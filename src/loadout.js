import * as THREE from 'three';
import { GROUPS, ITEMS, ITEM_IDS, STATS, statsFor, comboName } from './items.js';
import { buildBoat, buildItemModel, buildMine, buildMissile, buildHook, aimTurret, updateAimers, stepGun, stepLaser, newHeat, gunDirection, laserDirection, launchMine, reloadMine, updateMineHolder } from './boatModel.js';
import { createWater, waveHeight } from './water.js';
import { Effects } from './effects.js';
import { SUN_DIR } from './world.js';
import { toon, outlined } from './toon.js';

export const PAINTS = [
  { name: 'Coral', value: 0xff5a5f },
  { name: 'Sunflower', value: 0xffb400 },
  { name: 'Mint', value: 0x3ddc97 },
  { name: 'Sky', value: 0x4d9de0 },
  { name: 'Lilac', value: 0xb57edc },
  { name: 'Bubblegum', value: 0xff8fc7 },
];

const $ = (id) => document.getElementById(id);
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const groupOf = (id) => GROUPS.find((g) => g.id === ITEMS[id].group);
const POOL_RADIUS = 19;

function renderThumbnails() {
  const size = 220;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fd8e8, 1.6));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const thumbs = {};
  for (const id of ITEM_IDS) {
    const color = parseInt(groupOf(id).color.slice(1), 16);
    const model = buildItemModel(id, color);
    scene.add(model);
    const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(15))) * 0.82;
    camera.position.copy(sphere.center).addScaledVector(new THREE.Vector3(1, 0.7, 1.25).normalize(), dist);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    thumbs[id] = renderer.domElement.toDataURL('image/png');
    scene.remove(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return thumbs;
}

export class Loadout {
  constructor({ setup, sfx, onChange }) {
    this.setup = setup;
    this.sfx = sfx;
    this.onChange = onChange;
    this.active = false;
    this.thumbs = renderThumbnails();
    this.prevStats = statsFor(setup.items);

    this.buildTray();
    this.buildIdentity();
    this.initPreview();
    this.heat = { machinegun: newHeat(), laser: newHeat() };
    this.busy = {};
    this.heldSlots = new Set();
    this.autoFire = { machinegun: 0, laser: 0 };
    const slotFor = { KeyO: 0, KeyP: 1 };
    addEventListener('keydown', (e) => {
      if (!this.active || e.target instanceof HTMLInputElement || e.repeat) return;
      const slot = slotFor[e.code];
      if (slot === undefined) return;
      this.sfx.unlock();
      if (ITEMS[this.setup.items[slot]]?.hold) this.heldSlots.add(slot);
      else this.demo(slot);
    });
    addEventListener('keyup', (e) => this.heldSlots.delete(slotFor[e.code]));
    addEventListener('blur', () => this.heldSlots.clear());
    this.refresh();
  }

  buildTray() {
    $('item-groups').innerHTML = GROUPS.map(
      (g) => `<section class="group" style="--tile:${g.color}">
        <h3 class="group-label">${g.label}</h3>
        <div class="tiles">
          ${ITEM_IDS.filter((id) => ITEMS[id].group === g.id)
            .map(
              (id) => `<button class="tile" data-id="${id}" aria-pressed="false">
                <img src="${this.thumbs[id]}" alt="" draggable="false" />
                <span class="tile-name">${ITEMS[id].name}</span>
                <span class="tile-key"></span>
              </button>`,
            )
            .join('')}
        </div>
      </section>`,
    ).join('');
    this.tiles = [...document.querySelectorAll('.tile[data-id]')];
    for (const tile of this.tiles) {
      const id = tile.dataset.id;
      tile.addEventListener('click', () => this.toggle(id, tile));
      tile.addEventListener('mouseenter', () => {
        this.showDetail(id);
        this.sfx.play('hover');
      });
      tile.addEventListener('focus', () => this.showDetail(id));
      tile.addEventListener('mouseleave', () => this.showDetail(null));
    }
  }

  buildIdentity() {
    $('swatches').innerHTML = PAINTS.map(
      (p) => `<button class="swatch" data-color="${p.value}" style="--paint:${hex(p.value)}" aria-label="${p.name}"></button>`,
    ).join('');
    for (const swatch of document.querySelectorAll('.swatch')) {
      swatch.addEventListener('click', () => {
        this.setup.color = Number(swatch.dataset.color);
        this.sfx.unlock();
        this.sfx.play('boing');
        this.refresh();
        this.splashBoat(1.2);
      });
    }
    const nameInput = $('boat-name');
    nameInput.value = this.setup.name;
    nameInput.addEventListener('input', () => {
      this.setup.name = nameInput.value.trim() || 'Sea Biscuit';
      this.onChange();
    });
  }

  toggle(id, tile) {
    this.sfx.unlock();
    const items = this.setup.items;
    const at = items.indexOf(id);
    if (at >= 0) {
      items.splice(at, 1);
      this.sfx.play('plop');
    } else if (items.length >= 2) {
      this.sfx.play('nope');
      tile.classList.remove('full');
      void tile.offsetWidth;
      tile.classList.add('full');
      return;
    } else {
      items.push(id);
      this.detailId = id;
      this.sfx.play('pick');
      tile.classList.remove('picked');
      void tile.offsetWidth;
      tile.classList.add('picked');
    }
    this.refresh();
    this.squashVel -= 4;
  }

  showDetail(id) {
    this.hoverId = id;
    this.renderDetail();
  }

  renderDetail() {
    const id = this.hoverId ?? this.detailId ?? this.setup.items.at(-1);
    const el = $('item-detail');
    if (!id) {
      el.innerHTML = '<p class="detail-empty">Pick two attachments for your boat. Hover one to see what it does.</p>';
      return;
    }
    const item = ITEMS[id];
    el.style.setProperty('--tile', groupOf(id).color);
    el.innerHTML = `<img src="${this.thumbs[id]}" alt="" /><div><h3>${item.name}</h3><p>${item.blurb}</p></div>`;
  }

  refreshTray() {
    const items = this.setup.items;
    for (const tile of this.tiles) {
      const slot = items.indexOf(tile.dataset.id);
      tile.setAttribute('aria-pressed', slot >= 0 ? 'true' : 'false');
      tile.querySelector('.tile-key').textContent = slot === 0 ? 'O' : slot === 1 ? 'P' : '';
    }
    const start = $('btn-start');
    start.disabled = items.length < 2;
    start.textContent = items.length === 2 ? 'Start race' : `Pick ${2 - items.length} more attachment${items.length === 1 ? '' : 's'}`;
  }

  refresh() {
    const { items, color } = this.setup;
    this.refreshTray();
    for (const swatch of document.querySelectorAll('.swatch')) {
      swatch.setAttribute('aria-pressed', Number(swatch.dataset.color) === color ? 'true' : 'false');
    }

    $('slots').innerHTML = [0, 1]
      .map((i) => {
        const id = items[i];
        const key = i === 0 ? 'O' : 'P';
        return id
          ? `<button class="slot-chip" data-slot="${i}" style="--tile:${groupOf(id).color}" title="Test fire"><kbd>${key}</kbd><img src="${this.thumbs[id]}" alt="" /><span>${ITEMS[id].name}</span></button>`
          : `<div class="slot-chip empty"><kbd>${key}</kbd><span>Empty slot</span></div>`;
      })
      .join('');
    for (const chip of document.querySelectorAll('.slot-chip[data-slot]')) {
      chip.addEventListener('click', () => this.demo(Number(chip.dataset.slot)));
    }

    const combo = $('combo-name');
    const name = comboName(items);
    if (combo.textContent !== name) {
      combo.textContent = name;
      combo.classList.remove('pop');
      void combo.offsetWidth;
      combo.classList.add('pop');
    }

    const stats = statsFor(items);
    $('stats').innerHTML = STATS.map((s) => {
      const pips = Array.from({ length: 5 }, (_, i) => {
        const on = i < stats[s.id];
        const fresh = on && i >= this.prevStats[s.id];
        return `<i class="${on ? 'on' : ''} ${fresh ? 'fresh' : ''}" style="--d:${i * 50}ms"></i>`;
      }).join('');
      return `<div class="stat" style="--stat:${s.color}"><span>${s.label}</span><div class="pips">${pips}</div></div>`;
    }).join('');
    this.prevStats = stats;

    this.renderDetail();
    this.rebuildBoat();
    this.onChange();
  }

  initPreview() {
    const canvas = $('preview');
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
    this.scene.add(new THREE.HemisphereLight(0xe8f8ff, 0x3cc4d4, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.copy(SUN_DIR).multiplyScalar(10);
    this.scene.add(sun);

    this.water = createWater({ geometry: new THREE.RingGeometry(0.01, POOL_RADIUS + 0.4, 72, 24) });
    this.scene.add(this.water.mesh);
    const red = toon(0xff4141);
    const white = toon(0xffffff);
    const arcs = 16;
    const arc = new THREE.TorusGeometry(POOL_RADIUS + 0.6, 1.05, 14, 10, (Math.PI * 2) / arcs);
    this.floatRing = new THREE.Group();
    for (let i = 0; i < arcs; i++) {
      const mesh = outlined(arc, i % 2 ? white : red, 0.06);
      mesh.rotation.set(-Math.PI / 2, 0, (i / arcs) * Math.PI * 2);
      this.floatRing.add(mesh);
    }
    this.scene.add(this.floatRing);
    this.fx = new Effects(this.scene);

    this.time = 0;
    this.spin = 0.7;
    this.spinVel = 0;
    this.squash = 0;
    this.squashVel = 0;
    this.timers = [];
    this.movers = [];
    this.jump = null;
    this.sawSpin = 0;
    this.sawBoost = 0;
    this.fade = 0;
    this.bristle = 0;

    let dragging = null;
    canvas.addEventListener('pointerdown', (e) => {
      dragging = { x: e.clientX };
      canvas.setPointerCapture(e.pointerId);
      this.sfx.unlock();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x;
      dragging.x = e.clientX;
      this.spin += dx * 0.012;
      this.spinVel = dx * 0.6;
    });
    canvas.addEventListener('pointerup', () => (dragging = null));
    canvas.addEventListener('pointercancel', () => (dragging = null));

    const stage = $('stage');
    const frame = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      const canvasBox = canvas.getBoundingClientRect();
      const stageBox = stage.getBoundingClientRect();
      const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      const byWidth = 12.5 / (0.85 * (stageBox.width / w) * 2 * tan * this.camera.aspect);
      const byHeight = 6.5 / (0.95 * (stageBox.height / h) * 2 * tan);
      const dist = Math.max(12, Math.max(byWidth, byHeight));
      this.camera.position.set(12, 7.6, 14.8).setLength(dist);
      this.camera.lookAt(0, 0.9, 0);
      const shiftX = canvasBox.left + w / 2 - (stageBox.left + stageBox.width / 2);
      const shiftY = canvasBox.top + h / 2 - (stageBox.top + stageBox.height / 2);
      this.camera.setViewOffset(w, h, shiftX, shiftY, w, h);
      this.camera.updateProjectionMatrix();
      if (this.boat) this.render(0);
    };
    const observer = new ResizeObserver(frame);
    observer.observe(canvas);
    observer.observe(stage);
  }

  rebuildBoat() {
    if (this.boat) this.scene.remove(this.boat.root);
    this.heat = { machinegun: newHeat(), laser: newHeat() };
    this.boat = buildBoat(this.setup.color, this.setup.items);
    this.scene.add(this.boat.root);
  }

  after(delay, fn) {
    this.timers.push({ at: this.time + delay, fn });
  }

  world(local) {
    return this.boat.body.localToWorld(local.clone());
  }

  forward() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.boat.root.quaternion);
  }

  splashBoat(power) {
    const p = this.boat.root.position;
    this.fx.splash(p.x, waveHeight(p.x, p.z, this.time), p.z, power);
    this.squashVel -= 6;
  }

  puffBoat() {
    const p = this.boat.root.position;
    for (let i = 0; i < 8; i++) this.fx.smoke(p.x + (Math.random() - 0.5) * 6, p.y + 1.5, p.z + (Math.random() - 0.5) * 6);
    this.squashVel -= 4;
  }

  demo(slot) {
    const id = this.setup.items[slot];
    if (!id || !this.boat) return;
    this.sfx.unlock();
    this.busy[id] = id === 'saw' ? 1.8 : 2.2;
    const b = this.boat;
    const fwd = this.forward();
    const up = new THREE.Vector3(0, 1, 0);
    switch (id) {
      case 'machinegun':
      case 'laser':
        this.autoFire[id] = 1.6;
        break;
      case 'saw':
        this.sawBoost = 1.6;
        this.sfx.play('saw');
        for (let i = 0; i < 8; i++) {
          this.after(0.15 + i * 0.16, () => {
            const p = b.saw.getWorldPosition(new THREE.Vector3());
            this.fx.sparkBurst(p.x, p.y, p.z, i % 2 ? 0xff9ef0 : 0xffe066, 8);
          });
        }
        break;
      case 'missiles': {
        const mesh = buildMissile();
        aimTurret(b, 'missiles');
        b.missileMount.getWorldPosition(mesh.position);
        this.scene.add(mesh);
        this.movers.push({
          mesh,
          vel: fwd.clone().multiplyScalar(8).addScaledVector(up, 22),
          gravity: 9,
          life: 1.2,
          trail: true,
          end: (m) => {
            this.fx.explosion(m.position.x, m.position.y, m.position.z, 1.2);
            for (const c of [0xff4fd8, 0x5ff4ff, 0xffe066, 0x7fd957]) this.fx.sparkBurst(m.position.x, m.position.y, m.position.z, c, 14);
            this.sfx.play('boom');
          },
        });
        this.sfx.play('missile');
        break;
      }
      case 'mines': {
        if (!b.mineLoaded.visible) return;
        const mesh = buildMine();
        b.mineMount.getWorldPosition(mesh.position);
        this.scene.add(mesh);
        launchMine(b);
        this.after(ITEMS.mines.cooldown, () => {
          if (this.boat !== b) return;
          reloadMine(b);
          this.after(0.5, () => this.sfx.play('clank'));
        });
        this.movers.push({
          mesh,
          vel: fwd.clone().multiplyScalar(-6).addScaledVector(up, 9),
          gravity: 20,
          life: 2.2,
          float: true,
          end: (m) => {
            this.fx.explosion(m.position.x, m.position.y + 0.5, m.position.z, 1.3);
            this.sfx.play('boom');
          },
        });
        this.sfx.play('plop');
        break;
      }
      case 'jetpack':
        if (this.jump) return;
        this.jump = { t: 0, dur: 1.3 };
        this.splashBoat(1.2);
        this.sfx.play('whoosh');
        break;
      case 'grapple': {
        aimTurret(b, 'grapple');
        const hook = buildHook();
        const rope = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.07, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
          toon(0x34465e),
        );
        this.scene.add(hook, rope);
        this.movers.push({ mesh: hook, rope, grapple: true, t: 0, life: 0.9, end: () => this.scene.remove(rope) });
        this.sfx.play('hook');
        this.after(0.42, () => this.sfx.play('clank'));
        break;
      }
      case 'emp': {
        const c = b.root.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this.fx.followRing(c, 0x5ff4ff, 11, 0.7);
        this.fx.followRing(c, 0xffffff, 8, 0.55);
        this.fx.shell(c, 0x5ff4ff, 11, 0.7);
        for (let i = 0; i < 3; i++) this.fx.sparkBurst(c.x, c.y + 1, c.z, 0x5ff4ff, 10);
        this.sfx.play('emp');
        break;
      }
      case 'spikes':
        this.bristle = 1;
        this.sfx.play('boing');
        this.after(0.1, () => this.sfx.play('tink'));
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const p = b.root.position;
          this.fx.sparkBurst(p.x + Math.cos(a) * 3, p.y + 0.8, p.z + Math.sin(a) * 3, 0xffffff, 6);
        }
        break;
      case 'armor':
        for (let i = 0; i < 4; i++) {
          this.after(i * 0.15, () => {
            const p = this.world(new THREE.Vector3((i % 2 ? 1 : -1) * 2, 0.4, -2 + i * 1.3));
            this.fx.sparkBurst(p.x, p.y, p.z, 0xffffff, 10);
            this.sfx.play('clank');
            this.squashVel -= 2;
          });
        }
        break;
      case 'camo':
        this.fade = 1.8;
        this.sfx.play('whoosh');
        break;
    }
  }

  swivelIdle(dt) {
    this.boat.swivels.forEach((s, i) => {
      this.busy[s.id] = Math.max(0, (this.busy[s.id] ?? 0) - dt);
      const busy = this.busy[s.id] > 0 || this.heat[s.id]?.trigger;
      s.group.rotation.y = Math.atan2(Math.sin(s.group.rotation.y), Math.cos(s.group.rotation.y));
      const wave = Math.sin(this.time * 0.8 + i * 2.1);
      const target = busy ? 0 : 0.55 * Math.sign(wave) * Math.sqrt(Math.abs(wave));
      s.group.rotation.y += (target - s.group.rotation.y) * (1 - Math.exp(-(busy ? 12 : 3) * dt));
    });
  }

  stepGun(dt) {
    const b = this.boat;
    const gun = this.heat.machinegun;
    const { shots, overheatedNow } = stepGun(gun, b, dt, this.time);
    for (let i = 0; i < shots; i++) {
      const o = b.gunMount.getWorldPosition(new THREE.Vector3());
      const dir = gunDirection(b, new THREE.Vector3());
      dir.x += (Math.random() - 0.5) * 0.16;
      dir.y += (Math.random() - 0.4) * 0.08;
      dir.z += (Math.random() - 0.5) * 0.16;
      this.fx.beam(o, o.clone().addScaledVector(dir.normalize(), 28), 0xffe066, 0.12, 0.1, 2);
      this.sfx.play('shoot');
    }
    this.afterHeat('machinegun', overheatedNow, b.gunMount);
  }

  stepLaser(dt) {
    const b = this.boat;
    const { beaming, overheatedNow } = stepLaser(this.heat.laser, b, dt, this.time);
    this.afterHeat('laser', overheatedNow, b.laserMount);
    this.laserHum = beaming ? (this.laserHum ?? 0) - dt : 0;
    if (!beaming) return;
    if (this.laserHum <= 0) {
      this.laserHum = 1.25;
      this.sfx.play('laser');
    }
    const origin = b.laserMount.getWorldPosition(new THREE.Vector3());
    const dir = laserDirection(b, new THREE.Vector3());
    dir.y = 0;
    const reach = 15;
    dir.normalize().setY(-(origin.y - 0.2) / reach).normalize();
    const end = origin.clone().addScaledVector(dir, reach * Math.hypot(1, (origin.y - 0.2) / reach));
    this.fx.beam(origin, end, 0xff4fd8, 0.5, 0.05, 1);
    this.fx.scorch(end.x, waveHeight(end.x, end.z, this.time) + 0.15, end.z);
  }

  afterHeat(id, overheatedNow, mount) {
    if (overheatedNow) {
      this.autoFire[id] = 0;
      this.sfx.play('overheat');
    }
    if (this.heat[id].overheated && Math.random() < 0.4) {
      const p = mount.getWorldPosition(new THREE.Vector3());
      this.fx.smoke(p.x, p.y + 0.3, p.z);
    }
  }

  setFade(opacity) {
    const fading = opacity < 0.999;
    for (const m of this.boat.materials) {
      m.transparent = fading;
      m.opacity = opacity;
    }
    this.boat.body.traverse((o) => {
      if (o.isMesh && o.material.isShaderMaterial) o.visible = !fading;
    });
  }

  render(dt) {
    this.time += dt;
    const b = this.boat;
    const { root, body, saw, flag, spinners, flames } = b;

    this.spinVel *= Math.exp(-3 * dt);
    this.spin += dt * 0.35 + this.spinVel * dt * 0.02;
    root.rotation.y = this.spin;

    let lift = 0;
    if (this.jump) {
      this.jump.t += dt;
      const u = this.jump.t / this.jump.dur;
      lift = 2.4 * 4 * u * (1 - u);
      for (const f of flames) {
        f.visible = true;
        f.scale.set(0.32 + Math.random() * 0.1, 1.6 + Math.random() * 0.8, 0.32 + Math.random() * 0.1);
        const p = f.getWorldPosition(new THREE.Vector3());
        const back = this.forward().negate();
        this.fx.flame(p.x + back.x * 0.6, p.y, p.z + back.z * 0.6, back.x * 10, -1, back.z * 10);
      }
      if (u >= 1) {
        this.jump = null;
        for (const f of flames) f.visible = false;
        this.splashBoat(1.3);
        this.sfx.play('splash');
      }
    }
    root.position.set(0, waveHeight(0, 0, this.time) + 0.35 + lift, 0);
    body.rotation.z = Math.sin(this.time * 1.3) * 0.05;
    body.rotation.x = Math.cos(this.time * 1.1) * 0.04 - (this.jump ? 0.15 : 0);

    this.squashVel += (-this.squash * 220 - this.squashVel * 11) * dt;
    this.squash += this.squashVel * dt;
    this.bristle = Math.max(0, this.bristle - dt * 1.8);
    const bristle = Math.sin(this.bristle * Math.PI * 3) * this.bristle * 0.12;
    const sq = Math.max(-0.35, Math.min(0.35, this.squash * 0.12));
    body.scale.set(1 - sq * 0.6 + bristle, 1 + sq + bristle, 1 - sq * 0.6 + bristle);

    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt);
      this.setFade(this.fade > 0 ? 1 - 0.8 * Math.sin((1 - this.fade / 1.8) * Math.PI) : 1);
    }

    this.sawBoost = Math.max(0, this.sawBoost - dt);
    if (saw) {
      const active = this.sawBoost > 0;
      this.sawSpin += ((active ? 42 : 0) - this.sawSpin) * (1 - Math.exp(-(active ? 6 : 2) * dt));
      saw.rotation.x += this.sawSpin * dt;
      if (active) b.sawYaw.rotation.y += dt * 4.5;
      const glowAmount = active ? 0.55 + 0.25 * Math.sin(this.time * 45) : 0;
      b.sawShield.material.opacity += (glowAmount - b.sawShield.material.opacity) * (1 - Math.exp(-14 * dt));
    }
    updateAimers(b, dt);
    this.swivelIdle(dt);
    updateMineHolder(b, dt);
    for (const id of ['machinegun', 'laser']) {
      this.autoFire[id] = Math.max(0, this.autoFire[id] - dt);
      const slot = this.setup.items.indexOf(id);
      this.heat[id].trigger = slot >= 0 && (this.heldSlots.has(slot) || this.autoFire[id] > 0);
    }
    if (b.minigun) this.stepGun(dt);
    if (b.laserMount) this.stepLaser(dt);
    for (const sp of spinners) sp.mesh.rotation[sp.axis] += sp.speed * dt;
    flag.rotation.y = Math.sin(this.time * 9) * 0.25;

    const due = this.timers.filter((t) => t.at <= this.time);
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const t of due) t.fn();

    this.movers = this.movers.filter((m) => {
      m.life -= dt;
      if (m.grapple) {
        m.t += dt;
        const from = b.hookMount.getWorldPosition(new THREE.Vector3());
        const k = m.t < 0.45 ? m.t / 0.45 : Math.max(0, 1 - (m.t - 0.45) / 0.45);
        const to = from.clone().addScaledVector(this.forward(), 24 * k).add(new THREE.Vector3(0, 2 * k, 0));
        m.mesh.position.copy(to);
        m.mesh.lookAt(to.clone().addScaledVector(this.forward(), 1));
        m.rope.position.copy(from);
        m.rope.lookAt(to);
        m.rope.scale.set(1, 1, Math.max(0.01, from.distanceTo(to)));
      } else if (m.float && m.mesh.position.y <= waveHeight(m.mesh.position.x, m.mesh.position.z, this.time) - 0.3) {
        if (!m.landed) {
          m.landed = true;
          this.fx.splash(m.mesh.position.x, m.mesh.position.y, m.mesh.position.z, 0.5);
        }
        m.mesh.position.y = waveHeight(m.mesh.position.x, m.mesh.position.z, this.time) - 0.3;
        m.mesh.rotation.x *= Math.exp(-4 * dt);
        m.mesh.rotation.z *= Math.exp(-4 * dt);
        m.mesh.userData.light.visible = (this.time * 4) % 1 < 0.5;
      } else {
        m.vel.y -= m.gravity * dt;
        m.mesh.position.addScaledVector(m.vel, dt);
        if (m.float) {
          m.mesh.rotation.x += dt * 7;
          m.mesh.rotation.z += dt * 4.5;
        }
        if (m.trail) {
          m.mesh.lookAt(m.mesh.position.clone().add(m.vel));
          this.fx.smoke(m.mesh.position.x, m.mesh.position.y, m.mesh.position.z);
        }
      }
      if (m.life <= 0) {
        m.end?.(m.mesh);
        this.scene.remove(m.mesh);
        return false;
      }
      return true;
    });

    this.water.update(this.time);
    this.floatRing.position.y = Math.sin(this.time * 1.4) * 0.12;
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
