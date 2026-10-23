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
import { MAPS } from './maps.js';
import { setSurface } from './water.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Race, BASE_SPEED } from './race.js';
import { Hud, formatTime } from './hud.js';
import { LANGUAGES, t, ordinal, itemInSentence, getLang, setLang, applyStatic } from './i18n.js';
import { Loadout, PAINTS } from './loadout.js';
import { logoSvg, layoutLogoText } from './logo.js';
import { TitleBoat } from './titleBoat.js';
import { ITEMS, ITEM_IDS } from './items.js';
import { arrange } from './boatModel.js';

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
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, 1, 0.5, 3000);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const fx = new Effects(scene);
fx.camera = camera;
const sfx = new Sfx();
const SILENT = { play() {} };
const input = new Input();

const venues = {};
function venue(id) {
  if (!venues[id]) {
    const track = createTrack(MAPS[id]);
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    const world = id === 'jungle' ? createJungle(group, track, fx) : createWorld(group, track);
    venues[id] = { track, world, group };
  }
  return venues[id];
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

function newRace(attract) {
  race?.dispose();
  useVenue(pickMap(attract));
  race = new Race({ scene, track: current.track, fx, sfx: attract ? SILENT : sfx, shores: current.world.shores, defs: makeDefs(attract ? null : setup), attract });
  cam.snap = true;
}

const screens = ['screen-title', 'screen-howto', 'screen-settings', 'screen-loadout', 'screen-maps', 'screen-pause', 'screen-results'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  loadout.active = false;
}

function goTitle() {
  sfx.playMusic(true);
  mode = 'title';
  newRace(true);
  hud.show(false);
  showScreen('screen-title');
  $('btn-play').focus();
}

function goLoadout() {
  sfx.unlock();
  sfx.playMusic(true);
  if (!race?.attract) newRace(true);
  mode = 'loadout';
  hud.show(false);
  showScreen('screen-loadout');
  loadout.active = true;
}

let wiping = false;
function wipe(fn) {
  if (wiping) return;
  wiping = true;
  sfx.unlock();
  sfx.play('whoosh');
  const el = $('wipe');
  el.className = 'wipe cover';
  el.addEventListener(
    'animationend',
    () => {
      fn();
      sfx.play('splash');
      el.className = 'wipe reveal';
      el.addEventListener(
        'animationend',
        () => {
          el.className = 'wipe';
          wiping = false;
        },
        { once: true },
      );
    },
    { once: true },
  );
}

const MAP_CHOICES = ['bay', 'jungle', 'random'];
function renderMaps() {
  $('map-cards').innerHTML = MAP_CHOICES.map((id, i) => {
    const art = id === 'random' ? 'map-art random' : 'map-art';
    const style = id === 'random' ? '' : ` style="background-image:url('${import.meta.env.BASE_URL}maps/${id}.jpg')"`;
    return `<button class="map-card" role="radio" data-map="${id}" aria-checked="${setup.map === id}" style="--i:${i}">
      <div class="${art}"${style}></div>
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

function startRace() {
  if (!setup.items.every(Boolean)) return;
  sfx.unlock();
  sfx.playMusic(false);
  saveSetup();
  newRace(false);
  mode = 'race';
  resultsTimer = 0;
  hud.setup(race);
  hud.show(true);
  showScreen(null);
  document.activeElement?.blur();
}

function pause(on) {
  if (on && mode === 'race') {
    mode = 'paused';
    showScreen('screen-pause');
    $('btn-resume').focus();
  } else if (!on && mode === 'paused') {
    mode = 'race';
    showScreen(null);
    document.activeElement?.blur();
  }
}

function showResults() {
  mode = 'results';
  showScreen('screen-results');
  renderResults();
  $('btn-again').focus();
}

function renderResults() {
  const p = race.player;
  $('results-title').textContent = p.finished ? t('youFinished', { place: ordinal(p.finishOrder), n: p.finishOrder }) : t('raceOver');
  $('standings').innerHTML = race.order
    .map((b) => {
      const time = b.finished ? formatTime(b.finishTime) : t('lapN', { n: b.lap });
      const items = b.items.map(itemInSentence).join(` ${t('and')} `);
      return `<li class="${b.isPlayer ? 'me' : ''}">
        <span class="st-place">${ordinal(b.place)}</span>
        <span class="st-dot" style="--paint:#${b.color.toString(16).padStart(6, '0')}"></span>
        <span class="st-name">${b.name}<small>${items}</small></span>
        <span class="st-time">${time}</span>
      </li>`;
    })
    .join('');
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
document.body.classList.toggle('touch-only', touchOnly);

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
$('btn-settings-close').addEventListener('click', () => {
  showScreen('screen-title');
  $('btn-settings').focus();
});
$('btn-resume').addEventListener('click', () => pause(false));
$('btn-restart').addEventListener('click', startRace);
$('btn-quit').addEventListener('click', goLoadout);
$('btn-menu').addEventListener('click', goTitle);
$('btn-pause').addEventListener('click', () => pause(true));
$('btn-again').addEventListener('click', startRace);
$('btn-change').addEventListener('click', () => wipe(goLoadout));
addEventListener('pointerdown', () => sfx.unlock(), { once: true });
addEventListener('keydown', () => sfx.unlock(), { once: true });

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

function updateCamera(dt) {
  if (import.meta.env.DEV && window.__bb?.freeCam) return;
  const k = (rate) => (cam.snap ? 1 : 1 - Math.exp(-rate * dt));
  let fov = 66;

  if (race.attract || !race.player) {
    cam.focusTime -= dt;
    if (cam.focusTime <= 0) {
      cam.focus = Math.floor(Math.random() * race.boats.length);
      cam.focusTime = 7;
      cam.orbit = Math.random() * Math.PI * 2;
      cam.snap = true;
    }
    const b = race.boats[cam.focus];
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
      const u = Math.min(1, Math.max(0, (4.2 - race.countdown) / 3.2));
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
  }

  if (mode !== 'paused') {
    time += dt;
    const playerInput = mode === 'race' || mode === 'results'
      ? { throttle: state.throttle, steer: state.steer, use0: pressed.has('item0'), use1: pressed.has('item1'), hold0: state.hold0, hold1: state.hold1 }
      : null;
    const steps = import.meta.env.DEV ? (window.__bb?.steps ?? 1) : 1;
    for (let i = 0; i < steps; i++) race.update(dt, time + (i * dt), import.meta.env.DEV && window.__bb?.autopilot ? null : playerInput);
    time += (steps - 1) * dt;
    handleEvents();
    fx.update(dt);
    current.world.update(time, dt, camera);
    if (resultsTimer > 0) {
      resultsTimer -= dt;
      if (resultsTimer <= 0 && mode === 'race') showResults();
    }
    if (mode === 'results' && Math.floor(time * 2) !== Math.floor((time - dt) * 2)) renderResults();
  }

  updateCamera(dt);
  if (race.player && !race.attract) {
    hud.update(race, camera, dt);
    sfx.listener = race.player.pos;
    sfx.setEngine(Math.abs(race.player.speed) / BASE_SPEED, mode === 'race');
  } else {
    sfx.listener = cam.pos;
    sfx.setEngine(0, false);
  }

  renderer.render(scene, camera);
  if (mode === 'loadout') loadout.render(dt);
  requestAnimationFrame(frame);
}

addEventListener('keydown', (e) => {
  const overlay = !$('screen-howto').classList.contains('hidden') || !$('screen-settings').classList.contains('hidden');
  if (e.code === 'Enter' && mode === 'title' && !overlay && !(document.activeElement instanceof HTMLButtonElement)) wipe(goLoadout);
  if (e.code === 'Escape' && !$('screen-howto').classList.contains('hidden')) {
    input.queued.delete('Escape');
    $('btn-howto-close').click();
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
    camera,
    cam,
    get world() {
      return current.world;
    },
    map: null,
    loadout,
    simRace() {
      race?.dispose();
      const defs = PAINTS.map((paint, i) => ({ name: `Boat ${i + 1}`, color: paint.value, items: arrange(shuffle(ITEM_IDS).slice(0, 2)) }));
      useVenue(pickMap(false));
      race = new Race({ scene, track: current.track, fx, sfx, shores: current.world.shores, defs, attract: false });
      mode = 'sim';
      hud.show(false);
      showScreen(null);
    },
  };
}

goTitle();
requestAnimationFrame(frame);
setTimeout(() => venue('jungle'), 1500);
