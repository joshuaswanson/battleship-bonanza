import * as THREE from 'three';
import { createWater } from './water.js';
import { toon, mulberry32 } from './toon.js';
import { Batcher, cullChunks, slicer, COLORS, mat, ROCK, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { courseSurface, buildHeightfield, courseBuoys, swissFlag, flagClock, groundHit, smooth, noise } from './terrain.js';
import { FLORA_COLORS, tree, sapling, boulder, cow, loadCowKit } from './alpine.js';
import { LANDMARK_COLORS, castle, coveredBridge, waterTower, buildSteamer, chalet } from './alpsLandmarks.js';

const ALPS_COLORS = {
  ...COLORS,
  ...FLORA_COLORS,
  ...LANDMARK_COLORS,
  plaster: 0xf6f0e2,
  wood: 0xa8683a,
  woodDark: 0x6e4224,
  roof: 0x7a3f2a,
  roofRed: 0xc9503a,
  flower: 0xff4f6d,
  flowerLeaf: 0x3f9a45,
  window: 0x2b3440,
  shutter: 0x3f8f5a,
  stone: 0xdcd5c7,
  stoneDark: 0xa9a196,
  copper: 0x62b3a0,
  clock: 0xffffff,
  horn: 0xf3e6c4,
  bell: 0xffd23f,
  flagPole: 0xeeeeee,
  flagRed: 0xe5332a,
  flagWhite: 0xffffff,
  islet: 0x9a958c,
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
const OCT = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPIRE = new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4);
const TURRET = new THREE.ConeGeometry(1, 1, 12);
const BALL = new THREE.SphereGeometry(1, 10, 8);
const roofShape = new THREE.Shape([new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0), new THREE.Vector2(0, 1)]);
const ROOF = new THREE.ExtrudeGeometry(roofShape, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);

function lakeness(f) {
  if (f >= 0.31 && f <= 0.88) return 0;
  if (f > 0.26 && f < 0.31) return 1 - smooth(0.26, 0.31, f);
  if (f > 0.88 && f < 0.94) return smooth(0.88, 0.94, f);
  return 1;
}

function placer(batch) {
  return (key, geometry, origin, yaw, lx, y, lz, sx, sy, sz, rx = 0, rz = 0, extraYaw = 0) => {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    batch.add(key, geometry, mat(origin.x + lx * c + lz * s, origin.y + y, origin.z - lx * s + lz * c, sx, sy, sz, rx, yaw + extraYaw, rz));
  };
}

function church(batch, x, y, z, yaw) {
  const put = placer(batch);
  const o = new THREE.Vector3(x, y, z);
  put('stoneDark', BOX, o, yaw, 0, -1.5, -4, 10, 3, 22);
  put('plaster', BOX, o, yaw, 0, 4.5, -6, 9, 9, 16);
  put('roofRed', ROOF, o, yaw, 0, 9, -6, 5.6, 4.5, 17);
  put('plaster', BOX, o, yaw, 0, 11, 4, 5.2, 22, 5.2);
  put('stoneDark', BOX, o, yaw, 0, 22.4, 4, 5.8, 0.8, 5.8);
  put('copper', SPIRE, o, yaw, 0, 28, 4, 4, 11, 4);
  put('bell', BALL, o, yaw, 0, 34, 4, 0.5, 0.5, 0.5);
  put('clock', CYL, o, yaw, 0, 18.5, 6.65, 1.5, 0.15, 1.5, Math.PI / 2);
  put('window', BOX, o, yaw, 0, 18.5, 6.75, 0.15, 1.2, 0.12, 0, 0.5);
  for (const lz of [-11, -6, -1]) for (const side of [-1, 1]) put('window', BOX, o, yaw, side * 4.55, 5, lz, 0.2, 3.2, 1.4);
}

export async function createAlps(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(0xdcefff, 420, 1000);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xeaf6ff, 0x5aa36a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const N = track.N;
  const lakeAt = (idx) => lakeness(idx / N);
  const surface = await courseSurface(track, tick, { amp: (i) => 0.35 + 0.35 * lakeAt(i) });
  const shoreOf = (x, z) => {
    const s = surface.sample(x, z);
    return s.edge - lakeAt(s.idx) * (32 + 40 * noise(x * 1.3 + 50, z * 1.3));
  };
  const height = (x, z) => {
    const shore = shoreOf(x, z);
    let y = -5 + 8.5 * smooth(-2, 7, shore);
    y += smooth(5, 70, shore) * (4 + 14 * noise(x * 1.7, z * 1.7));
    const ridge = 1 - Math.abs(Math.sin(x * 0.011 + Math.sin(z * 0.007) * 2) * Math.cos(z * 0.013 - x * 0.004));
    y += smooth(60, 300, shore) * (80 + 140 * ridge * noise(x * 0.7 + 200, z * 0.7 - 100));
    const mx = x - 110;
    const mz = z - 500;
    const pyramid = Math.max(Math.abs(mx * 0.71 + mz * 0.71), Math.abs(mx * 0.71 - mz * 0.71));
    y += Math.max(0, 280 - pyramid * 1.7) * smooth(40, 140, shore);
    return y;
  };
  const tint = new THREE.Color();
  const paint = (x, y, z, ny, color) => {
    const snowLine = 105 + 30 * noise(x * 2, z * 2);
    if (y < 0.8) color.set(0xcfc6ad);
    else if (y > snowLine && ny > 0.4) color.set(0xf6f9ff);
    else if (ny < 0.66) color.set(y > snowLine - 30 ? 0x8f8c8a : 0xa49e95);
    else if (y > 70) color.set(0xa3b06e);
    else color.set(noise(x * 3, z * 3) > 0.55 ? 0x7bd35a : 0x93df63);
    color.multiply(tint.setScalar(0.93 + 0.1 * noise(x * 5 + 7, z * 5)));
  };
  group.add(await buildHeightfield({ bounds: surface.bounds, step: 5, height, paint, tick }));

  const water = createWater({ deep: 0x1677b8, shallow: 0x4fd0e6 });
  group.add(water.mesh);

  const rand = mulberry32(4207);
  const batch = new Batcher();
  const slope = (x, z) => {
    const e = 2;
    const gx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const gz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    return 1 / Math.hypot(gx, gz, 1);
  };
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const taken = [];
  const shores = [];
  const free = (x, z, r) => !taken.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r);

  const shoreline = (idx, sign) => {
    const i = track.wrap(idx);
    for (let lat = track.hw[i]; lat < track.hw[i] + 140; lat += 2) {
      const p = track.point(i, sign * lat);
      if (height(p.x, p.z) > 1.2) return { lat, p };
    }
    return null;
  };

  const villageSide = 1;
  for (let f = 0.02; f < 0.22; f += 0.012) {
    const idx = Math.round(f * N);
    const edge = shoreline(idx, villageSide);
    if (!edge) continue;
    for (let row = 0; row < 3; row++) {
      const lat = edge.lat + 8 + row * 13 + rand() * 4;
      const p = track.point(idx + Math.round((rand() - 0.5) * 6), villageSide * lat);
      const y = height(p.x, p.z);
      if (y < 1.5 || y > 30 || slope(p.x, p.z) < 0.8 || !free(p.x, p.z, 8)) continue;
      const c = track.point(idx);
      const yaw = Math.atan2(c.x - p.x, c.z - p.z);
      if (row === 1 && Math.abs(f - 0.1) < 0.008) church(batch, p.x, y, p.z, yaw);
      else chalet(batch, p.x, y, p.z, yaw + (rand() - 0.5) * 0.3, rand);
      taken.push({ x: p.x, z: p.z, r: 9 });
    }
  }
  {
    const idx = Math.round(0.035 * N);
    const edge = shoreline(idx, villageSide);
    if (edge) {
      const i = track.wrap(idx);
      const yaw = track.heading(i) + Math.PI / 2;
      const put = placer(batch);
      const pierLen = edge.lat - track.hw[i] + 4;
      const start = track.point(i, villageSide * (track.hw[i] + 5 + pierLen / 2));
      put('wood', BOX, new THREE.Vector3(start.x, 0, start.z), yaw, 0, 1.2, 0, 4, 0.5, pierLen);
      shores.push({ x: start.x, z: start.z, rx: 2, rz: pierLen / 2, rot: yaw });
      for (let k = -pierLen / 2; k <= pierLen / 2; k += 4) for (const lx of [-1.8, 1.8]) put('woodDark', BOX, new THREE.Vector3(start.x, 0, start.z), yaw, lx, -0.5, k, 0.4, 3.5, 0.4);
      const flagAt = track.point(i, villageSide * (track.hw[i] + 6));
      swissFlag(batch, group, flagAt.x, 1.4, flagAt.z, yaw, 1);
    }
  }

  const castleAt = (() => {
    const idx = Math.round(0.15 * N);
    const edge = shoreline(idx, -villageSide);
    const i = track.wrap(idx);
    const lat = edge ? Math.min(edge.lat - 18, track.hw[i] + 26) : track.hw[i] + 26;
    return { p: track.point(i, -villageSide * lat), yaw: track.heading(i), gap: edge ? edge.lat - lat - 16 : 6 };
  })();
  castle(batch, group, castleAt.p.x, castleAt.p.z, castleAt.yaw, rand, castleAt.gap);
  group.userData.castle = { x: castleAt.p.x, z: castleAt.p.z };
  taken.push({ x: castleAt.p.x, z: castleAt.p.z, r: 26 });


  {
    const idx = Math.round(0.62 * N);
    const i = track.wrap(idx);
    coveredBridge(batch, track, idx);
    const bridgeAt = track.point(i);
    taken.push({ x: bridgeAt.x, z: bridgeAt.z, r: track.hw[i] + 16 });
    const towerIdx = track.wrap(idx - Math.round(12 / track.spacing));
    const tower = track.point(towerIdx, track.hw[towerIdx] + 8);
    waterTower(batch, tower.x, Math.max(-1, height(tower.x, tower.z) - 0.6), tower.z, rand);
    taken.push({ x: tower.x, z: tower.z, r: 9 });
  }

  const meadow = (x, z) => {
    const y = height(x, z);
    return y > 2 && y < 40 && shoreOf(x, z) > 7 && slope(x, z) > 0.88;
  };
  const cowKit = await loadCowKit(`${import.meta.env.BASE_URL}models/cow.glb`);
  const herdBatch = new Batcher();
  const herdSpots = [];
  group.userData.herds = herdSpots;
  for (let tries = 0, herds = 0; herds < 9 && tries < 4000; tries++) {
    const idx = Math.floor(rand() * N);
    const sign = rand() < 0.5 ? -1 : 1;
    const c = track.point(idx, sign * (track.hw[track.wrap(idx)] + 16 + rand() * 40));
    if (!meadow(c.x, c.z) || !free(c.x, c.z, 14)) continue;
    const facing = rand() * Math.PI * 2;
    const size = 2 + Math.floor(rand() * 5);
    const herd = [];
    const roomFor = (x, z, r) => meadow(x, z) && herd.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
    for (let k = 0, tries2 = 0; k < size && tries2 < 40; tries2++) {
      const a = rand() * Math.PI * 2;
      const d = 3 + rand() * 11;
      const x = c.x + Math.cos(a) * d;
      const z = c.z + Math.sin(a) * d;
      if (!roomFor(x, z, 2.6)) continue;
      cow(herdBatch, x, height(x, z), z, facing + (rand() - 0.5) * 1.6, rand, cowKit);
      herd.push({ x, z, r: 2.6 });
      k++;
      if (rand() < 0.3) {
        const b = rand() * Math.PI * 2;
        const cx = x + Math.cos(b) * 4.5;
        const cz = z + Math.sin(b) * 4.5;
        if (roomFor(cx, cz, 1.6)) {
          cow(herdBatch, cx, height(cx, cz), cz, facing + (rand() - 0.5) * 2, rand, cowKit, { calf: true });
          herd.push({ x: cx, z: cz, r: 1.6 });
        }
      }
    }
    taken.push({ x: c.x, z: c.z, r: 14 });
    herdSpots.push({ x: c.x, y: height(c.x, c.z), z: c.z });
    herds++;
  }

  for (let tries = 0, rocks = 0; rocks < 140 && tries < 4000; tries++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const shore = shoreOf(x, z);
    if (shore < -1 || shore > 160) continue;
    const y = height(x, z);
    if (y < -0.5 || y > 110 || !free(x, z, 3)) continue;
    boulder(batch, x, y, z, rand, shore < 4 ? 1 + rand() * 1.5 : 1.2 + rand() * 2.8);
    rocks++;
  }

  let trees = 0;
  for (let tries = 0, groves = 0; groves < 420 && tries < 9000; tries++) {
    if (tries % 200 === 0) await tick();
    const cx = minX + rand() * (maxX - minX);
    const cz = minZ + rand() * (maxZ - minZ);
    if (noise(cx * 2.1 + 90, cz * 2.1 - 40) < 0.4 || shoreOf(cx, cz) < 6) continue;
    const cy = height(cx, cz);
    if (cy < 2 || cy > 100) continue;
    groves++;
    const count = 3 + Math.floor(rand() * 14);
    const spread = 6 + rand() * 18;
    for (let k = 0; k < count; k++) {
      const a = rand() * Math.PI * 2;
      const d = spread * Math.sqrt(rand());
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (shoreOf(x, z) < 5) continue;
      const y = height(x, z);
      if (y < 2 || y > 102 || slope(x, z) < 0.7 || !free(x, z, 3)) continue;
      const edge = d / spread;
      tree(batch, x, y, z, rand, (1.15 - edge * 0.45) * (y > 85 ? 0.7 : 1));
      trees++;
      if (rand() < 0.15) {
        const sx = x + (rand() - 0.5) * 6;
        const sz = z + (rand() - 0.5) * 6;
        if (free(sx, sz, 1)) sapling(batch, sx, height(sx, sz), sz, rand);
      }
    }
  }
  for (let tries = 0, singles = 0; singles < 260 && tries < 6000; tries++) {
    const idx = Math.floor(rand() * N);
    const sign = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, sign * (track.hw[track.wrap(idx)] + 6 + rand() * 50));
    const y = height(p.x, p.z);
    if (y < 1.5 || y > 60 || shoreOf(p.x, p.z) < 5 || !free(p.x, p.z, 4)) continue;
    if (rand() < 0.35) sapling(batch, p.x, y, p.z, rand);
    else tree(batch, p.x, y, p.z, rand, 0.7 + rand() * 0.6);
    singles++;
  }

  const scenery = new THREE.Group();
  const chunks = await batch.buildAsync(scenery, 0.1, ALPS_COLORS, undefined, tick);
  chunks.push(...(await herdBatch.buildAsync(scenery, 0.045, ALPS_COLORS, undefined, tick)));
  group.add(scenery);

  const buoys = courseBuoys(track, (idx) => lakeAt(idx) > 0.4);
  group.add(buoys);
  group.add(createArch(track, track.hw[0]));

  const reachOut = [new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) {
    for (const [k, sign] of [[0, -1], [1, 1]]) {
      let lat = track.hw[i];
      while (lat < track.hw[i] + 50) {
        const p = track.point(i, sign * lat);
        if (height(p.x, p.z) > -1.5) break;
        lat += 1;
      }
      reachOut[k][i] = Math.max(track.hw[i] - 2.5, Math.min(track.hw[i] + 45, lat - 4));
    }
  }
  track.reach = reachOut;
  shores.push({ x: castleAt.p.x, z: castleAt.p.z, rx: 19, rz: 19, rot: 0 });

  const steamer = buildSteamer();
  group.add(steamer.group);
  steamer.group.userData.steamer = true;
  const lane = (lat, from, to, step) => {
    const pts = [];
    for (let f = from; step > 0 ? f <= to : f >= to; f += step) {
      const i = track.wrap(Math.round(f * N));
      const p = track.point(i, -villageSide * (track.hw[i] + lat));
      pts.push(new THREE.Vector3(p.x, 0, p.z));
    }
    return pts;
  };
  const wet = (pts) => pts.every((p) => height(p.x, p.z) < -2.5);
  const laneA = lane(13, -0.04, 0.1, 0.01);
  let laneB = lane(25, 0.1, -0.04, -0.01);
  if (!wet(laneB)) laneB = lane(20, 0.1, -0.04, -0.01);
  const route = wet(laneA) && wet(laneB) ? new THREE.CatmullRomCurve3([...laneA, ...laneB], true, 'centripetal') : null;
  const routeLength = route ? route.getLength() : 1;
  let smoke = 0;
  const hull = { x: 0, z: -9999, rx: 4.8, rz: 14.5, rot: 0 };
  shores.push(hull);

  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 150 + rand() * 80, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  return {
    fog,
    water,
    sun,
    surface,
    shores,
    solid(p) {
      if (Math.hypot(p.x - castleAt.p.x, p.z - castleAt.p.z) < 17 && p.y < 16) {
        return new THREE.Vector3(p.x - castleAt.p.x, 0, p.z - castleAt.p.z).normalize();
      }
      return groundHit(height, p);
    },
    update(t, dt, camera) {
      water.update(t);
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      buoys.userData.update(t);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      flagClock.value = t;
      if (route) {
        const u = ((t * 5) / routeLength) % 1;
        const p = route.getPointAt(u);
        const d = route.getTangentAt(u);
        const ship = steamer.group;
        ship.position.set(p.x, Math.sin(t * 1.1) * 0.12 - 0.2, p.z);
        ship.rotation.set(Math.sin(t * 0.9) * 0.015, Math.atan2(d.x, d.z), Math.sin(t * 1.3) * 0.02);
        hull.x = p.x;
        hull.z = p.z;
        hull.rot = ship.rotation.y;
        for (const wheel of steamer.wheels) wheel.rotation.x = t * 2.2;
        ship.updateMatrixWorld();
        smoke -= dt;
        if (smoke <= 0) {
          smoke = 0.18;
          const top = steamer.funnel.clone().applyMatrix4(ship.matrixWorld);
          fx.smoke(top.x, top.y, top.z);
        }
        if (Math.random() < dt * 6) {
          const wheel = steamer.paddles[Math.random() < 0.5 ? 0 : 1].clone().applyMatrix4(ship.matrixWorld);
          fx.splash(wheel.x, 0.2, wheel.z, 0.35);
        }
      }
    },
  };
}
