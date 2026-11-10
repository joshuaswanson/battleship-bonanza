import '../node/stubs.mjs';
import * as THREE from 'three';
import { check } from '../lib.mjs';
import { createTrack } from '../../src/track.js';
import { MAPS } from '../../src/maps.js';
import { ellipseHit } from '../../src/terrain.js';

const BUILDERS = { bay: ['world', 'createWorld'], jungle: ['jungle', 'createJungle'], frozen: ['frozen', 'createFrozen'], volcano: ['volcano', 'createVolcano'], alps: ['alps', 'createAlps'], venice: ['venice', 'createVenice'], canyon: ['canyon', 'createCanyon'], docks: ['docks', 'createDocks'], tuebingen: ['tuebingen', 'createTuebingen'] };
const EYE = 1.2;
const JUMP = 15;

for (const id of (process.argv[2] ?? Object.keys(BUILDERS).join(',')).split(',')) {
  const [file, name] = BUILDERS[id];
  const track = createTrack(MAPS[id]);
  const world = await (await import(`../../src/${file}.js`))[name](new THREE.Group(), track, { puffs: { emit() {} } });
  const spot = new THREE.Vector3();
  const blocked = [];
  for (let i = 0; i < track.px.length; i++) {
    const p = track.point(i, 0);
    spot.set(p.x, 0, p.z);
    if (world.shores.some((b) => b.rx && ellipseHit([{ rot: 0, ...b }], spot))) blocked.push(i);
  }
  check(`${id}: no obstacle sits on the centre of the course`, !blocked.length, blocked.length ? `samples ${blocked.slice(0, 6).join(', ')}` : '');
  if (!world.raycast) continue;
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const walls = [];
  const land = track.river?.land;
  const airborne = (at) => land && (Math.abs(at - land.launch) < JUMP || Math.abs(at - land.lip) < JUMP);
  for (let i = 0; i < track.px.length; i++) {
    if (airborne(i * track.spacing)) continue;
    const j = track.next[i];
    const a = track.point(i, 0);
    const b = track.point(j, 0);
    const ya = (track.level?.(i * track.spacing) ?? 0) + EYE;
    const yb = (track.level?.(j * track.spacing) ?? 0) + EYE;
    from.set(a.x, ya, a.z);
    dir.set(b.x - a.x, yb - ya, b.z - a.z);
    const length = dir.length();
    if (!length || length > 4 * track.spacing) continue;
    const hit = world.raycast(from, dir.normalize(), length);
    if (hit && (hit.distance ?? 0) < length) walls.push(i);
  }
  check(`${id}: nothing solid crosses the centre of the course`, !walls.length, walls.length ? `samples ${walls.slice(0, 6).join(', ')}` : '');
}
