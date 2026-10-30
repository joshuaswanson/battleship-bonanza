import * as THREE from 'three';
import { toon, INK } from './toon.js';

const WIDTH = 1024;
const UNCUT = -1e5;

const CHOP_VERT = /* glsl */ `
  vec4 chopInfo = texelFetch(uCuts, ivec2(int(mod(aChop.x, ${WIDTH}.0)), int(aChop.x / ${WIDTH}.0)), 0);
  if (chopInfo.a > 0.5 && transformed.y > chopInfo.r) {
    if (aChop.y > 0.5) transformed.y = chopInfo.r;
    else transformed = vec3(chopInfo.g, chopInfo.r, chopInfo.b);
  }
`;

const OUTLINE_VERT = /* glsl */ `
  uniform float uThickness;
  uniform sampler2D uCuts;
  attribute vec2 aChop;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vec3 transformed = position;
    ${CHOP_VERT}
    vec4 mvPosition = modelViewMatrix * vec4(transformed + normal * uThickness, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  #include <common>
  #include <fog_pars_fragment>
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class Chopper {
  constructor(group) {
    this.group = group;
    this.trees = [];
    this.grid = new Map();
    this.falling = [];
    this.data = null;
    this.texture = null;
    this.uniform = { value: null };
    this.colors = {};
    this.materials = new Map();
  }

  plant(batch, info) {
    const id = this.trees.length;
    const tree = { id, ...info, parts: [], cut: false };
    this.trees.push(tree);
    const cell = this.key(info.x, info.z);
    if (!this.grid.has(cell)) this.grid.set(cell, []);
    this.grid.get(cell).push(tree);
    const box = new THREE.Box3();
    return {
      add: (key, geometry, matrix) => {
        if (!geometry.boundingBox) geometry.computeBoundingBox();
        box.copy(geometry.boundingBox).applyMatrix4(matrix ?? new THREE.Matrix4());
        const trunk = box.min.y < info.base + 1 && box.max.y - box.min.y > 1;
        tree.parts.push({ key, geometry, matrix: matrix ? matrix.clone() : new THREE.Matrix4(), trunk });
        batch.add(key, geometry, matrix, { id, trunk });
      },
    };
  }

  key(x, z) {
    return `${Math.floor(x / 12)},${Math.floor(z / 12)}`;
  }

  finish(colors) {
    this.colors = colors;
    const rows = Math.max(1, Math.ceil(this.trees.length / WIDTH));
    this.data = new Float32Array(WIDTH * rows * 4);
    for (let i = 0; i < this.data.length; i += 4) this.data[i] = UNCUT;
    this.texture = new THREE.DataTexture(this.data, WIDTH, rows, THREE.RGBAFormat, THREE.FloatType);
    this.texture.needsUpdate = true;
    this.uniform.value = this.texture;
  }

  material() {
    if (this.toonMaterial) return this.toonMaterial;
    const material = toon(0xffffff, { vertexColors: true });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uCuts = this.uniform;
      shader.vertexShader = 'uniform sampler2D uCuts;\nattribute vec2 aChop;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${CHOP_VERT}`);
    };
    this.toonMaterial = material;
    return material;
  }

  outline(thickness) {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uThickness: { value: thickness }, uColor: { value: new THREE.Color(INK) }, uCuts: this.uniform }]),
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      side: THREE.BackSide,
      fog: true,
    });
  }

  hit(p) {
    const cx = Math.floor(p.x / 12);
    const cz = Math.floor(p.z / 12);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.grid.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const t of list) {
          if (t.cut || p.y < t.base - 2.5 || p.y > t.base + t.height * 0.55) continue;
          if (Math.hypot(p.x - t.x, p.z - t.z) < t.radius) return t;
        }
      }
    }
    return null;
  }

  trunkAhead(origin, dir, reach) {
    if (!this.trees.length) return null;
    const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const p = new THREE.Vector3();
    for (let t = 1; t <= reach; t += 0.6) {
      p.copy(origin).addScaledVector(flat, t);
      const list = this.grid.get(`${Math.floor(p.x / 12)},${Math.floor(p.z / 12)}`);
      if (!list) continue;
      for (const tree of list) {
        if (!tree.cut && !tree.hang && Math.hypot(p.x - tree.x, p.z - tree.z) < tree.radius) return tree;
      }
    }
    return null;
  }

  march(origin, dir, reach) {
    if (!this.trees.length) return null;
    const p = new THREE.Vector3();
    for (let t = 1; t <= reach; t += 0.6) {
      p.copy(origin).addScaledVector(dir, t);
      const tree = this.hit(p);
      if (tree) return { tree, t, point: p.clone() };
    }
    return null;
  }

  partMaterial(key, clip, painted) {
    return toon(painted ? 0xffffff : this.colors[key] ?? 0xffffff, { clippingPlanes: [clip], side: THREE.DoubleSide, vertexColors: painted });
  }

  chop(id, cutY, dir) {
    const tree = this.trees[id];
    if (!tree || tree.cut) return;
    tree.cut = true;
    const low = tree.hang ? tree.base + tree.hang.low : cutY;
    const top = tree.hang ? tree.base + tree.hang.high : cutY;
    this.data.set([low, tree.x, tree.z, 1], id * 4);
    this.texture.needsUpdate = true;
    const pivot = new THREE.Vector3(tree.x, top, tree.z);
    const holder = new THREE.Group();
    holder.position.copy(pivot);
    const inverse = new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), -top);
    const materials = new Map();
    for (const part of tree.parts) {
      const box = part.geometry.boundingBox.clone().applyMatrix4(part.matrix);
      if (box.max.y <= top) continue;
      const painted = part.geometry.hasAttribute('color');
      const id = `${part.key}|${painted}`;
      if (!materials.has(id)) materials.set(id, this.partMaterial(part.key, clip, painted));
      const mesh = new THREE.Mesh(part.geometry, materials.get(id));
      mesh.matrixAutoUpdate = false;
      mesh.matrix.multiplyMatrices(inverse, part.matrix);
      holder.add(mesh);
    }
    this.group.add(holder);
    const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    if (tree.hang) {
      tree.hang.dress(holder, low - top, tree);
      this.onShatter?.(tree, dir);
      this.falling.push({ holder, clip, pivot, axis: new THREE.Vector3(flat.z, 0, -flat.x), angle: 0, speed: 0, rest: 0, landed: true });
      return;
    }
    this.falling.push({ holder, clip, pivot, axis: new THREE.Vector3(flat.z, 0, -flat.x), angle: 0.06, speed: 1.3, rest: Math.PI / 2 - 0.08, landed: false, height: tree.height });
    while (this.falling.length > 40) {
      const old = this.falling.shift();
      this.group.remove(old.holder);
    }
  }

  update(dt, onLand) {
    const up = new THREE.Vector3();
    for (const f of this.falling) {
      if (!f.landed || Math.abs(f.speed) > 0.02) {
        f.speed += (5 * Math.sin(f.angle) + 1.6) * dt * (f.landed ? 0 : 1);
        f.angle += f.speed * dt;
        if (f.angle >= f.rest) {
          f.angle = f.rest;
          if (!f.landed) {
            f.landed = true;
            onLand?.(f);
          }
          f.speed = -f.speed * 0.22;
        } else if (f.landed) {
          f.speed += 2.5 * dt;
        }
      }
      f.holder.quaternion.setFromAxisAngle(f.axis, f.angle);
      up.set(0, 1, 0).applyQuaternion(f.holder.quaternion);
      f.clip.setFromNormalAndCoplanarPoint(up, f.pivot);
    }
  }

  reset() {
    for (const f of this.falling) this.group.remove(f.holder);
    this.falling.length = 0;
    for (const t of this.trees) {
      t.cut = false;
      t.melt = 0;
    }
    if (this.data) {
      for (let i = 0; i < this.trees.length; i++) this.data.set([UNCUT, 0, 0, 0], i * 4);
      this.texture.needsUpdate = true;
    }
  }
}
