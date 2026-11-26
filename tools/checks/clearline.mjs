import '../node/stubs.mjs';
import * as THREE from 'three';
import { check } from '../lib.mjs';
import { createTrack } from '../../src/track.js';
import { MAPS } from '../../src/maps.js';
import { ellipseHit } from '../../src/terrain.js';
import { Collider } from '../../src/collider.js';

const BUILDERS = { bay: ['world', 'createWorld'], jungle: ['jungle', 'createJungle'], frozen: ['frozen', 'createFrozen'], volcano: ['volcano', 'createVolcano'], alps: ['alps', 'createAlps'], venice: ['venice', 'createVenice'], canyon: ['canyon', 'createCanyon'], docks: ['docks', 'createDocks'], tuebingen: ['tuebingen', 'createTuebingen'] };
const EYE = 1.2;

async function sceneryRaycast(group, world) {
  const skip = new Set([world.water?.mesh].filter(Boolean));
  group.traverse((o) => {
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (o.geometry?.attributes?.aFlow || m?.transparent || m?.uniforms?.uThickness) skip.add(o);
  });
  for (const c of group.children) if (!c.isGroup) skip.add(c);
  group.updateMatrixWorld(true);
  const collider = new Collider();
  await collider.addObject(group, skip, async () => {});
  return (origin, dir, far) => collider.raycast(origin, dir, far);
}
const JUMP = 15;
const FLIGHT = { truck: 200, cart: 220, sub: 200 };

for (const id of (process.argv[2] ?? Object.keys(BUILDERS).join(',')).split(',')) {
  const [file, name] = BUILDERS[id];
  const track = createTrack(MAPS[id]);
  const group = new THREE.Group();
  const world = await (await import(`../../src/${file}.js`))[name](group, track, { puffs: { emit() {} }, mist() {} });
  const spot = new THREE.Vector3();
  const blocked = [];
  for (let i = 0; i < track.px.length; i++) {
    const p = track.point(i, 0);
    spot.set(p.x, 0, p.z);
    if (world.shores.some((b) => b.rx && ellipseHit([{ rot: 0, ...b }], spot))) blocked.push(i);
  }
  check(`${id}: no obstacle sits on the centre of the course`, !blocked.length, blocked.length ? `samples ${blocked.slice(0, 6).join(', ')}` : '');
  const raycast = world.raycast ?? (await sceneryRaycast(group, world));
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const walls = [];
  const land = track.river?.land;
  const airborne = (at) => land && (Math.abs(at - land.lip) < JUMP || (at > land.launch - JUMP && at < land.launch + (FLIGHT[land.kind] ?? JUMP)));
  for (let i = 0; i < track.px.length; i++) {
    if (airborne(i * track.spacing) || track.whirlpool?.hidden(track.mainIndex(i))) continue;
    const j = track.next[i];
    const a = track.point(i, 0);
    const b = track.point(j, 0);
    const ya = (track.level?.(i * track.spacing) ?? 0) + EYE;
    const yb = (track.level?.(j * track.spacing) ?? 0) + EYE;
    from.set(a.x, ya, a.z);
    dir.set(b.x - a.x, yb - ya, b.z - a.z);
    const length = dir.length();
    if (!length || length > 4 * track.spacing) continue;
    const hit = raycast(from, dir.normalize(), length);
    if (hit && (hit.distance ?? 0) < length) walls.push(i);
  }
  check(`${id}: nothing solid crosses the centre of the course`, !walls.length, walls.length ? `samples ${walls.slice(0, 6).join(', ')}` : '');
}
