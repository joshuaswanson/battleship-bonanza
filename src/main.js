import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/saira-condensed/800.css';
import '@fontsource/saira-condensed/900.css';
import './style.css';
import * as THREE from 'three';
import { createTrack } from './track.js';
import { createWorld } from './world.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Race, BASE_SPEED } from './race.js';
import { Hud, ordinal, formatTime } from './hud.js';
import { Loadout, PAINTS } from './loadout.js';
import { logoSvg } from './logo.js';
import { TitleBoat } from './titleBoat.js';
import { ITEMS, ITEM_IDS } from './items.js';

const $ = (id) => document.getElementById(id);
for (const el of document.querySelectorAll('[data-logo]')) el.innerHTML = logoSvg({ boat: el.dataset.logo !== '3d' });
new TitleBoat(document.querySelector('.title-logo'));

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

const track = createTrack();
const world = createWorld(scene, track);
const fx = new Effects(scene);
const sfx = new Sfx();
const input = new Input();
const hud = new Hud(track, sfx);

const AI_NAMES = ['Noodle', 'Dumpling', 'Pickle', 'Marshmallow', 'Waffles', 'Gumdrop', 'Pudding', 'Turnip', 'Meatball'];

function loadSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-setup'));
    if (saved && Array.isArray(saved.items) && saved.items.every((id) => ITEMS[id])) return saved;
  } catch {}
  return { name: 'Sea Biscuit', color: PAINTS[0].value, items: ['jetpack', 'machinegun'] };
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

function randomLoadout() {
  const weapons = ITEM_IDS.filter((id) => ITEMS[id].group === 'weapons');
  const first = weapons[Math.floor(Math.random() * weapons.length)];
  const rest = ITEM_IDS.filter((id) => id !== first);
  return [first, rest[Math.floor(Math.random() * rest.length)]];
}

function makeDefs(player) {
  const names = shuffle(AI_NAMES);
  const colors = shuffle(PAINTS.map((p) => p.value).filter((c) => c !== player?.color));
  const defs = [];
  for (let i = 0; i < 6; i++) {
    if (player && i === 3) defs.push({ name: player.name, color: player.color, items: [...player.items], isPlayer: true });
    else defs.push({ name: names.pop(), color: colors.pop() ?? PAINTS[i].value, items: randomLoadout() });
  }
  return defs;
}

let mode = 'title';
let race = null;
let resultsTimer = 0;
let time = 0;
let shake = 0;

function newRace(attract) {
  race?.dispose();
  race = new Race({ scene, track, fx, sfx, defs: makeDefs(attract ? null : setup), attract });
  cam.snap = true;
}

const screens = ['screen-title', 'screen-howto', 'screen-loadout', 'screen-pause', 'screen-results'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  loadout.active = false;
}

function goTitle() {
  mode = 'title';
  newRace(true);
  hud.show(false);
  showScreen('screen-title');
  $('btn-play').focus();
}

function goLoadout() {
  sfx.unlock();
  if (!race?.attract) newRace(true);
  mode = 'loadout';
  hud.show(false);
  showScreen('screen-loadout');
  loadout.active = true;
}

function startRace() {
  if (setup.items.length < 2) return;
  sfx.unlock();
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
  $('results-title').textContent = p.finished ? `You finished ${ordinal(p.finishOrder)}` : 'Race over';
  $('standings').innerHTML = race.order
    .map((b) => {
      const time = b.finished ? formatTime(b.finishTime) : `Lap ${b.lap}`;
      const items = b.items.map((id) => ITEMS[id].name).join(' and ');
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

$('btn-play').addEventListener('click', goLoadout);
const soundLabel = () => ($('btn-sound').textContent = sfx.muted ? 'Sound off' : 'Sound on');
soundLabel();
$('btn-sound').addEventListener('click', () => {
  sfx.unlock();
  sfx.toggleMute();
  soundLabel();
});
$('btn-howto').addEventListener('click', () => {
  showScreen('screen-howto');
  $('btn-howto-close').focus();
});
$('btn-howto-close').addEventListener('click', () => {
  showScreen('screen-title');
  $('btn-howto').focus();
});
$('btn-back').addEventListener('click', goTitle);
$('btn-start').addEventListener('click', startRace);
$('btn-resume').addEventListener('click', () => pause(false));
$('btn-restart').addEventListener('click', startRace);
$('btn-quit').addEventListener('click', goLoadout);
$('btn-menu').addEventListener('click', goTitle);
$('btn-pause').addEventListener('click', () => pause(true));
$('btn-again').addEventListener('click', startRace);
$('btn-change').addEventListener('click', goLoadout);
addEventListener('pointerdown', () => sfx.unlock(), { once: true });

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

  if (race.attract) {
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
    const chase = new THREE.Vector3(b.pos.x - fx * back, b.waterY + 6 + b.yOffset * 0.6, b.pos.z - fz * back);
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
    if (e.type === 'hurt') shake = Math.max(shake, e.kind === 'bullet' ? 0.25 : 1.2);
    if (e.type === 'ko') shake = 1.6;
    if (e.type === 'lockShake') shake = Math.max(shake, e.amount);
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

  if (pressed.has('mute')) {
    sfx.toggleMute();
    soundLabel();
  }
  if (pressed.has('pause')) {
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
    world.update(time, dt, camera);
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
  if (e.code === 'Enter' && mode === 'title' && $('screen-howto').classList.contains('hidden')) goLoadout();
  if (e.code === 'Escape' && !$('screen-howto').classList.contains('hidden')) $('btn-howto-close').click();
});

if (import.meta.env.DEV) window.__bb = { get race() { return race; }, setup, camera, cam, world, loadout };

goTitle();
requestAnimationFrame(frame);
