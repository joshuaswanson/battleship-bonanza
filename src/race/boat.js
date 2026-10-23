import * as THREE from 'three';
import { ITEMS } from '../items.js';
import { buildBoat, newHeat } from '../boatModel.js';
import { createAI } from '../ai.js';
import { AXIS_HALF, HOLD_IDS, MAX_HP, clamp } from './shared.js';

let shadowTexture;
function shadowMaterial() {
  if (!shadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(8,40,70,0.45)');
    g.addColorStop(0.6, 'rgba(8,40,70,0.25)');
    g.addColorStop(1, 'rgba(8,40,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    shadowTexture = new THREE.CanvasTexture(canvas);
  }
  return new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
}
const SHADOW_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export class Boat {
  constructor(def, index, scene) {
    this.index = index;
    this.name = def.name;
    this.color = def.color;
    this.items = def.items;
    this.isPlayer = !!def.isPlayer;
    this.model = buildBoat(def.color, def.items);
    scene.add(this.model.root);
    this.turrets = this.model.swivels
      .filter((s) => s.id !== 'saw' && s.id !== 'jetpack')
      .map((s) => ({ id: s.id, group: s.group, center: s.center }));
    this.aim = {};
    this.missileQueue = [];
    this.charges = this.items.map((id) => (ITEMS[id]?.charges ? { left: ITEMS[id].charges, refill: 0 } : null));
    this.attackRolls = new Map();
    this.lastFired = -Infinity;
    this.regenerating = false;
    this.disabled = 0;
    this.stats = { dealt: 0, taken: 0, sunk: 0, kills: 0, top: 0, byItem: {} };
    this.shadow = new THREE.Mesh(SHADOW_GEOMETRY, shadowMaterial());
    this.shadow.renderOrder = 1;
    scene.add(this.shadow);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.prevSpeed = 0;
    this.yOffset = 0;
    this.waterY = 0;
    this.hp = MAX_HP;
    this.cooldowns = [0, 0];
    this.control = { throttle: 0, steer: 0 };
    this.steerVis = 0;
    this.skill = 1;
    this.ai = createAI();

    this.air = null;
    this.spinTime = 0;
    this.spinDur = 1;
    this.stun = 0;
    this.boost = 0;
    this.sawState = { spin: 0, yaw: 0, tick: 0, shield: 0, shieldYaw: 0, sound: 0 };
    this.heat = Object.fromEntries(HOLD_IDS.map((id) => [id, newHeat()]));
    this.flameTicks = new Map();
    this.burn = null;
    this.exploded = false;
    this.laserTicks = new Map();
    this.laserHum = 0;
    this.ko = 0;
    this.invuln = 0;
    this.flash = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.wakeTimer = 0;
    this.bumpCooldown = new Map();

    this.trackIdx = 0;
    this.trackS = 0;
    this.dist = 0;
    this.lap = 1;
    this.finished = false;
    this.finishTime = 0;
    this.finishOrder = 0;
    this.place = index + 1;
    this.wrongWay = 0;
    this.offCourse = 0;
  }

  has(id) {
    return this.items.includes(id);
  }

  get alive() {
    return this.ko <= 0;
  }

  local(x, y, z, out = new THREE.Vector3()) {
    const c = Math.cos(this.heading);
    const s = Math.sin(this.heading);
    return out.set(this.pos.x + c * x + s * z, this.waterY + 0.35 + this.yOffset + y, this.pos.z - s * x + c * z);
  }

  center(out = new THREE.Vector3()) {
    return this.local(0, 0.9, 0, out);
  }

  distanceToAxis(point) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const cy = this.waterY + 0.35 + this.yOffset + 0.9;
    const dx = point.x - this.pos.x;
    const dy = point.y - cy;
    const dz = point.z - this.pos.z;
    const along = clamp(dx * fx + dz * fz, -AXIS_HALF, AXIS_HALF);
    return Math.hypot(dx - fx * along, dy, dz - fz * along);
  }

  distanceToAxis2D(x, z) {
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const along = clamp(dx * fx + dz * fz, -AXIS_HALF, AXIS_HALF);
    return Math.hypot(dx - fx * along, dz - fz * along);
  }

  bump(amount) {
    this.squashVel -= amount;
  }
}
