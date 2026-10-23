export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('bb-muted') === '1';
    this.listener = null;
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.engine = this.ctx.createOscillator();
      this.engine.type = 'sawtooth';
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineFilter).connect(this.engineGain).connect(this.master);
      this.engine.start();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    localStorage.setItem('bb-muted', this.muted ? '1' : '0');
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  setEngine(speedFraction, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime(55 + speedFraction * 70, t, 0.1);
    this.engineFilter.frequency.setTargetAtTime(300 + speedFraction * 500, t, 0.1);
    this.engineGain.gain.setTargetAtTime(active ? 0.05 + speedFraction * 0.05 : 0, t, 0.2);
  }

  volumeAt(pos) {
    if (!pos || !this.listener) return 1;
    const d = Math.hypot(pos.x - this.listener.x, pos.z - this.listener.z);
    return 1 / (1 + d / 35);
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.3, freq = 1000, type = 'lowpass', to = null } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  play(name, pos) {
    if (!this.ctx || this.muted) return;
    const v = this.volumeAt(pos);
    if (v < 0.04) return;
    switch (name) {
      case 'shoot':
        this.tone(900, 0.05, { type: 'square', vol: 0.06 * v, to: 300 });
        break;
      case 'laser':
        this.tone(1800, 0.3, { type: 'sawtooth', vol: 0.12 * v, to: 160 });
        this.tone(2400, 0.2, { type: 'sine', vol: 0.1 * v, to: 600 });
        break;
      case 'boom':
        this.noise(0.7, { vol: 0.5 * v, freq: 900, to: 80 });
        this.tone(110, 0.5, { vol: 0.4 * v, to: 35 });
        break;
      case 'boing':
        this.tone(220, 0.22, { vol: 0.22 * v, to: 660 });
        break;
      case 'tink':
        this.tone(2200, 0.08, { type: 'triangle', vol: 0.12 * v });
        this.tone(3100, 0.06, { type: 'triangle', vol: 0.08 * v, delay: 0.02 });
        break;
      case 'hit':
        this.tone(180, 0.15, { type: 'square', vol: 0.12 * v, to: 70 });
        this.noise(0.12, { vol: 0.15 * v, freq: 2500 });
        break;
      case 'saw':
        this.noise(0.45, { vol: 0.25 * v, freq: 3000, type: 'bandpass', to: 1200 });
        this.tone(500, 0.4, { type: 'sawtooth', vol: 0.06 * v, to: 900 });
        break;
      case 'whoosh':
        this.noise(0.6, { vol: 0.3 * v, freq: 400, type: 'bandpass', to: 2400 });
        break;
      case 'missile':
        this.noise(0.5, { vol: 0.2 * v, freq: 1500, type: 'bandpass', to: 500 });
        this.tone(300, 0.3, { type: 'square', vol: 0.05 * v, to: 600 });
        break;
      case 'emp':
        this.tone(160, 0.5, { vol: 0.3 * v, to: 1400 });
        this.tone(1400, 0.4, { type: 'triangle', vol: 0.08 * v, to: 200, delay: 0.1 });
        break;
      case 'hook':
        this.tone(400, 0.14, { type: 'square', vol: 0.08 * v, to: 1100 });
        break;
      case 'clank':
        this.tone(320, 0.18, { type: 'square', vol: 0.12 * v, to: 140 });
        this.tone(1200, 0.12, { type: 'triangle', vol: 0.1 * v });
        break;
      case 'plop':
        this.tone(600, 0.12, { vol: 0.2 * v, to: 200 });
        break;
      case 'splash':
        this.noise(0.4, { vol: 0.25 * v, freq: 1800, to: 300 });
        break;
      case 'pop':
        this.tone(700, 0.08, { vol: 0.25 * v, to: 1400 });
        this.tone(500, 0.5, { type: 'triangle', vol: 0.15 * v, to: 100, delay: 0.08 });
        break;
      case 'tick':
        this.tone(1300, 0.03, { type: 'square', vol: 0.05 });
        break;
      case 'hover':
        this.tone(880, 0.04, { type: 'sine', vol: 0.05, to: 1100 });
        break;
      case 'pick':
        [520, 780, 1040].forEach((f, i) => this.tone(f, 0.1, { type: 'triangle', vol: 0.12, delay: i * 0.05 }));
        break;
      case 'drop':
        this.tone(240, 0.12, { type: 'square', vol: 0.12, to: 90 });
        this.noise(0.25, { vol: 0.2, freq: 1600, to: 300 });
        break;
      case 'nope':
        this.tone(140, 0.09, { type: 'square', vol: 0.06 });
        break;
      case 'beep':
        this.tone(520, 0.18, { type: 'square', vol: 0.12 });
        break;
      case 'go':
        this.tone(1040, 0.5, { type: 'square', vol: 0.12 });
        break;
      case 'lap':
        [660, 880, 1320].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.15, delay: i * 0.08 }));
        break;
      case 'finish':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.16, delay: i * 0.1 }));
        break;
    }
  }
}
