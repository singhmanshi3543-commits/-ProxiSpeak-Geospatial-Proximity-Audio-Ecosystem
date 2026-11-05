const EARSHOT_RADIUS = 100;
const SMOOTHING_TIME = 0.08;

type Position = {
  x: number;
  y: number;
};

type PeerAudio = {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  stream: MediaStream;
};

class SpatialAudioManager {
  private context: AudioContext | null = null;
  private peers = new Map<string, PeerAudio>();
  private localPosition: Position = { x: 0, y: 0 };
  private remotePositions = new Map<string, Position>();

  private getContext(): AudioContext {
    if (!this.context || this.context.state === 'closed') {
      this.context = new AudioContext();
    }
    return this.context;
  }

  async resume(): Promise<void> {
    const context = this.getContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
  }

  setLocalPosition(x: number, y: number): void {
    this.localPosition = { x, y };
    this.updateAllVolumes();
  }

  setRemotePosition(peerId: string, x: number, y: number): void {
    this.remotePositions.set(peerId, { x, y });
    this.updateVolume(peerId);
  }

  addPeerAudio(peerId: string, stream: MediaStream): void {
    const existingPeer = this.peers.get(peerId);
    if (existingPeer?.stream === stream) {
      return;
    }

    this.removePeerAudio(peerId);

    const context = this.getContext();
    const source = context.createMediaStreamSource(stream);
    const gain = context.createGain();

    gain.gain.value = 0;

    source.connect(gain);
    gain.connect(context.destination);

    this.peers.set(peerId, {
      source,
      gain,
      stream,
    });

    this.updateVolume(peerId);
  }

  private calculateDistance(first: Position, second: Position): number {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private updateVolume(peerId: string): void {
    const peer = this.peers.get(peerId);
    const remotePosition = this.remotePositions.get(peerId);

    if (!peer || !remotePosition || !this.context) {
      return;
    }

    const distance = this.calculateDistance(this.localPosition, remotePosition);
    const targetGain =
      distance >= EARSHOT_RADIUS ? 0 : Math.max(0, 1 - distance / EARSHOT_RADIUS);

    peer.gain.gain.setTargetAtTime(targetGain, this.context.currentTime, SMOOTHING_TIME);
  }

  private updateAllVolumes(): void {
    this.peers.forEach((_, peerId) => {
      this.updateVolume(peerId);
    });
  }

  removePeerAudio(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.source.disconnect();
      peer.gain.disconnect();
      this.peers.delete(peerId);
    }
  }

  removeAll(): void {
    this.peers.forEach((_, peerId) => {
      this.removePeerAudio(peerId);
    });
    this.remotePositions.clear();
  }

  async close(): Promise<void> {
    this.removeAll();
    if (this.context && this.context.state !== 'closed') {
      await this.context.close();
    }
    this.context = null;
  }
}

export const spatialAudio = new SpatialAudioManager();
export default spatialAudio;
