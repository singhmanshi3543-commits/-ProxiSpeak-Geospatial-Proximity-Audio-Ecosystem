import spatialMixerInstance from './SpatialAudioMixer.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VAD_INTERVAL_MS = 80;
const SPEAKING_THRESHOLD = 14;
const MAX_PENDING_ICE_CANDIDATES = 50;

/**
 * WebRTC Mesh Manager for ProxiSpeak
 * Handles peer-connection lifecycles, dynamic mesh audio handshakes within proximity,
 * glare-free negotiation, stale candidate filtering, and Voice Activity Detection (VAD).
 */
export class WebRTCManager {
  constructor(socket, currentUserId) {
    this.socket = socket;
    this.currentUserId = currentUserId;

    this.localStream = null;
    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.pendingIceCandidates = new Map(); // peerId -> Array<RTCIceCandidateInit>

    this.audioAnalyser = null;
    this.audioSource = null;
    this.audioData = null;
    this.syntheticOscillator = null;
    this.syntheticGain = null;

    this.isSpeaking = false;
    this.isMicMuted = false;
    this.isDestroyed = false;
    this.vadInterval = null;
    this.initPromise = null;

    this.micStatus = 'requesting'; // 'active' | 'muted' | 'synthetic' | 'blocked'
    this.currentVolume = 0; // 0..100

    this.volumeListeners = new Set();
    this.statusListeners = new Set();
  }

  onVolumeUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    this.volumeListeners.add(callback);
    return () => this.volumeListeners.delete(callback);
  }

  onStatusUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    this.statusListeners.add(callback);
    callback(this.micStatus);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus() {
    this.statusListeners.forEach((callback) => {
      try {
        callback(this.micStatus);
      } catch (error) {
        console.error('[WebRTC] Status listener failed:', error);
      }
    });
  }

  notifyVolume(value) {
    this.volumeListeners.forEach((callback) => {
      try {
        callback(value);
      } catch (error) {
        console.error('[WebRTC] Volume listener failed:', error);
      }
    });
  }

  /**
   * Request user microphone stream or fallback to synthetic audio
   */
  async initLocalStream(useFallbackSynth = false) {
    if (this.isDestroyed) {
      throw new Error('WebRTCManager has been destroyed.');
    }

    if (this.localStream) return this.localStream;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._initializeLocalStream(useFallbackSynth);

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async _initializeLocalStream(useFallbackSynth) {
    let stream;

    try {
      if (
        useFallbackSynth ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error('Microphone unavailable or fallback requested.');
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      if (this.isDestroyed) {
        stream?.getTracks?.().forEach((track) => track.stop?.());
        throw new Error('WebRTCManager was destroyed during initialization.');
      }

      this.micStatus = 'active';
      console.log('[WebRTC] Microphone stream initialized.');
    } catch (error) {
      if (this.isDestroyed) throw error;

      console.warn(
        '[WebRTC] Microphone unavailable. Using synthetic audio fallback:',
        error.message
      );

      try {
        const audioContext = spatialMixerInstance.ensureAudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const destination = audioContext.createMediaStreamDestination();

        gain.gain.value = 0.0001;
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();

        stream = destination.stream;
        this.syntheticOscillator = oscillator;
        this.syntheticGain = gain;
        this.micStatus = 'synthetic';
      } catch (fallbackError) {
        this.micStatus = 'blocked';
        this.notifyStatus();
        throw fallbackError;
      }
    }

    if (this.isDestroyed) {
      stream?.getTracks?.().forEach((track) => track.stop?.());
      throw new Error('WebRTCManager was destroyed during initialization.');
    }

    this.localStream = stream;

    if (this.isMicMuted) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    // Attach local stream tracks to any existing peer connections created prior to mic resolution
    this.peerConnections.forEach((pc) => {
      this._attachLocalTracksToPeer(pc);
    });

    this.notifyStatus();
    this.setupVoiceActivityDetection();

    return stream;
  }

  /**
   * Safely attach local audio tracks to a peer connection if not already present
   */
  _attachLocalTracksToPeer(pc) {
    if (!this.localStream || pc.signalingState === 'closed') return;

    const tracks = this.localStream.getAudioTracks();
    if (!tracks.length) return;

    const currentSenders = pc.getSenders();
    tracks.forEach((track) => {
      const alreadyAdded = currentSenders.some((sender) => sender.track === track);
      if (!alreadyAdded) {
        try {
          pc.addTrack(track, this.localStream);
        } catch (error) {
          console.warn('[WebRTC] Failed to attach audio track to peer connection:', error);
        }
      }
    });
  }

  /**
   * Voice Activity Detection (VAD) & Live VU Meter
   */
  setupVoiceActivityDetection() {
    this.stopVoiceActivityDetection();

    if (!this.localStream?.getAudioTracks().length) return;

    try {
      const audioContext = spatialMixerInstance.ensureAudioContext();

      this.audioSource = audioContext.createMediaStreamSource(this.localStream);
      this.audioAnalyser = audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      this.audioAnalyser.smoothingTimeConstant = 0.4;
      this.audioSource.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      this.audioData = new Uint8Array(bufferLength);

      this.vadInterval = setInterval(() => {
        if (this.isDestroyed || !this.audioAnalyser || !this.audioData) {
          return;
        }

        if (this.isMicMuted) {
          this.currentVolume = 0;
          this.notifyVolume(0);
          this.updateSpeakingStatus(false);
          return;
        }

        this.audioAnalyser.getByteFrequencyData(this.audioData);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += this.audioData[i];
        }

        const average = sum / bufferLength;
        const volume = Math.min(100, Math.round((average / 128) * 100));

        this.currentVolume = volume;
        this.notifyVolume(volume);
        this.updateSpeakingStatus(volume > SPEAKING_THRESHOLD);
      }, VAD_INTERVAL_MS);
    } catch (error) {
      console.error('[WebRTC] Could not initialize voice activity detection:', error);
      this.stopVoiceActivityDetection();
    }
  }

  stopVoiceActivityDetection() {
    if (this.vadInterval !== null) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    if (this.audioSource) {
      try {
        this.audioSource.disconnect();
      } catch (error) {
        console.warn('[WebRTC] Audio source disconnect failed:', error);
      }
      this.audioSource = null;
    }

    this.audioAnalyser = null;
    this.audioData = null;
  }

  updateSpeakingStatus(speaking) {
    if (this.isSpeaking === speaking) return;
    this.isSpeaking = speaking;
    this.emitSpeakingStatus(speaking);
  }

  emitSpeakingStatus(speaking) {
    this.socket?.emit('voice-status-change', {
      userId: this.currentUserId,
      isSpeaking: speaking,
      isMuted: this.isMicMuted,
    });
  }

  toggleMicrophone() {
    if (this.isDestroyed) return false;

    spatialMixerInstance.resume();
    this.isMicMuted = !this.isMicMuted;

    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMicMuted;
    });

    this.micStatus = this.isMicMuted
      ? 'muted'
      : this.localStream
        ? this.localStream.getAudioTracks().length > 0
          ? 'active'
          : 'synthetic'
        : 'requesting';

    if (this.isMicMuted) {
      this.currentVolume = 0;
      this.notifyVolume(0);
    }

    this.notifyStatus();
    this.updateSpeakingStatus(false);
    this.emitSpeakingStatus(false);

    return !this.isMicMuted;
  }

  toggleLoopback() {
    if (this.isDestroyed) return false;
    return spatialMixerInstance.toggleMicLoopback(this.localStream);
  }

  /**
   * Create or return an existing active RTCPeerConnection for the given peer.
   * If an existing connection is dead or failed, tears it down first.
   */
  createPeerConnection(peerId) {
    if (this.isDestroyed) {
      throw new Error('WebRTCManager has been destroyed.');
    }

    const existing = this.peerConnections.get(peerId);
    if (existing) {
      if (
        existing.connectionState !== 'closed' &&
        existing.connectionState !== 'failed' &&
        existing.signalingState !== 'closed'
      ) {
        return existing;
      }
      this.handlePeerLeftEarshot(peerId);
    }

    // Ensure stale queued candidates are discarded for a new connection
    this.pendingIceCandidates.delete(peerId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    // Attach local audio tracks
    this._attachLocalTracksToPeer(pc);

    pc.onicecandidate = (event) => {
      if (!event.candidate || this.isDestroyed) return;

      this.socket?.emit('webrtc-ice-candidate', {
        targetUserId: peerId,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      let stream = event.streams?.[0];
      if (!stream && event.track) {
        stream = new MediaStream([event.track]);
      }
      if (stream) {
        spatialMixerInstance.addPeerStream(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state for ${peerId}:`, pc.connectionState);

      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        this.handlePeerLeftEarshot(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE connection state for ${peerId}:`, pc.iceConnectionState);

      if (
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'closed'
      ) {
        this.handlePeerLeftEarshot(peerId);
      }
    };

    return pc;
  }

  /**
   * Dynamic WebRTC Peer Handshake when peer enters 100px proximity earshot.
   * Prevents duplicate peer connections and ensures local audio stream readiness.
   */
  async handlePeerEnteredEarshot(peer, shouldInitiateOffer) {
    if (this.isDestroyed || !peer?.userId) return;

    const peerId = peer.userId;

    // Await ongoing local stream initialization so initial offer/connection includes audio
    if (!this.localStream && this.initPromise) {
      try {
        await this.initPromise;
      } catch (err) {
        // Fallback or error handled in initPromise
      }
    }

    if (this.isDestroyed) return;

    const existingPc = this.peerConnections.get(peerId);
    if (existingPc) {
      if (
        existingPc.connectionState === 'closed' ||
        existingPc.connectionState === 'failed' ||
        existingPc.signalingState === 'closed'
      ) {
        this.handlePeerLeftEarshot(peerId);
      } else {
        // Active healthy connection already exists; prevent duplicate handshake
        return;
      }
    }

    let pc;

    try {
      pc = this.createPeerConnection(peerId);

      if (!shouldInitiateOffer) return;

      const offer = await pc.createOffer();

      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc ||
        pc.signalingState === 'closed'
      ) {
        return;
      }

      await pc.setLocalDescription(offer);

      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc ||
        pc.signalingState === 'closed'
      ) {
        return;
      }

      this.socket?.emit('webrtc-offer', {
        targetUserId: peerId,
        sdp: pc.localDescription,
      });
    } catch (error) {
      console.error(`[WebRTC] Failed to create offer for ${peerId}:`, error);
      this.handlePeerLeftEarshot(peerId);
    }
  }

  /**
   * Handle incoming WebRTC Offer.
   * Implements polite peer glare resolution and flushes queued ICE candidates safely.
   */
  async handleOffer(fromUserId, sdp) {
    if (this.isDestroyed || !fromUserId || !sdp) return;

    if (!this.localStream && this.initPromise) {
      try {
        await this.initPromise;
      } catch (err) {}
    }

    if (this.isDestroyed) return;

    let pc = this.peerConnections.get(fromUserId);
    if (
      pc &&
      (pc.connectionState === 'closed' ||
        pc.connectionState === 'failed' ||
        pc.signalingState === 'closed')
    ) {
      this.handlePeerLeftEarshot(fromUserId);
      pc = null;
    }

    try {
      if (!pc) {
        pc = this.createPeerConnection(fromUserId);
      }

      // Handle glare (both peers sent an offer simultaneously)
      if (pc.signalingState === 'have-local-offer') {
        const isPolite = this.currentUserId > fromUserId;
        if (!isPolite) {
          console.warn(`[WebRTC] Glare with ${fromUserId}: impolite peer ignoring incoming offer.`);
          return;
        }
        console.log(`[WebRTC] Glare with ${fromUserId}: polite peer rolling back local offer.`);
        await pc.setLocalDescription({ type: 'rollback' });
      } else if (pc.signalingState === 'have-remote-offer') {
        console.warn(`[WebRTC] Duplicate remote offer from ${fromUserId} ignored.`);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.flushPendingIceCandidates(fromUserId, pc);

      if (
        this.isDestroyed ||
        this.peerConnections.get(fromUserId) !== pc ||
        pc.signalingState === 'closed'
      ) {
        return;
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (
        this.isDestroyed ||
        this.peerConnections.get(fromUserId) !== pc ||
        pc.signalingState === 'closed'
      ) {
        return;
      }

      this.socket?.emit('webrtc-answer', {
        targetUserId: fromUserId,
        sdp: pc.localDescription,
      });
    } catch (error) {
      console.error(`[WebRTC] Error handling offer from ${fromUserId}:`, error);
      this.handlePeerLeftEarshot(fromUserId);
    }
  }

  /**
   * Handle incoming WebRTC Answer.
   * Safely ignores duplicate or out-of-order answers without tearing down connection.
   */
  async handleAnswer(fromUserId, sdp) {
    if (this.isDestroyed || !fromUserId || !sdp) return;

    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;

    if (pc.signalingState !== 'have-local-offer') {
      console.warn(
        `[WebRTC] Ignoring answer from ${fromUserId}: signalingState is '${pc.signalingState}' (expected 'have-local-offer')`
      );
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.flushPendingIceCandidates(fromUserId, pc);
    } catch (error) {
      console.error(`[WebRTC] Error setting remote answer from ${fromUserId}:`, error);
      this.handlePeerLeftEarshot(fromUserId);
    }
  }

  /**
   * Handle incoming ICE Candidate.
   * Discards stale candidates for disconnected/out-of-proximity peers.
   */
  async handleIceCandidate(fromUserId, candidate) {
    if (!candidate || this.isDestroyed || !fromUserId) return;

    const pc = this.peerConnections.get(fromUserId);

    // Drop stale candidate if no active connection exists for this peer
    if (
      !pc ||
      pc.signalingState === 'closed' ||
      pc.connectionState === 'closed' ||
      pc.connectionState === 'failed'
    ) {
      return;
    }

    // If remote description is not set yet, queue the candidate safely
    if (!pc.remoteDescription) {
      const queue = this.pendingIceCandidates.get(fromUserId) || [];
      const candidateStr = typeof candidate === 'string' ? candidate : candidate.candidate;
      const isDuplicate = queue.some(
        (c) => (typeof c === 'string' ? c : c.candidate) === candidateStr
      );

      if (!isDuplicate && queue.length < MAX_PENDING_ICE_CANDIDATES) {
        queue.push(candidate);
        this.pendingIceCandidates.set(fromUserId, queue);
      }
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.warn(`[WebRTC] Non-fatal error adding ICE candidate from ${fromUserId}:`, error.message);
    }
  }

  /**
   * Safely flush queued ICE candidates once remote description is established
   */
  async flushPendingIceCandidates(peerId, pc) {
    if (!pc || !pc.remoteDescription || pc.signalingState === 'closed') return;

    const pending = this.pendingIceCandidates.get(peerId);
    if (!pending?.length) return;

    this.pendingIceCandidates.delete(peerId);

    for (const candidate of pending) {
      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc ||
        pc.signalingState === 'closed'
      ) {
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn(`[WebRTC] Non-fatal error adding queued ICE candidate from ${peerId}:`, error.message);
      }
    }
  }

  /**
   * Teardown connection and release spatial audio resources when peer leaves proximity
   */
  handlePeerLeftEarshot(peerId) {
    const pc = this.peerConnections.get(peerId);

    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onsignalingstatechange = null;

      try {
        pc.close();
      } catch (error) {
        console.warn(`[WebRTC] Error closing peer connection for ${peerId}:`, error);
      }

      this.peerConnections.delete(peerId);
    }

    // Always clear queued candidates so they never bleed into future sessions
    this.pendingIceCandidates.delete(peerId);

    // Clean up Web Audio nodes for this peer
    spatialMixerInstance.removePeerStream(peerId);
  }

  getPeerConnection(peerId) {
    return this.peerConnections.get(peerId);
  }

  hasPeerConnection(peerId) {
    return this.peerConnections.has(peerId);
  }

  getActivePeerIds() {
    return Array.from(this.peerConnections.keys());
  }

  /**
   * Complete destruction and cleanup of all WebRTC connections, audio tracks, and VAD
   */
  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.stopVoiceActivityDetection();

    this.peerConnections.forEach((pc, peerId) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onsignalingstatechange = null;

      try {
        pc.close();
      } catch (error) {}

      spatialMixerInstance.removePeerStream(peerId);
    });

    this.peerConnections.clear();
    this.pendingIceCandidates.clear();

    if (this.localStream) {
      this.localStream?.getTracks?.().forEach((track) => track.stop?.());
      this.localStream = null;
    }

    if (this.syntheticOscillator) {
      try {
        this.syntheticOscillator.stop();
        this.syntheticOscillator.disconnect();
      } catch (error) {
        console.warn('[WebRTC] Synthetic oscillator cleanup failed:', error);
      }
      this.syntheticOscillator = null;
    }

    if (this.syntheticGain) {
      try {
        this.syntheticGain.disconnect();
      } catch (error) {
        console.warn('[WebRTC] Synthetic gain cleanup failed:', error);
      }
      this.syntheticGain = null;
    }

    this.isSpeaking = false;
    this.currentVolume = 0;
    this.notifyVolume(0);

    this.volumeListeners.clear();
    this.statusListeners.clear();
  }
}

export default WebRTCManager;
