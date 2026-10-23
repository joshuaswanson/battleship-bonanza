export const COUNT_LAND = 0.11;
const RACE_VOLUME = 0.2;
const SFX_VOLUME = 0.85;

function track(file, volume) {
  const audio = new Audio(`${import.meta.env.BASE_URL}${file}`);
  audio.loop = true;
  audio.volume = volume;
  return audio;
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.soundOn = localStorage.getItem('bb-sound') !== '0';
    this.musicOn = localStorage.getItem('bb-music') !== '0';
    this.listener = null;
    this.tracks = { menu: track('menu-music.mp3', 0.45), race: track('race-music.mp3', RACE_VOLUME) };
    this.musicWanted = null;
    this.music = this.tracks.menu;
  }

  get latency() {
    return this.ctx ? (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0) : 0;
  }

  playMusic(name) {
    if (name !== this.musicWanted) {
      for (const audio of Object.values(this.tracks)) audio.pause();
      if (name) this.tracks[name].currentTime = 0;
    }
    this.musicWanted = name;
    if (name) this.music = this.tracks[name];
    if (name && this.musicOn && this.ctx) this.music.play().catch(() => {});
    else this.music.pause();
  }

  duckMusic(on) {
    this.tracks.race.volume = on ? RACE_VOLUME * 0.35 : RACE_VOLUME;
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.soundOn ? SFX_VOLUME : 0;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.knee.value = 8;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      this.master.connect(limiter).connect(this.ctx.destination);
      this.samples = {};
      this.loadSamples('gun', ['sfx/gun1.wav', 'sfx/gun2.wav', 'sfx/gun3.wav']);
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
    if (this.musicWanted && this.musicOn && this.music.paused) this.music.play().catch(() => {});
  }

  setSound(on) {
    this.soundOn = on;
    localStorage.setItem('bb-sound', on ? '1' : '0');
    if (this.master) this.master.gain.value = on ? SFX_VOLUME : 0;
  }

  setMusic(on) {
    this.musicOn = on;
    localStorage.setItem('bb-music', on ? '1' : '0');
    this.playMusic(this.musicWanted);
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

  loadSamples(name, files) {
    Promise.all(
      files.map((file) =>
        fetch(`${import.meta.env.BASE_URL}${file}`)
          .then((r) => r.arrayBuffer())
          .then((data) => this.ctx.decodeAudioData(data)),
      ),
    )
      .then((buffers) => {
        this.samples[name] = buffers;
      })
      .catch(() => {});
  }

  sample(name, vol, rate = 1) {
    const buffers = this.samples[name];
    if (!buffers?.length) return false;
    const source = this.ctx.createBufferSource();
    source.buffer = buffers[Math.floor(Math.random() * buffers.length)];
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    source.connect(gain).connect(this.master);
    source.start();
    return true;
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
    if (!this.ctx || !this.soundOn) return;
    const v = this.volumeAt(pos);
    if (!(v >= 0.04)) return;
    switch (name) {
      case 'shoot':
        if (this.sample('gun', 0.32 * v, 0.94 + Math.random() * 0.14)) break;
        this.noise(0.07, { vol: 0.22 * v, freq: 2600, type: 'bandpass', to: 700 });
        this.tone(150, 0.07, { type: 'square', vol: 0.1 * v, to: 55 });
        this.tone(2400, 0.02, { type: 'square', vol: 0.03 * v, to: 900 });
        break;
      case 'laser':
        this.tone(3200, 0.25, { type: 'sawtooth', vol: 0.12 * v, to: 400 });
        this.tone(55, 1.3, { type: 'sawtooth', vol: 0.16 * v, to: 62 });
        this.tone(110, 1.3, { type: 'square', vol: 0.07 * v, to: 124 });
        this.tone(880, 1.3, { type: 'sawtooth', vol: 0.035 * v, to: 940 });
        this.noise(1.3, { vol: 0.12 * v, freq: 2400, type: 'bandpass', to: 1600 });
        this.noise(0.3, { vol: 0.2 * v, freq: 600, to: 120 });
        break;
      case 'boom':
        this.noise(0.7, { vol: 0.5 * v, freq: 900, to: 80 });
        this.tone(110, 0.5, { vol: 0.4 * v, to: 35 });
        break;
      case 'mineBoom':
        this.tone(70, 0.9, { type: 'sine', vol: 0.6 * v, to: 28 });
        this.tone(140, 0.35, { type: 'square', vol: 0.18 * v, to: 40 });
        this.noise(0.25, { vol: 0.55 * v, freq: 2600, to: 300 });
        this.noise(1.4, { vol: 0.32 * v, freq: 1800, type: 'bandpass', to: 400 });
        this.tone(1250, 0.25, { type: 'triangle', vol: 0.06 * v, to: 900 });
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
        this.noise(0.45, { vol: 0.6 * v, freq: 3400, type: 'bandpass', to: 2200 });
        this.tone(1500, 0.4, { type: 'sawtooth', vol: 0.14 * v, to: 1100 });
        this.tone(2900, 0.4, { type: 'square', vol: 0.06 * v, to: 2300 });
        this.tone(95, 0.4, { type: 'square', vol: 0.2 * v, to: 70 });
        break;
      case 'sawSpin':
        this.tone(1850, 0.36, { type: 'sawtooth', vol: 0.11 * v, to: 1900 });
        this.tone(3700, 0.36, { type: 'square', vol: 0.035 * v, to: 3800 });
        this.tone(120, 0.36, { type: 'sawtooth', vol: 0.18 * v, to: 124 });
        this.noise(0.36, { vol: 0.16 * v, freq: 3000, type: 'bandpass', to: 3200 });
        break;
      case 'whoosh':
        this.noise(0.6, { vol: 0.3 * v, freq: 400, type: 'bandpass', to: 2400 });
        break;
      case 'missile':
        this.noise(0.12, { vol: 0.45 * v, freq: 900, to: 200 });
        this.tone(120, 0.18, { type: 'square', vol: 0.16 * v, to: 45 });
        this.noise(0.9, { vol: 0.28 * v, freq: 1200, type: 'bandpass', to: 4200 });
        this.tone(220, 0.8, { type: 'sawtooth', vol: 0.06 * v, to: 900 });
        break;
      case 'crackle':
        for (let i = 0; i < 2; i++) this.noise(0.03 + Math.random() * 0.03, { vol: 0.035 * v, freq: 2200 + Math.random() * 800, type: 'bandpass' });
        break;
      case 'zap':
        this.noise(0.14, { vol: 0.09 * v, freq: 1600, type: 'bandpass', to: 900 });
        this.tone(260, 0.16, { type: 'triangle', vol: 0.06 * v, to: 110 });
        break;
      case 'emp':
        this.tone(220, 0.6, { vol: 0.3 * v, to: 55 });
        this.noise(0.5, { vol: 0.14 * v, freq: 700, to: 150 });
        this.tone(520, 0.45, { type: 'triangle', vol: 0.04 * v, to: 260, delay: 0.05 });
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
      case 'lock':
        this.tone(1250, 0.07, { type: 'square', vol: 0.09 });
        break;
      case 'lockHigh':
        this.tone(1650, 0.05, { type: 'square', vol: 0.11 });
        break;
      case 'boost':
        this.tone(300, 0.35, { type: 'sawtooth', vol: 0.08 * v, to: 1200 });
        this.noise(0.4, { vol: 0.2 * v, freq: 800, type: 'bandpass', to: 4000 });
        break;
      case 'heal':
        [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.16, { type: 'sine', vol: 0.12 * v, delay: i * 0.06 }));
        break;
      case 'flame':
        this.noise(0.4, { vol: 0.14 * v, freq: 500, type: 'lowpass', to: 900 });
        break;
      case 'ignite':
        this.noise(0.3, { vol: 0.22 * v, freq: 2500, type: 'bandpass', to: 600 });
        break;
      case 'dodge':
        this.noise(0.4, { vol: 0.25 * v, freq: 600, type: 'bandpass', to: 3000 });
        [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.14, { type: 'triangle', vol: 0.14, delay: 0.05 + i * 0.06 }));
        break;
      case 'overheat':
        this.noise(0.9, { vol: 0.3 * v, freq: 4000, type: 'highpass', to: 1500 });
        this.tone(900, 0.5, { type: 'square', vol: 0.06 * v, to: 120 });
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
        this.tone(520, 0.22, { type: 'square', vol: 0.22, delay: Math.max(0, COUNT_LAND - this.latency) });
        break;
      case 'go':
        this.tone(1040, 0.6, { type: 'square', vol: 0.22, delay: Math.max(0, COUNT_LAND - this.latency) });
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
