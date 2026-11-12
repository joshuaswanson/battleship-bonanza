import * as THREE from 'three';
import { buildBoat, disposeBoat } from './boatModel.js';
import { toon } from './toon.js';
import { courseOf } from './records.js';

const RATE = 1 / 6;
const FIELDS = 15;
const POSITION_STEP = 0.1;
const UNIT = 32767;
const ANGLE_STEP = 0.01;
const FADE_NEAR = 6;
const FADE_FAR = 16;
const OPACITY = 0.45;
const GHOST_ORDER = 20;
const keyOf = (map) => `bb-ghost-${map}`;
export const ghostsOn = () => localStorage.getItem('bb-ghost') !== '0';
export const setGhosts = (on) => localStorage.setItem('bb-ghost', on ? '1' : '0');

const clampShort = (v) => Math.max(-UNIT, Math.min(UNIT, Math.round(v)));

export class GhostRecorder {
  constructor(boat) {
    this.boat = boat;
    this.samples = [];
    this.next = 0;
  }

  update(clock) {
    if (clock < this.next || this.boat.finished) return;
    this.next = clock + RATE;
    const { root, body } = this.boat.model;
    const b = this.boat;
    this.samples.push(
      root.position.x / POSITION_STEP, root.position.y / POSITION_STEP, root.position.z / POSITION_STEP,
      root.quaternion.x * UNIT, root.quaternion.y * UNIT, root.quaternion.z * UNIT, root.quaternion.w * UNIT,
      body.position.y / ANGLE_STEP,
      body.quaternion.x * UNIT, body.quaternion.y * UNIT, body.quaternion.z * UNIT, body.quaternion.w * UNIT,
      b.formP * UNIT, ((b.roll ?? 0) % 1000) / ANGLE_STEP / 10, (-b.steerVis * 0.4) / ANGLE_STEP,
    );
  }

  save(map, time) {
    const data = Int16Array.from(this.samples, clampShort);
    const bytes = new Uint8Array(data.buffer);
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    try {
      localStorage.setItem(keyOf(map), JSON.stringify({ time, course: courseOf(map), color: this.boat.color, items: this.boat.items, data: btoa(text) }));
    } catch {}
  }
}

export function loadGhost(map) {
  try {
    const saved = JSON.parse(localStorage.getItem(keyOf(map)));
    if (!saved?.data || !Array.isArray(saved.items) || (saved.course ?? 1) !== courseOf(map)) return null;
    const text = atob(saved.data);
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
    const data = new Int16Array(bytes.buffer);
    return data.length >= FIELDS * 2 ? { ...saved, data } : null;
  } catch {
    return null;
  }
}

const qa = new THREE.Quaternion();
const qb = new THREE.Quaternion();

export class Ghost {
  constructor(scene, saved, vehicle) {
    this.scene = scene;
    this.data = saved.data;
    this.count = Math.floor(saved.data.length / FIELDS);
    this.model = buildBoat(saved.color, saved.items);
    this.form = vehicle ? new vehicle.Form(this.model, saved.color) : null;
    this.material = toon(0xdff4ff, { transparent: true, opacity: OPACITY, depthWrite: false });
    this.mask = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true });
    const solid = [];
    this.model.root.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.uniforms || m.transparent || m.blending !== THREE.NormalBlending || m.isMeshBasicMaterial) o.visible = false;
      else solid.push(o);
    });
    for (const mesh of solid) {
      mesh.material = this.material;
      mesh.renderOrder = GHOST_ORDER + 1;
      const mask = new THREE.Mesh(mesh.geometry, this.mask);
      mask.renderOrder = GHOST_ORDER;
      mesh.add(mask);
    }
    scene.add(this.model.root);
  }

  pose(clock, viewer) {
    const at = clock / RATE;
    const i = Math.floor(at);
    const root = this.model.root;
    root.visible = i >= 0 && i < this.count - 1;
    if (!root.visible) return;
    const d = this.data;
    const a = i * FIELDS;
    const b = a + FIELDS;
    const k = at - i;
    const mix = (f) => d[a + f] + (d[b + f] - d[a + f]) * k;
    root.position.set(mix(0) * POSITION_STEP, mix(1) * POSITION_STEP, mix(2) * POSITION_STEP);
    qa.set(d[a + 3], d[a + 4], d[a + 5], d[a + 6]).normalize();
    qb.set(d[b + 3], d[b + 4], d[b + 5], d[b + 6]).normalize();
    root.quaternion.slerpQuaternions(qa, qb, k);
    const body = this.model.body;
    qa.set(d[a + 8], d[a + 9], d[a + 10], d[a + 11]).normalize();
    qb.set(d[b + 8], d[b + 9], d[b + 10], d[b + 11]).normalize();
    body.quaternion.slerpQuaternions(qa, qb, k);
    this.form?.set(mix(12) / UNIT, mix(13) * ANGLE_STEP * 10, mix(14) * ANGLE_STEP, clock);
    body.position.y = mix(7) * ANGLE_STEP;
    const gap = viewer ? root.position.distanceTo(viewer) : FADE_FAR;
    this.material.opacity = OPACITY * Math.max(0, Math.min(1, (gap - FADE_NEAR) / (FADE_FAR - FADE_NEAR)));
  }

  dispose() {
    this.scene.remove(this.model.root);
    disposeBoat(this.model);
    this.material.dispose();
    this.mask.dispose();
  }
}
