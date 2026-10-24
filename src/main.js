import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/saira-condensed/800.css';
import '@fontsource/saira-condensed/900.css';
import './style.css';
import * as THREE from 'three';
import { createTrack } from './track.js';
import { createWorld } from './world.js';
import { createJungle } from './jungle.js';
import { createAlps } from './alps.js';
import { createVenice } from './venice.js';
import { createMidway } from './midway.js';
import { MAPS } from './maps.js';
import { Recorder, Replay } from './replay.js';
import { Hints } from './hints.js';
import { setSurface, waveHeight } from './water.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Race, BASE_SPEED, COUNTDOWN } from './race.js';
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

function scaleWorld(group, world, scale) {
  const scenery = new THREE.Group();
  for (const child of [...group.children]) {
    if (child === world.water?.mesh || child.isLight) continue;
    scenery.add(child);
  }
  scenery.scale.setScalar(scale);
  group.add(scenery);
  world.shores = world.shores.map((b) => ({ ...b, x: b.x * scale, z: b.z * scale, rx: b.rx * scale, rz: b.rz * scale }));
  if (world.solid) {
    const solid = world.solid;
    const p = new THREE.Vector3();
    world.solid = (q) => solid(p.set(q.x / scale, q.y / scale, q.z / scale));
  }
  if (world.surface) {
    const sample = world.surface.sample.bind(world.surface);
    world.surface = { ...world.surface, sample: (x, z) => sample(x / scale, z / scale) };
  }
  const update = world.update.bind(world);
  world.update = (t, dt, camera) => {
    const real = camera.position.clone();
    camera.position.divideScalar(scale);
    update(t, dt, camera);
    camera.position.copy(real);
  };
}

function prepareVenue(id) {
  if (venues[id]) return Promise.resolve(venues[id]);
  building[id] ??= (async () => {
    const scale = MAPS[id].scale ?? 1;
    const group = new THREE.Group();
    group.visible = false;
    const builders = { jungle: createJungle, alps: createAlps, venice: createVenice, midway: createMidway };
    const built = createTrack(MAPS[id]);
    const world = builders[id] ? await builders[id](group, built, fx) : createWorld(group, built);
    const track = scale === 1 ? built : createTrack(MAPS[id], scale);
    if (scale !== 1) scaleWorld(group, world, scale);
    scene.add(group);
    venues[id] = { track, world, group };
    return venues[id];
  })();
  return building[id];
}

{
  const track = createTrack(MAPS.bay);
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  venues.bay = { track, world: createWorld(group, track), group };
}
let current = venue('bay');
const hud = new Hud(current.track, sfx);

function useVenue(id) {
  const next = venue(id);
  current.group.visible = false;
  next.group.visible = true;
  scene.fog = next.world.fog;
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
let shake = 0;
const HURT_SHAKE = { bullet: 0.25, laser: 0.3, reflect: 0.3, saw: 0.5, flame: 0, fire: 0 };

let recorder = null;
let replay = null;
let replaySongAt = null;

function newRace(attract, map = pickMap(attract)) {
  recorder?.detach();
  recorder = null;
  replay = null;
  $('replay-ui').classList.add('hidden');
  race?.dispose();
  fx.decals.clear();
  useVenue(map);
  current.world.chopper?.reset();
  race = new Race({ scene, track: current.track, fx, sfx: attract ? SILENT : sfx, shores: current.world.shores, solid: current.world.solid, chopper: current.world.chopper ?? null, defs: makeDefs(attract ? null : setup), attract });
  if (!attract) recorder = new Recorder(race, fx);
  cam.snap = true;
}

function startReplay() {
  hints.stop();
  if (!recorder?.frames.length) return;
  recorder.detach();
  replay = new Replay(recorder, scene, sfx);
  replaySongAt = (recorder.start ?? replay.time) + 1;
  replay.end = Math.min(replay.end, replaySongAt + sfx.musicLength('race') + 1);
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
  replaySongAt = null;
  sfx.playMusic('race');
  for (const b of race.boats) b.air = null;
  race.frozen = true;
  mode = 'results';
  $('replay-ui').classList.add('hidden');
  showScreen('screen-results');
  renderResults();
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
  sfx.unlock();
  sfx.playMusic('menu');
  if (!race?.attract) newRace(true);
  mode = 'loadout';
  hud.show(false);
  showScreen('screen-loadout');
  loadout.active = true;
}

let wiping = false;
const wipeCanvas = $('wipe');
const wipeCtx = wipeCanvas.getContext('2d');
const easeIn = (u) => u * u * u;
const easeOut = (u) => 1 - (1 - u) ** 3;

function drawIris(radius, spin) {
  const scale = Math.min(devicePixelRatio, 1.5);
  const w = Math.round(innerWidth * scale);
  const h = Math.round(innerHeight * scale);
  if (wipeCanvas.width !== w || wipeCanvas.height !== h) {
    wipeCanvas.width = w;
    wipeCanvas.height = h;
  }
  const ctx = wipeCtx;
  const cx = w / 2;
  const cy = h / 2;
  const r = radius * Math.hypot(w, h) * 0.5;
  const band = Math.max(10 * scale, r * 0.26);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0e2a47';
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.arc(cx, cy, r + band, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  if (r <= 0.5) return;
  const segments = 8;
  for (let k = 0; k < segments; k++) {
    const a0 = spin + (k / segments) * Math.PI * 2;
    const a1 = spin + ((k + 1) / segments) * Math.PI * 2;
    ctx.fillStyle = k % 2 ? '#ffffff' : '#ff4141';
    ctx.beginPath();
    ctx.arc(cx, cy, r + band, a0, a1);
    ctx.arc(cx, cy, r, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = '#0e2a47';
  ctx.lineWidth = Math.max(3 * scale, band * 0.1);
  for (const rr of [r, r + band]) {
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function animateIris(from, to, ms, ease, spinFrom, spinTo) {
  return new Promise((done) => {
    const start = performance.now();
    const step = (now) => {
      const u = Math.min(1, Math.max(0, (now - start) / ms));
      const k = ease(u);
      drawIris(from + (to - from) * k, spinFrom + (spinTo - spinFrom) * k);
      if (u < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

async function wipe(fn) {
  if (wiping) return;
  wiping = true;
  sfx.unlock();
  sfx.play('whoosh');
  wipeCanvas.classList.add('on');
  await animateIris(1.05, 0, 420, easeIn, 0, -3.5);
  await fn();
  await new Promise((r) => setTimeout(r, 120));
  sfx.play('splash');
  await animateIris(0, 1.05, 520, easeOut, -3.5, -7);
  wipeCanvas.classList.remove('on');
  wiping = false;
}

const MAP_CHOICES = ['bay', 'jungle', 'alps', 'venice', 'midway', 'random'];
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
  sfx.duckMusic(false);
  saveSetup();
  const map = pickMap(false);
  await prepareVenue(map);
  newRace(false, map);
  mode = 'race';
  resultsTimer = 0;
  hud.setup(race);
  hints.start(race, touchOnly);
  hud.show(true);
  showScreen(null);
  document.activeElement?.blur();
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
  renderResults();
  $('btn-continue').focus();
}

const BADGE_KEYS = { winner: 'badgeWinner', damage: 'badgeDamage', sinks: 'badgeSinks', tank: 'badgeTank', fishFood: 'badgeFishFood', air: 'badgeAir' };
const badgeSvg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const BADGE_ICONS = {
  winner: badgeSvg('<path d="M4 8 L8 12 L12 5 L16 12 L20 8 L18 18 H6 Z"/>'),
  damage: badgeSvg('<path d="M13 2 L5 14 H11 L10 22 L19 9 H13 Z"/>'),
  sinks: badgeSvg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1 V5 M12 19 V23 M1 12 H5 M19 12 H23"/>'),
  tank: badgeSvg('<path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z"/>'),
  fishFood: badgeSvg('<path d="M3 12 C7 6 14 6 18 12 C14 18 7 18 3 12 Z"/><path d="M18 12 L22 8 V16 Z"/><circle cx="8" cy="11" r="1.2"/>'),
  air: badgeSvg('<path d="M2 14 L10 12 L13 4 L15 4 L14 11 L21 9 L22 11 L14 14 L15 20 L13 20 L10 15 L3 16 Z"/>'),
};

function awardBadges(boats) {
  const out = new Map(boats.map((b) => [b, []]));
  const top = (key, value, ok = (v) => v > 0, low = false) => {
    let best = null;
    for (const b of boats) {
      const v = value(b);
      if (!ok(v)) continue;
      if (!best || (low ? v < value(best) : v > value(best))) best = b;
    }
    if (best) out.get(best).push(key);
  };
  const winner = boats.find((b) => b.finishOrder === 1);
  if (winner) out.get(winner).push('winner');
  top('damage', (b) => b.stats.dealt);
  top('sinks', (b) => b.stats.kills);
  top('tank', (b) => b.stats.taken, (v) => v >= 0, true);
  top('fishFood', (b) => b.stats.sunk);
  top('air', (b) => b.stats.jumps);
  return out;
}

function renderResults() {
  const p = race.player;
  const badges = awardBadges(race.boats);
  $('results-title').textContent = p.finished ? t('youFinished', { place: ordinal(p.finishOrder), n: p.finishOrder }) : t('raceOver');
  $('standings').innerHTML = `<li class="st-head"><span></span><span></span><span></span><span></span><span class="st-mini"><span>${t('colDmg')}</span><span>${t('colKo')}</span><span>${t('colSunk')}</span></span></li>` + race.order
    .map((b) => {
      const time = b.finished ? formatTime(b.finishTime) : t('lapN', { n: b.lap });
      const items = (badges.get(b) ?? []).map((k) => `<em class="badge badge-${k}">${BADGE_ICONS[k]}${t(BADGE_KEYS[k])}</em>`).join('');
      return `<li class="${b.isPlayer ? 'me' : ''}">
        <span class="st-place">${ordinal(b.place)}</span>
        <span class="st-dot" style="--paint:#${b.color.toString(16).padStart(6, '0')}"></span>
        <span class="st-name">${b.name}<span class="badges">${items}</span></span>
        <span class="st-time">${time}</span>
        <span class="st-mini" title="${t('statDealt')} / ${t('statKills')} / ${t('statSunk')}"><span>${Math.round(b.stats.dealt)}</span><span>${b.stats.kills}</span><span>${b.stats.sunk}</span></span>
      </li>`;
    })
    .join('');
  const me = p.stats;
  const cards = [
    [t('statDealt'), Math.round(me.dealt)],
    [t('statKills'), me.kills],
    [t('statSunk'), me.sunk],
  ];
  $('race-stats').innerHTML = cards.map(([label, value]) => `<div class="stat-card"><span>${label}</span><b>${value}</b></div>`).join('');
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
$('btn-howto').addEventListener('click', () => openHowto($('btn-howto')));
$('btn-pause-howto').addEventListener('click', () => openHowto($('btn-pause-howto')));
$('btn-howto-close').addEventListener('click', () => {
  showScreen(mode === 'paused' ? 'screen-pause' : 'screen-title');
  howtoOpener?.focus();
});
$('btn-back').addEventListener('click', () => wipe(goTitle));
$('btn-start').addEventListener('click', () => wipe(goMaps));
$('btn-maps-back').addEventListener('click', () => wipe(goLoadout));
$('btn-go').addEventListener('click', () => wipe(startRace));
$('btn-settings').addEventListener('click', () => {
  showScreen('screen-settings');
  document.querySelector('.lang[aria-pressed="true"]')?.focus();
});
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
  showScreen('screen-title');
  $('btn-credits').focus();
});
$('btn-settings-close').addEventListener('click', () => {
  showScreen('screen-title');
  $('btn-settings').focus();
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

const cam = {
  pos: new THREE.Vector3(0, 30, -40),
  look: new THREE.Vector3(),
  heading: 0,
  snap: true,
  focus: 0,
  focusTime: 0,
  orbit: 0,
};

const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const RIVER_SHOTS = ['chase', 'lead', 'bank', 'chase', 'lead'];

function riverShot(dt, k) {
  const t = race.track;
  cam.focusTime -= dt;
  const b = race.boats[cam.focus] ?? race.player;
  const hit = t.project(b.pos.x, b.pos.z, cam.focusTime > 0 ? cam.idx ?? -1 : -1);
  cam.idx = hit.idx;
  const big = t.river.drops.find((d) => d.height > 8);
  const toFalls = t.ahead(hit.s, big.s);
  if (cam.focusTime <= 0 || (cam.shot !== 'falls' && toFalls < 45 && toFalls > 25)) {
    cam.focus = Math.random() < 0.6 ? race.boats.indexOf(race.player) : Math.floor(Math.random() * race.boats.length);
    const focus = race.boats[cam.focus];
    const at = t.project(focus.pos.x, focus.pos.z);
    cam.idx = at.idx;
    const nearFalls = t.ahead(at.s, big.s) < 45;
    cam.shot = nearFalls ? 'falls' : RIVER_SHOTS[Math.floor(Math.random() * RIVER_SHOTS.length)];
    cam.focusTime = nearFalls ? 3.5 : 5 + Math.random() * 3;
    cam.side = Math.random() < 0.5 ? -1 : 1;
    cam.anchor = null;
    cam.snap = true;
  }
  const f = race.boats[cam.focus];
  const level = f.waterY;
  const hw = t.halfWidth;
  let desired;
  const nearExit = t.ahead(hit.s, t.river.tunnelOut) < 40 || t.ahead(t.river.tunnelOut, hit.s) < 15;
  if (cam.shot === 'chase' && nearExit) cam.shot = 'lead';
  if (cam.shot === 'chase' || cam.shot === 'lead') {
    const ahead = cam.shot === 'chase' ? -14 : 16;
    const p = t.point(cam.idx + Math.round(ahead / t.spacing), clamp(t.project(f.pos.x, f.pos.z, cam.idx).lateral * 0.6 + cam.side * 4, -hw + 4, hw - 4));
    desired = new THREE.Vector3(p.x, level + (cam.shot === 'chase' ? 6 : 5), p.z);
  } else if (cam.shot === 'bank') {
    if (!cam.anchor) {
      const p = t.point(cam.idx + Math.round(45 / t.spacing), cam.side * (hw - 3));
      cam.anchor = new THREE.Vector3(p.x, waveHeight(p.x, p.z, 0) + 3, p.z);
    }
    desired = cam.anchor.clone();
  } else {
    if (!cam.anchor) {
      const p = t.point(Math.round(big.s / t.spacing) + Math.round(34 / t.spacing), cam.side * 8);
      cam.anchor = new THREE.Vector3(p.x, waveHeight(p.x, p.z, 0) + 5, p.z);
    }
    desired = cam.anchor.clone();
  }
  cam.pos.lerp(desired, k(cam.shot === 'chase' || cam.shot === 'lead' ? 6 : 20));
  cam.look.lerp(new THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z), k(8));
}

const CANAL_SHOTS = ['chase', 'lead', 'bank', 'high', 'chase', 'lead'];

function canalShot(dt, k) {
  const t = race.track;
  cam.focusTime -= dt;
  const b = race.boats[cam.focus] ?? race.player;
  const hit = t.project(b.pos.x, b.pos.z, cam.focusTime > 0 ? cam.idx ?? -1 : -1);
  cam.idx = hit.idx;
  if (cam.focusTime <= 0) {
    cam.focus = Math.random() < 0.6 ? race.boats.indexOf(race.player) : Math.floor(Math.random() * race.boats.length);
    const focus = race.boats[cam.focus];
    cam.idx = t.project(focus.pos.x, focus.pos.z).idx;
    cam.shot = CANAL_SHOTS[Math.floor(Math.random() * CANAL_SHOTS.length)];
    cam.focusTime = 4 + Math.random() * 3;
    cam.side = Math.random() < 0.5 ? -1 : 1;
    cam.anchor = null;
    cam.snap = true;
  }
  const f = race.boats[cam.focus];
  const level = f.waterY;
  const room = (idx) => Math.max(2, t.widthAt(idx) - 4);
  let desired;
  if (cam.shot === 'chase' || cam.shot === 'lead' || cam.shot === 'high') {
    const ahead = cam.shot === 'lead' ? 14 : cam.shot === 'high' ? -18 : -12;
    const idx = cam.idx + Math.round(ahead / t.spacing);
    const lateral = t.project(f.pos.x, f.pos.z, cam.idx).lateral * 0.7 + cam.side * 2.5;
    const p = t.point(idx, clamp(lateral, -room(idx), room(idx)));
    desired = new THREE.Vector3(p.x, level + (cam.shot === 'high' ? 15 : cam.shot === 'chase' ? 5.5 : 4.5), p.z);
  } else {
    if (!cam.anchor) {
      const idx = cam.idx + Math.round(36 / t.spacing);
      const p = t.point(idx, cam.side * room(idx));
      cam.anchor = new THREE.Vector3(p.x, waveHeight(p.x, p.z, 0) + 2.5, p.z);
    }
    desired = cam.anchor.clone();
    if (t.ahead(hit.s, t.project(desired.x, desired.z).s) > t.length / 2) cam.focusTime = Math.min(cam.focusTime, 0.6);
  }
  for (const o of race.boats) {
    const gap = Math.hypot(o.pos.x - desired.x, o.pos.z - desired.z);
    if (gap < 7) desired.y = Math.max(desired.y, o.pos.y + 4 + (7 - gap) * 0.9);
  }
  cam.pos.lerp(desired, k(cam.shot === 'bank' ? 20 : 6));
  cam.look.lerp(new THREE.Vector3(f.pos.x, f.pos.y + 1, f.pos.z), k(8));
}

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

function updateCamera(dt) {
  if (import.meta.env.DEV && window.__bb?.freeCam) return;
  const k = (rate) => (cam.snap ? 1 : 1 - Math.exp(-rate * dt));
  let fov = 66;

  if (mode === 'replay' && race.track.river) {
    const b = race.boats[cam.focus];
    if (b && cam.lastY !== undefined && Math.abs(b.waterY - cam.lastY) > 30) {
      const dy = b.waterY - cam.lastY;
      cam.pos.y += dy;
      cam.look.y += dy;
      if (cam.anchor) cam.anchor.y += dy;
    }
    riverShot(dt, k);
    cam.lastY = race.boats[cam.focus].waterY;
  } else if (mode === 'replay' && race.track.banked) {
    canalShot(dt, k);
  } else if (race.attract || !race.player || mode === 'replay') {
    cam.focusTime -= dt;
    if (cam.focusTime <= 0) {
      const pickPlayer = mode === 'replay' && Math.random() < 0.6;
      cam.focus = pickPlayer ? race.boats.indexOf(race.player) : Math.floor(Math.random() * race.boats.length);
      cam.focusTime = 7;
      cam.orbit = Math.random() * Math.PI * 2;
      cam.snap = true;
    }
    const b = race.boats[cam.focus];
    if (cam.lastY !== undefined && Math.abs(b.waterY - cam.lastY) > 30) {
      cam.pos.y += b.waterY - cam.lastY;
      cam.look.y += b.waterY - cam.lastY;
    }
    cam.lastY = b.waterY;
    cam.orbit += dt * 0.18;
    const desired = new THREE.Vector3(b.pos.x + Math.cos(cam.orbit) * 34, b.waterY + 12, b.pos.z + Math.sin(cam.orbit) * 30);
    cam.pos.lerp(desired, k(3));
    cam.look.lerp(new THREE.Vector3(b.pos.x, b.pos.y + 1, b.pos.z), k(6));
  } else {
    const b = race.player;
    cam.heading = cam.snap ? b.heading : lerpAngle(cam.heading, b.heading, k(4.5));
    const fx = Math.sin(cam.heading);
    const fz = Math.cos(cam.heading);
    const speedFrac = Math.max(0, Math.min(1.4, b.speed / BASE_SPEED));
    const back = 11 + speedFrac * 2;
    const chase = new THREE.Vector3(b.pos.x - fx * back, b.waterY + 6 + b.yOffset * (b.air?.fall ? 0.95 : 0.6), b.pos.z - fz * back);
    let desired = chase;
    if (race.state === 'countdown') {
      const u = Math.min(1, Math.max(0, (COUNTDOWN - race.countdown) / (COUNTDOWN - 1)));
      const e = u * u * (3 - 2 * u);
      const a = 0.25 * Math.PI + e * 0.75 * Math.PI;
      const radius = 15 + e * (back - 15);
      desired = new THREE.Vector3(
        b.pos.x + (fx * Math.cos(a) + fz * Math.sin(a)) * radius,
        b.waterY + 4 + e * 3,
        b.pos.z + (fz * Math.cos(a) - fx * Math.sin(a)) * radius,
      );
    }
    cam.pos.lerp(desired, k(race.state === 'countdown' ? 20 : 12));
    cam.look.lerp(new THREE.Vector3(b.pos.x + fx * 9, b.pos.y + 2, b.pos.z + fz * 9), k(10));
    fov = 60 + speedFrac * 10;
  }
  cam.snap = false;

  camera.position.copy(cam.pos);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 4);
  }
  camera.lookAt(cam.look);
  if (Math.abs(camera.fov - fov) > 0.05) {
    camera.fov += (fov - camera.fov) * (1 - Math.exp(-3 * dt));
    camera.updateProjectionMatrix();
  }
}

function handleEvents() {
  for (const e of race.events) {
    if (race.attract) continue;
    hud.handle(e);
    if (e.type === 'hurt') shake = Math.max(shake, HURT_SHAKE[e.kind] ?? 1.2);
    if (e.type === 'ko') shake = 1.6;
    if (e.type === 'lockShake') shake = Math.max(shake, e.amount);
    if (e.type === 'warp') {
      cam.pos.y += e.dy;
      cam.look.y += e.dy;
    }
    if (e.type === 'finish') resultsTimer = 3.5;
    if (e.type === 'go') sfx.playMusic('race');
  }
  race.events.length = 0;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
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
      if (replaySongAt !== null && replay.time >= replaySongAt) {
        sfx.playMusic('race', { at: replay.time - replaySongAt, loop: false });
        replaySongAt = null;
      }
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
        if (e.type === 'boom' && mode !== 'paused') shake = Math.max(shake, e.power * near * near);
      }
    }
    if (resultsTimer > 0) {
      resultsTimer -= dt;
      if (resultsTimer <= 0 && mode === 'race') showResults();
    }
    if (mode === 'results' && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) renderResults();
  }

  updateCamera(dt);
  if (race.player && !race.attract && mode !== 'replay') {
    hud.update(race, camera, mode === 'paused' ? 0 : dt);
    sfx.listener = race.player.pos;
    sfx.setEngine(Math.abs(race.player.speed) / BASE_SPEED, mode === 'race' && state.throttle > 0 && race.player.alive);
  } else {
    sfx.listener = cam.pos;
    sfx.setEngine(0, false);
  }
  updateSawSound();

  renderer.render(scene, camera);
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
  }
  if (e.code === 'Escape' && !$('screen-settings').classList.contains('hidden')) {
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
    map: null,
    loadout,
    async simRace() {
      const map = pickMap(false);
      await prepareVenue(map);
      race?.dispose();
      const defs = PAINTS.map((paint, i) => ({ name: `Boat ${i + 1}`, color: paint.value, items: arrange(shuffle(ITEM_IDS).slice(0, 2)) }));
      useVenue(map);
      race = new Race({ scene, track: current.track, fx, sfx, shores: current.world.shores, solid: current.world.solid, chopper: current.world.chopper ?? null, defs, attract: false });
      mode = 'sim';
      hud.show(false);
      showScreen(null);
    },
  };
}

goTitle();
requestAnimationFrame(frame);
setTimeout(() => prepareVenue('jungle'), 1500);
