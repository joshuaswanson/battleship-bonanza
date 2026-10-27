import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/saira-condensed/800.css';
import '@fontsource/saira-condensed/900.css';
import './style.css';
import * as THREE from 'three';
import { createTrack } from './track.js';
import { createWorld, buildBudget } from './world.js';
import { MAPS } from './maps.js';
import { Recorder, Replay } from './replay.js';
import { Hints } from './hints.js';
import { Director } from './director.js';
import { renderResults } from './results.js';
import { createWipe } from './wipe.js';
import { setSurface } from './water.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Race, BASE_SPEED } from './race.js';
import { Hud, formatTime } from './hud.js';
import { LANGUAGES, t, ordinal, itemInSentence, itemName, getLang, setLang, applyStatic } from './i18n.js';
import { Loadout, PAINTS } from './loadout.js';
import { logoSvg, layoutLogoText } from './logo.js';
import { TitleBoat } from './titleBoat.js';
import { ITEMS, ITEM_IDS } from './items.js';
import { arrange, charClock } from './boatModel.js';

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll('[data-logo]')) {
  el.classList.add('logo-3d');
  el.innerHTML = logoSvg({ boat: false, main: false });
  new TitleBoat(el);
  el.insertAdjacentHTML('beforeend', logoSvg({ art: false }).replace('class="logo"', 'class="logo logo-front" aria-hidden="true"'));
  layoutLogoText(el);
}

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.localClippingEnabled = true;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, 1, 0.5, 3000);

function fitYard() {
  const yard = document.querySelector('.yard');
  const w = innerWidth;
  const h = innerHeight;
  const compact = h <= 560 && w > h;
  const fit = compact ? Math.min(w / 900, h / 430) : Math.min(w / 1180, h / 780);
  const zoom = compact ? Math.min(1.4, Math.max(0.7, fit)) : Math.min(1.8, Math.max(0.5, fit));
  yard.style.zoom = zoom;
  yard.style.width = `${w / zoom}px`;
  yard.style.height = `${h / zoom}px`;
}

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitYard();
}
addEventListener('resize', resize);
resize();

const MAX_RATIO = Math.min(devicePixelRatio, 2);
const quality = { ratio: MAX_RATIO, frames: 0, total: 0, calm: 0 };
function adaptResolution(dt) {
  if (document.hidden || dt <= 0) return;
  quality.frames++;
  quality.total += dt;
  if (quality.frames < 90) return;
  const avg = quality.total / quality.frames;
  quality.frames = 0;
  quality.total = 0;
  let next = quality.ratio;
  if (avg > 1 / 50 && quality.ratio > 0.75) {
    next = Math.max(0.75, quality.ratio - 0.25);
    quality.calm = 0;
  } else if (avg < 1 / 58 && quality.ratio < MAX_RATIO) {
    quality.calm++;
    if (quality.calm >= 4) {
      next = Math.min(MAX_RATIO, quality.ratio + 0.25);
      quality.calm = 0;
    }
  }
  if (next !== quality.ratio) {
    quality.ratio = next;
    renderer.setPixelRatio(next);
    resize();
  }
}

const fx = new Effects(scene);
fx.camera = camera;
const sfx = new Sfx();
const SILENT = { play() {} };
const input = new Input();

const venues = {};
const building = {};
function venue(id) {
  return venues[id];
}

const BUILDERS = {
  jungle: () => import('./jungle.js').then((m) => m.createJungle),
  alps: () => import('./alps.js').then((m) => m.createAlps),
  venice: () => import('./venice.js').then((m) => m.createVenice),
  midway: () => import('./midway.js').then((m) => m.createMidway),
  canyon: () => import('./canyon.js').then((m) => m.createCanyon),
  docks: () => import('./docks.js').then((m) => m.createDocks),
};

function prepareVenue(id) {
  if (venues[id]) return Promise.resolve(venues[id]);
  building[id] ??= (async () => {
    const group = new THREE.Group();
    group.visible = false;
    group.matrixWorldAutoUpdate = false;
    const track = createTrack(MAPS[id]);
    const world = BUILDERS[id] ? await (await BUILDERS[id]())(group, track, fx) : createWorld(group, track);
    scene.add(group);
    venues[id] = { track, world, group };
    return venues[id];
  })();
  return building[id];
}

function disposeVenue(id) {
  const { group } = venues[id];
  delete venues[id];
  delete building[id];
  scene.remove(group);
  group.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    o.geometry?.dispose();
    for (const material of [o.material ?? []].flat()) for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
  });
}

{
  const track = createTrack(MAPS.bay);
  const group = new THREE.Group();
  group.visible = false;
  group.matrixWorldAutoUpdate = false;
  scene.add(group);
  venues.bay = { track, world: createWorld(group, track), group };
}
let current = venue('bay');
const hud = new Hud(current.track, sfx);

function useVenue(id) {
  const next = venue(id);
  current.group.visible = false;
  current.group.matrixWorldAutoUpdate = false;
  next.group.visible = true;
  next.group.matrixWorldAutoUpdate = true;
  scene.fog = next.world.fog;
  fx.setWater(next.world.spray);
  setSurface(next.world.surface ?? null);
  hud.setTrack(next.track);
  current = next;
}

function pickMap(attract) {
  if (import.meta.env.DEV && window.__bb?.map) return window.__bb.map;
  if (attract) return 'bay';
  if (MAPS[setup.map]) return setup.map;
  const ids = Object.keys(MAPS);
  return ids[Math.floor(Math.random() * ids.length)];
}


function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-setup'));
    if (saved && Array.isArray(saved.items) && saved.items.length === 2 && saved.items.every((id) => id === null || ITEMS[id])) return { ...saved, items: arrange(saved.items) };
  } catch {}
  return { name: 'Sea Biscuit', color: PAINTS[0].value, items: ['machinegun', 'jetpack'] };
}
const setup = loadSetup();
const saveSetup = () => localStorage.setItem('bb-setup', JSON.stringify(setup));

const shuffle = (xs) => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function dealLoadouts(count, taken = []) {
  const byPreference = (ids) => [...shuffle(ids.filter((id) => !taken.includes(id))), ...shuffle(ids.filter((id) => taken.includes(id)))];
  const weapons = byPreference(ITEM_IDS.filter((id) => ITEMS[id].group === 'weapons'));
  const others = byPreference(ITEM_IDS.filter((id) => ITEMS[id].group !== 'weapons'));
  return Array.from({ length: count }, (_, i) => arrange(Math.random() < 0.5 ? [weapons[i % weapons.length], others[i % others.length]] : [others[i % others.length], weapons[i % weapons.length]]));
}

function makeDefs(player) {
  const names = shuffle(t('aiNames'));
  const colors = shuffle(PAINTS.map((p) => p.value).filter((c) => c !== player?.color));
  const loadouts = dealLoadouts(player ? 5 : 6, player?.items);
  const defs = [];
  for (let i = 0; i < 6; i++) {
    if (player && i === 3) defs.push({ name: player.name, color: player.color, items: [...player.items], isPlayer: true });
    else defs.push({ name: names.pop(), color: colors.pop() ?? PAINTS[i].value, items: loadouts.pop() });
  }
  return defs;
}

let mode = 'title';
let race = null;
let resultsTimer = 0;
let time = 0;
const HURT_SHAKE = { bullet: 0.25, laser: 0.3, reflect: 0.3, saw: 0.5, flame: 0, fire: 0 };

let recorder = null;
let replay = null;

function newRace(attract, map = pickMap(attract)) {
  recorder?.detach();
  recorder = null;
  replay = null;
  $('replay-ui').classList.add('hidden');
  race?.dispose();
  fx.decals.clear();
  useVenue(map);
  current.world.chopper?.reset();
  race = new Race({ scene, track: current.track, fx, sfx: attract ? SILENT : sfx, shores: current.world.shores, solid: current.world.solid, raycast: current.world.raycast ?? null, chopper: current.world.chopper ?? null, hazards: current.world.hazards ?? null, defs: makeDefs(attract ? null : setup), attract });
  if (!attract) recorder = new Recorder(race, fx);
  cam.snap = true;
}

function startReplay() {
  hints.stop();
  if (!recorder?.frames.length) return;
  recorder.detach();
  replay = new Replay(recorder, scene, sfx);
  sfx.playMusic(null);
  race.wakes.trails.clear();
  mode = 'replay';
  showScreen(null);
  hud.show(false);
  $('replay-ui').classList.remove('hidden');
  cam.focusTime = 0;
  document.activeElement?.blur();
}

function endReplay() {
  sfx.playMusic('race');
  for (const b of race.boats) b.air = null;
  race.frozen = true;
  mode = 'results';
  $('replay-ui').classList.add('hidden');
  showScreen('screen-results');
  renderResults(race);
  $('btn-replay').focus();
}

const screens = ['screen-title', 'screen-howto', 'screen-settings', 'screen-credits', 'screen-loadout', 'screen-maps', 'screen-pause', 'screen-results'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  loadout.active = false;
}

function goTitle() {
  sfx.playMusic('menu');
  mode = 'title';
  newRace(true);
  hud.show(false);
  showScreen('screen-title');
  $('btn-play').focus();
}

function goLoadout() {
  loadout.showThumbs();
  sfx.unlock();
  sfx.playMusic('menu');
  if (!race?.attract) newRace(true);
  mode = 'loadout';
  hud.show(false);
  showScreen('screen-loadout');
  loadout.active = true;
}

const wipe = createWipe($('wipe'), sfx);

const MAP_CHOICES = ['bay', 'jungle', 'canyon', 'alps', 'venice', 'midway', 'docks', 'random'];
const die = (pips, cls) => `<svg class="die ${cls}" viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx="9" fill="#fff" stroke="#0E2A47" stroke-width="3.5"/>${pips.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" fill="#0E2A47"/>`).join('')}</svg>`;
const DICE = die([[12, 12], [20, 20], [28, 28]], 'die-a') + die([[12, 12], [28, 12], [12, 28], [28, 28], [20, 20]], 'die-b');
function renderMaps() {
  $('map-cards').innerHTML = MAP_CHOICES.map((id, i) => {
    const art = id === 'random' ? 'map-art random' : 'map-art';
    const tile = (map) => `background-image:url('${import.meta.env.BASE_URL}maps/${map}.jpg')`;
    const style = id === 'random' ? '' : ` style="${tile(id)}"`;
    return `<button class="map-card${id === 'random' ? ' surprise' : ''}" role="radio" data-map="${id}" aria-checked="${setup.map === id}" style="--i:${i}">
      <div class="${art}"${style}>${id === 'random' ? DICE : ''}</div>
      <div class="map-text"><h3>${t(`map_${id}`)}</h3><p>${t(`mapBlurb_${id}`)}</p></div>
    </button>`;
  }).join('');
  for (const card of document.querySelectorAll('.map-card')) {
    card.addEventListener('click', () => {
      setup.map = card.dataset.map;
      saveSetup();
      sfx.play('pick');
      for (const c of document.querySelectorAll('.map-card')) c.setAttribute('aria-checked', String(c === card));
    });
    card.addEventListener('dblclick', () => wipe(startRace));
  }
}

function goMaps() {
  if (!setup.items.every(Boolean)) return;
  setup.map ??= 'random';
  saveSetup();
  mode = 'maps';
  showScreen('screen-maps');
  renderMaps();
  document.querySelector('.map-card[aria-checked="true"]')?.focus();
}

async function startRace() {
  if (!setup.items.every(Boolean)) return;
  sfx.unlock();
  sfx.playMusic(null);
  sfx.nextRaceSong();
  sfx.duckMusic(false);
  saveSetup();
  const map = pickMap(false);
  if (venues[map]) await prepareVenue(map);
  else await showLoading(map, prepareVenue(map));
  newRace(false, map);
  for (const id of Object.keys(venues)) if (id !== 'bay' && id !== map) disposeVenue(id);
  mode = 'race';
  resultsTimer = 0;
  hud.setup(race);
  hints.start(race, touchOnly);
  hud.show(true);
  showScreen(null);
  document.activeElement?.blur();
}

let loading = false;
async function showLoading(map, ready) {
  $('loading-title').textContent = t(`map_${map}`);
  $('loading-blurb').textContent = t(`mapBlurb_${map}`);
  $('loading').classList.add('on');
  loading = true;
  buildBudget.ms = 40;
  try {
    await ready;
  } finally {
    buildBudget.ms = 6;
    loading = false;
    $('loading').classList.remove('on');
  }
}

function pause(on) {
  if (on && mode === 'race') {
    mode = 'paused';
    sfx.duckMusic(true);
    showScreen('screen-pause');
    $('btn-resume').focus();
  } else if (!on && mode === 'paused') {
    mode = 'race';
    sfx.duckMusic(false);
    showScreen(null);
    document.activeElement?.blur();
  }
}

function showResults() {
  mode = 'results';
  showScreen('screen-results');
  renderResults(race);
  $('btn-continue').focus();
}

const loadout = new Loadout({ setup, sfx, onChange: saveSetup });

function renderLanguagePicker() {
  $('lang-picker').innerHTML = LANGUAGES.map(
    (l) => `<button class="btn lang" data-lang="${l.id}" lang="${l.id}" aria-label="${l.name}" aria-pressed="${l.id === getLang()}">${l.label}</button>`,
  ).join('');
  for (const button of document.querySelectorAll('.lang')) {
    button.addEventListener('click', () => {
      if (button.dataset.lang === getLang()) return;
      setLang(button.dataset.lang);
      applyStatic();
      loadout.relabel();
      renderLanguagePicker();
      if (mode === 'maps') renderMaps();
      document.querySelector(`.lang[data-lang="${getLang()}"]`).focus();
    });
  }
}
applyStatic();
renderLanguagePicker();
const touchOnly = matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches;
const hints = new Hints($('hud-hint'));
document.body.classList.toggle('touch-only', touchOnly);
input.bindTouch($('touch-pad'));
input.touchMode = touchOnly;

$('btn-play').addEventListener('click', () => wipe(goLoadout));
let howtoOpener = null;
function openHowto(opener) {
  howtoOpener = opener;
  showScreen('screen-howto');
  $('btn-howto-close').focus();
}
function menuScreen() {
  if (mode === 'paused') showScreen('screen-pause');
  else if (mode === 'loadout') {
    showScreen('screen-loadout');
    loadout.active = true;
  } else showScreen('screen-title');
}
$('btn-howto').addEventListener('click', () => openHowto($('btn-howto')));
$('btn-yard-howto').addEventListener('click', () => openHowto($('btn-yard-howto')));
$('btn-pause-howto').addEventListener('click', () => openHowto($('btn-pause-howto')));
$('btn-howto-close').addEventListener('click', () => {
  menuScreen();
  howtoOpener?.focus();
});
$('btn-back').addEventListener('click', () => wipe(goTitle));
$('btn-start').addEventListener('click', () => wipe(goMaps));
$('btn-maps-back').addEventListener('click', () => wipe(goLoadout));
$('btn-go').addEventListener('click', () => wipe(startRace));
let settingsOpener = null;
function openSettings(opener) {
  settingsOpener = opener;
  showScreen('screen-settings');
  document.querySelector('.lang[aria-pressed="true"]')?.focus();
}
$('btn-settings').addEventListener('click', () => openSettings($('btn-settings')));
$('btn-yard-settings').addEventListener('click', () => openSettings($('btn-yard-settings')));
function renderToggles() {
  $('toggle-sound').setAttribute('aria-checked', String(sfx.soundOn));
  $('toggle-music').setAttribute('aria-checked', String(sfx.musicOn));
}
renderToggles();
$('toggle-sound').addEventListener('click', () => {
  sfx.unlock();
  sfx.setSound(!sfx.soundOn);
  sfx.play('pick');
  renderToggles();
});
$('toggle-music').addEventListener('click', () => {
  sfx.unlock();
  sfx.setMusic(!sfx.musicOn);
  renderToggles();
});
$('btn-credits').addEventListener('click', () => {
  showScreen('screen-credits');
  $('btn-credits-close').focus();
});
$('btn-credits-close').addEventListener('click', () => {
  showScreen('screen-settings');
  $('btn-credits').focus();
});
$('btn-settings-close').addEventListener('click', () => {
  menuScreen();
  settingsOpener?.focus();
});
$('btn-resume').addEventListener('click', () => pause(false));
$('btn-restart').addEventListener('click', startRace);
$('btn-quit').addEventListener('click', goLoadout);
$('btn-menu').addEventListener('click', goTitle);
$('btn-pause').addEventListener('click', () => pause(true));
$('btn-continue').addEventListener('click', () => wipe(goLoadout));
$('btn-replay').addEventListener('click', () => wipe(startReplay));
$('btn-replay-exit').addEventListener('click', () => wipe(endReplay));
function unlockAudio() {
  sfx.unlock();
  $('sound-nudge').classList.add('hidden');
}
addEventListener('pointerdown', unlockAudio, { once: true });
addEventListener('keydown', unlockAudio, { once: true });

const cam = new Director(camera);

function updateSawSound() {
  let level = 0;
  let grinding = 0;
  if (mode === 'loadout') level = loadout.sawSpin / 42;
  else if ((mode === 'race' || mode === 'results') && !race.attract) {
    for (const b of race.boats) {
      if (!b.model.sawYaw || !b.alive) continue;
      const near = sfx.volumeAt(b.pos);
      const spin = (b.sawState.spin / 42) * near;
      if (spin > level) level = spin;
      if (b.sawState.chop > 0) grinding = Math.max(grinding, near);
    }
  }
  sfx.setSaw(level, grinding);
  let flame = 0;
  if (mode === 'loadout') flame = loadout.heat.flamethrower.firing ? 1 : 0;
  else if ((mode === 'race' || mode === 'results') && !race.attract) {
    for (const b of race.boats) {
      const h = b.heat.flamethrower;
      if (h?.firing && h.delay <= 0 && b.alive) flame = Math.max(flame, sfx.volumeAt(b.pos));
    }
  }
  sfx.setFlame(flame);
}

function handleEvents() {
  for (const e of race.events) {
    if (race.attract) continue;
    hud.handle(e);
    if (e.type === 'hurt') cam.bump(HURT_SHAKE[e.kind] ?? 1.2);
    if (e.type === 'ko') cam.shake = 1.6;
    if (e.type === 'lockShake') cam.bump(e.amount);
    if (e.type === 'warp') cam.lift(e.dy);
    if (e.type === 'finish') resultsTimer = 3.5;
    if (e.type === 'go') sfx.playMusic('race');
  }
  race.events.length = 0;
}

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  if (loading) {
    requestAnimationFrame(frame);
    return;
  }
  const state = input.poll();
  const pressed = input.pressed;

  if (pressed.has('pause') && $('screen-howto').classList.contains('hidden')) {
    if (mode === 'race') pause(true);
    else if (mode === 'paused') pause(false);
    else if (mode === 'replay') endReplay();
  }

  if (mode !== 'paused') {
    time += dt;
    charClock.value = time;
    const playerInput = mode === 'race' || mode === 'results'
      ? { throttle: state.throttle, steer: state.steer, use0: pressed.has('item0'), use1: pressed.has('item1'), hold0: state.hold0, hold1: state.hold1 }
      : null;
    const steps = import.meta.env.DEV ? (window.__bb?.steps ?? 1) : 1;
    if (mode === 'replay') {
      for (let i = 0; i < steps; i++) replay.step(dt);
      if (replay.done) endReplay();
    } else if (!race.frozen) {
      for (let i = 0; i < steps; i++) {
        race.update(dt, time + (i * dt), import.meta.env.DEV && window.__bb?.autopilot ? null : playerInput);
        recorder?.capture();
      }
      time += (steps - 1) * dt;
    }
    handleEvents();
    if (mode === 'race') hints.update(dt, race, state, pressed);
    fx.update(dt);
    current.world.update(time, dt, camera);
    if (current.world.events?.length) {
      for (const e of current.world.events.splice(0)) {
        const near = Math.max(0, 1 - e.pos.distanceTo(camera.position) / 320);
        if (near <= 0) continue;
        if (mode === 'race' || mode === 'replay' || mode === 'results') sfx.play(e.type === 'boom' ? 'mineBoom' : 'splash', e.pos);
        if (e.type === 'boom' && mode !== 'paused') cam.bump(e.power * near * near);
      }
    }
    if (resultsTimer > 0) {
      resultsTimer -= dt;
      if (resultsTimer <= 0 && mode === 'race') showResults();
    }
    if (mode === 'results' && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) renderResults(race);
  }

  if (!(import.meta.env.DEV && window.__bb?.freeCam)) cam.update(dt, race, mode === 'replay');
  if (race.player && !race.attract && mode !== 'replay') {
    hud.update(race, camera, mode === 'paused' ? 0 : dt);
    sfx.listener = race.player.pos;
    sfx.setEngine(Math.abs(race.player.speed) / BASE_SPEED, mode === 'race' && state.throttle > 0 && race.player.alive);
  } else {
    sfx.listener = cam.pos;
    sfx.setEngine(0, false);
  }
  updateSawSound();

  if (!(import.meta.env.DEV && window.__bb?.skipRender)) renderer.render(scene, camera);
  adaptResolution(dt);
  if (mode === 'loadout') loadout.render(dt);
  requestAnimationFrame(frame);
}

addEventListener('keydown', (e) => {
  const overlay = !$('screen-howto').classList.contains('hidden') || !$('screen-settings').classList.contains('hidden') || !$('screen-credits').classList.contains('hidden');
  if (e.code === 'Enter' && mode === 'title' && !overlay && !(document.activeElement instanceof HTMLButtonElement)) wipe(goLoadout);
  if (e.code === 'Escape' && !$('screen-howto').classList.contains('hidden')) {
    input.queued.delete('Escape');
    $('btn-howto-close').click();
  }
  if (e.code === 'Escape' && !$('screen-credits').classList.contains('hidden')) {
    input.queued.delete('Escape');
    $('btn-credits-close').click();
  } else if (e.code === 'Escape' && !$('screen-settings').classList.contains('hidden')) {
    input.queued.delete('Escape');
    $('btn-settings-close').click();
  }
});

if (import.meta.env.DEV) {
  window.__bb = {
    get race() {
      return race;
    },
    setup,
    sfx,
    input,
    scene,
    THREE,
    renderer,
    camera,
    cam,
    get recorder() {
      return recorder;
    },
    get replay() {
      return replay;
    },
    get world() {
      return current.world;
    },
    get venueGroup() {
      return current.group;
    },
    map: null,
    loadout,
    async simRace() {
      const map = pickMap(false);
      await prepareVenue(map);
      race?.dispose();
      const defs = PAINTS.map((paint, i) => ({ name: `Boat ${i + 1}`, color: paint.value, items: arrange(shuffle(ITEM_IDS).slice(0, 2)) }));
      useVenue(map);
      race = new Race({ scene, track: current.track, fx, sfx, shores: current.world.shores, solid: current.world.solid, raycast: current.world.raycast ?? null, chopper: current.world.chopper ?? null, hazards: current.world.hazards ?? null, defs, attract: false });
      mode = 'sim';
      hud.show(false);
      showScreen(null);
    },
  };
}

goTitle();
cam.update(0, race, false);
renderer.compileAsync(scene, camera).finally(() => {
  requestAnimationFrame(frame);
  requestAnimationFrame(() => document.body.classList.remove('booting'));
});
setTimeout(() => prepareVenue('jungle'), 1500);
