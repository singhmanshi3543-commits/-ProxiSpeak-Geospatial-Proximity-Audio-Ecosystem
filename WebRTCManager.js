import spatialMixerInstance from './SpatialAudioMixer.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  constructor(socket, currentUserId) {
    this.socket = socket;
    this.currentUserId = currentUserId;
    this.localStream = null;
    this.peerConnections = new Map(); // peerId -> RTCPeerConnection
    this.audioAnalyser = null;
    this.isSpeaking = false;
    this.isMicMuted = false;
    this.vadInterval = null;
    this.micStatus = 'requesting'; // 'active' | 'muted' | 'synthetic' | 'blocked'
    this.currentVolume = 0; // 0..100
    this.volumeListeners = new Set();
    this.statusListeners = new Set();
  }

  onVolumeUpdate(callback) {
    this.volumeListeners.add(callback);
    return () => this.volumeListeners.delete(callback);
  }

  onStatusUpdate(callback) {
    this.statusListeners.add(callback);
    callback(this.micStatus);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus() {
    this.statusListeners.forEach((cb) => {
      try { cb(this.micStatus); } catch (e) {}
    });
  }

  /**
   * Request user microphone stream and initialize Voice Activity Detection (VAD)
   */
  async initLocalStream(useFallbackSynth = false) {
    try {
      if (!useFallbackSynth && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.micStatus = 'active';
        console.log('[WebRTC] Microphone stream captured successfully.');
      } else {
        throw new Error('Fallback synthetic stream requested');
      }
    } catch (err) {
      console.warn('[WebRTC] Microphone access not granted or unavailable. Utilizing synthetic audio track:', err.message);
      this.micStatus = 'synthetic';
      const ctx = spatialMixerInstance.ensureAudioContext();
      const osc = ctx.createOscillator();
      const dst = ctx.createMediaStreamDestination();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      this.localStream = dst.stream;
    }

    this.notifyStatus();
    this.setupVoiceActivityDetection();
    return this.localStream;
  }

  /**
   * Voice Activity Detection (VAD) & Live VU Meter
   */
  setupVoiceActivityDetection() {
    if (!this.localStream || this.localStream.getAudioTracks().length === 0) return;

    try {
      const audioCtx = spatialMixerInstance.ensureAudioContext();
      const source = audioCtx.createMediaStreamSource(this.localStream);
      this.audioAnalyser = audioCtx.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      this.audioAnalyser.smoothingTimeConstant = 0.4;
      source.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      this.vadInterval = setInterval(() => {
        if (this.isMicMuted) {
          this.currentVolume = 0;
          this.notifyVolume(0);
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.emitSpeakingStatus(false);
          }
          return;
        }

        this.audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        // Normalized volume level 0..100
        const volumeLevel = Math.min(100, Math.round((average / 128) * 100));
        this.currentVolume = volumeLevel;
        this.notifyVolume(volumeLevel);

        const speakingNow = volumeLevel > 14;
        if (speakingNow !== this.isSpeaking) {
          this.isSpeaking = speakingNow;
          this.emitSpeakingStatus(speakingNow);
        }
      }, 80);
    } catch (err) {
      console.warn('[WebRTC] Could not initialize VAD analyser:', err);
    }
  }

  notifyVolume(val) {
    this.volumeListeners.forEach((cb) => {
      try { cb(val); } catch (e) {}
    });
  }

  emitSpeakingStatus(speaking) {
    if (this.socket) {
      this.socket.emit('voice-status-change', {
        userId: this.currentUserId,
        isSpeaking: speaking,
        isMuted: this.isMicMuted,
      });
    }
  }

  toggleMicrophone() {
    spatialMixerInstance.resume();
    this.isMicMuted = !this.isMicMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMicMuted;
      });
    }
    this.micStatus = this.isMicMuted ? 'muted' : this.localStream ? 'active' : 'synthetic';
    this.notifyStatus();
    this.emitSpeakingStatus(false);
    return !this.isMicMuted;
  }

  toggleLoopback() {
    return spatialMixerInstance.toggleMicLoopback(this.localStream);
  }

  /**
   * Dynamic WebRTC Peer Handshake when peer enters 100px earshot
   */
  async handlePeerEnteredEarshot(peer, shouldInitiateOffer) {
    const peerId = peer.userId;
    if (this.peerConnections.has(peerId)) {
      return;
    }

    console.log(`[WebRTC Mesh] Peer ${peerId} entered earshot. Creating connection (Initiator: ${shouldInitiateOffer})`);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnections.set(peerId, pc);

    // Attach local audio tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc-ice-candidate', {
          targetUserId: peerId,
          candidate: event.candidate,
        });
      }
    };

    // Remote audio track handler: send straight into SpatialAudioMixer!
    pc.ontrack = (event) => {
      console.log(`[WebRTC Mesh] Received audio track from peer ${peerId}`);
      if (event.streams && event.streams[0]) {
        spatialMixerInstance.addPeerStream(peerId, event.streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC Mesh] Connection state for ${peerId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.handlePeerLeftEarshot(peerId);
      }
    };

    // If designated as offer initiator
    if (shouldInitiateOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket.emit('webrtc-offer', {
          targetUserId: peerId,
          sdp: pc.localDescription,
        });
      } catch (err) {
        console.error(`[WebRTC] Failed to create offer for ${peerId}:`, err);
      }
    }
  }

  /**
   * Handle incoming WebRTC Offer
   */
  async handleOffer(fromUserId, sdp) {
    let pc = this.peerConnections.get(fromUserId);
    if (!pc) {
      pc = new RTCPeerConnection(RTC_CONFIG);
      this.peerConnections.set(fromUserId, pc);

      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          pc.addTrack(track, this.localStream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && this.socket) {
          this.socket.emit('webrtc-ice-candidate', {
            targetUserId: fromUserId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          spatialMixerInstance.addPeerStream(fromUserId, event.streams[0]);
        }
      };
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('webrtc-answer', {
        targetUserId: fromUserId,
        sdp: pc.localDescription,
      });
    } catch (err) {
      console.error(`[WebRTC] Error handling offer from ${fromUserId}:`, err);
    }
  }

  /**
   * Handle incoming WebRTC Answer
   */
  async handleAnswer(fromUserId, sdp) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error(`[WebRTC] Error setting remote answer from ${fromUserId}:`, err);
    }
  }

  /**
   * Handle incoming ICE Candidate
   */
  async handleIceCandidate(fromUserId, candidate) {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error(`[WebRTC] Error adding ICE candidate from ${fromUserId}:`, err);
    }
  }

  /**
   * Mesh Scaling teardown when peer leaves 100px earshot
   */
  handlePeerLeftEarshot(peerId) {
    console.log(`[WebRTC Mesh] Peer ${peerId} left earshot. Closing peer connection.`);
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    spatialMixerInstance.removePeerStream(peerId);
  }

  destroy() {
    if (this.vadInterval) clearInterval(this.vadInterval);
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
  }
}

export default WebRTCManager;
