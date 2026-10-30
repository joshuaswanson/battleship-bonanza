import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mat, ROCK } from './world.js';
import { groundMesh, noise, smooth } from './mapKit.js';

export const BEACH_COLORS = {
  concrete: 0x8f8d86,
  concreteDark: 0x5f5e5a,
  bunkerSlit: 0x14130f,
  hedgehog: 0x4b4640,
  crater: 0x8a7248,
  craterDark: 0x5a4a30,
  sandbag: 0xb7a67a,
  craftGrey: 0x5d6b6e,
  craftDark: 0x3a4447,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const HEDGEHOG = mergeGeometries(
  [[0.62, 0], [-0.62, 0.3], [0, -0.62]].map(([rx, rz], k) => new THREE.BoxGeometry(0.42, 4.6, 0.42).rotateZ(rz + 0.95 * (k - 1)).rotateX(rx).translate(0, 1.5, 0)),
);
const COAST = -424;
const WET = 36;
const BEACH_TOP = 6;
const BLUFF_FROM = 262;
const BLUFF_TO = 330;
const BLUFF_RISE = 36;
const WEST = -340;
const EAST = 980;
const HEDGEHOG_GAP = 30;
const CLEAR_ENDS = 110;
const SHOT_EVERY = 0.55;
const BUNKERS = [150, 320, 490];

const coastAt = (x) => COAST + 16 * Math.sin(x * 0.011) + 9 * Math.sin(x * 0.031 + 1);

export function onIsland(x, z, margin = 0) {
  return x > WEST - margin && x < EAST + margin && z < coastAt(x) + margin;
}

function shoreHeight(x, z) {
  const inland = coastAt(x) - z;
  const ends = smooth(WEST, WEST + 130, x) * (1 - smooth(EAST - 130, EAST, x));
  const flat = inland <= 0 ? inland * 0.12 : Math.min(BEACH_TOP, (inland * BEACH_TOP) / WET);
  const bluff = smooth(BLUFF_FROM, BLUFF_TO, inland) * (BLUFF_RISE + 18 * noise(x * 1.2, z * 1.2));
  return Math.max(-8, flat + bluff + 0.6 * noise(x * 3.4, z * 3.4)) * ends + -8 * (1 - ends);
}

function bunker(batch, x, y, z) {
  batch.add('concrete', BOX, mat(x, y + 6, z, 46, 13, 28));
  batch.add('concreteDark', BOX, mat(x, y + 13.4, z, 52, 2.6, 34));
  batch.add('bunkerSlit', BOX, mat(x, y + 7, z + 14.1, 28, 2.8, 0.4));
  batch.add('concreteDark', BOX, mat(x, y + 5, z + 15, 32, 0.9, 2));
  batch.add('hedgehog', CYL, mat(x, y + 7.2, z + 21, 0.8, 14, 0.8, Math.PI / 2 - 0.16, 0, 0));
}

function crater(batch, x, y, z, r, rand) {
  batch.add('crater', CYL, mat(x, y - 0.06, z, r, 0.16, r * (0.8 + rand() * 0.3)));
  batch.add('craterDark', CYL, mat(x, y - 0.02, z, r * 0.6, 0.16, r * 0.5));
}

function landingCraft(batch, x, y, z, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  batch.add('craftGrey', BOX, mat(x, y + 1.3, z, 6.6, 2.6, 15, 0, yaw, 0.12));
  batch.add('craftDark', BOX, mat(x + s * 8.6, y + 0.7, z + c * 8.6, 6.2, 0.4, 5, 0.3, yaw, 0.12));
  batch.add('craftDark', BOX, mat(x - s * 5, y + 3.2, z - c * 5, 4, 1.4, 3, 0, yaw, 0.12));
}

export async function buildBeach({ group, batch, track, surface, tick, rand, shores }) {
  const height = (x, z) => {
    const natural = shoreHeight(x, z);
    const { s, edge, level } = surface.sample(x, z);
    if (track.landDepth(s) < 0) return natural;
    return level - 0.15 + (natural - level + 0.15) * smooth(2, 34, edge);
  };
  const sand = new THREE.Color(0xd2bd8a);
  const damp = new THREE.Color(0x9b8a64);
  const dune = new THREE.Color(0xb6a26f);
  const grass = new THREE.Color(0x6d7f3f);
  const scrub = new THREE.Color(0x56663a);
  const rock = new THREE.Color(0x8a8074);
  const bounds = { minX: WEST - 10, maxX: EAST + 10, minZ: -900, maxZ: COAST + 60 };
  group.add(await groundMesh({ bounds }, height, (x, y, z, n, out) => {
    out.copy(sand).lerp(dune, smooth(0.34, 0.66, noise(x * 2.3, z * 2.3) * 0.65 + noise(x * 7, z * 7) * 0.35));
    if (y < 1.6) out.lerp(damp, 1 - smooth(0.3, 1.6, y));
    if (y > 9) out.copy(grass).lerp(scrub, smooth(0.4, 0.65, noise(x * 3, z * 3)));
    if (n.y < 0.8) out.lerp(rock, 0.8);
  }, tick, 5));
  await tick();

  const { launch, lip } = track.river.land;
  const stoppers = [];
  const taken = (x, z) => stoppers.some((o) => Math.hypot(o.x - x, o.z - z) < HEDGEHOG_GAP);
  for (let k = 0; k < 420; k++) {
    const x = WEST + 180 + rand() * (EAST - WEST - 300);
    const z = coastAt(x) - 26 - rand() * 300;
    const near = track.project(x, z);
    const depth = track.landDepth(near.s);
    const onRun = depth >= 0 && near.distance < track.hw[near.idx] + 3;
    if (onRun && (depth < CLEAR_ENDS || depth > lip - launch - CLEAR_ENDS)) continue;
    if (taken(x, z) || stoppers.length > 150) continue;
    stoppers.push({ x, z });
    const y = height(x, z);
    batch.add('hedgehog', HEDGEHOG, mat(x, y - 0.4, z, 1, 1, 1, 0, rand() * 6, 0));
    if (onRun) shores.push({ x, z, rx: 2.2, rz: 2.2, rot: 0, top: y + 4 });
  }
  await tick();
  for (let k = 0; k < 70; k++) {
    const x = WEST + 220 + rand() * (EAST - WEST - 420);
    const z = coastAt(x) - 40 - rand() * 210;
    crater(batch, x, height(x, z) + 0.05, z, 3 + rand() * 6, rand);
  }
  for (let k = 0; k < 6; k++) {
    const x = WEST + 330 + (k / 5) * (EAST - WEST - 660) + rand() * 40;
    const z = coastAt(x) + 2 - rand() * 12;
    const near = track.project(x, z);
    if (near.distance < track.hw[near.idx] + 14) continue;
    landingCraft(batch, x, height(x, z), z, 0.4 + rand() * 2.4);
  }
  for (let k = 0; k < 90; k++) {
    const x = WEST + 200 + rand() * (EAST - WEST - 400);
    const z = coastAt(x) - BLUFF_FROM + 6 - rand() * 26;
    if (track.project(x, z).distance < 48) continue;
    batch.add('sandbag', ROCK, mat(x, height(x, z) + 0.5, z, 2.4, 0.9, 1.3, 0, rand() * 0.4, 0));
  }
  const guns = BUNKERS.map((x) => {
    const z = coastAt(x) - BLUFF_TO - 4;
    const y = height(x, z);
    bunker(batch, x, y, z);
    return new THREE.Vector3(x, y + 7.2, z + 28);
  });
  return { height, guns, onBeach: (s) => track.landDepth(s) >= 0 };
}

export function bunkerFire({ guns, track, fx, surface, events, tracers, height }) {
  let wait = 0;
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  return (dt, camera) => {
    const { s } = surface.sample(camera.position.x, camera.position.z);
    if (track.landDepth(s) < 0) return;
    wait -= dt;
    if (wait > 0) return;
    wait = SHOT_EVERY * (0.5 + Math.random());
    const near = track.project(camera.position.x, camera.position.z);
    const ahead = track.wrap(near.idx + Math.round((20 + Math.random() * 90) / track.spacing));
    const miss = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 34);
    const p = track.point(ahead, near.lateral + miss);
    const y = height(p.x, p.z);
    from.copy(guns[Math.floor(Math.random() * guns.length)]);
    to.set(p.x, y + 0.5, p.z);
    fx.sparkBurst(from.x, from.y, from.z, 0xffd27a, 14);
    tracers(from, to);
    fx.groundBlast(to.x, to.y, to.z, 1.3, 0xd2bd8a, 0x7a6846);
    events.push({ type: 'boom', pos: to.clone(), power: 1.4 });
  };
}
