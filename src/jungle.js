import * as THREE from 'three';
import { createWater } from './water.js';
import { toon, outlined, mulberry32 } from './toon.js';
import { Batcher, COLORS, mat, LOW_SPHERE, CYLINDER, CONE, ROCK, addPalm, createSky, createCloud, createArch, SUN_DIR } from './world.js';

const CELL = 3;
const MARGIN = 340;
const RIVER_AMP = 0.4;
const SKY_GREEN = 0xd2f2dc;

const JUNGLE_COLORS = {
  ...COLORS,
  bark: 0x8a5a33,
  leaf: 0x3fae4a,
  leafLight: 0x6fcf55,
  leafDark: 0x23894a,
  fern: 0x4cbf5a,
  rock: 0x9a958c,
  pillar: 0x5b4636,
  railYellow: 0xffd23f,
  railDark: 0x2b3440,
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function noise(x, z) {
  return (
    0.5 +
    0.25 * Math.sin(x * 0.021 + Math.sin(z * 0.013) * 2) +
    0.15 * Math.sin(z * 0.034 + x * 0.011) +
    0.1 * Math.sin((x - z) * 0.057)
  );
}

export function riverSurface(track) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < track.N; i++) {
    minX = Math.min(minX, track.px[i]);
    maxX = Math.max(maxX, track.px[i]);
    minZ = Math.min(minZ, track.pz[i]);
    maxZ = Math.max(maxZ, track.pz[i]);
  }
  minX -= MARGIN;
  minZ -= MARGIN;
  maxX += MARGIN;
  maxZ += MARGIN;
  const cols = Math.ceil((maxX - minX) / CELL) + 1;
  const rows = Math.ceil((maxZ - minZ) / CELL) + 1;
  const nearest = new Int16Array(cols * rows);
  const { N, px, pz, tx, tz, wrap, spacing } = track;
  const step = 4;
  for (let r = 0; r < rows; r++) {
    const z = minZ + r * CELL;
    for (let c = 0; c < cols; c++) {
      const x = minX + c * CELL;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < N; i += step) {
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      for (let k = best - step; k <= best + step; k++) {
        const i = wrap(k);
        const d = (x - px[i]) ** 2 + (z - pz[i]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      nearest[r * cols + c] = best;
    }
  }

  const out = { level: 0, amp: 0, s: 0, dist: 0 };
  return {
    bounds: { minX, maxX, minZ, maxZ },
    sample(x, z) {
      const c = Math.min(cols - 1, Math.max(0, Math.round((x - minX) / CELL)));
      const r = Math.min(rows - 1, Math.max(0, Math.round((z - minZ) / CELL)));
      const i = nearest[r * cols + c];
      const along = (x - px[i]) * tx[i] + (z - pz[i]) * tz[i];
      const s = i * spacing + along;
      out.s = s;
      out.level = track.level(s);
      out.amp = track.onLift(s) ? 0 : RIVER_AMP;
      out.dist = Math.hypot(x - px[i], z - pz[i]);
      return out;
    },
  };
}

function terrainHeight(surface, track, x, z) {
  const { level, dist } = surface.sample(x, z);
  const hw = track.halfWidth;
  const bank = smooth(hw - 4, hw + 7, dist);
  const hills = smooth(hw + 7, hw + 70, dist) * (2 + 7 * noise(x, z));
  const mountains = smooth(140, 330, dist) * 70 * (0.5 + 0.6 * noise(x * 1.7 + 300, z * 1.7));
  return level - 4 + bank * 8.5 + hills + mountains;
}

function buildTerrain(surface, track) {
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const step = 4;
  const cols = Math.ceil((maxX - minX) / step) + 1;
  const rows = Math.ceil((maxZ - minZ) / step) + 1;
  const heights = new Float32Array(cols * rows);
  const levels = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = minX + c * step;
      const z = minZ + r * step;
      heights[r * cols + c] = terrainHeight(surface, track, x, z);
      levels[r * cols + c] = surface.sample(x, z).level;
    }
  }
  const positions = [];
  const colors = [];
  const grass = new THREE.Color(0x6fc94f);
  const grassDark = new THREE.Color(0x4fae45);
  const mud = new THREE.Color(0xc9a46b);
  const rock = new THREE.Color(0xa69b8f);
  const rockDark = new THREE.Color(0x8b8076);
  const tint = new THREE.Color();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c3 = new THREE.Vector3();
  const n = new THREE.Vector3();
  const tri = (i0, i1, i2, cIdx) => {
    for (const [v, idx] of [[a, i0], [b, i1], [c3, i2]]) {
      const rr = Math.floor(idx / cols);
      const cc = idx % cols;
      v.set(minX + cc * step, heights[idx], minZ + rr * step);
    }
    n.subVectors(b, a).cross(c3.clone().sub(a)).normalize();
    const lvl = levels[cIdx];
    const steep = 1 - Math.abs(n.y);
    const lush = noise(a.x * 3, a.z * 3) > 0.55 ? grassDark : grass;
    for (const v of [a, b, c3]) {
      if (steep > 0.45) tint.copy(steep > 0.7 ? rockDark : rock);
      else tint.copy(mud).lerp(lush, smooth(lvl + 0.4, lvl + 2.4, v.y));
      positions.push(v.x, v.y, v.z);
      colors.push(tint.r, tint.g, tint.b);
    }
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      tri(i, i + cols, i + 1, i);
      tri(i + 1, i + cols, i + cols + 1, i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, toon(0xffffff, { vertexColors: true }));
}

function buildRiver(track) {
  const hw = track.halfWidth + 8;
  const { N, spacing, river } = track;
  const positions = [];
  const lanes = 10;
  const at = (i, lane) => {
    const k = track.wrap(i);
    const lat = -hw + (2 * hw * lane) / lanes;
    return [track.px[k] + track.nx[k] * lat, track.pz[k] + track.nz[k] * lat];
  };
  for (let i = 0; i < N; i++) {
    const s0 = i * spacing;
    const s1 = (i + 1) * spacing;
    if (track.ahead(s0, river.falls) < spacing) continue;
    if (track.onLift(s0) && track.level(s0) > 0.5) continue;
    if (track.onLift(s1) && track.level(s1) > 0.5) continue;
    const y0 = track.level(s0);
    const y1 = track.level(s1);
    for (let lane = 0; lane < lanes; lane++) {
      const [ax, az] = at(i, lane);
      const [bx, bz] = at(i, lane + 1);
      const [cx, cz] = at(i + 1, lane);
      const [dx, dz] = at(i + 1, lane + 1);
      positions.push(ax, y0, az, cx, y1, cz, bx, y0, bz);
      positions.push(bx, y0, bz, cx, y1, cz, dx, y1, dz);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return createWater({ geometry, flat: true, amp: RIVER_AMP, deep: 0x1c8f86, shallow: 0x4fd6b4 });
}

const FALL_VERT = /* glsl */ `
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FALL_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    float col = floor(vUv.x * 46.0);
    float r = fract(sin(col * 12.9898) * 43758.5453);
    float flow = fract(vUv.y * 2.5 - uTime * (1.2 + r * 0.8) + r);
    float streak = smoothstep(0.5, 0.56, flow) * (1.0 - smoothstep(0.8, 0.9, flow));
    vec3 base = mix(vec3(0.42, 0.86, 0.84), vec3(0.75, 0.96, 0.95), vUv.y);
    vec3 color = mix(base, vec3(1.0), streak * 0.75 + smoothstep(0.82, 1.0, vUv.y) * 0.7 + smoothstep(0.08, 0.0, vUv.y) * 0.5);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function buildFalls(track) {
  const s = track.river.falls;
  const i = Math.floor(s / track.spacing);
  const px = track.px[i], pz = track.pz[i], tx = track.tx[i], tz = track.tz[i], nx = track.nx[i], nz = track.nz[i];
  const height = track.map.height;
  const hw = track.halfWidth + 8;
  const cols = 24;
  const rows = 14;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const u = r / rows;
    const along = 1 + 9 * Math.sqrt(u);
    const y = height * (1 - u) + 0.3 * (1 - u);
    for (let c = 0; c <= cols; c++) {
      const lat = -hw + (2 * hw * c) / cols;
      positions.push(px + tx * along + nx * lat, y, pz + tz * along + nz * lat);
      uvs.push(c / cols, u);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      indices.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: FALL_VERT,
    fragmentShader: FALL_FRAG,
    side: THREE.DoubleSide,
    fog: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, material, base: { x: px + tx * 10, z: pz + tz * 10, nx, nz, hw: track.halfWidth } };
}

function beltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#39424f';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#2b323c';
  for (let y = 0; y < 128; y += 16) ctx.fillRect(0, y, 128, 5);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(24, 92);
  ctx.lineTo(64, 48);
  ctx.lineTo(104, 92);
  ctx.lineTo(104, 70);
  ctx.lineTo(64, 26);
  ctx.lineTo(24, 70);
  ctx.closePath();
  ctx.fillStyle = '#FFD23F';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function buildLift(track, batch) {
  const { river, spacing } = track;
  const start = Math.floor(river.liftStart / spacing) - 3;
  const end = Math.ceil(river.liftEnd / spacing) + 2;
  const hw = track.halfWidth;
  const positions = [];
  const uvs = [];
  const sides = [];
  let v = 0;
  for (let k = start; k < end; k++) {
    const i0 = track.wrap(k);
    const i1 = track.wrap(k + 1);
    const y0 = track.level(k * spacing) - 0.08;
    const y1 = track.level((k + 1) * spacing) - 0.08;
    const corner = (i, lat, y) => [track.px[i] + track.nx[i] * lat, y, track.pz[i] + track.nz[i] * lat];
    const a = corner(i0, -hw, y0);
    const b = corner(i0, hw, y0);
    const c = corner(i1, -hw, y1);
    const d = corner(i1, hw, y1);
    const v1 = v + spacing / 9;
    positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    uvs.push(0, v, 0, v1, (hw * 2) / 9, v, (hw * 2) / 9, v, 0, v1, (hw * 2) / 9, v1);
    for (const [p, q] of [[a, c], [d, b]]) {
      sides.push(...p, ...q, p[0], p[1] - 1.6, p[2], p[0], p[1] - 1.6, p[2], ...q, q[0], q[1] - 1.6, q[2]);
    }
    v = v1;
    if (k % 4 === 0) {
      for (const side of [-1, 1]) {
        const [x, y, z] = corner(i0, side * (hw + 0.6), y0);
        batch.add(k % 8 === 0 ? 'railYellow' : 'railDark', new THREE.BoxGeometry(1, 1.4, spacing * 4.1), mat(x, y + 0.7, z, 1, 1, 1, 0, track.heading(i0), 0));
        if (k % 12 === 0) batch.add('pillar', CYLINDER, mat(x, y - 6, z, 1.1, 12, 1.1));
      }
    }
  }
  const texture = beltTexture();
  texture.repeat.set(1, 1);
  const deckGeometry = new THREE.BufferGeometry();
  deckGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  deckGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  deckGeometry.computeVertexNormals();
  const deck = new THREE.Mesh(deckGeometry, toon(0xffffff, { map: texture, side: THREE.DoubleSide }));
  const sideGeometry = new THREE.BufferGeometry();
  sideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sides, 3));
  sideGeometry.computeVertexNormals();
  const skirt = new THREE.Mesh(sideGeometry, toon(0x2b3440, { side: THREE.DoubleSide }));
  const group = new THREE.Group();
  group.add(deck, skirt);
  return { group, texture };
}

const CANOPY = new THREE.SphereGeometry(1, 9, 6);

function addBroadleaf(batch, x, y, z, rand, tall = 1) {
  const h = (9 + rand() * 9) * tall;
  batch.add('bark', CYLINDER, mat(x, y + h / 2 - 1, z, 0.6 + h * 0.03, h, 0.6 + h * 0.03));
  const blobs = 3 + Math.floor(rand() * 3);
  const r = 3.4 + rand() * 2.2;
  for (let i = 0; i < blobs; i++) {
    const a = rand() * Math.PI * 2;
    const off = i === 0 ? 0 : r * 0.6;
    const key = ['leaf', 'leafLight', 'leafDark'][Math.floor(rand() * 3)];
    const s = r * (i === 0 ? 1 : 0.7 + rand() * 0.25);
    batch.add(key, CANOPY, mat(x + Math.cos(a) * off, y + h + (i === 0 ? 0.5 : -0.8 + rand() * 1.5), z + Math.sin(a) * off, s, s * 0.75, s));
  }
}

function addBush(batch, x, y, z, rand) {
  const lumps = 2 + Math.floor(rand() * 2);
  for (let i = 0; i < lumps; i++) {
    const a = rand() * Math.PI * 2;
    const s = 1.8 + rand() * 1.8;
    const key = ['leaf', 'leafLight', 'leafDark', 'fern'][Math.floor(rand() * 4)];
    batch.add(key, CANOPY, mat(x + Math.cos(a) * s * 0.5, y + s * 0.35, z + Math.sin(a) * s * 0.5, s, s * 0.7, s));
  }
}

function addFern(batch, x, y, z, rand) {
  const leaves = 5 + Math.floor(rand() * 3);
  const size = 1.2 + rand() * 1.4;
  for (let i = 0; i < leaves; i++) {
    const a = (i / leaves) * Math.PI * 2 + rand() * 0.4;
    batch.add('fern', CONE, mat(x + Math.cos(a) * size * 0.6, y + size * 0.35, z + Math.sin(a) * size * 0.6, 0.35 * size, size * 1.4, 0.18 * size, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9));
  }
}

export function createJungle(group, track, fx) {
  const fog = new THREE.Fog(SKY_GREEN, 130, 560);
  const sky = createSky();
  group.add(sky);
  group.add(new THREE.HemisphereLight(0xeaffea, 0x3c8f6a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(100);
  group.add(sun);

  const surface = riverSurface(track);
  group.add(buildTerrain(surface, track));
  const water = buildRiver(track);
  group.add(water.mesh);
  const falls = buildFalls(track);
  group.add(falls.mesh);

  const batch = new Batcher();
  const lift = buildLift(track, batch);
  group.add(lift.group);

  const rand = mulberry32(7203);
  const hw = track.halfWidth;
  const { minX, maxX, minZ, maxZ } = surface.bounds;
  const steep = (x, z) => {
    const h = terrainHeight(surface, track, x, z);
    return Math.max(
      Math.abs(terrainHeight(surface, track, x + 3, z) - h),
      Math.abs(terrainHeight(surface, track, x, z + 3) - h),
    ) > 2.4;
  };
  const bankSpot = (from, to) => {
    const idx = Math.floor(rand() * track.N);
    const side = rand() < 0.5 ? -1 : 1;
    const p = track.point(idx, side * (hw + from + rand() * (to - from)));
    const { dist } = surface.sample(p.x, p.z);
    return dist < hw + from - 0.5 || steep(p.x, p.z) ? null : p;
  };
  for (let n = 0, tries = 0; n < 1300 && tries < 8000; tries++) {
    const p = bankSpot(7, 42);
    if (!p) continue;
    const y = terrainHeight(surface, track, p.x, p.z);
    if (rand() < 0.7) addBroadleaf(batch, p.x, y, p.z, rand, 1 + rand() * 0.4);
    else addPalm(batch, p.x, y - 0.5, p.z, rand, { height: 10 + rand() * 9, lean: rand() * 0.5, dir: rand() * Math.PI * 2 });
    n++;
  }
  for (let n = 0, tries = 0; n < 1000 && tries < 6000; tries++) {
    const p = bankSpot(3.5, 16);
    if (!p) continue;
    addBush(batch, p.x, terrainHeight(surface, track, p.x, p.z), p.z, rand);
    n++;
  }
  for (let n = 0, tries = 0; n < 420 && tries < 4000; tries++) {
    const p = bankSpot(5, 30);
    if (!p) continue;
    addFern(batch, p.x, terrainHeight(surface, track, p.x, p.z), p.z, rand);
    n++;
  }
  for (let n = 0, tries = 0; n < 500 && tries < 9000; tries++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    const { dist } = surface.sample(x, z);
    if (dist < hw + 42 || dist > 260 || steep(x, z)) continue;
    addBroadleaf(batch, x, terrainHeight(surface, track, x, z), z, rand, 1.2 + rand() * 0.5);
    n++;
  }
  const lip = track.river.falls;
  const li = Math.floor(lip / track.spacing);
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const lat = side * (hw + 2 + k * 3);
      const along = -4 + k * 4;
      const x = track.px[li] + track.nx[li] * lat + track.tx[li] * along;
      const z = track.pz[li] + track.nz[li] * lat + track.tz[li] * along;
      const s = 3 + rand() * 3;
      batch.add('rock', ROCK, mat(x, track.map.height + s * 0.3 - (along > 2 ? 4 : 0), z, s, s * 0.8, s, rand(), rand(), rand()));
    }
  }
  const scenery = new THREE.Group();
  batch.build(scenery, 0.1, JUNGLE_COLORS);
  group.add(scenery);

  group.add(createArch(track, hw));

  const clouds = [];
  for (let i = 0; i < 12; i++) {
    const cloud = createCloud(rand);
    const a = rand() * Math.PI * 2;
    const d = 150 + rand() * 600;
    cloud.position.set(Math.cos(a) * d, 140 + rand() * 70, Math.sin(a) * d);
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  const base = falls.base;
  return {
    fog,
    water,
    sun,
    surface,
    shores: [],
    update(t, dt, camera) {
      water.update(t);
      falls.material.uniforms.uTime.value = t;
      lift.texture.offset.y -= dt * 2.2;
      sky.position.copy(camera.position);
      for (const cloud of clouds) {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > 800) cloud.position.x = -800;
      }
      for (let i = 0; i < 3; i++) {
        if (Math.random() > dt * 30) continue;
        const lat = (Math.random() - 0.5) * 2 * (base.hw + 4);
        fx.mist(base.x + base.nx * lat, 0.5, base.z + base.nz * lat);
      }
    },
  };
}
