import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon, outlined } from './toon.js';
import { waveHeight } from './water.js';

const HEAL = 35;
const RESPAWN = 14;
const RADIUS = 3.4;
const SPOTS = [
  [0.07, -12], [0.19, 11], [0.31, 0], [0.44, -15],
  [0.56, 14], [0.68, -6], [0.81, 9], [0.93, -14],
];

const BOX = new RoundedBoxGeometry(1, 1, 1, 3, 0.18);
const RING_ARC = new THREE.TorusGeometry(1.45, 0.4, 12, 10, Math.PI / 2);

function block(parent, material, x, y, z, sx, sy, sz, outline = 0.04) {
  const geometry = BOX.clone().scale(sx, sy, sz);
  const mesh = outlined(geometry, material, outline);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function buildMedkit() {
  const group = new THREE.Group();
  const orange = toon(0xff8a1f);
  const white = toon(0xffffff);
  const red = toon(0xff4141);
  for (let i = 0; i < 4; i++) {
    const arc = outlined(RING_ARC, i % 2 ? white : orange, 0.05);
    arc.rotation.set(-Math.PI / 2, 0, (i * Math.PI) / 2);
    group.add(arc);
  }
  const kit = new THREE.Group();
  kit.position.y = 1.1;
  group.add(kit);
  block(kit, white, 0, 0, 0, 1.7, 1.15, 1.25);
  block(kit, red, 0, 0.6, 0, 0.9, 0.08, 0.28, 0);
  block(kit, red, 0, 0.6, 0, 0.28, 0.08, 0.9, 0);
  for (const side of [-1, 1]) {
    block(kit, red, 0, 0, side * 0.64, 0.8, 0.24, 0.06, 0);
    block(kit, red, 0, 0, side * 0.64, 0.24, 0.8, 0.06, 0);
  }
  const handle = outlined(new THREE.TorusGeometry(0.32, 0.07, 8, 16, Math.PI), toon(0x34465e), 0.02);
  handle.position.y = 0.6;
  kit.add(handle);
  return group;
}

export class Medkits {
  constructor(scene, track, fx, sfx) {
    this.scene = scene;
    this.track = track;
    this.fx = fx;
    this.sfx = sfx;
    this.kits = SPOTS.map(([fraction, lateral], i) => {
      const idx = track.wrap(Math.round(fraction * track.N));
      const p = track.point(idx, lateral);
      const mesh = buildMedkit();
      scene.add(mesh);
      return { idx, lateral, x: p.x, z: p.z, mesh, cooldown: 0, appear: 1, phase: i * 1.7 };
    });
  }

  get active() {
    return this.kits.filter((k) => k.cooldown <= 0);
  }

  nearestAhead(boat, range) {
    let best = null;
    let bestGap = Infinity;
    for (const kit of this.active) {
      const gap = this.track.wrap(kit.idx - boat.trackIdx) * this.track.spacing;
      if (gap > 6 && gap < range && gap < bestGap) {
        best = kit;
        bestGap = gap;
      }
    }
    return best;
  }

  update(race, dt, t) {
    for (const kit of this.kits) {
      if (kit.cooldown > 0) {
        kit.cooldown -= dt;
        kit.mesh.visible = kit.cooldown <= 0;
        if (kit.cooldown <= 0) kit.appear = 0;
        continue;
      }
      kit.appear = Math.min(1, kit.appear + dt * 2.5);
      const k = kit.appear;
      const pop = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
      kit.mesh.scale.setScalar(Math.max(0.01, pop));
      kit.mesh.position.set(kit.x, waveHeight(kit.x, kit.z, t) + 0.1, kit.z);
      kit.mesh.rotation.set(Math.sin(t * 1.6 + kit.phase) * 0.08, t * 0.8 + kit.phase, Math.cos(t * 1.3 + kit.phase) * 0.08);

      for (const b of race.boats) {
        if (!b.alive || b.hp >= 100 || b.yOffset > 2.5) continue;
        if (b.distanceToAxis2D(kit.x, kit.z) > RADIUS) continue;
        b.hp = Math.min(100, b.hp + HEAL);
        kit.cooldown = RESPAWN;
        kit.mesh.visible = false;
        const y = kit.mesh.position.y + 1.2;
        this.fx.sparkBurst(kit.x, y, kit.z, 0x3ddc6f, 18);
        this.fx.sparkBurst(kit.x, y, kit.z, 0xffffff, 10);
        this.fx.ring(kit.x, y - 0.8, kit.z, 0x3ddc6f, 1, 6, 0.5);
        this.sfx.play('heal', b.pos);
        if (b.isPlayer) race.emit('heal', { amount: HEAL });
        break;
      }
    }
  }

  dispose() {
    for (const kit of this.kits) this.scene.remove(kit.mesh);
  }
}
