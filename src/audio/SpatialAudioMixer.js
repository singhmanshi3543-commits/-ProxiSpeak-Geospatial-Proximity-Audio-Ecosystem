function checkLineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false;
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

function isRayOccludedByWalls(p1, p2, walls = []) {
  if (!walls || walls.length === 0) return false;
  const [x1, y1] = p1;
  const [x2, y2] = p2;

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const left = w.x;
    const right = w.x + w.w;
    const top = w.y;
    const bottom = w.y + w.h;

    if (
      checkLineIntersection(x1, y1, x2, y2, left, top, right, top) ||
      checkLineIntersection(x1, y1, x2, y2, right, top, right, bottom) ||
      checkLineIntersection(x1, y1, x2, y2, right, bottom, left, bottom) ||
      checkLineIntersection(x1, y1, x2, y2, left, bottom, left, top)
    ) {
      return true;
    }
  }
  return false;
}

export class SpatialAudioMixer {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.peerNodes = new Map();
    this.earshotRadius = 100;
    this.isMuted = false;
    this.isDeafened = false;
    this.masterVolume = 1.0;
    this.enable3DPanning = true;
    this.enableOcclusion = true;

    this.loopbackSource = null;
    this.loopbackGain = null;
    this.isLoopbackActive = false;

    this.stateListeners = new Set();
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      this.audioCtx.onstatechange = () => {
        this.notifyStateListeners();
      };
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => this.notifyStateListeners()).catch(() => {});
    }

    return this.audioCtx;
  }

  async resume() {
    this.ensureAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
      this.notifyStateListeners();
    }
    return this.audioCtx ? this.audioCtx.state : 'uninitialized';
  }

  getAudioState() {
    return this.audioCtx ? this.audioCtx.state : 'uninitialized';
  }

  onAudioStateChange(callback) {
    this.stateListeners.add(callback);
    callback(this.getAudioState());
    return () => this.stateListeners.delete(callback);
  }

  notifyStateListeners() {
    const state = this.getAudioState();
    this.stateListeners.forEach((cb) => {
      try {
        cb(state);
      } catch (e) {}
    });
  }

  addPeerStream(peerId, mediaStream) {
    this.ensureAudioContext();

    if (this.peerNodes.has(peerId)) {
      this.removePeerStream(peerId);
    }

    try {
      const source = this.audioCtx.createMediaStreamSource(mediaStream);

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(20000, this.audioCtx.currentTime);
      filter.Q.setValueAtTime(1, this.audioCtx.currentTime);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, this.audioCtx.currentTime);

      const panner = this.audioCtx.createStereoPanner
        ? this.audioCtx.createStereoPanner()
        : null;

      source.connect(filter);
      filter.connect(gain);

      if (panner) {
        panner.pan.setValueAtTime(0, this.audioCtx.currentTime);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        gain.connect(this.masterGain);
      }

      this.peerNodes.set(peerId, {
        source,
        filter,
        gain,
        panner,
        mediaStream,
        lastCalculatedGain: 0,
        lastPan: 0,
        isOccluded: false,
      });

      return true;
    } catch (err) {
      console.error(`[SpatialMixer] Failed to attach peer stream ${peerId}:`, err);
      return false;
    }
  }

  removePeerStream(peerId) {
    const peerNode = this.peerNodes.get(peerId);
    if (!peerNode) return;

    try {
      peerNode.source.disconnect();
      peerNode.filter.disconnect();
      peerNode.gain.disconnect();
      if (peerNode.panner) {
        peerNode.panner.disconnect();
      }
    } catch (e) {}

    this.peerNodes.delete(peerId);
  }

  updatePeerSpatial(peerId, listenerPos, peerPos, listenerFacing = 0, walls = []) {
    const peerNode = this.peerNodes.get(peerId);
    if (!peerNode || !this.audioCtx) return { gain: 0, pan: 0, distance: 999 };

    const [lx, ly] = listenerPos;
    const [px, py] = peerPos;

    const dx = px - lx;
    const dy = py - ly;
    const distance = Math.hypot(dx, dy);

    let calculatedGain = 0;
    let pan = 0;
    let isOccluded = false;

    if (distance <= this.earshotRadius && !this.isDeafened) {
      const normalizedDist = distance / this.earshotRadius;
      calculatedGain = Math.pow(1 - normalizedDist, 1.5) * this.masterVolume;

      if (this.enableOcclusion && walls.length > 0) {
        isOccluded = isRayOccludedByWalls([lx, ly], [px, py], walls);
        if (isOccluded) {
          calculatedGain *= 0.35;
          peerNode.filter.frequency.setTargetAtTime(750, this.audioCtx.currentTime, 0.05);
        } else {
          peerNode.filter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.05);
        }
      } else {
        peerNode.filter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.05);
      }

      if (this.enable3DPanning && peerNode.panner) {
        const soundAngle = Math.atan2(dy, dx);
        const relativeAngle = soundAngle - listenerFacing;
        pan = Math.max(-1, Math.min(1, Math.sin(relativeAngle)));
      }
    } else {
      calculatedGain = 0;
    }

    const safeGain = Math.max(0.0001, Math.min(1.0, calculatedGain));
    peerNode.gain.gain.setTargetAtTime(
      this.isDeafened ? 0.0001 : safeGain,
      this.audioCtx.currentTime,
      0.04
    );

    if (peerNode.panner && this.enable3DPanning) {
      peerNode.panner.pan.setTargetAtTime(pan, this.audioCtx.currentTime, 0.04);
    }

    peerNode.lastCalculatedGain = calculatedGain;
    peerNode.lastPan = pan;
    peerNode.isOccluded = isOccluded;

    return {
      distance: Math.round(distance),
      gain: parseFloat(calculatedGain.toFixed(2)),
      pan: parseFloat(pan.toFixed(2)),
      isOccluded,
    };
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        this.isDeafened ? 0 : this.masterVolume,
        this.audioCtx.currentTime,
        0.05
      );
    }
  }

  setDeafened(isDeafened) {
    this.isDeafened = isDeafened;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(
        this.isDeafened ? 0 : this.masterVolume,
        this.audioCtx.currentTime,
        0.05
      );
    }
  }

  set3DPanningEnabled(enabled) {
    this.enable3DPanning = !!enabled;
    if (!this.enable3DPanning) {
      this.peerNodes.forEach((node) => {
        if (node.panner && this.audioCtx) {
          node.panner.pan.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
        }
      });
    }
  }

  setOcclusionEnabled(enabled) {
    this.enableOcclusion = !!enabled;
    if (!this.enableOcclusion) {
      this.peerNodes.forEach((node) => {
        if (node.filter && this.audioCtx) {
          node.filter.frequency.setTargetAtTime(20000, this.audioCtx.currentTime, 0.05);
        }
      });
    }
  }

  destroy() {
    this.peerNodes.forEach((node, peerId) => {
      this.removePeerStream(peerId);
    });
    this.peerNodes.clear();
    this.stateListeners.clear();

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
    }
    this.audioCtx = null;
    this.masterGain = null;
  }
}

const spatialMixerInstance = new SpatialAudioMixer();
export default spatialMixerInstance;
