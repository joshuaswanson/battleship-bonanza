export const COUNT_LAND = 0.11;
const RACE_VOLUME = 0.45;
const SFX_VOLUME = 0.85;

const RACE_SONGS = ['race-music.mp3', 'coral-cannonade.mp3', 'torpedo-tide-rider.mp3', 'funlit-path.mp3', 'full-tilt-finish-line.mp3'];
const MAP_SONGS = { canyon: 'canyon-chase-derby.mp3', docks: 'the-midnight-regatta.mp3', bay: 'high-tide-hustle.mp3', venice: 'sharp-turns-in-the-harbor.mp3', midway: 'the-admirals-dash.mp3', tuebingen: 'the-deans-shortcut.mp3' };

function track(file, volume, preload = 'auto') {
  const audio = new Audio();
  audio.preload = preload;
  audio.src = `${import.meta.env.BASE_URL}music/${file}`;
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
    this.raceSongs = RACE_SONGS.map((file) => track(file, RACE_VOLUME, 'none'));
    this.mapSongs = Object.fromEntries(Object.entries(MAP_SONGS).map(([map, file]) => [map, track(file, RACE_VOLUME, 'none')]));
    this.raceSong = (Number(localStorage.getItem('bb-race-song')) || 0) % RACE_SONGS.length;
    this.tracks = { menu: track('menu-music.mp3', 0.45), race: this.raceSongs[this.raceSong] };
    this.preloadRaceSong();
    this.musicWanted = null;
    this.music = this.tracks.menu;
  }

  get latency() {
    return this.ctx ? (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0) : 0;
  }

  nextRaceSong(map) {
    this.tracks.race.pause();
    const own = this.mapSongs[map];
    if (own) {
      this.tracks.race = own;
      own.volume = RACE_VOLUME;
      if (own.preload !== 'auto') {
        own.preload = 'auto';
        own.load();
      }
      return;
    }
    this.tracks.race = this.raceSongs[this.raceSong];
    this.tracks.race.volume = RACE_VOLUME;
    this.raceSong = (this.raceSong + 1) % this.raceSongs.length;
    localStorage.setItem('bb-race-song', this.raceSong);
    this.preloadRaceSong();
  }

  preloadRaceSong() {
    const audio = this.raceSongs[this.raceSong];
    if (audio.preload === 'auto') return;
    audio.preload = 'auto';
    audio.load();
  }

  playMusic(name, { at, loop = true } = {}) {
    if (name !== this.musicWanted) {
      for (const audio of [this.tracks.menu, ...this.raceSongs, ...Object.values(this.mapSongs)]) audio.pause();
      if (name) this.tracks[name].currentTime = 0;
    }
    this.musicWanted = name;
    if (name) {
      this.music = this.tracks[name];
      this.music.loop = loop;
      if (at !== undefined) this.music.currentTime = at;
    }
    if (name && this.musicOn && this.ctx) this.music.play().catch(() => {});
    else this.music.pause();
  }

  musicLength(name) {
    return this.tracks[name].duration || Infinity;
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
      this.loadSamples('jetpack', ['sfx/jetpack.wav']);
      for (const name of ['emp', 'zap', 'hook', 'hookcatch', 'reel', 'winch', 'fireloop']) this.loadSamples(name, [`sfx/${name}.wav`]);
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
      this.buildSaw();
      this.buildFlame();
      this.buildRotor();
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

  buildSaw() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const chatter = ctx.createGain();
    chatter.gain.value = 0.75;
    chatter.connect(out);
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 38;
    const depth = ctx.createGain();
    depth.gain.value = 0.25;
    lfo.connect(depth).connect(chatter.gain);
    const whine = [ctx.createOscillator(), ctx.createOscillator()];
    whine[0].type = 'sawtooth';
    whine[1].type = 'sawtooth';
    whine[1].detune.value = 18;
    const whineTone = ctx.createBiquadFilter();
    whineTone.type = 'bandpass';
    whineTone.frequency.value = 2200;
    whineTone.Q.value = 1.2;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.5;
    for (const o of whine) o.connect(whineTone);
    whineTone.connect(whineGain).connect(chatter);
    const motor = ctx.createOscillator();
    motor.type = 'sawtooth';
    const motorTone = ctx.createBiquadFilter();
    motorTone.type = 'lowpass';
    motorTone.frequency.value = 500;
    const motorGain = ctx.createGain();
    motorGain.gain.value = 0.8;
    motor.connect(motorTone).connect(motorGain).connect(chatter);
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.noiseBuffer;
    hiss.loop = true;
    const hissTone = ctx.createBiquadFilter();
    hissTone.type = 'bandpass';
    hissTone.frequency.value = 3600;
    hissTone.Q.value = 0.8;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.35;
    hiss.connect(hissTone).connect(hissGain).connect(chatter);
    const grind = ctx.createGain();
    grind.gain.value = 0;
    grind.connect(this.master);
    const grindNoise = ctx.createBufferSource();
    grindNoise.buffer = this.noiseBuffer;
    grindNoise.loop = true;
    grindNoise.playbackRate.value = 0.7;
    const grindTone = ctx.createBiquadFilter();
    grindTone.type = 'bandpass';
    grindTone.frequency.value = 1700;
    grindTone.Q.value = 1.5;
    grindNoise.connect(grindTone).connect(grind);
    const screech = ctx.createOscillator();
    screech.type = 'square';
    screech.frequency.value = 1180;
    const screechGain = ctx.createGain();
    screechGain.gain.value = 0.12;
    screech.connect(screechGain).connect(grind);
    for (const node of [lfo, ...whine, motor, hiss, grindNoise, screech]) node.start();
    this.saw = { out, grind, whine, motor };
  }

  buildRotor() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    chop.connect(out);
    const beat = ctx.createOscillator();
    beat.type = 'sawtooth';
    beat.frequency.value = 7;
    const depth = ctx.createGain();
    depth.gain.value = -0.5;
    beat.connect(depth).connect(chop.gain);
    beat.start();
    const wash = ctx.createBufferSource();
    wash.buffer = this.noiseBuffer;
    wash.loop = true;
    wash.playbackRate.value = 0.5;
    wash.start();
    const washFilter = ctx.createBiquadFilter();
    washFilter.type = 'lowpass';
    washFilter.frequency.value = 460;
    const washGain = ctx.createGain();
    washGain.gain.value = 1.3;
    wash.connect(washFilter).connect(washGain).connect(chop);
    const thump = ctx.createOscillator();
    thump.type = 'triangle';
    thump.frequency.value = 54;
    thump.start();
    const thumpGain = ctx.createGain();
    thumpGain.gain.value = 0.9;
    thump.connect(thumpGain).connect(chop);
    const whine = ctx.createOscillator();
    whine.type = 'sawtooth';
    whine.frequency.value = 170;
    whine.start();
    const whineFilter = ctx.createBiquadFilter();
    whineFilter.type = 'lowpass';
    whineFilter.frequency.value = 900;
    const whineGain = ctx.createGain();
    whineGain.gain.value = 0.05;
    whine.connect(whineFilter).connect(whineGain).connect(out);
    this.rotor = { out, beat, whine };
  }

  setRotor(level) {
    if (!this.rotor) return;
    const t = this.ctx.currentTime;
    this.rotor.out.gain.setTargetAtTime(0.3 * level, t, 0.2);
    this.rotor.beat.frequency.setTargetAtTime(7 + 10 * level, t, 0.3);
    this.rotor.whine.frequency.setTargetAtTime(170 + 130 * level, t, 0.3);
  }

  buildFlame() {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const flutter = ctx.createGain();
    flutter.gain.value = 0.8;
    flutter.connect(out);
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 9;
    const depth = ctx.createGain();
    depth.gain.value = 0.2;
    lfo.connect(depth).connect(flutter.gain);
    const source = (rate) => {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      n.loop = true;
      n.playbackRate.value = rate;
      n.start();
      return n;
    };
    const roar = ctx.createBiquadFilter();
    roar.type = 'lowpass';
    roar.frequency.value = 520;
    roar.Q.value = 1.4;
    const roarGain = ctx.createGain();
    roarGain.gain.value = 1.6;
    source(0.6).connect(roar).connect(roarGain).connect(flutter);
    const hiss = ctx.createBiquadFilter();
    hiss.type = 'bandpass';
    hiss.frequency.value = 2400;
    hiss.Q.value = 0.7;
    const hissGain = ctx.createGain();
    hissGain.gain.value = 0.35;
    source(1).connect(hiss).connect(hissGain).connect(flutter);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * 2 - 1;
      curve[i] = Math.tanh(x * 3);
    }
    shaper.curve = curve;
    roarGain.disconnect();
    roarGain.connect(shaper).connect(flutter);
    const fire = ctx.createGain();
    fire.gain.value = 0;
    fire.connect(this.master);
    const startFire = () => {
      const buffer = this.samples.fireloop?.[0];
      if (!buffer) return setTimeout(startFire, 300);
      const loop = ctx.createBufferSource();
      loop.buffer = buffer;
      loop.loop = true;
      loop.connect(fire);
      loop.start();
    };
    startFire();
    const crackle = ctx.createBiquadFilter();
    crackle.type = 'highpass';
    crackle.frequency.value = 3000;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0;
    source(1.3).connect(crackle).connect(crackleGain).connect(out);
    lfo.start();
    this.flame = { out, crackleGain, roar, fire, on: false };
  }

  setFlame(level) {
    if (!this.flame) return;
    const t = this.ctx.currentTime;
    const f = this.flame;
    f.out.gain.setTargetAtTime(0.42 * level, t, level > f.level ? 0.03 : 0.12);
    f.fire.gain.setTargetAtTime(0.9 * level, t, level > f.level ? 0.04 : 0.2);
    f.roar.frequency.setTargetAtTime(420 + 260 * level + Math.random() * 120, t, 0.05);
    f.crackleGain.gain.setTargetAtTime(level > 0.05 && Math.random() < 0.35 ? 0.25 + Math.random() * 0.35 : 0, t, 0.01);
    if (level > 0.3 && !f.on) {
      this.noise(0.45, { vol: 0.7 * level, freq: 250, to: 1800 });
      this.tone(80, 0.4, { type: 'sine', vol: 0.5 * level, to: 40 });
      this.sample('jetpack', 0.35 * level, 1.3);
    }
    f.on = level > 0.3;
    f.level = level;
  }

  setSaw(level, grinding = 0) {
    if (!this.saw) return;
    const t = this.ctx.currentTime;
    const spin = Math.min(1, level);
    for (const o of this.saw.whine) o.frequency.setTargetAtTime(500 + 1500 * spin, t, 0.08);
    this.saw.motor.frequency.setTargetAtTime(60 + 70 * spin, t, 0.08);
    this.saw.out.gain.setTargetAtTime(0.16 * spin, t, 0.06);
    this.saw.grind.gain.setTargetAtTime(0.22 * grinding, t, 0.04);
  }

  setEngine(speedFraction, active, truck = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engine.frequency.setTargetAtTime((truck ? 36 : 55) + speedFraction * (truck ? 52 : 70), t, 0.1);
    this.engineFilter.frequency.setTargetAtTime((truck ? 420 : 300) + speedFraction * (truck ? 760 : 500), t, 0.1);
    this.engineGain.gain.setTargetAtTime(active ? (0.05 + speedFraction * 0.05) * (truck ? 1.7 : 1) : 0, t, 0.2);
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

  noise(dur, { vol = 0.3, freq = 1000, type = 'lowpass', to = null, delay = 0 } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
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

  clank(delay, v, pitch = 1) {
    this.tone(2300 * pitch, 0.1, { type: 'triangle', vol: 0.1 * v, delay });
    this.tone(3400 * pitch, 0.06, { type: 'square', vol: 0.03 * v, delay });
    this.tone(320 * pitch, 0.16, { type: 'square', vol: 0.16 * v, to: 95, delay });
    this.noise(0.08, { vol: 0.28 * v, freq: 2800, type: 'bandpass', to: 900, delay });
  }

  hiss(delay, v, dur = 0.3) {
    this.noise(dur, { vol: 0.22 * v, freq: 5200, type: 'highpass', to: 1500, delay });
  }

  backfire(delay, v) {
    this.noise(0.14, { vol: 0.42 * v, freq: 1500, to: 180, delay });
    this.tone(150, 0.14, { type: 'square', vol: 0.2 * v, to: 48, delay });
  }

  play(name, pos, pitch = 1000) {
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
      case 'seek':
        this.tone(pitch, 0.05, { type: 'square', vol: 0.05 });
        break;
      case 'seekLock':
        this.tone(1760, 0.09, { type: 'square', vol: 0.08 });
        this.tone(1760, 0.22, { type: 'square', vol: 0.08, delay: 0.11 });
        this.tone(2640, 0.22, { type: 'sine', vol: 0.05, delay: 0.11 });
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
      case 'jetpack':
        if (this.sample('jetpack', 0.55 * v)) break;
        this.noise(0.6, { vol: 0.3 * v, freq: 400, type: 'bandpass', to: 2400 });
        break;
      case 'whoosh':
        this.noise(0.6, { vol: 0.3 * v, freq: 400, type: 'bandpass', to: 2400 });
        break;
      case 'transform':
        if (v < 0.15) break;
        this.hiss(0, v, 0.4);
        this.tone(170, 1.75, { type: 'sawtooth', vol: 0.07 * v, to: 980 });
        this.tone(340, 1.75, { type: 'square', vol: 0.03 * v, to: 1960 });
        this.noise(1.7, { vol: 0.09 * v, freq: 500, type: 'bandpass', to: 3200 });
        for (const delay of [0.22, 0.3, 0.38, 0.46]) this.clank(delay, v * 0.7, 0.8 + delay);
        for (let k = 0; k < 10; k++) this.tone(1500 + k * 90, 0.03, { type: 'square', vol: 0.05 * v, delay: 0.42 + k * 0.042 });
        this.hiss(0.68, v, 0.35);
        for (const delay of [0.84, 0.9, 0.96, 1.02]) {
          this.tone(120, 0.14, { type: 'sine', vol: 0.32 * v, to: 300, delay });
          this.noise(0.09, { vol: 0.2 * v, freq: 800, delay });
        }
        this.tone(90, 0.5, { type: 'sawtooth', vol: 0.09 * v, to: 240, delay: 1.02 });
        this.clank(1.24, v, 0.72);
        this.clank(1.3, v, 0.66);
        this.hiss(1.34, v, 0.22);
        this.clank(1.55, v, 1.05);
        this.clank(1.68, v * 1.2, 0.55);
        this.tone(58, 0.32, { type: 'sine', vol: 0.5 * v, to: 34, delay: 1.68 });
        this.tone(55, 0.5, { type: 'sawtooth', vol: 0.16 * v, to: 210, delay: 1.76 });
        this.backfire(1.86, v);
        this.backfire(2.02, v * 0.8);
        break;
      case 'untransform':
        if (v < 0.15) break;
        this.hiss(0, v, 0.3);
        this.tone(900, 0.75, { type: 'sawtooth', vol: 0.06 * v, to: 170 });
        this.tone(1800, 0.75, { type: 'square', vol: 0.025 * v, to: 340 });
        for (const delay of [0.1, 0.22, 0.34, 0.46]) this.clank(delay, v * 0.75, 1.1 - delay);
        this.hiss(0.5, v, 0.25);
        this.clank(0.68, v, 0.6);
        break;
      case 'truckLand':
        this.tone(64, 0.42, { type: 'sine', vol: 0.6 * v, to: 30 });
        this.noise(0.3, { vol: 0.38 * v, freq: 900, to: 120 });
        this.tone(340, 0.2, { type: 'square', vol: 0.07 * v, to: 620, delay: 0.1 });
        this.tone(620, 0.24, { type: 'square', vol: 0.05 * v, to: 300, delay: 0.3 });
        this.clank(0.06, v * 0.7, 0.7);
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
        if (this.sample('zap', 0.4 * v, 0.9 + Math.random() * 0.2)) break;
        this.noise(0.14, { vol: 0.09 * v, freq: 1600, type: 'bandpass', to: 900 });
        this.tone(260, 0.16, { type: 'triangle', vol: 0.06 * v, to: 110 });
        break;
      case 'emp':
        if (this.sample('emp', 0.75 * v)) break;
        this.tone(220, 0.6, { vol: 0.3 * v, to: 55 });
        this.noise(0.5, { vol: 0.14 * v, freq: 700, to: 150 });
        this.tone(520, 0.45, { type: 'triangle', vol: 0.04 * v, to: 260, delay: 0.05 });
        break;
      case 'hook':
        if (this.sample('hook', 0.7 * v, 0.95 + Math.random() * 0.1)) break;
        this.tone(400, 0.14, { type: 'square', vol: 0.08 * v, to: 1100 });
        break;
      case 'hookCatch':
        if (this.sample('hookcatch', 0.55 * v)) break;
        this.tone(320, 0.18, { type: 'square', vol: 0.12 * v, to: 140 });
        break;
      case 'reel':
        this.sample('reel', 0.5 * v);
        break;
      case 'winch':
        this.sample('winch', 0.6 * v);
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
