import * as THREE from 'three';
import { toon, glow, mulberry32 } from './toon.js';
import { groundHit } from './terrain.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batcher, cullChunks, slicer, COLORS, mat, CONE, ROCK, CYLINDER, SPHERE, createSky, createCloud, createArch, SUN_DIR } from './world.js';
import { riverSurface } from './jungle.js';
import { Chopper } from './chop.js';
import { BOX, groundMesh, noise, seaStrip, smooth, trackBand } from './mapKit.js';

const SKY = 0xdff3ff;
const SEA_DEEP = 0x14609a;
const SEA_SHALLOW = 0x58cfe8;
const UNDER_FOG = 0x0f6d9a;
const PALETTE = {
  ...COLORS,
  ice: 0xbdeafa,
  iceDeep: 0x6cc7ec,
  iceLight: 0xeafaff,
  snow: 0xffffff,
  stone: 0x6f7c88,
  stationRed: 0xe0503a,
  stationPale: 0xf2f4f6,
  stationDark: 0x34465e,
  crystal: 0x8ff0ff,
  pillar: 0xffffff,
  penguin: 0xffffff,
};

function groundHeight(surface, track, x, z) {
  const { edge, s, level } = surface.sample(x, z);
  const hw = track.halfWidth;
  const dist = edge + hw;
  const bank = smooth(hw - 5, hw + 6, dist);
  const floor = Math.min(-7, level - 9.5) - 2 * noise(x * 2, z * 2);
  const plateau = 3.2 + 2.4 * noise(x * 0.9, z * 0.9) + 2 * smooth(0.62, 0.72, noise(x * 3, z * 3));
  const ridges = smooth(30, 120, edge) * 14 * noise(x * 1.6 + 40, z * 1.6);
  const peaks = smooth(110, 340, edge) * (24 + 90 * noise(x * 0.5 + 200, z * 0.5 - 90));
  return floor + (plateau + ridges + peaks - floor) * bank;
}

const UNDER_VERT = /* glsl */ `
  attribute float aInfo;
  varying vec3 vWorld;
  varying float vIce;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vIce = aInfo;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const UNDER_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  varying float vIce;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  vec3 cells(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float first = 8.0;
    float second = 8.0;
    float id = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(hash(i + g), hash(i + g + 19.0));
        float d = length(g + o - f);
        if (d < first) {
          second = first;
          first = d;
          id = hash(i + g + 41.0);
        } else if (d < second) second = d;
      }
    }
    return vec3(first, second - first, id);
  }
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vWorld.xz * 0.13;
    float a = sin(p.x * 1.7 + sin(p.y * 1.3 + uTime * 0.6) * 1.8);
    float b = sin(p.y * 1.9 + sin(p.x * 1.2 - uTime * 0.5) * 1.8);
    float shimmer = smoothstep(0.5, 0.68, a * b + 0.2);
    vec3 water = mix(vec3(0.16, 0.66, 0.82), vec3(0.74, 0.97, 0.98), shimmer);

    vec3 plate = cells(vWorld.xz * 0.075);
    vec3 shard = cells(vWorld.xz * 0.24 + plate.z * 7.0);
    float tone = floor(plate.z * 4.0) / 3.0;
    vec3 ice = mix(vec3(0.2, 0.55, 0.8), vec3(0.5, 0.84, 0.95), tone);
    ice = mix(ice, ice * 1.14, step(0.5, shard.z));
    float thin = smoothstep(0.52, 0.72, noise(vWorld.xz * 0.018 + 4.0));
    ice = mix(ice, vec3(0.8, 0.97, 1.0), thin * 0.55);
    ice = mix(ice, ice * 0.78, (1.0 - smoothstep(0.015, 0.05, shard.y)) * 0.8);
    float seam = 1.0 - smoothstep(0.02, 0.075, plate.y);
    ice = mix(ice, vec3(0.93, 1.0, 1.0), seam);
    ice += vec3(0.1, 0.16, 0.18) * shimmer * (0.3 + thin);
    gl_FragColor = vec4(mix(water, ice, step(0.5, vIce)), 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const FLOOR_VERT = /* glsl */ `
  varying vec3 vWorld;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FLOOR_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    vec2 p = vWorld.xz * 0.2;
    float a = sin(p.x * 1.7 + sin(p.y * 1.3 + uTime * 0.7) * 1.9 + uTime * 0.2);
    float b = sin(p.y * 1.9 + sin(p.x * 1.2 - uTime * 0.6) * 1.9 - uTime * 0.2);
    float caustic = 1.0 - smoothstep(0.0, 0.1, abs(a * b));
    float mottle = noise(vWorld.xz * 0.09) * 0.6 + noise(vWorld.xz * 0.3) * 0.4;
    vec3 bed = mix(vec3(0.26, 0.46, 0.62), vec3(0.4, 0.6, 0.72), smoothstep(0.42, 0.58, mottle));
    bed = mix(bed, vec3(0.18, 0.36, 0.54), smoothstep(0.62, 0.7, noise(vWorld.xz * 0.05 + 9.0)) * 0.6);
    gl_FragColor = vec4(bed + vec3(0.12, 0.2, 0.22) * caustic, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const painted = (geometry, color) => {
  const g = geometry.index ? geometry : geometry;
  g.deleteAttribute('uv');
  const c = new THREE.Color(color);
  const rgb = new Float32Array(g.attributes.position.count * 3);
  for (let k = 0; k < rgb.length; k += 3) rgb.set([c.r, c.g, c.b], k);
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return g;
};

const egg = (x, y, z, sx, sy, sz, color, rx = 0, rz = 0) => painted(new THREE.SphereGeometry(1, 14, 10).scale(sx, sy, sz).rotateX(rx).rotateZ(rz).translate(x, y, z), color);

function penguinShape({ flap = 0.2, tilt = 0, back = 0x2b323b, belly = 0xf1efe8, patch = 0xe8c98a, foot = 0x3a3f46, chick = false }) {
  const profile = [[0.001, 0], [0.15, 0.015], [0.24, 0.14], [0.27, 0.34], [0.245, 0.56], [0.17, 0.74], [0.11, 0.84], [0.001, 0.9]].map(([r, y]) => new THREE.Vector2(r, y));
  const parts = [
    painted(new THREE.LatheGeometry(profile, 16), back),
    egg(0, 0.36, 0.125, 0.205, 0.335, 0.15, belly),
    egg(0, 0.67, 0.095, 0.115, 0.09, 0.09, patch),
    egg(0, 0.93, 0.005, 0.105, 0.105, 0.125, back),
    egg(0.085, 0.9, 0, 0.03, 0.075, 0.05, chick ? belly : patch, 0, -0.25),
    egg(-0.085, 0.9, 0, 0.03, 0.075, 0.05, chick ? belly : patch, 0, 0.25),
    egg(0.07, 0.95, 0.075, 0.012, 0.012, 0.009, 0x0c0f13),
    egg(-0.07, 0.95, 0.075, 0.012, 0.012, 0.009, 0x0c0f13),
    painted(new THREE.ConeGeometry(0.028, 0.21, 7).rotateX(Math.PI / 2 + 0.16).translate(0, 0.905, 0.195), 0x23262b),
    painted(new THREE.ConeGeometry(0.018, 0.1, 6).rotateX(Math.PI / 2 + 0.16).translate(0, 0.895, 0.2), 0xd98a3a),
    egg(0.265, 0.44, -0.01, 0.022, 0.235, 0.075, back, 0, flap),
    egg(-0.265, 0.44, -0.01, 0.022, 0.235, 0.075, back, 0, -flap),
    egg(0.1, 0.02, 0.09, 0.075, 0.022, 0.13, foot),
    egg(-0.1, 0.02, 0.09, 0.075, 0.022, 0.13, foot),
  ].map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(parts);
  if (tilt) merged.rotateX(tilt);
  merged.computeVertexNormals();
  return merged;
}

const PENGUINS = [penguinShape({}), penguinShape({ flap: 0.55 }), penguinShape({ flap: 0.28, tilt: -0.2 }), penguinShape({ flap: 0.12, tilt: 0.12 })];
const CHICK = penguinShape({ flap: 0.3, back: 0x8f969e, belly: 0xc8ccd0, patch: 0xc8ccd0, foot: 0x4a4f56, chick: true });

const SHATTER = new THREE.DodecahedronGeometry(1, 0);
const SHATTER_TOP = toon(0xd6f6ff);
const SHATTER_LOW = toon(0x9fdcf4);

function shatterCaps(holder, drop, tree) {
  const r = tree.radius;
  const upper = new THREE.Mesh(SHATTER, SHATTER_TOP);
  upper.scale.set(r * 0.95, 2.4, r * 0.95);
  upper.rotation.set(0.5, tree.x, 0.3);
  holder.add(upper);
  const lower = new THREE.Mesh(SHATTER, SHATTER_LOW);
  lower.position.y = drop;
  lower.scale.set(r * 1.2, 1.5, r * 1.2);
  lower.rotation.set(0.3, tree.z, 0.5);
  holder.add(lower);
}

function icePillarShape(rand) {
  const sides = 7;
  const rows = 8;
  const angles = Array.from({ length: sides }, (_, k) => ((k + (rand() - 0.5) * 0.5) / sides) * Math.PI * 2);
  const radial = angles.map(() => 0.8 + rand() * 0.4);
  const ring = Array.from({ length: rows + 1 }, (_, r) => {
    const t = r / rows;
    const waist = 0.72 + 0.62 * (2 * t - 1) ** 2 + (rand() - 0.5) * 0.14;
    return angles.map((a, k) => [Math.cos(a) * radial[k] * waist * (0.92 + rand() * 0.16), t, Math.sin(a) * radial[k] * waist * (0.92 + rand() * 0.16)]);
  });
  const pos = [];
  const col = [];
  const low = new THREE.Color(0x4ea6d8);
  const high = new THREE.Color(0xd6f6ff);
  const seam = new THREE.Color(0xf4feff);
  const c = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < sides; k++) {
      const a = ring[r][k];
      const b = ring[r][(k + 1) % sides];
      const d = ring[r + 1][k];
      const e = ring[r + 1][(k + 1) % sides];
      const shade = k % 3 === 0 ? 0.28 : 0;
      for (const v of [a, d, e, a, e, b]) {
        pos.push(...v);
        c.copy(low).lerp(high, v[1] * 0.75 + shade).lerp(seam, (r + k) % 7 === 0 ? 0.5 : 0);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

const ICICLE = new THREE.ConeGeometry(1, 1, 5).rotateX(Math.PI).toNonIndexed();
ICICLE.computeVertexNormals();
const SHARD = new THREE.ConeGeometry(1, 1, 5).toNonIndexed();
SHARD.computeVertexNormals();

const place = (track, s, lat, y = 0) => {
  const p = track.point(track.wrap(Math.round(s / track.spacing)), lat);
  return new THREE.Vector3(p.x, y, p.z);
};

function iceWall(batch, track, s, rand, spread = 1) {
  const half = (track.halfWidth + 16) * spread;
  for (let lat = -half; lat <= half; lat += 5.5) {
    const size = 5 + rand() * 3.5;
    const p = place(track, s + (rand() - 0.5) * 3, lat);
    batch.add(['ice', 'iceDeep', 'iceLight'][Math.floor(rand() * 3)], ROCK, mat(p.x, 3 + rand() * 2.4, p.z, size, size * 1.05, size * 0.8, rand(), rand() * 6, rand()));
    const c = 2 + rand() * 2;
    batch.add('snow', ROCK, mat(p.x, 8 + rand() * 1.2, p.z, c * 1.3, c * 0.5, c * 1.2, 0, rand() * 6, 0));
  }
}

function iceShelf(track, s) {
  const rows = 26;
  const lanes = 34;
  const half = track.halfWidth + 22;
  const pos = [];
  const col = [];
  const index = [];
  const snow = new THREE.Color(0xffffff);
  const ice = new THREE.Color(0x8fdcf2);
  const deep = new THREE.Color(0x4fa9d4);
  const c = new THREE.Color();
  for (let r = 0; r <= rows; r++) {
    const along = -8 + (r / rows) * 50;
    const i = track.wrap(Math.round((s + along) / track.spacing));
    for (let l = 0; l <= lanes; l++) {
      const lat = -half + (2 * half * l) / lanes;
      const p = track.point(i, lat);
      const crest = 26 + 4 * Math.sin(lat * 0.17 + 1) + 2 * Math.sin(lat * 0.43);
      const front = smooth(1.5 + 2 * Math.sin(lat * 0.21), crest - 2, along);
      const rear = 1 - smooth(crest, crest + 7, along);
      const sides = 1 + 0.5 * smooth(track.halfWidth - 6, half, Math.abs(lat));
      const y = -1.2 + (7 * sides + 1.6 * noise(p.x * 5, p.z * 5)) * front * rear;
      pos.push(p.x, y, p.z);
      c.copy(y < 0.7 ? deep : y < 2 ? ice : snow).lerp(ice, rear < 0.8 ? 0.7 : noise(p.x * 9, p.z * 9) > 0.6 ? 0.25 : 0);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = lanes + 1;
  for (let r = 0; r < rows; r++) {
    for (let l = 0; l < lanes; l++) {
      const a = r * row + l;
      index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return new THREE.Mesh(flat, toon(0xffffff, { vertexColors: true }));
}

function addStation(batch, x, z, y, rand) {
  batch.add('stationRed', SPHERE, mat(x, y + 2, z, 9, 7, 9));
  batch.add('stationPale', CYLINDER, mat(x, y + 1, z, 9.4, 2, 9.4));
  batch.add('stationDark', BOX, mat(x + 8.8, y + 2.2, z, 0.3, 2.8, 2.4));
  batch.add('stationPale', SPHERE, mat(x - 18, y + 1, z + 7, 6.5, 5, 6.5));
  batch.add('stationRed', CYLINDER, mat(x - 18, y + 0.5, z + 7, 6.9, 1.4, 6.9));
  batch.add('stationPale', BOX, mat(x - 9, y + 2, z + 3, 12, 3, 4));
  batch.add('stationDark', CYLINDER, mat(x + 16, y + 14, z - 6, 0.4, 28, 0.4));
  batch.add('stationRed', SPHERE, mat(x + 16, y + 28.4, z - 6, 0.9, 0.9, 0.9));
  batch.add('stationPale', SPHERE, mat(x + 16, y + 21, z - 6, 3.2, 0.9, 3.2, 0.9, 0, 0.4));
  for (let k = 0; k < 4; k++) batch.add('stationDark', CYLINDER, mat(x - 18 + k * 7, y + 2.4, z + 18, 0.2, 5, 0.2));
}

function addPenguins(batch, x, z, y, face, rand, count) {
  for (let k = 0; k < count; k++) {
    const a = rand() * 6.3;
    const r = 2 + rand() * 9;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    const chick = rand() < 0.25;
    const size = chick ? 1 + rand() * 0.3 : 2 + rand() * 0.5;
    const yaw = face + (rand() - 0.5) * 1.6;
    batch.add('penguin', chick ? CHICK : PENGUINS[Math.floor(rand() * PENGUINS.length)], mat(px, y, pz, size, size, size, 0, yaw, 0));
  }
}

export async function createFrozen(group, track, fx) {
  const tick = slicer();
  const fog = new THREE.Fog(SKY, 200, 780);
  const sky = createSky({ top: 0x4aa8e8, horizon: SKY });
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xf2fbff, 0x7fb6d6, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e6, 2.2);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const surface = await riverSurface(track, tick);
  const height = (x, z) => groundHeight(surface, track, x, z);
  const rock = new THREE.Color(PALETTE.stone);
  const snow = new THREE.Color(0xffffff);
  const shade = new THREE.Color(0xd6ecf8);
  const ice = new THREE.Color(0x8fdcf2);
  const deep = new THREE.Color(0x4fa9d4);
  group.add(await groundMesh(surface, height, (x, y, z, n, out) => {
    const steep = 1 - Math.abs(n.y);
    if (y < 0) out.copy(deep).lerp(ice, 0.5 + 0.5 * Math.sin(y * 1.1 + noise(x * 2, z * 2) * 5)).lerp(snow, noise(x * 4, z * 4) > 0.6 ? 0.25 : 0);
    else if (steep > 0.34) out.copy(y > 26 ? rock : ice).lerp(deep, 0.25 * Math.sin(y * 0.8 + x * 0.05) + 0.25);
    else out.copy(noise(x * 2, z * 2) > 0.55 ? snow : shade);
  }, tick));
  await tick();

  const { launch, lip, dive, ramp, span } = track.river.land;
  const wallS = launch + dive + 62;
  const lidEnd = lip - 40;
  const water = seaStrip(track, Math.round((lip - 44) / track.spacing), Math.round((wallS + 3) / track.spacing) + track.N, { deep: SEA_DEEP, shallow: SEA_SHALLOW });
  group.add(water.mesh);

  const iceOf = (s) => (s > wallS && s < lidEnd ? 1 : 0);
  const underMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: UNDER_VERT,
    fragmentShader: UNDER_FRAG,
    side: THREE.FrontSide,
    fog: true,
  });
  const underside = new THREE.Mesh(trackBand(track, launch + dive - 40, lip + 20, 12, 1, iceOf), underMat);
  group.add(underside);
  const lidGeo = trackBand(track, wallS, lidEnd, 12, 1.3).clone();
  const lidIndex = lidGeo.index.array;
  for (let k = 0; k < lidIndex.length; k += 3) [lidIndex[k + 1], lidIndex[k + 2]] = [lidIndex[k + 2], lidIndex[k + 1]];
  lidGeo.computeVertexNormals();
  group.add(new THREE.Mesh(lidGeo, toon(0xf4fbff)));

  const floorMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    fog: true,
  });
  const floorGeo = trackBand(track, launch + dive - 10, lip, 6, 0);
  const floorPos = floorGeo.attributes.position;
  for (let i = 0; i < floorPos.count; i++) floorPos.setY(i, height(floorPos.getX(i), floorPos.getZ(i)) + 0.15);
  floorGeo.computeVertexNormals();
  const floorIdx = floorGeo.index.array;
  for (let k = 0; k < floorIdx.length; k += 3) [floorIdx[k + 1], floorIdx[k + 2]] = [floorIdx[k + 2], floorIdx[k + 1]];
  group.add(new THREE.Mesh(floorGeo, floorMat));

  const batch = new Batcher();
  const chopper = new Chopper(group);
  batch.chopper = chopper;
  const rand = mulberry32(5150);
  const blobs = [];
  group.add(iceShelf(track, launch));
  iceWall(batch, track, wallS, rand);
  iceWall(batch, track, wallS + 7, rand);
  for (let k = 0; k < 44; k++) {
    const lat = (rand() - 0.5) * 2 * (track.halfWidth + 14);
    const p = place(track, lidEnd + rand() * 8, lat);
    const size = 1.6 + rand() * 2.8;
    if (Math.abs(lat) < track.halfWidth - 6 && rand() < 0.75) continue;
    batch.add(['ice', 'iceLight'][k % 2], ROCK, mat(p.x, 0.6, p.z, size * 1.3, size * 0.6, size * 1.1, rand(), rand() * 6, rand()));
  }
  const columns = Array.from({ length: 5 }, () => icePillarShape(rand));
  const roofBatch = new Batcher();
  for (let k = 0; k < 20; k++) {
    const s = wallS + 40 + (k / 20) * (lidEnd - wallS - 90) + rand() * 10;
    const lat = (k % 2 ? 1 : -1) * (8 + rand() * 30);
    const p = place(track, s, lat);
    const floor = height(p.x, p.z);
    const r = 3.4 + rand() * 2.4;
    chopper.plant(batch, { x: p.x, z: p.z, base: floor, height: 1.5 - floor, radius: r, hang: { low: 2.4, high: 21, dress: shatterCaps } }).add('pillar', columns[k % columns.length], mat(p.x, floor - 0.5, p.z, r, 1.5 - floor, r, 0, rand() * 6, 0));
    for (let n = 0; n < 6; n++) {
      const a = rand() * 6.3;
      const q = 1.2 + rand() * 1.8;
      batch.add(['ice', 'iceLight', 'iceDeep'][n % 3], ROCK, mat(p.x + Math.cos(a) * r * 1.5, floor + q * 0.3, p.z + Math.sin(a) * r * 1.5, q, q * 0.7, q, rand(), rand() * 6, rand()));
    }
    blobs.push({ x: p.x, z: p.z, rx: r, rz: r, rot: 0, tree: chopper.trees.at(-1) });
  }
  for (let k = 0; k < 190; k++) {
    const s = wallS + 6 + rand() * (lidEnd - wallS - 12);
    const i = track.wrap(Math.round(s / track.spacing));
    const edge = rand();
    const lat = (rand() < 0.5 ? -1 : 1) * (edge * (track.hw[i] + 10));
    const p = place(track, s, lat);
    const reach = 2 + edge * edge * 16 + rand() * 3;
    const w = 4 + rand() * 7;
    batch.add(['iceDeep', 'ice', 'iceLight'][k % 3], ROCK, mat(p.x, 0.4 - reach * 0.4, p.z, w * 1.3, reach, w, rand() * 0.5, rand() * 6, rand() * 0.5));
    if (k % 2 === 0) {
      for (let n = 0; n < 3; n++) {
        const size = 0.6 + rand() * 0.9;
        const len = 2 + rand() * 4 + edge * 5;
        batch.add('iceLight', ICICLE, mat(p.x + (rand() - 0.5) * w, 0.2 - reach * 0.7 - len * 0.5, p.z + (rand() - 0.5) * w, size, len, size, 0, rand() * 6, 0));
      }
    }
  }
  for (let k = 0; k < 110; k++) {
    const s = wallS + 6 + rand() * (lidEnd - wallS - 12);
    const p = place(track, s, (rand() - 0.5) * 2 * (track.halfWidth + 4));
    const base = height(p.x, p.z);
    if (k % 2) {
      const size = 1.2 + rand() * 2.4;
      batch.add(['ice', 'iceLight'][k % 4 === 1 ? 0 : 1], ROCK, mat(p.x, base + size * 0.2, p.z, size * 1.3, size * 0.7, size, rand(), rand() * 6, rand()));
      if (size > 2.4) blobs.push({ x: p.x, z: p.z, rx: size, rz: size, rot: 0, top: track.level(s) + size * 0.6, launch: true });
    } else {
      for (let n = 0; n < 5; n++) {
        const size = 0.3 + rand() * 0.5;
        const len = 1.4 + rand() * 3;
        const lean = (rand() - 0.5) * 0.7;
        batch.add('crystal', SHARD, mat(p.x + (rand() - 0.5) * 1.6, base + len * 0.42, p.z + (rand() - 0.5) * 1.6, size, len, size, lean, rand() * 6, (rand() - 0.5) * 0.7));
      }
    }
  }
  for (let k = 0; k < 36; k++) {
    const s = rand() * track.length;
    if (track.formAt(s)) continue;
    const i = track.wrap(Math.round(s / track.spacing));
    const lat = (rand() < 0.5 ? -1 : 1) * (track.hw[i] * 0.5 + rand() * track.hw[i] * 0.4);
    const p = place(track, s, lat);
    const r = 3.5 + rand() * 5;
    batch.add('snow', ROCK, mat(p.x, 0.7, p.z, r, 1.1, r * 1.3, 0, rand() * 6, 0));
    batch.add('ice', ROCK, mat(p.x, 0.1, p.z, r * 1.08, 1, r * 1.38, 0, rand() * 6, 0));
    blobs.push({ x: p.x, z: p.z, rx: r * 0.8, rz: r * 1.05, rot: 0, top: 3, launch: true });
  }
  for (let k = 0; k < 150; k++) {
    const s = rand() * track.length;
    const side = rand() < 0.5 ? -1 : 1;
    const i = track.wrap(Math.round(s / track.spacing));
    const p = place(track, s, side * (track.hw[i] + 16 + rand() * 90));
    const y = height(p.x, p.z);
    if (y < 1) continue;
    const r = 8 + rand() * 20;
    const h = 1 + rand() * 1.5;
    await tick();
    batch.add(['ice', 'iceLight', 'iceDeep'][k % 3], ROCK, mat(p.x, y + r * h * 0.4, p.z, r, r * h, r * 0.9, rand() * 0.5, rand() * 6, rand() * 0.5));
    batch.add('snow', ROCK, mat(p.x, y + r * h * 1.05, p.z, r * 0.62, r * 0.28, r * 0.6, 0, rand() * 6, 0));
  }
  const penguins = new Batcher();
  for (let k = 0; k < 22; k++) {
    const s = rand() * track.length;
    if (track.formAt(s) && !(s > wallS)) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const i = track.wrap(Math.round(s / track.spacing));
    const p = place(track, s, side * (track.hw[i] + 11 + rand() * 12));
    const y = height(p.x, p.z);
    if (y < 1) continue;
    addPenguins(penguins, p.x, p.z, y, Math.atan2(-side * track.nx[i], -side * track.nz[i]), rand, 6 + Math.floor(rand() * 8));
  }
  const sp = place(track, track.length * 0.05, -(track.hw[0] + 42));
  addStation(batch, sp.x, sp.z, height(sp.x, sp.z), rand);
  const sp2 = place(track, track.length * 0.68, track.hw[0] + 46);
  addStation(batch, sp2.x, sp2.z, height(sp2.x, sp2.z), rand);

  const scenery = new THREE.Group();
  chopper.finish(PALETTE);
  const chunks = await batch.buildAsync(scenery, 0.1, PALETTE, 110, tick);
  chunks.push(...(await penguins.buildAsync(scenery, 0, PALETTE, 110, tick)));
  group.add(scenery);
  group.add(createArch(track, track.halfWidth));

  const fishCount = 90;
  const fish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.8, 5).rotateX(Math.PI / 2), toon(0xffffff), fishCount);
  fish.frustumCulled = false;
  const shoal = Array.from({ length: fishCount }, (_, k) => {
    const school = k % 3;
    fish.setColorAt(k, new THREE.Color([0xd9f4ff, 0xffd23f, 0xff8fc7][school]));
    return { s: wallS + 110 + school * 210, lat: (school - 1) * 20, r: 3 + rand() * 7, a: rand() * 6.3, y: -19 - rand() * 12, speed: 0.6 + rand() * 0.6 };
  });
  group.add(fish);
  const dummy = new THREE.Object3D();

  const shaftPos = [];
  const shaftCol = [];
  for (let k = 0; k < 70; k++) {
    const s = wallS + 10 + rand() * (lidEnd - wallS - 20);
    const p = place(track, s, (rand() - 0.5) * 2 * track.halfWidth);
    const w = 1.5 + rand() * 4;
    const yaw = rand() * 6.3;
    const dx = Math.cos(yaw) * w;
    const dz = Math.sin(yaw) * w;
    const drift = 3 + rand() * 4;
    const glowTop = 0.1 + rand() * 0.12;
    const quad = [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]];
    for (const [u, v] of quad) {
      shaftPos.push(p.x + dx * u + drift * v, -v * 40, p.z + dz * u + drift * 0.4 * v);
      const b = glowTop * (1 - v);
      shaftCol.push(b * 0.8, b, b);
    }
  }
  const shaftGeo = new THREE.BufferGeometry();
  shaftGeo.setAttribute('position', new THREE.Float32BufferAttribute(shaftPos, 3));
  shaftGeo.setAttribute('color', new THREE.Float32BufferAttribute(shaftCol, 3));
  const shafts = new THREE.Mesh(shaftGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  shafts.visible = false;
  group.add(shafts);

  const under = new THREE.Mesh(new THREE.SphereGeometry(900, 16, 10), new THREE.MeshBasicMaterial({ color: UNDER_FOG, side: THREE.BackSide, fog: false, depthWrite: false }));
  under.visible = false;
  group.add(under);

  const snowCount = 420;
  const snowGeo = new THREE.BufferGeometry();
  const flakes = new Float32Array(snowCount * 3);
  for (let k = 0; k < snowCount * 3; k++) flakes[k] = rand() * 90;
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const flurry = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.45, transparent: true, opacity: 0.9, depthWrite: false }));
  flurry.frustumCulled = false;
  group.add(flurry);

  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 200 + rand() * 500;
    cloud.position.set(Math.cos(a) * d, 130 + rand() * 60, Math.sin(a) * d);
    clouds.push(cloud);
    group.add(cloud);
  }
  const airFog = { color: new THREE.Color(SKY), near: 200, far: 780 };
  const seaFog = { color: new THREE.Color(UNDER_FOG), near: 14, far: 150 };
  const deepFog = new THREE.Color(0x07365e);

  return {
    fog,
    water,
    sun,
    surface,
    shores: blobs,
    chopper,
    spray: { foam: 0xffffff, tint: 0xc9f1ff, wake: 0xe9fbff },
    solid(p) {
      const { s, dist } = surface.sample(p.x, p.z);
      if (track.formAt(s) && p.y > 0.2 && p.y < 2) return dist < track.halfWidth + 10 && iceOf(s) ? new THREE.Vector3(0, -1, 0) : null;
      return groundHit(height, p);
    },
    update(t, dt, camera) {
      water.update(t);
      chopper.update(dt);
      underMat.uniforms.uTime.value = t;
      floorMat.uniforms.uTime.value = t;
      cullChunks(chunks, camera, fog.far);
      sky.position.copy(camera.position);
      under.position.copy(camera.position);
      const sample = surface.sample(camera.position.x, camera.position.z);
      const below = camera.position.y < 0.9 && sample.dist < track.hw[track.norm(sample.idx)] + 30;
      const mood = below ? seaFog : airFog;
      fog.color.copy(mood.color);
      if (below) fog.color.lerp(deepFog, Math.min(1, -camera.position.y / 26));
      under.material.color.copy(fog.color);
      fog.near = mood.near;
      fog.far = mood.far;
      sky.visible = !below;
      under.visible = below;
      shafts.visible = below;
      flurry.material.size = below ? 0.22 : 0.45;
      flurry.material.opacity = below ? 0.55 : 0.9;
      if (below) {
        shoal.forEach((f, k) => {
          f.a += f.speed * dt;
          const p = place(track, f.s, f.lat);
          dummy.position.set(p.x + Math.cos(f.a) * f.r, f.y + Math.sin(t + k) * 0.4, p.z + Math.sin(f.a) * f.r);
          dummy.rotation.set(0, -f.a, 0);
          dummy.updateMatrix();
          fish.setMatrixAt(k, dummy.matrix);
        });
        fish.instanceMatrix.needsUpdate = true;
      }
      const pos = snowGeo.attributes.position;
      for (let k = 0; k < snowCount; k++) {
        let y = pos.getY(k) - dt * (below ? 1.2 : 6);
        if (y < 0) y += 90;
        pos.setY(k, y);
      }
      pos.needsUpdate = true;
      flurry.position.set(camera.position.x - 45, camera.position.y - 30, camera.position.z - 45);
    },
  };
}
