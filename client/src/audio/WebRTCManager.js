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

  // --- Helper Methods ---

  _notifyListeners(listeners, value) {
    listeners.forEach((callback) => {
      try {
        callback(value);
      } catch (error) {
        console.error('[WebRTC] Listener callback failed:', error);
      }
    });
  }

  _isConnectionActive(pc) {
    return Boolean(
      pc &&
      pc.signalingState !== 'closed' &&
      pc.connectionState !== 'closed' &&
      pc.connectionState !== 'failed' &&
      pc.iceConnectionState !== 'closed' &&
      pc.iceConnectionState !== 'failed'
    );
  }

  _closePeerConnection(pc) {
    if (!pc) return;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.oniceconnectionstatechange = null;
    pc.onsignalingstatechange = null;

    try {
      pc.getReceivers?.().forEach((receiver) => {
        try {
          receiver.track?.stop?.();
        } catch (e) {}
      });
    } catch (error) {
      console.warn('[WebRTC] Error stopping receiver tracks:', error);
    }

    try {
      pc.getSenders?.().forEach((sender) => {
        try {
          pc.removeTrack?.(sender);
        } catch (e) {}
      });
    } catch (error) {}

    try {
      pc.close();
    } catch (error) {
      console.warn('[WebRTC] Error closing peer connection:', error);
    }
  }

  _stopMediaStream(stream) {
    if (!stream?.getTracks) return;
    try {
      stream.getTracks().forEach((track) => track.stop?.());
    } catch (error) {
      console.warn('[WebRTC] Error stopping stream tracks:', error);
    }
  }

  _cleanupSyntheticNodes() {
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
  }

  async _addIceCandidate(pc, candidate, peerId) {
    try {
      if (!this._isConnectionActive(pc) || !pc.remoteDescription) return;
      const iceCandidate = candidate instanceof RTCIceCandidate ? candidate : new RTCIceCandidate(candidate);
      await pc.addIceCandidate(iceCandidate);
    } catch (error) {
      console.warn(`[WebRTC] Non-fatal error adding ICE candidate from ${peerId}:`, error.message);
    }
  }

  // --- Public Listener Subscriptions ---

  onVolumeUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    this.volumeListeners.add(callback);
    return () => this.volumeListeners.delete(callback);
  }

  onStatusUpdate(callback) {
    if (typeof callback !== 'function') return () => {};
    this.statusListeners.add(callback);
    try {
      callback(this.micStatus);
    } catch (error) {
      console.error('[WebRTC] Status initial callback failed:', error);
    }
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus() {
    this._notifyListeners(this.statusListeners, this.micStatus);
  }

  notifyVolume(value) {
    this._notifyListeners(this.volumeListeners, value);
  }

  // --- Stream & Mic Management ---

  async initLocalStream(useFallbackSynth = false) {
    if (this.isDestroyed) {
      throw new Error('WebRTCManager has been destroyed.');
    }

    if (this.localStream && this.localStream.getAudioTracks().some((t) => t.readyState === 'live')) {
      return this.localStream;
    }

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

    this._cleanupSyntheticNodes();

    try {
      if (useFallbackSynth || !navigator.mediaDevices?.getUserMedia) {
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
        this._stopMediaStream(stream);
        throw new Error('WebRTCManager was destroyed during initialization.');
      }

      this.micStatus = 'active';
      console.log('[WebRTC] Microphone stream initialized.');
    } catch (error) {
      if (this.isDestroyed) throw error;

      console.warn('[WebRTC] Microphone unavailable. Using synthetic audio fallback:', error.message);

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
      this._stopMediaStream(stream);
      this._cleanupSyntheticNodes();
      throw new Error('WebRTCManager was destroyed during initialization.');
    }

    if (this.localStream && this.localStream !== stream) {
      this._stopMediaStream(this.localStream);
    }

    this.localStream = stream;

    if (this.isMicMuted) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    this.peerConnections.forEach((pc) => {
      this._attachLocalTracksToPeer(pc);
    });

    this.notifyStatus();
    this.setupVoiceActivityDetection();

    return stream;
  }

  _attachLocalTracksToPeer(pc) {
    if (!this.localStream || !this._isConnectionActive(pc)) return;

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

  // --- Voice Activity Detection ---

  setupVoiceActivityDetection() {
    this.stopVoiceActivityDetection();

    if (this.isDestroyed || !this.localStream?.getAudioTracks().length) return;

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
          this.stopVoiceActivityDetection();
          return;
        }

        if (this.isMicMuted) {
          if (this.currentVolume !== 0) {
            this.currentVolume = 0;
            this.notifyVolume(0);
          }
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

        if (this.currentVolume !== volume) {
          this.currentVolume = volume;
          this.notifyVolume(volume);
        }
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

    if (this.audioAnalyser) {
      try {
        this.audioAnalyser.disconnect();
      } catch (error) {}
      this.audioAnalyser = null;
    }

    this.audioData = null;
  }

  updateSpeakingStatus(speaking) {
    if (this.isSpeaking === speaking) return;
    this.isSpeaking = speaking;
    this.emitSpeakingStatus(speaking);
  }

  emitSpeakingStatus(speaking) {
    if (this.isDestroyed) return;
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

    if (this.isMicMuted) {
      this.micStatus = 'muted';
      this.currentVolume = 0;
      this.notifyVolume(0);
    } else {
      this.micStatus = this.syntheticOscillator
        ? 'synthetic'
        : this.localStream
          ? 'active'
          : 'requesting';
    }

    this.notifyStatus();
    this.isSpeaking = false;
    this.emitSpeakingStatus(false);

    return !this.isMicMuted;
  }

  toggleLoopback() {
    if (this.isDestroyed) return false;
    return spatialMixerInstance.toggleMicLoopback(this.localStream);
  }

  // --- Peer Connection Lifecycles ---

  createPeerConnection(peerId) {
    if (this.isDestroyed) {
      throw new Error('WebRTCManager has been destroyed.');
    }

    if (!peerId || peerId === this.currentUserId) {
      return null;
    }

    const existing = this.peerConnections.get(peerId);
    if (existing) {
      if (this._isConnectionActive(existing)) {
        return existing;
      }
      this.handlePeerLeftEarshot(peerId);
    }

    this.pendingIceCandidates.delete(peerId);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    this._attachLocalTracksToPeer(pc);

    pc.onicecandidate = (event) => {
      if (!event.candidate || this.isDestroyed || this.peerConnections.get(peerId) !== pc) return;

      this.socket?.emit('webrtc-ice-candidate', {
        targetUserId: peerId,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      if (this.isDestroyed || this.peerConnections.get(peerId) !== pc) return;

      let stream = event.streams?.[0];
      if (!stream && event.track) {
        stream = new MediaStream([event.track]);
      }
      if (stream) {
        spatialMixerInstance.addPeerStream(peerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.peerConnections.get(peerId) !== pc) return;
      console.log(`[WebRTC] Connection state for ${peerId}:`, pc.connectionState);

      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.handlePeerLeftEarshot(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.peerConnections.get(peerId) !== pc) return;
      console.log(`[WebRTC] ICE connection state for ${peerId}:`, pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
        this.handlePeerLeftEarshot(peerId);
      }
    };

    return pc;
  }

  async handlePeerEnteredEarshot(peer, shouldInitiateOffer) {
    if (this.isDestroyed || !peer?.userId || peer.userId === this.currentUserId) return;

    const peerId = peer.userId;

    // Fast check: If active connection already exists for this peer, prevent duplicate
    const activePc = this.peerConnections.get(peerId);
    if (activePc && this._isConnectionActive(activePc)) {
      return;
    }

    if (!this.localStream) {
      try {
        await this.initLocalStream();
      } catch (err) {}
    }

    if (this.isDestroyed) return;

    const existingPc = this.peerConnections.get(peerId);
    if (existingPc) {
      if (!this._isConnectionActive(existingPc)) {
        this.handlePeerLeftEarshot(peerId);
      } else {
        return;
      }
    }

    let pc;
    try {
      pc = this.createPeerConnection(peerId);
      if (!pc || !shouldInitiateOffer) return;

      if (pc.signalingState !== 'stable') {
        return;
      }

      const offer = await pc.createOffer();

      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc ||
        pc.signalingState !== 'stable'
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
      if (this.peerConnections.get(peerId) === pc && !this._isConnectionActive(pc)) {
        this.handlePeerLeftEarshot(peerId);
      }
    }
  }

  async handleOffer(fromUserId, sdp) {
    if (this.isDestroyed || !fromUserId || !sdp || fromUserId === this.currentUserId) return;

    if (!this.localStream) {
      try {
        await this.initLocalStream();
      } catch (err) {}
    }

    if (this.isDestroyed) return;

    let pc = this.peerConnections.get(fromUserId);
    if (pc && !this._isConnectionActive(pc)) {
      this.handlePeerLeftEarshot(fromUserId);
      pc = null;
    }

    try {
      if (!pc) {
        pc = this.createPeerConnection(fromUserId);
      }
      if (!pc) return;

      // Handle glare (both peers sent an offer simultaneously)
      if (pc.signalingState === 'have-local-offer') {
        const isPolite = String(this.currentUserId) > String(fromUserId);
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

      if (pc.signalingState !== 'stable') {
        console.warn(`[WebRTC] Cannot process offer from ${fromUserId}: unexpected signalingState '${pc.signalingState}'`);
        return;
      }

      const remoteDesc = sdp instanceof RTCSessionDescription ? sdp : new RTCSessionDescription(sdp);
      await pc.setRemoteDescription(remoteDesc);
      await this.flushPendingIceCandidates(fromUserId, pc);

      if (
        this.isDestroyed ||
        this.peerConnections.get(fromUserId) !== pc ||
        pc.signalingState !== 'have-remote-offer'
      ) {
        return;
      }

      const answer = await pc.createAnswer();

      if (
        this.isDestroyed ||
        this.peerConnections.get(fromUserId) !== pc ||
        pc.signalingState !== 'have-remote-offer'
      ) {
        return;
      }

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
      if (this.peerConnections.get(fromUserId) === pc && !this._isConnectionActive(pc)) {
        this.handlePeerLeftEarshot(fromUserId);
      }
    }
  }

  async handleAnswer(fromUserId, sdp) {
    if (this.isDestroyed || !fromUserId || !sdp || fromUserId === this.currentUserId) return;

    const pc = this.peerConnections.get(fromUserId);
    if (!pc || !this._isConnectionActive(pc)) return;

    if (pc.signalingState !== 'have-local-offer') {
      console.warn(
        `[WebRTC] Ignoring answer from ${fromUserId}: signalingState is '${pc.signalingState}' (expected 'have-local-offer')`
      );
      return;
    }

    try {
      const remoteDesc = sdp instanceof RTCSessionDescription ? sdp : new RTCSessionDescription(sdp);
      await pc.setRemoteDescription(remoteDesc);
      await this.flushPendingIceCandidates(fromUserId, pc);
    } catch (error) {
      console.error(`[WebRTC] Error setting remote answer from ${fromUserId}:`, error);
      if (this.peerConnections.get(fromUserId) === pc && !this._isConnectionActive(pc)) {
        this.handlePeerLeftEarshot(fromUserId);
      }
    }
  }

  async handleIceCandidate(fromUserId, candidate) {
    if (!candidate || this.isDestroyed || !fromUserId || fromUserId === this.currentUserId) return;

    const pc = this.peerConnections.get(fromUserId);

    // If connection exists but is dead (closed/failed), drop candidate
    if (pc && !this._isConnectionActive(pc)) return;

    // Queue candidate safely if peer connection or remote description has not been established yet
    if (!pc || !pc.remoteDescription) {
      const queue = this.pendingIceCandidates.get(fromUserId) || [];
      const candidateStr = typeof candidate === 'string' ? candidate : candidate?.candidate || '';
      const isDuplicate = candidateStr && queue.some(
        (c) => (typeof c === 'string' ? c : c?.candidate || '') === candidateStr
      );

      if (!isDuplicate && queue.length < MAX_PENDING_ICE_CANDIDATES) {
        queue.push(candidate);
        this.pendingIceCandidates.set(fromUserId, queue);
      }
      return;
    }

    await this._addIceCandidate(pc, candidate, fromUserId);
  }

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

      await this._addIceCandidate(pc, candidate, peerId);
    }
  }

  handlePeerLeftEarshot(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      this._closePeerConnection(pc);
      this.peerConnections.delete(peerId);
    }

    this.pendingIceCandidates.delete(peerId);
    try {
      spatialMixerInstance.removePeerStream(peerId);
    } catch (error) {
      console.warn(`[WebRTC] Error removing peer stream for ${peerId}:`, error);
    }
  }

  getPeerConnection(peerId) {
    return this.peerConnections.get(peerId);
  }

  hasPeerConnection(peerId) {
    const pc = this.peerConnections.get(peerId);
    return this._isConnectionActive(pc);
  }

  getActivePeerIds() {
    return Array.from(this.peerConnections.entries())
      .filter(([_, pc]) => this._isConnectionActive(pc))
      .map(([peerId]) => peerId);
  }

  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.stopVoiceActivityDetection();

    this.peerConnections.forEach((pc, peerId) => {
      this._closePeerConnection(pc);
      spatialMixerInstance.removePeerStream(peerId);
    });

    this.peerConnections.clear();
    this.pendingIceCandidates.clear();

    if (this.localStream) {
      this._stopMediaStream(this.localStream);
      this.localStream = null;
    }

    this._cleanupSyntheticNodes();

    this.isSpeaking = false;
    this.currentVolume = 0;
    this.notifyVolume(0);

    this.volumeListeners.clear();
    this.statusListeners.clear();
  }
}

export default WebRTCManager;
