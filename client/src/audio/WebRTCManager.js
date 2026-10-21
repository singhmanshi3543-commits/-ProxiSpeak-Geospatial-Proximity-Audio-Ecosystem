
import spatialMixerInstance from './SpatialAudioMixer.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VAD_INTERVAL_MS = 80;
const SPEAKING_THRESHOLD = 14;

export class WebRTCManager {
  constructor(socket, currentUserId) {
    this.socket = socket;
    this.currentUserId = currentUserId;

    this.localStream = null;
    this.peerConnections = new Map();
    this.pendingIceCandidates = new Map();

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

    this.micStatus = 'requesting';
    this.currentVolume = 0;

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
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('WebRTCManager was destroyed during initialization.');
      }

      this.micStatus = 'active';
      console.log('[WebRTC] Microphone stream initialized.');
    } catch (error) {
      if (this.isDestroyed) throw error;

      console.warn(
        '[WebRTC] Microphone unavailable. Using synthetic audio:',
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
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('WebRTCManager was destroyed during initialization.');
    }

    this.localStream = stream;

    if (this.isMicMuted) {
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    }

    this.notifyStatus();
    this.setupVoiceActivityDetection();

    return stream;
  }

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

  createPeerConnection(peerId) {
    if (this.isDestroyed) {
      throw new Error('WebRTCManager has been destroyed.');
    }

    const existing = this.peerConnections.get(peerId);
    if (existing) return existing;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    this.localStream?.getAudioTracks().forEach((track) => {
      pc.addTrack(track, this.localStream);
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      this.socket?.emit('webrtc-ice-candidate', {
        targetUserId: peerId,
        candidate: event.candidate,
      });
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        spatialMixerInstance.addPeerStream(peerId, event.streams[0]);
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

    return pc;
  }

  async handlePeerEnteredEarshot(peer, shouldInitiateOffer) {
    if (this.isDestroyed || !peer?.userId) return;

    const peerId = peer.userId;
    if (this.peerConnections.has(peerId)) return;

    let pc;

    try {
      pc = this.createPeerConnection(peerId);

      if (!shouldInitiateOffer) return;

      const offer = await pc.createOffer();

      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc
      ) {
        return;
      }

      await pc.setLocalDescription(offer);

      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc
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

  async handleOffer(fromUserId, sdp) {
    if (this.isDestroyed || !fromUserId || !sdp) return;

    let pc;

    try {
      pc = this.createPeerConnection(fromUserId);

      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.flushPendingIceCandidates(fromUserId, pc);

      if (
        this.isDestroyed ||
        this.peerConnections.get(fromUserId) !== pc
      ) {
        return;
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (
        this.isDestroyed ||
        this.peerConnections.get(fromUserId) !== pc
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

  async handleAnswer(fromUserId, sdp) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc || !sdp || this.isDestroyed) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await this.flushPendingIceCandidates(fromUserId, pc);
    } catch (error) {
      console.error(`[WebRTC] Error setting remote answer from ${fromUserId}:`, error);
      this.handlePeerLeftEarshot(fromUserId);
    }
  }

  async handleIceCandidate(fromUserId, candidate) {
    if (!candidate || this.isDestroyed) return;

    const pc = this.peerConnections.get(fromUserId);

    if (!pc || !pc.remoteDescription) {
      const pending = this.pendingIceCandidates.get(fromUserId) || [];
      pending.push(candidate);
      this.pendingIceCandidates.set(fromUserId, pending);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error(`[WebRTC] Error adding ICE candidate from ${fromUserId}:`, error);
    }
  }

  async flushPendingIceCandidates(peerId, pc) {
    if (!pc.remoteDescription) return;

    const pending = this.pendingIceCandidates.get(peerId);
    if (!pending?.length) return;

    this.pendingIceCandidates.delete(peerId);

    for (const candidate of pending) {
      if (
        this.isDestroyed ||
        this.peerConnections.get(peerId) !== pc
      ) {
        return;
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error(`[WebRTC] Error adding queued ICE candidate from ${peerId}:`, error);
      }
    }
  }

  handlePeerLeftEarshot(peerId) {
    const pc = this.peerConnections.get(peerId);

    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();

      this.peerConnections.delete(peerId);
    }

    this.pendingIceCandidates.delete(peerId);
    spatialMixerInstance.removePeerStream(peerId);
  }

  destroy() {
    if (this.isDestroyed) return;

    this.isDestroyed = true;
    this.stopVoiceActivityDetection();

    this.peerConnections.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });

    this.peerConnections.clear();
    this.pendingIceCandidates.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
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
