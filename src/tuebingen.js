import * as THREE from 'three';
import { Collider } from './collider.js';
import { createWater } from './water.js';
import { mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, createSky, createCloud, createArch, SUN_DIR, LOW_SPHERE } from './world.js';
import { courseSurface, buildHeightfield, groundHit, quayWalls, smooth, noise } from './terrain.js';
import {
  TOWN_COLORS, PUNT_LENGTH, pick, gabledHouse, hoelderlinTower, burse, collegiateChurch, castle, planeTree, willow, leafyTree, fruitTree,
  chapel, aula, townHall, bench, lamp, shed, punt, sitter, archBridge,
} from './tuebingenDetail.js';
import { Punts } from './tuebingenHazards.js';

const COLORS_ALL = { ...COLORS, ...TOWN_COLORS };
const TOWN = -1;
const DEEP = -4.5;
const MAUER = 5.5;
const MAUER_WALK = 3.4;
const TERRACE = 8.2;
const HALDE = 3.2;
const AMMER_WALL = 2.4;
const FRONT_WALL_END = 125;
const LANDING_END = 168;
const TOWER_AT = 163;
const HALDE_END = 285;
const BANK = 1.4;
const FRONT_ROW = [
  ['mint', 'shutterBlue', 10, 5],
  ['yellow', 'shutterRed', 12.5, 5],
  ['pink', 'shutterRed', 9, 5],
  ['plaster', 'shutterRed', 9.5, 5],
  ['cream', 'shutterGreen', 10, 6],
  ['ochre', null, 11, 5, true],
  ['yellow', 'shutterGreen', 8.5, 4],
  ['plaster', 'shutterRed', 9, 5],
  ['salmon', 'shutterRed', 8.5, 4],
  ['sky', 'shutterBlue', 9, 4],
  ['plaster', 'shutterGreen', 10, 5],
  ['yellow', 'shutterRed', 9, 4],
];

const bump = (x, z, c) => {
  const dx = x - c.x;
  const dz = z - c.z;
  const ca = Math.cos(c.rot ?? 0);
  const sa = Math.sin(c.rot ?? 0);
  const u = (dx * ca - dz * sa) / c.sx;
  const v = (dx * sa + dz * ca) / c.sz;
  return Math.exp(-(u * u + v * v));
};

export async function createTuebingen(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(0xe4f0f4, 430, 1000);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xfff3df, 0x6aa86a, 1.4));
  const sun = new THREE.DirectionalLight(0xffe9c8, 2.5);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const N = track.N;
  const route = track.routes[0];
  const fOf = (i) => track.mainIndex(i) / N;
  const surface = await courseSurface(track, tick, { margin: 330, amp: () => 0.25 });
  const near = { idx: 0, edge: 0, side: 1, main: 0 };
  const probe = (x, z) => {
    const s = surface.sample(x, z);
    const i = s.idx;
    near.idx = i;
    near.edge = s.edge;
    near.side = (x - track.px[i]) * track.nx[i] + (z - track.pz[i]) * track.nz[i] >= 0 ? 1 : -1;
    near.main = track.mainIndex(i);
    return near;
  };

  const routeBank = new Float32Array(N);
  for (let k = 0; k <= (route.to - route.from + N) % N; k++) {
    const i = track.wrap(route.from + k);
    for (let lat = track.hw[i] + 0.5; lat < track.hw[i] + 90; lat += 0.5) {
      const p = track.point(i, lat);
      const s = surface.sample(p.x, p.z);
      if (track.route[s.idx] === route.id && s.edge < 0) {
        routeBank[i] = lat;
        break;
      }
    }
  }
  const islandWidth = (i) => (routeBank[i] ? routeBank[i] - track.hw[i] : 0);
  let bridgeIdx = route.from;
  while (islandWidth(bridgeIdx) < 12) bridgeIdx = track.wrap(bridgeIdx + 1);
  const along = (i) => {
    const d = ((track.mainIndex(i) - bridgeIdx + N) % N) * track.spacing;
    return d > track.length / 2 ? d - track.length : d;
  };
  const idxAt = (d) => track.wrap(bridgeIdx + Math.round(d / track.spacing));
  const townPoint = (d, e) => {
    const i = idxAt(d);
    return track.point(i, TOWN * (track.hw[i] + e));
  };
  const faceRiver = (i, side) => Math.atan2(-side * track.nx[i], -side * track.nz[i]);

  const castleAt = townPoint(245, 92);
  const churchAt = townPoint(108, 50);
  const towerI = idxAt(TOWER_AT);
  const towerAt = track.point(towerI, TOWN * (track.hw[towerI] + 4.6));
  const ammer = (f) => f > 0.555 && f < 0.715;
  const hallI = Math.round(0.655 * N);
  const hallAt = track.point(hallI, TOWN * (track.hw[hallI] + 16));
  const aulaI = Math.round(0.615 * N);
  const aulaAt = track.point(aulaI, -TOWN * (track.hw[aulaI] + 36));
  const chapelAt = { x: -600, z: 140 };
  const hills = [
    { x: castleAt.x, z: castleAt.z, sx: 120, sz: 70, rot: -track.heading(idxAt(245)) + Math.PI / 2, peak: 42, flat: 1.25 },
    { x: 190, z: -165, sx: 85, sz: 75, peak: 34, flat: 1 },
    { x: -40, z: -165, sx: 150, sz: 90, peak: 12, flat: 1 },
    { x: -400, z: 250, sx: 190, sz: 62, rot: 0.25, peak: 52, flat: 1, vines: true },
    { x: chapelAt.x, z: chapelAt.z, sx: 80, sz: 80, peak: 66, flat: 1.12, vines: true },
    { x: 40, z: -660, sx: 420, sz: 120, peak: 64, flat: 1 },
    { x: 560, z: 330, sx: 200, sz: 110, peak: 40, flat: 1 },
  ];
  const pads = [
    { x: castleAt.x, z: castleAt.z, r: 40 },
    { x: churchAt.x, z: churchAt.z, r: 26 },
    { x: hallAt.x, z: hallAt.z, r: 16 },
    { x: aulaAt.x, z: aulaAt.z, r: 40 },
    { x: chapelAt.x, z: chapelAt.z, r: 13 },
  ];
  const hillHeight = (x, z) => {
    let y = 0;
    for (const h of hills) y += Math.min(h.peak, h.peak * h.flat * bump(x, z, h));
    return y;
  };
  for (const pad of pads) pad.y = hillHeight(pad.x, pad.z);

  const zone = (n) => {
    const f = n.main / N;
    if (track.route[n.idx] >= 0) return n.side < 0 ? 'island' : 'outer';
    if (n.side > 0 && islandWidth(n.main) > 2 && n.edge < islandWidth(n.main)) return 'island';
    if (ammer(f)) return 'ammer';
    if (n.side !== TOWN) return 'outer';
    const d = along(n.main);
    if (d > -105 && d < FRONT_WALL_END) return 'mauer';
    if (d >= FRONT_WALL_END && d < LANDING_END) return 'landing';
    if (d >= LANDING_END && d < HALDE_END) return 'halde';
    return 'inner';
  };
  const natural = (e) => (e < -1.5 ? DEEP : e < 3 ? DEEP + (BANK - DEEP) * smooth(-1.5, 3, e) : BANK);
  const profile = (kind, e, n) => {
    if (kind === 'mauer') {
      if (e < 1.7) return DEEP;
      if (e < MAUER_WALK) return MAUER;
      if (e < 12) return MAUER + 0.7;
      return MAUER + 0.7 + (TERRACE - MAUER - 0.7) * smooth(12, 13.5, e);
    }
    if (kind === 'halde') return e < 1.7 ? DEEP : e < 3 ? HALDE : HALDE + 1.2 * smooth(3, 5, e);
    if (kind === 'ammer') return e < 1.7 ? DEEP : AMMER_WALL;
    if (kind === 'inner' && n.side === TOWN) {
      const d = along(n.main);
      const near = d < 0 ? smooth(-170, -105, d) : smooth(HALDE_END + 60, HALDE_END, d);
      return natural(e) + (MAUER + 0.7 - BANK) * near * smooth(3, 9, e);
    }
    if (kind === 'landing') return natural(e) + 6 * smooth(10, 22, e);
    return natural(e);
  };
  const height = (x, z) => {
    const n = probe(x, z);
    const kind = zone(n);
    const e = n.edge;
    let y = profile(kind, e, n);
    if (e < 0) return y;
    const inside = kind === 'mauer' || kind === 'landing' || kind === 'halde' || kind === 'inner' || (kind === 'ammer' && n.side === TOWN);
    const lift = inside ? smooth(kind === 'mauer' ? 26 : 10, kind === 'mauer' ? 80 : 60, e) : smooth(14, 90, e);
    const meadow = kind === 'island' ? 0 : (1 + 2.5 * noise(x * 1.7, z * 1.7)) * smooth(6, 40, e);
    y = Math.max(y, Math.min(y + meadow, y + 3) + hillHeight(x, z) * lift);
    for (const pad of pads) {
      const d = Math.hypot(x - pad.x, z - pad.z);
      if (d < pad.r + 14) y += (Math.max(y, pad.y) - y) * smooth(pad.r + 14, pad.r, d);
    }
    return y;
  };
  const shades = {
    grass: new THREE.Color(0x6cbf4a),
    grassDeep: new THREE.Color(0x52a83c),
    lawn: new THREE.Color(0x7ccb55),
    bed: new THREE.Color(0x2f6e5c),
    mud: new THREE.Color(0x8c8a5a),
    paving: new THREE.Color(0xd2c39f),
    cobble: new THREE.Color(0xc8bc9f),
    gravel: new THREE.Color(0xe6dab8),
    vine: new THREE.Color(0x5e9a38),
    soil: new THREE.Color(0xa58a5c),
    rock: new THREE.Color(0xa59a86),
  };
  const oldTown = (x, z) => {
    const n = probe(x, z);
    if (n.side !== TOWN || n.edge < 15 || zone(n) === 'island') return false;
    const f = n.main / N;
    const d = along(n.main);
    return (d > 30 && d < 260 && n.edge < 150) || (f > 0.52 && f < 0.74 && n.edge < 140);
  };
  const townish = (x, z) => {
    const n = probe(x, z);
    const kind = zone(n);
    return ((kind === 'halde' || kind === 'ammer') && n.edge < 70) || oldTown(x, z);
  };
  const islandPath = (x, z) => {
    const n = probe(x, z);
    if (zone(n) !== 'island') return false;
    const m = n.main;
    const lat = (x - track.px[m]) * track.nx[m] + (z - track.pz[m]) * track.nz[m];
    const mid = (track.hw[m] + routeBank[m]) / 2;
    return Math.abs(lat - mid) < 2.2 && along(m) > 0;
  };
  const paint = (x, y, z, ny, color) => {
    if (y < -1) return color.copy(shades.bed);
    color.copy(shades.grass).lerp(shades.grassDeep, smooth(0.35, 0.7, noise(x * 2.3, z * 2.3)));
    if (y < 0.6) color.lerp(shades.mud, 0.6);
    for (const h of hills) {
      if (!h.vines) continue;
      const w = bump(x, z, h);
      if (w > 0.2 && y > 6) color.copy(Math.sin((x * 0.8 + z * 0.35) * 0.9) > 0.1 ? shades.vine : shades.soil);
    }
    if (islandPath(x, z)) color.copy(shades.gravel);
    else if (townish(x, z) && y > 2) color.lerp(shades.cobble, 0.75);
    if (ny < 0.55) color.lerp(shades.rock, 0.6);
  };
  const ground = await buildHeightfield({ bounds: surface.bounds, step: 3, height, paint, tick, smooth: true });
  group.add(ground);

  const wallAt = (kind) => (i, side) => {
    const n = { idx: i, main: track.mainIndex(i), side, edge: 1 };
    return zone(n) === kind;
  };
  const sandstone = { stone: 0xd8c59a, algae: 0x55705a, paving: 0xd2c39f };
  group.add(quayWalls(track, wallAt('mauer'), { top: MAUER, walk: MAUER_WALK, ...sandstone, bottom: DEEP, line: 0.4 }));
  group.add(quayWalls(track, wallAt('halde'), { top: HALDE, walk: 3, ...sandstone, bottom: DEEP, line: 0.4 }));
  group.add(quayWalls(track, wallAt('ammer'), { top: AMMER_WALL, walk: 2, ...sandstone, bottom: DEEP, line: 0.4 }));

  const water = createWater({ deep: 0x2a7a68, shallow: 0x5cb594, amp: 0.5 });
  group.add(water.mesh);

  const rand = mulberry32(1477);
  const batch = new Batcher();
  const windows = new Batcher();
  const foliage = new Batcher();
  const taken = [];
  const shores = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);
  const dry = (x, z, margin = 2) => probe(x, z).edge > margin;

  const bridgeYaw = track.heading(bridgeIdx);
  const spans = [];
  {
    const tx = track.tx[bridgeIdx];
    const tz = track.tz[bridgeIdx];
    const wet = [];
    for (const off of [-10, 0, 10]) {
      let start = null;
      for (let lat = -track.hw[bridgeIdx] - 20; lat < routeBank[bridgeIdx] + 60; lat += 0.5) {
        const p = track.point(bridgeIdx, lat);
        const inWater = surface.sample(p.x + tx * off, p.z + tz * off).edge < 0;
        if (inWater && start === null) start = lat;
        if (!inWater && start !== null) {
          wet.push([start, lat]);
          start = null;
        }
      }
    }
    wet.sort((p, q) => p[0] - q[0]);
    const merged = [];
    for (const [lo, hi] of wet) {
      const last = merged.at(-1);
      if (last && lo <= last[1]) last[1] = Math.max(last[1], hi);
      else merged.push([lo, hi]);
    }
    for (const [lo, hi] of merged) {
      const half = (hi - lo) / 2 + 4;
      spans.push({ center: (lo + hi) / 2, half, spring: 3, crown: Math.min(8.3, 4 + half * 0.16) });
    }
  }
  const bridgeFrom = Math.min(...spans.map((s) => s.center - s.half)) - 30;
  const bridgeTo = Math.max(...spans.map((s) => s.center + s.half)) + 26;
  archBridge(batch, track, bridgeIdx, spans, { from: bridgeFrom, to: bridgeTo, rand });
  for (let lat = bridgeFrom; lat < bridgeTo; lat += 6) {
    const p = track.point(bridgeIdx, lat);
    taken.push({ x: p.x, z: p.z, r: 11 });
  }

  const castleYaw = Math.atan2(towerAt.x - castleAt.x, towerAt.z - castleAt.z);
  castle(batch, windows, castleAt.x, pads[0].y, castleAt.z, castleYaw);
  taken.push({ x: castleAt.x, z: castleAt.z, r: 42 });
  const churchI = idxAt(108);
  collegiateChurch(batch, windows, churchAt.x, pads[1].y, churchAt.z, faceRiver(churchI, TOWN));
  taken.push({ x: churchAt.x, z: churchAt.z, r: 26 });
  hoelderlinTower(batch, windows, towerAt.x, 1.2, towerAt.z, faceRiver(towerI, TOWN));
  taken.push({ x: towerAt.x, z: towerAt.z, r: 6 });
  {
    const behind = track.point(towerI, TOWN * (track.hw[towerI] + 4.6 + 9.5));
    taken.push({ x: behind.x, z: behind.z, r: 8 });
    const bi = idxAt(196);
    const b = track.point(bi, TOWN * (track.hw[bi] + 24));
    burse(batch, windows, b.x, height(b.x, b.z) - 0.4, b.z, faceRiver(bi, TOWN));
    taken.push({ x: b.x, z: b.z, r: 22 });
  }

  const row = (from, to, e, { first = [], floorsFrom = 3, floorsTo = 4, timbered = 0.15, base = null, depth = 12 }) => {
    let d = from;
    let k = 0;
    while (d < to) {
      const spec = first[k];
      const w = spec ? spec[2] : 8 + rand() * 3;
      const mid = idxAt(d + w / 2);
      const dep = depth + rand() * 2;
      const c = track.point(mid, TOWN * (track.hw[mid] + e + dep / 2));
      k++;
      d += w + 0.25;
      if (!free(c.x, c.z, Math.min(w, dep) / 2)) continue;
      const y = base ?? Math.min(...[-1, 1].flatMap((a) => [-1, 1].map((b) => height(c.x + a * w * 0.4, c.z + b * dep * 0.4))));
      const opts = spec
        ? { color: spec[0], shutters: spec[1], timbered: !!spec[4] }
        : { timbered: rand() < timbered };
      gabledHouse(batch, windows, c.x, y, c.z, faceRiver(mid, TOWN), w, dep, spec ? spec[3] : floorsFrom + Math.floor(rand() * (floorsTo - floorsFrom + 1)), rand, { ...opts, plinth: 9 });
      taken.push({ x: c.x, z: c.z, r: Math.min(w, dep) / 2 });
    }
  };
  row(3, FRONT_WALL_END - 4, 13.6, { first: FRONT_ROW, base: TERRACE });
  row(-98, -14, 13.6, { floorsFrom: 3, floorsTo: 4, base: TERRACE });
  row(0, FRONT_WALL_END + 20, 33, { floorsFrom: 3, floorsTo: 5 });
  row(-6, FRONT_WALL_END + 40, 52, { floorsFrom: 3, floorsTo: 4 });
  row(170, HALDE_END - 6, 3, { floorsFrom: 3, floorsTo: 4, timbered: 0.3 });
  row(165, HALDE_END, 24, { floorsFrom: 3, floorsTo: 4, timbered: 0.3 });

  for (let d = 2; d < FRONT_WALL_END - 2; d += 3 + rand() * 4) {
    const i = idxAt(d);
    const p = track.point(i, TOWN * (track.hw[i] + 7 + rand() * 4));
    if (!free(p.x, p.z, 1.5)) continue;
    if (rand() < 0.35) leafyTree(batch, p.x, MAUER + 0.7, p.z, rand, 0.7 + rand() * 0.3);
    else batch.add(pick(['hedge', 'leafC', 'leafA'], rand), LOW_SPHERE, mat(p.x, MAUER + 1.2, p.z, 1.6 + rand(), 1.3, 1.6 + rand()));
    if (rand() < 0.5) {
      const q = track.point(i, TOWN * (track.hw[i] + 0.6));
      sitter(batch, q.x, MAUER + 0.15, q.z, faceRiver(i, TOWN), rand);
    }
  }
  for (let d = -30; d < FRONT_WALL_END; d += 2.2) {
    const i = idxAt(d);
    const p = track.point(i, TOWN * (track.hw[i] + MAUER_WALK - 0.2));
    batch.add('ironDark', LOW_SPHERE, mat(p.x, MAUER + 0.6, p.z, 0.06, 0.6, 0.06));
  }

  for (const [d, e] of [[134, 3.5], [149, 2.5]]) {
    const p = townPoint(d, e);
    willow(batch, foliage, p.x, BANK - 0.2, p.z, rand, 1.15);
    taken.push({ x: p.x, z: p.z, r: 6 });
  }
  for (let d = FRONT_WALL_END + 2; d < LANDING_END - PUNT_LENGTH; d += PUNT_LENGTH + 0.6) {
    const i = idxAt(d + PUNT_LENGTH / 2);
    for (const lat of [1.6, 4.4]) {
      const p = track.point(i, TOWN * (track.hw[i] - lat));
      punt(batch, p.x, -0.15, p.z, track.heading(i) + (rand() - 0.5) * 0.08, rand, { crew: 0, poler: false });
      shores.push({ x: p.x, z: p.z, rx: 1.4, rz: PUNT_LENGTH / 2, rot: track.heading(i), top: 1.6 });
    }
  }

  for (let d = 4; d < HALDE_END + 40; d += 6.5) {
    const i = idxAt(d);
    const w = islandWidth(i);
    if (w < 10) continue;
    const mid = track.hw[i] + w / 2;
    for (const off of [-3.4, 3.4]) {
      const p = track.point(i, mid + off);
      planeTree(batch, p.x, BANK - 0.3, p.z, rand, 0.95 + rand() * 0.15);
      taken.push({ x: p.x, z: p.z, r: 1.5 });
    }
    if (w > 19) {
      for (const lat of [track.hw[i] + 2.4, routeBank[i] - 2.4]) {
        if (rand() < 0.35) continue;
        const p = track.point(i, lat);
        planeTree(batch, p.x, BANK - 0.3, p.z, rand, 0.85 + rand() * 0.2);
      }
    }
    if (Math.round(d / 6.5) % 3 === 0) {
      const p = track.point(i, mid + 2.1);
      lamp(batch, p.x, BANK, p.z);
    } else if (rand() < 0.3) {
      const s = rand() < 0.5 ? -1 : 1;
      const p = track.point(i, mid + s * 2.3);
      bench(batch, p.x, BANK, p.z, track.heading(i) + (s > 0 ? -Math.PI / 2 : Math.PI / 2));
    }
  }
  {
    const tip = idxAt(-24);
    const w = islandWidth(tip);
    if (w > 4) {
      const p = track.point(tip, track.hw[tip] + w / 2);
      willow(batch, foliage, p.x, BANK - 0.3, p.z, rand, 1.05);
    }
  }

  const scatter = (count, tries, pickSpot, place) => {
    for (let t = 0, made = 0; made < count && t < tries; t++) {
      const spot = pickSpot();
      if (!spot) continue;
      if (place(spot) !== false) made++;
    }
  };
  const bankSpot = (fFrom, fTo, side, eFrom, eTo) => () => {
    const f = fFrom + rand() * (fTo - fFrom);
    const i = track.wrap(Math.round(f * N));
    const p = track.point(i, side * (track.hw[i] + eFrom + rand() * (eTo - eFrom)));
    const n = probe(p.x, p.z);
    if (n.edge < eFrom - 1 || zone(n) === 'island' || !free(p.x, p.z, 4)) return null;
    return { ...p, i, y: height(p.x, p.z) };
  };

  taken.push({ x: hallAt.x, z: hallAt.z, r: 15 }, { x: aulaAt.x, z: aulaAt.z, r: 36 }, { x: chapelAt.x, z: chapelAt.z, r: 12 });
  const ammerBridges = [0.585, 0.64, 0.695].map((f) => Math.round(f * N));
  for (const i of ammerBridges) {
    const hw = track.hw[i];
    archBridge(batch, track, i, [{ center: 0, half: hw + 1, spring: 2.6, crown: 6.6 }], { deck: 7.4, width: 6, from: -hw - 9, to: hw + 9, rand, body: 'sandstone', trim: 'sandstoneDark', flowers: false });
    const p = track.point(i);
    taken.push({ x: p.x, z: p.z, r: hw + 6 });
  }
  for (let i0 = Math.round(0.555 * N); i0 < Math.round(0.715 * N); i0 += Math.round(9 / track.spacing)) {
    for (const side of [-1, 1]) {
      const w = 7 + rand() * 3;
      const p = track.point(i0, side * (track.hw[i0] + 8.5));
      if (rand() < 0.15 || !free(p.x, p.z, 4.5)) continue;
      const y = Math.min(height(p.x + 3, p.z), height(p.x - 3, p.z), height(p.x, p.z + 3), height(p.x, p.z - 3));
      gabledHouse(batch, windows, p.x, y, p.z, faceRiver(i0, side), w, 12, 3 + Math.floor(rand() * 2), rand, { timbered: rand() < 0.75, plinth: 7 });
      taken.push({ x: p.x, z: p.z, r: 5 });
    }
  }
  townHall(batch, windows, hallAt.x, pads[2].y, hallAt.z, faceRiver(hallI, TOWN));
  aula(batch, windows, aulaAt.x, pads[3].y, aulaAt.z, faceRiver(aulaI, -TOWN));
  chapel(batch, windows, chapelAt.x, pads[4].y, chapelAt.z, 0.6);

  await tick();
  for (let gx = -340; gx < 200; gx += 12) {
    for (let gz = -300; gz < -10; gz += 13.5) {
      const x = gx + (rand() - 0.5) * 2;
      const z = gz + (rand() - 0.5) * 2;
      if (!oldTown(x, z) || !free(x, z, 5)) continue;
      const n = probe(x, z);
      const w = 8 + rand() * 3;
      const d = 10 + rand() * 2;
      const y = Math.min(height(x - w / 2, z - d / 2), height(x + w / 2, z + d / 2), height(x - w / 2, z + d / 2), height(x + w / 2, z - d / 2));
      if (y > 40) continue;
      const yaw = track.heading(n.main) + (rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2) + (rand() < 0.25 ? Math.PI / 2 : 0) + (rand() - 0.5) * 0.12;
      gabledHouse(batch, windows, x, y, z, yaw, w, d, 3 + Math.floor(rand() * 2), rand, { timbered: rand() < 0.4, plinth: 9, door: rand() < 0.5 });
      taken.push({ x, z, r: Math.min(w, d) / 2 });
    }
    if (gx % 48 === 0) await tick();
  }

  await tick();
  const sparse = (fn) => (p) => {
    fn(p);
    taken.push({ x: p.x, z: p.z, r: 16 });
  };
  scatter(12, 600, bankSpot(0.28, 0.47, 1, 3.5, 7), sparse((p) => willow(batch, foliage, p.x, p.y - 0.2, p.z, rand, 0.85 + rand() * 0.3)));
  scatter(9, 600, bankSpot(0.28, 0.47, -1, 3.5, 7), sparse((p) => willow(batch, foliage, p.x, p.y - 0.2, p.z, rand, 0.85 + rand() * 0.3)));
  scatter(140, 2000, bankSpot(0.27, 0.48, 1, 12, 160), (p) => fruitTree(batch, p.x, p.y, p.z, rand));
  scatter(70, 1200, bankSpot(0.46, 0.56, -1, 4, 60), (p) => leafyTree(batch, p.x, p.y, p.z, rand, 1.2 + rand() * 0.6));
  scatter(70, 1200, bankSpot(0.46, 0.56, 1, 4, 60), (p) => leafyTree(batch, p.x, p.y, p.z, rand, 1.2 + rand() * 0.6));
  scatter(60, 1200, bankSpot(0.72, 0.8, 1, 4, 80), (p) => leafyTree(batch, p.x, p.y, p.z, rand, 1 + rand() * 0.5));
  scatter(160, 2500, bankSpot(0.78, 1, TOWN, 8, 120), (p) => leafyTree(batch, p.x, p.y, p.z, rand, 1.1 + rand() * 0.5));
  scatter(26, 900, bankSpot(0.8, 0.98, -TOWN, 14, 90), (p) => {
    shed(batch, p.x, p.y, p.z, track.heading(p.i) + (rand() - 0.5) * 0.3, rand);
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      const q = { x: p.x + Math.cos(a) * 6, z: p.z + Math.sin(a) * 6 };
      if (free(q.x, q.z, 2)) fruitTree(batch, q.x, height(q.x, q.z), q.z, rand);
    }
    taken.push({ x: p.x, z: p.z, r: 8 });
  });
  scatter(10, 900, bankSpot(0.8, 1.02, -TOWN, 3.5, 8), sparse((p) => willow(batch, foliage, p.x, p.y - 0.2, p.z, rand, 0.85 + rand() * 0.3)));
  scatter(90, 1400, () => {
    const k = Math.round(route.first + rand() * (route.count - 1));
    const p = track.point(k, track.hw[k] + 3 + rand() * 40);
    if (probe(p.x, p.z).edge < 2 || !free(p.x, p.z, 4)) return null;
    return p;
  }, (p) => leafyTree(batch, p.x, height(p.x, p.z), p.z, rand, 1.1 + rand() * 0.5));
  scatter(400, 6000, () => {
    const { minX, maxX, minZ, maxZ } = surface.bounds;
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const y = height(x, z);
    if (y < 18 || noise(x * 3.1 + 40, z * 3.1) < 0.45 || !free(x, z, 3)) return null;
    if (hills.some((h) => h.vines && bump(x, z, h) > 0.15)) return null;
    return { x, y, z };
  }, (p) => leafyTree(batch, p.x, p.y, p.z, rand, 1.3 + rand() * 0.5));

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, COLORS_ALL, undefined, tick);
  const glass = await windows.buildAsync(scenery, 0, COLORS_ALL, undefined, tick);
  const leaves = await foliage.buildAsync(scenery, 0, COLORS_ALL, undefined, tick);
  group.add(scenery);

  const laneLoop = (from, to, a, b) => {
    const pts = [];
    for (let d = from; d <= to; d += 12) {
      const i = idxAt(d);
      const p = track.point(i, a * track.hw[i]);
      pts.push([p.x, p.z]);
    }
    for (let d = to; d >= from; d -= 12) {
      const i = idxAt(d);
      const p = track.point(i, b * track.hw[i]);
      pts.push([p.x, p.z]);
    }
    return pts;
  };
  const hazards = new Punts({
    group,
    rand: mulberry32(9071),
    shores,
    lanes: [
      { points: laneLoop(20, 150, -0.45, 0.3), phase: 0 },
      { points: laneLoop(30, 165, 0.45, -0.25), phase: 0.5 },
      { points: laneLoop(60, 230, -0.15, 0.55), phase: 0.25 },
      { points: laneLoop(15, 200, 0.1, -0.5), phase: 0.75 },
    ],
  });

  group.add(createArch(track, track.hw[0]));

  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 130 + rand() * 60, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  const collider = new Collider();
  await collider.addObject(group, new Set([sky, water.mesh, hazards.group, ...clouds]), tick);

  return {
    marks: { bridgeIdx, towerI, towerAt, castleAt, churchAt },
    fog,
    hazards,
    water,
    sun,
    surface,
    shores,
    collider,
    solid: (p) => groundHit(height, p),
    raycast: (origin, dir, far) => collider.raycast(origin, dir, dir.y < 0 ? Math.min(far, (origin.y + 0.3) / -dir.y) : far),
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      cullChunks(glass, camera, fog.far * 0.6);
      cullChunks(leaves, camera, fog.far);
      sky.position.copy(camera.position);
      hazards.animate(t, dt);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
    },
  };
}
