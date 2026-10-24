import * as THREE from 'three';

const SHAPE_LIMIT = 700;
const EPS = 1e-7;

const triangleCount = (geometry) => (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;

class Buffer {
  constructor(Type, size = 4096) {
    this.Type = Type;
    this.data = new Type(size);
    this.length = 0;
  }

  reserve(n) {
    if (this.length + n <= this.data.length) return;
    const next = new this.Type(Math.max(this.data.length * 2, this.length + n));
    next.set(this.data);
    this.data = next;
  }

  trim() {
    return this.data.slice(0, this.length);
  }
}

function rayBox(o, d, min, max, far) {
  let t0 = 0;
  let t1 = far;
  for (let a = 0; a < 3; a++) {
    const inv = 1 / d[a];
    let near = (min[a] - o[a]) * inv;
    let farT = (max[a] - o[a]) * inv;
    if (near > farT) [near, farT] = [farT, near];
    if (near > t0) t0 = near;
    if (farT < t1) t1 = farT;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

function rayTriangle(o, d, p, i0, i1, i2, far) {
  const ax = p[i0], ay = p[i0 + 1], az = p[i0 + 2];
  const e1x = p[i1] - ax, e1y = p[i1 + 1] - ay, e1z = p[i1 + 2] - az;
  const e2x = p[i2] - ax, e2y = p[i2 + 1] - ay, e2z = p[i2 + 2] - az;
  const hx = d[1] * e2z - d[2] * e2y;
  const hy = d[2] * e2x - d[0] * e2z;
  const hz = d[0] * e2y - d[1] * e2x;
  const det = e1x * hx + e1y * hy + e1z * hz;
  if (det > -EPS && det < EPS) return Infinity;
  const f = 1 / det;
  const sx = o[0] - ax, sy = o[1] - ay, sz = o[2] - az;
  const u = f * (sx * hx + sy * hy + sz * hz);
  if (u < 0 || u > 1) return Infinity;
  const qx = sy * e1z - sz * e1y;
  const qy = sz * e1x - sx * e1z;
  const qz = sx * e1y - sy * e1x;
  const v = f * (d[0] * qx + d[1] * qy + d[2] * qz);
  if (v < 0 || u + v > 1) return Infinity;
  const t = f * (e2x * qx + e2y * qy + e2z * qz);
  return t > 1e-4 && t < far ? t : Infinity;
}

function faceNormal(p, i0, i1, i2, out) {
  const e1x = p[i1] - p[i0], e1y = p[i1 + 1] - p[i0 + 1], e1z = p[i1 + 2] - p[i0 + 2];
  const e2x = p[i2] - p[i0], e2y = p[i2 + 1] - p[i0 + 1], e2z = p[i2 + 2] - p[i0 + 2];
  return out.set(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x);
}

export class Collider {
  constructor(cell = 6) {
    this.cell = cell;
    this.cells = new Map();
    this.geometries = [];
    this.geometryIds = new Map();
    this.shapeGeometry = new Buffer(Int32Array);
    this.matrices = new Buffer(Float32Array, 65536);
    this.bounds = new Buffer(Float32Array, 24576);
    this.tris = new Buffer(Float32Array, 36864);
    this.shapeStamps = null;
    this.triStamps = null;
    this.stamp = 0;
    this.lo = [0, 0, 0];
    this.ld = [0, 0, 0];
    this.wo = [0, 0, 0];
    this.wd = [0, 0, 0];
    this.min = [0, 0, 0];
    this.max = [0, 0, 0];
    this.matrix = new THREE.Matrix4();
    this.inverse = new THREE.Matrix4();
    this.n3 = new THREE.Matrix3();
    this.v = new THREE.Vector3();
    this.box = new THREE.Box3();
    this.size = [0, 0, 0];
  }

  key(cx, cz) {
    return (cx + 32768) * 65536 + (cz + 32768);
  }

  insert(id, minX, minZ, maxX, maxZ) {
    const c = this.cell;
    for (let cx = Math.floor(minX / c); cx <= Math.floor(maxX / c); cx++) {
      for (let cz = Math.floor(minZ / c); cz <= Math.floor(maxZ / c); cz++) {
        const k = this.key(cx, cz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(id);
      }
    }
  }

  geometryId(geometry) {
    let id = this.geometryIds.get(geometry);
    if (id === undefined) {
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const { min, max } = geometry.boundingBox;
      id = this.geometries.length;
      this.geometries.push({ position: geometry.attributes.position.array, index: geometry.index?.array ?? null, isBox: geometry.type === 'BoxGeometry', min: min.toArray(), max: max.toArray() });
      this.geometryIds.set(geometry, id);
    }
    return id;
  }

  addShape(geometry, matrix) {
    if (triangleCount(geometry) > SHAPE_LIMIT) {
      this.addTriangles(geometry, matrix);
      return;
    }
    const geometryId = this.geometryId(geometry);
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = this.box.copy(geometry.boundingBox).applyMatrix4(matrix);
    const id = this.shapeGeometry.length;
    this.shapeGeometry.reserve(1);
    this.shapeGeometry.data[this.shapeGeometry.length++] = geometryId;
    this.matrices.reserve(16);
    this.matrices.data.set(matrix.elements, this.matrices.length);
    this.matrices.length += 16;
    this.bounds.reserve(6);
    this.bounds.data.set([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z], this.bounds.length);
    this.bounds.length += 6;
    this.insert(id, box.min.x, box.min.z, box.max.x, box.max.z);
  }

  addTriangles(geometry, matrix) {
    const position = geometry.attributes.position;
    const index = geometry.index?.array;
    const count = index ? index.length : position.count;
    const a = this.v;
    this.tris.reserve(count * 3);
    for (let k = 0; k < count; k += 3) {
      const id = this.tris.length / 9;
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (let j = 0; j < 3; j++) {
        a.fromBufferAttribute(position, index ? index[k + j] : k + j).applyMatrix4(matrix);
        this.tris.data[this.tris.length++] = a.x;
        this.tris.data[this.tris.length++] = a.y;
        this.tris.data[this.tris.length++] = a.z;
        minX = Math.min(minX, a.x);
        maxX = Math.max(maxX, a.x);
        minZ = Math.min(minZ, a.z);
        maxZ = Math.max(maxZ, a.z);
      }
      this.insert(-1 - id, minX, minZ, maxX, maxZ);
    }
  }

  async addObject(root, exclude, tick) {
    root.updateWorldMatrix(true, true);
    const local = new THREE.Matrix4();
    const meshes = [];
    const walk = (o) => {
      if (exclude.has(o)) return;
      if (o.isMesh) meshes.push(o);
      for (const child of o.children) walk(child);
    };
    walk(root);
    for (const o of meshes) {
      const material = Array.isArray(o.material) ? o.material[0] : o.material;
      if (material.side === THREE.BackSide && material.isShaderMaterial) continue;
      if (!o.geometry.attributes.position?.array) continue;
      if (o.isInstancedMesh) {
        for (let k = 0; k < o.count; k++) {
          o.getMatrixAt(k, local);
          this.addShape(o.geometry, local.premultiply(o.matrixWorld));
        }
      } else {
        this.addShape(o.geometry, o.matrixWorld);
      }
      await tick();
    }
    this.finish();
  }

  finish() {
    this.shapeGeometry.data = this.shapeGeometry.trim();
    this.matrices.data = this.matrices.trim();
    this.bounds.data = this.bounds.trim();
    this.tris.data = this.tris.trim();
    for (const [k, list] of this.cells) this.cells.set(k, Int32Array.from(list));
    this.shapeStamps = new Uint32Array(this.shapeGeometry.length);
    this.triStamps = new Uint32Array(this.tris.length / 9);
    this.geometryIds = null;
  }

  testShape(id, far, normal) {
    const b = this.bounds.data;
    const o6 = id * 6;
    this.min[0] = b[o6];
    this.min[1] = b[o6 + 1];
    this.min[2] = b[o6 + 2];
    this.max[0] = b[o6 + 3];
    this.max[1] = b[o6 + 4];
    this.max[2] = b[o6 + 5];
    if (rayBox(this.wo, this.wd, this.min, this.max, far) === Infinity) return Infinity;
    const g = this.geometries[this.shapeGeometry.data[id]];
    const matrix = this.matrix.fromArray(this.matrices.data, id * 16);
    const inv = this.inverse.copy(matrix).invert().elements;
    const [ox, oy, oz] = this.wo;
    const [dx, dy, dz] = this.wd;
    const lo = this.lo;
    const ld = this.ld;
    lo[0] = inv[0] * ox + inv[4] * oy + inv[8] * oz + inv[12];
    lo[1] = inv[1] * ox + inv[5] * oy + inv[9] * oz + inv[13];
    lo[2] = inv[2] * ox + inv[6] * oy + inv[10] * oz + inv[14];
    ld[0] = inv[0] * dx + inv[4] * dy + inv[8] * dz;
    ld[1] = inv[1] * dx + inv[5] * dy + inv[9] * dz;
    ld[2] = inv[2] * dx + inv[6] * dy + inv[10] * dz;
    let best = Infinity;
    if (g.isBox) {
      const t = rayBox(lo, ld, g.min, g.max, far);
      if (t > 1e-4 && t < far) {
        best = t;
        let axis = 0;
        let gap = Infinity;
        let sign = 1;
        for (let a = 0; a < 3; a++) {
          const hit = lo[a] + ld[a] * t;
          const toMin = Math.abs(hit - g.min[a]);
          const toMax = Math.abs(hit - g.max[a]);
          if (toMin < gap) {
            gap = toMin;
            axis = a;
            sign = -1;
          }
          if (toMax < gap) {
            gap = toMax;
            axis = a;
            sign = 1;
          }
        }
        normal.set(0, 0, 0).setComponent(axis, sign);
      }
    } else {
      const p = g.position;
      const idx = g.index;
      const n = idx ? idx.length : p.length / 3;
      let bi = -1;
      for (let k = 0; k < n; k += 3) {
        const i0 = (idx ? idx[k] : k) * 3;
        const i1 = (idx ? idx[k + 1] : k + 1) * 3;
        const i2 = (idx ? idx[k + 2] : k + 2) * 3;
        const t = rayTriangle(lo, ld, p, i0, i1, i2, Math.min(far, best));
        if (t < best) {
          best = t;
          bi = k;
        }
      }
      if (bi >= 0) faceNormal(p, (idx ? idx[bi] : bi) * 3, (idx ? idx[bi + 1] : bi + 1) * 3, (idx ? idx[bi + 2] : bi + 2) * 3, normal);
    }
    if (best === Infinity) return Infinity;
    normal.applyMatrix3(this.n3.getNormalMatrix(matrix)).normalize();
    return best;
  }

  testTriangle(id, far, normal) {
    const t = rayTriangle(this.wo, this.wd, this.tris.data, id * 9, id * 9 + 3, id * 9 + 6, far);
    if (t !== Infinity) faceNormal(this.tris.data, id * 9, id * 9 + 3, id * 9 + 6, normal).normalize();
    return t;
  }

  extent(id, normal) {
    if (id < 0) return Infinity;
    const b = this.bounds.data;
    const size = this.size;
    for (let a = 0; a < 3; a++) size[a] = b[id * 6 + 3 + a] - b[id * 6 + a];
    const facing = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
    const along = facing.indexOf(Math.max(...facing));
    return Math.min(...size.filter((_, a) => a !== along));
  }

  raycast(origin, dir, far) {
    const stamp = ++this.stamp;
    this.wo[0] = origin.x;
    this.wo[1] = origin.y;
    this.wo[2] = origin.z;
    this.wd[0] = dir.x;
    this.wd[1] = dir.y;
    this.wd[2] = dir.z;
    const c = this.cell;
    let cx = Math.floor(origin.x / c);
    let cz = Math.floor(origin.z / c);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const dx = Math.abs(dir.x) > 1e-9 ? c / Math.abs(dir.x) : Infinity;
    const dz = Math.abs(dir.z) > 1e-9 ? c / Math.abs(dir.z) : Infinity;
    let nextX = Math.abs(dir.x) > 1e-9 ? ((dir.x > 0 ? cx + 1 : cx) * c - origin.x) / dir.x : Infinity;
    let nextZ = Math.abs(dir.z) > 1e-9 ? ((dir.z > 0 ? cz + 1 : cz) * c - origin.z) / dir.z : Infinity;
    let best = Infinity;
    let bestId = 0;
    const normal = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (;;) {
      const exit = Math.min(nextX, nextZ, far);
      const list = this.cells.get(this.key(cx, cz));
      if (list) {
        for (let k = 0; k < list.length; k++) {
          const id = list[k];
          let t;
          if (id >= 0) {
            if (this.shapeStamps[id] === stamp) continue;
            this.shapeStamps[id] = stamp;
            t = this.testShape(id, Math.min(far, best), n);
          } else {
            if (this.triStamps[-1 - id] === stamp) continue;
            this.triStamps[-1 - id] = stamp;
            t = this.testTriangle(-1 - id, Math.min(far, best), n);
          }
          if (t < best) {
            best = t;
            bestId = id;
            normal.copy(n);
          }
        }
      }
      if (best <= exit || exit >= far) break;
      if (nextX < nextZ) {
        cx += stepX;
        nextX += dx;
      } else {
        cz += stepZ;
        nextZ += dz;
      }
    }
    if (best === Infinity) return null;
    if (normal.dot(dir) > 0) normal.negate();
    return { point: origin.clone().addScaledVector(dir, best), normal, t: best, extent: this.extent(bestId, normal) };
  }
}
