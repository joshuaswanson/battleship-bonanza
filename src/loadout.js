import * as THREE from 'three';
import { GROUPS, ITEMS, ITEM_IDS, STATS, statsFor, comboName } from './items.js';
import { buildBoat, buildItemModel, buildMine, buildMissile, buildHook, HULL_L } from './boatModel.js';
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
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
const easeOutBounce = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
};
const POOL_RADIUS = 12.5;

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
    $('btn-surprise').addEventListener('click', () => this.surprise());
    addEventListener('keydown', (e) => {
      if (!this.active || e.target instanceof HTMLInputElement || e.repeat) return;
      if (e.code === 'KeyO') this.demo(0);
      if (e.code === 'KeyP') this.demo(1);
    });
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
    this.tiles = [...document.querySelectorAll('.tile')];
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
    if (this.spinning) return;
    this.sfx.unlock();
    const items = this.setup.items;
    const at = items.indexOf(id);
    if (at >= 0) {
      items.splice(at, 1);
      this.sfx.play('plop');
      this.refresh();
      this.puffBoat();
      return;
    }
    if (items.length >= 2) items.shift();
    items.push(id);
    this.sfx.play('pick');
    this.detailId = id;
    this.refreshTray();
    tile.classList.remove('picked');
    void tile.offsetWidth;
    tile.classList.add('picked');
    this.flyToBoat(tile, () => this.refresh({ added: id }));
  }

  flyToBoat(tile, done) {
    if (reducedMotion()) return done();
    const img = tile.querySelector('img');
    const from = img.getBoundingClientRect();
    const to = this.canvas.getBoundingClientRect();
    const ghost = img.cloneNode();
    ghost.className = 'flyer';
    Object.assign(ghost.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(ghost);
    const dx = to.left + to.width * 0.5 - (from.left + from.width / 2);
    const dy = to.top + to.height * 0.42 - (from.top + from.height / 2);
    ghost.animate(
      [
        { transform: 'translate(0, 0) scale(1) rotate(0deg)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 160}px) scale(1.5) rotate(-25deg)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35) rotate(-50deg)`, opacity: 0.3 },
      ],
      { duration: 560, easing: 'cubic-bezier(0.45, 0, 0.55, 1)' },
    ).onfinish = () => {
      ghost.remove();
      done();
    };
  }

  surprise() {
    if (this.spinning) return;
    this.sfx.unlock();
    this.spinning = true;
    const pick = [...ITEM_IDS].sort(() => Math.random() - 0.5).slice(0, 2);
    let steps = reducedMotion() ? 0 : 22;
    let delay = 45;
    let last = null;
    const tick = () => {
      last?.classList.remove('lit');
      if (steps-- <= 0) {
        this.setup.items.length = 0;
        this.spinning = false;
        const first = this.tiles.find((t) => t.dataset.id === pick[0]);
        const second = this.tiles.find((t) => t.dataset.id === pick[1]);
        this.toggle(pick[0], first);
        setTimeout(() => this.toggle(pick[1], second), 260);
        return;
      }
      last = this.tiles[Math.floor(Math.random() * this.tiles.length)];
      last.classList.add('lit');
      this.sfx.play('tick');
      delay *= 1.13;
      setTimeout(tick, delay);
    };
    tick();
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
    $('btn-start').disabled = items.length < 2;
  }

  refresh({ added = null } = {}) {
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
    this.rebuildBoat(added);
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
    this.drops = [];
    this.timers = [];
    this.movers = [];
    this.jump = null;
    this.lunge = 0;
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

    new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = canvas;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      const narrow = Math.max(1, 1.6 / (w / h));
      this.camera.position.set(12 * narrow, 7.6 * narrow, 14.8 * narrow);
      this.camera.lookAt(0, 0.9, 0);
      this.camera.updateProjectionMatrix();
      if (this.boat) this.render(0);
    }).observe(canvas);
  }

  rebuildBoat(added) {
    if (this.boat) this.scene.remove(this.boat.root);
    this.boat = buildBoat(this.setup.color, this.setup.items);
    this.scene.add(this.boat.root);
    this.drops = [];
    if (added && this.boat.parts[added] && !reducedMotion()) {
      const part = this.boat.parts[added];
      this.drops.push({ part, t: 0, base: part.position.clone(), mounted: part.position.y > 0.5 });
      part.visible = false;
    }
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
    const b = this.boat;
    const fwd = this.forward();
    const up = new THREE.Vector3(0, 1, 0);
    switch (id) {
      case 'machinegun':
        this.gunSpin = 1.3;
        for (let i = 0; i < 14; i++) {
          this.after(i * 0.07, () => {
            const o = this.world(b.gunMount);
            const end = o
              .clone()
              .addScaledVector(this.forward(), 30)
              .add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2));
            this.fx.beam(o, end, 0xffe066, 0.12, 0.12);
            this.sfx.play('shoot');
          });
        }
        break;
      case 'laser': {
        const o = this.world(b.laserMount);
        this.fx.beam(o, o.clone().addScaledVector(fwd, 45), 0xff4fd8, 0.6, 0.5);
        this.fx.sparkBurst(o.x, o.y, o.z, 0xff4fd8, 12);
        this.sfx.play('laser');
        this.squashVel -= 3;
        break;
      }
      case 'saw':
        this.sawBoost = 1.4;
        this.lunge = 1;
        this.sfx.play('saw');
        for (let i = 0; i < 6; i++) {
          this.after(0.1 + i * 0.12, () => {
            const p = b.saw.getWorldPosition(new THREE.Vector3());
            this.fx.sparkBurst(p.x, p.y, p.z, 0xffe066, 8);
          });
        }
        break;
      case 'missiles': {
        const mesh = buildMissile();
        mesh.position.copy(this.world(b.missileMount));
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
        const mesh = buildMine();
        mesh.position.copy(this.world(new THREE.Vector3(0, 1.4, -HULL_L - 0.5)));
        this.scene.add(mesh);
        this.movers.push({
          mesh,
          vel: fwd.clone().multiplyScalar(-6).addScaledVector(up, 6),
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
      lift = 6 * 4 * u * (1 - u);
      for (const f of flames) {
        f.visible = true;
        f.scale.set(0.32 + Math.random() * 0.1, 1.6 + Math.random() * 0.8, 0.32 + Math.random() * 0.1);
        const p = f.getWorldPosition(new THREE.Vector3());
        this.fx.flame(p.x, p.y - 0.4, p.z);
      }
      if (u >= 1) {
        this.jump = null;
        for (const f of flames) f.visible = false;
        this.splashBoat(1.3);
        this.sfx.play('splash');
      }
    }
    this.lunge = Math.max(0, this.lunge - dt * 1.6);
    const lungeOffset = Math.sin(this.lunge * Math.PI) * 3;
    const fwd = this.forward();
    root.position.set(fwd.x * lungeOffset, waveHeight(0, 0, this.time) + 0.35 + lift, fwd.z * lungeOffset);
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
    if (saw) saw.rotation.x += dt * (this.sawBoost > 0 ? 45 : 6);
    this.gunSpin = Math.max(0, (this.gunSpin ?? 0) - dt);
    if (b.minigun) b.minigun.rotation.z += dt * (this.gunSpin > 0 ? 30 : 1.5);
    for (const sp of spinners) sp.mesh.rotation[sp.axis] += sp.speed * dt;
    flag.rotation.y = Math.sin(this.time * 9) * 0.25;

    for (const drop of this.drops) {
      drop.t = Math.min(1, drop.t + dt / 0.6);
      drop.part.visible = true;
      if (drop.mounted) {
        drop.part.position.copy(drop.base);
        drop.part.position.y += (1 - easeOutBounce(drop.t)) * 7;
        drop.part.scale.setScalar(Math.min(1, 0.4 + drop.t * 1.2));
      } else {
        drop.part.scale.setScalar(Math.max(0.01, easeOutBack(drop.t)));
      }
      if (drop.t >= 1 && !drop.landed) {
        drop.landed = true;
        const p = this.world(drop.base);
        this.fx.sparkBurst(p.x, p.y + 0.5, p.z, 0xffe066, 14);
        this.fx.ring(p.x, p.y + 0.2, p.z, 0xffffff, 1, 4, 0.4);
        this.splashBoat(0.8);
        this.sfx.play('drop');
      }
    }

    const due = this.timers.filter((t) => t.at <= this.time);
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const t of due) t.fn();

    this.movers = this.movers.filter((m) => {
      m.life -= dt;
      if (m.grapple) {
        m.t += dt;
        const from = this.world(b.hookMount);
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
        m.mesh.userData.light.visible = (this.time * 4) % 1 < 0.5;
      } else {
        m.vel.y -= m.gravity * dt;
        m.mesh.position.addScaledVector(m.vel, dt);
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
