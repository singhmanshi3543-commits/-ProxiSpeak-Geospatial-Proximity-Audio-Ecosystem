export class AudioSynthesizerDemo {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.activeGenerators = new Map();
  }

  createVoiceStream(id, customPitch = null) {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }

    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
    const botPitchChoices = [185, 210, 240, 275, 310, 345];
    const basePitch = customPitch || botPitchChoices[hash % botPitchChoices.length];

    const destination = this.audioCtx.createMediaStreamDestination();

    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(basePitch, this.audioCtx.currentTime);
    osc2.frequency.setValueAtTime(basePitch * 1.5, this.audioCtx.currentTime);

    const formantFilter1 = this.audioCtx.createBiquadFilter();
    formantFilter1.type = 'bandpass';
    formantFilter1.frequency.setValueAtTime(750, this.audioCtx.currentTime);
    formantFilter1.Q.setValueAtTime(3.5, this.audioCtx.currentTime);

    const formantFilter2 = this.audioCtx.createBiquadFilter();
    formantFilter2.type = 'bandpass';
    formantFilter2.frequency.setValueAtTime(1600, this.audioCtx.currentTime);
    formantFilter2.Q.setValueAtTime(2.5, this.audioCtx.currentTime);

    const rhythmGain = this.audioCtx.createGain();
    rhythmGain.gain.setValueAtTime(0.65, this.audioCtx.currentTime);

    const lfo = this.audioCtx.createOscillator();
    lfo.frequency.setValueAtTime(2.8, this.audioCtx.currentTime);
    const lfoGain = this.audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(rhythmGain.gain);

    const intonationLfo = this.audioCtx.createOscillator();
    intonationLfo.frequency.setValueAtTime(0.6, this.audioCtx.currentTime);
    const intonationGain = this.audioCtx.createGain();
    intonationGain.gain.setValueAtTime(28, this.audioCtx.currentTime);
    intonationLfo.connect(intonationGain);
    intonationGain.connect(osc1.frequency);

    const streamMasterGain = this.audioCtx.createGain();
    streamMasterGain.gain.setValueAtTime(0.9, this.audioCtx.currentTime);

    osc1.connect(formantFilter1);
    osc2.connect(formantFilter2);

    formantFilter1.connect(rhythmGain);
    formantFilter2.connect(rhythmGain);
    rhythmGain.connect(streamMasterGain);
    streamMasterGain.connect(destination);

    osc1.start();
    osc2.start();
    lfo.start();
    intonationLfo.start();

    this.activeGenerators.set(id, {
      osc1,
      osc2,
      lfo,
      intonationLfo,
      streamMasterGain,
      stream: destination.stream,
    });

    return destination.stream;
  }

  stopVoiceStream(id) {
    const gen = this.activeGenerators.get(id);
    if (!gen) return;

    try {
      gen.osc1.stop();
      gen.osc2.stop();
      gen.lfo.stop();
      gen.intonationLfo.stop();
    } catch (e) {}

    this.activeGenerators.delete(id);
  }

  stopAll() {
    this.activeGenerators.forEach((_, id) => this.stopVoiceStream(id));
  }
}

export default AudioSynthesizerDemo;
