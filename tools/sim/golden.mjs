import '../node/stubs.mjs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
globalThis.self ??= globalThis;
let seed = 12345;
Math.random = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const { createTrack } = await import('../../src/track.js');
const { MAPS } = await import('../../src/maps.js');
const { setSurface } = await import('../../src/water.js');
const { Race } = await import('../../src/race.js');
const B = { bay: ['world', 'createWorld'], jungle: ['jungle', 'createJungle'], frozen: ['frozen', 'createFrozen'], volcano: ['volcano', 'createVolcano'], alps: ['alps', 'createAlps'], venice: ['venice', 'createVenice'], canyon: ['canyon', 'createCanyon'], docks: ['docks', 'createDocks'], midway: ['midway', 'createMidway'] };
const secs = +(process.argv[2] ?? 150);
const recorder = (h, counts, path = '') => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : recorder(h, counts, path + '.' + String(k))), apply: (t, me, args) => { counts[path] = (counts[path] ?? 0) + 1; h.update(path + '(' + args.map((a) => (typeof a === 'number' ? a.toFixed(3) : typeof a === 'string' ? a : a?.isVector3 ? [a.x, a.y, a.z].map((v) => v.toFixed(2)).join('/') : typeof a)).join(',') + ')'); return recorder(h, counts, path + '()'); } });
const any = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : any()), apply: () => any() });
for (const id of (process.argv[3] ?? Object.keys(B).join(',')).split(',')) {
  seed = 12345;
  try {
    const track = createTrack(MAPS[id]);
    const scene = new THREE.Scene();
    const fxHash = createHash('md5'); const counts = {};
    const world = await (await import(`../../src/${B[id][0]}.js`))[B[id][1]](scene, track, any());
    setSurface(world.surface ?? null);
    const items = [['machinegun', 'missiles'], ['mines', 'spikes'], ['laser', 'emp'], ['saw', 'jetpack'], ['flamethrower', 'grapple'], ['machinegun', 'mines']];
    const defs = items.map((it, i) => ({ name: 'ai' + i, color: 0xff0000, items: it }));
    const race = new Race({ scene, track, fx: recorder(fxHash, counts, 'fx'), sfx: recorder(fxHash, counts, 'sfx'), shores: world.shores, solid: world.solid, raycast: world.raycast ?? null, chopper: world.chopper ?? null, hazards: world.hazards ?? null, defs, attract: true });
    const cam = new THREE.PerspectiveCamera();
    const h = createHash('md5');
    let formed = 0;
    for (let f = 0; f < secs * 60; f++) {
      race.update(1 / 60, f / 60, null);
      world.update(f / 60, 1 / 60, cam);
      race.events.length = 0;
      if (f % 30 === 0) for (const b of race.boats) { h.update([b.pos.x, b.pos.y, b.pos.z, b.heading, b.speed, b.formP, b.hp, b.roll, b.pitch].map((v) => (+v || 0).toFixed(4)).join(',')); if (b.formP >= 1) formed++; }
    }
    console.log(id.padEnd(8), h.digest('hex'), 'fx', fxHash.digest('hex'), 'marks', race.tireMarks ? 'yes' : 'no', Object.entries(counts).filter(([k]) => /soot|explosion|puffs|bubbles|splash\b/.test(k)).map(([k, v]) => k.replace('fx.', '') + ':' + v).join(' '), 'formed samples', formed, 'laps', race.boats.map((b) => (b.dist / track.length).toFixed(2)).join(' '));
  } catch (e) { console.log(id.padEnd(8), 'ERROR', String(e).slice(0, 120)); }
}
