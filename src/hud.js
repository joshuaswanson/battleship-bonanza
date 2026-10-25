import * as THREE from 'three';
import { ITEMS, iconSvg } from './items.js';
import { t, ordinal, itemName } from './i18n.js';
import { MAX_HP } from './race.js';
import { COUNT_LAND } from './audio.js';


export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

const $ = (id) => document.getElementById(id);

const SEEK_TIME = 0.8;
const TARGETING = {
  missiles: { range: 180, minDot: -1, filter: (o) => !o.has('camo') },
};

export class Hud {
  constructor(track, sfx) {
    this.sfx = sfx;
    this.lock = $('hud-lock');
    this.lockVignette = $('lock-vignette');
    this.burnVignette = $('burn-vignette');
    this.lockArrow = $('lock-arrow');
    this.lockPhase = 0;
    this.lockBeep = 0;
    this.root = $('hud');
    this.place = $('hud-place');
    this.of = $('hud-of');
    this.lap = $('hud-lap');
    this.time = $('hud-time');
    this.feed = $('hud-feed');
    this.center = $('hud-center');
    this.warn = $('hud-warn');
    this.reticle = $('hud-reticle');
    this.seeker = $('hud-seeker');
    this.seekLabel = this.seeker.querySelector('.sk-label');
    this.seek = { target: null, t: 0, tick: 0, x: 0, y: 0 };
    this.barsEl = $('hud-bars');
    this.dmgEl = $('hud-dmg');
    this.popups = [];
    this.returnEl = $('hud-return');
    this.returnArrow = $('return-arrow');
    this.slotsEl = $('hud-slots');
    this.flash = $('hud-flash');
    this.map = $('hud-map');
    this.ctx = this.map.getContext('2d');
    this.warnTime = 0;
    this.projected = new THREE.Vector3();
    this.setTrack(track);
  }

  setTrack(track) {
    this.track = track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < track.total; i++) {
      if (i === track.N) i = 2 * track.N;
      if (i >= track.total) break;
      minX = Math.min(minX, track.px[i]);
      maxX = Math.max(maxX, track.px[i]);
      minZ = Math.min(minZ, track.pz[i]);
      maxZ = Math.max(maxZ, track.pz[i]);
    }
    const pad = 16;
    const size = this.map.width - pad * 2;
    const scale = size / Math.max(maxX - minX, maxZ - minZ);
    const offX = pad + (size - (maxX - minX) * scale) / 2;
    const offZ = pad + (size - (maxZ - minZ) * scale) / 2;
    this.toMap = (x, z) => [offX + (maxX - x) * scale, offZ + (maxZ - z) * scale];
    this.mapScale = scale;
  }

  show(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  setup(race) {
    this.race = race;
    const player = race.player;
    this.feed.innerHTML = '';
    this.dmgEl.innerHTML = '';
    this.popups = [];
    this.center.textContent = '';
    this.warn.textContent = '';
    this.of.textContent = t('of', { n: race.boats.length });
    this.slotsEl.innerHTML = `<div class="ability hull-row">
          <i class="hull-dot"></i>
          <div class="ability-body">
            <div class="ability-top"><span>${t('health')}</span><em class="hull-text"></em></div>
            <div class="ability-track"><div class="ability-fill hull-fill"></div></div>
          </div>
        </div>` + player.items
      .map((id, i) => {
        const item = ITEMS[id];
        if (item.passive) return '';
        return `<div class="ability${item.hold ? ' heat' : ''}" data-slot="${i}">
          <kbd>${i === 0 ? 'O' : 'P'}</kbd>
          <div class="ability-body">
            <div class="ability-top"><span>${itemName(id)}</span><em class="slot-state"></em></div>
            ${item.charges ? `<div class="ability-segs">${'<div class="ability-track"><div class="ability-fill"></div></div>'.repeat(item.charges)}</div>` : '<div class="ability-track"><div class="ability-fill"></div></div>'}
          </div>
        </div>`;
      })
      .join('');
    this.hullFill = this.slotsEl.querySelector('.hull-fill');
    this.hullText = this.slotsEl.querySelector('.hull-text');
    this.slots = [];
    for (const el of this.slotsEl.querySelectorAll('.ability[data-slot]')) this.slots[Number(el.dataset.slot)] = el;
    this.barsEl.innerHTML = race.boats
      .map((b) => `<div class="boat-bar"><span class="boat-bar-name">${b.name}</span><div class="boat-bar-track"><div class="boat-bar-fill"></div></div></div>`)
      .join('');
    this.bars = [...this.barsEl.children].map((el) => {
      el.style.display = 'none';
      return { el, fill: el.querySelector('.boat-bar-fill'), shown: false };
    });
    this.slotLabels = this.slots.map((slot) => slot.querySelector('.slot-state'));
    this.slotFills = this.slots.map((slot) => slot.querySelector('.ability-fill'));
    this.touchItems = [0, 1].map((i) => document.querySelector(`.touch-item[data-touch="item${i}"]`));
    this.touchItems.forEach((button, i) => {
      const id = player.items[i];
      button.querySelector('.touch-name').textContent = itemName(id);
      button.classList.toggle('passive', !!ITEMS[id].passive);
      button.style.setProperty('--fill', 1);
    });
    this.segFills = this.slots.map((slot) => [...slot.querySelectorAll('.ability-segs .ability-fill')]);
    this.lastPlace = 0;
  }

  popInSync(text, kind) {
    const lag = this.sfx.latency - COUNT_LAND;
    if (lag > 0.01) setTimeout(() => this.pop(text, kind), lag * 1000);
    else this.pop(text, kind);
  }

  pop(text, kind = '') {
    this.center.className = 'hud-center';
    void this.center.offsetWidth;
    this.center.textContent = text;
    this.center.className = `hud-center pop ${kind}`;
  }

  addFeed(e) {
    const tag = (b) => `<b class="feed-name" style="--paint:#${b.color.toString(16).padStart(6, '0')}">${b.name}</b>`;
    const li = document.createElement('li');
    const icon = e.item ? `<span class="feed-icon">${iconSvg(e.item)}</span>` : '';
    if (e.text) {
      li.innerHTML = icon + '<span class="feed-text"></span>';
      li.lastChild.textContent = e.text;
    } else {
      li.innerHTML = `${icon}<span class="feed-text">${t(`feed_${e.kind}`, { a: tag(e.killer), b: tag(e.victim) })}</span>`;
    }
    if (e.player) li.classList.add('mine');
    this.feed.prepend(li);
    while (this.feed.children.length > 4) this.feed.lastChild.remove();
    setTimeout(() => li.classList.add('fade'), 4000);
    setTimeout(() => li.remove(), 4700);
  }

  setWarning(text, time = 1.6) {
    this.warn.textContent = text;
    this.warnTime = time;
  }

  hurtFlash() {
    this.flash.className = 'hud-flash';
    void this.flash.offsetWidth;
    this.flash.className = 'hud-flash on';
  }

  handle(e) {
    switch (e.type) {
      case 'count':
        this.popInSync(String(e.n), 'count');
        break;
      case 'go':
        this.popInSync(t('go'), 'go');
        break;
      case 'lap':
        this.pop(t('lapN', { n: e.lap }));
        break;
      case 'finalLap':
        this.pop(t('finalLap'));
        break;
      case 'dmg':
        this.addDamage(e.target, e.amount);
        break;
      case 'heal':
        this.flash.className = 'hud-flash';
        void this.flash.offsetWidth;
        this.flash.className = 'hud-flash on heal';
        break;
      case 'blast':
        this.flash.className = 'hud-flash';
        void this.flash.offsetWidth;
        this.flash.className = 'hud-flash on blast';
        break;
      case 'falls':
        this.pop(t('wheee'), 'go');
        break;
      case 'dodge':
        this.pop(t('dodged'), 'go');
        break;
      case 'finish':
        this.pop(t('youFinished', { place: ordinal(e.place), n: e.place }), 'go');
        break;
      case 'feed':
        this.addFeed(e);
        break;
      case 'hurt':
        this.hurtFlash();
        break;
      case 'ko':
        this.pop(t('sunk'), 'ko');
        break;
      case 'warning':
        this.setWarning(e.text);
        break;
    }
  }

  update(race, camera, dt) {
    const p = race.player;
    if (!p) return;
    if (p.place !== this.lastPlace) {
      this.place.textContent = ordinal(p.place);
      this.place.classList.remove('bump');
      void this.place.offsetWidth;
      this.place.classList.add('bump');
      this.lastPlace = p.place;
    }
    this.lap.textContent = p.finished ? t('finished') : t('lapOf', { n: p.lap, total: race.laps });
    this.time.textContent = formatTime(p.finished ? p.finishTime : race.clock);

    p.items.forEach((id, i) => {
      const item = ITEMS[id];
      if (item.passive) return;
      const slot = this.slots[i];
      const off = p.disabled > 0 && item.group === 'weapons';
      slot.classList.toggle('disabled', off);
      if (off) {
        if (this.slotLabels[i].textContent !== t('disabled')) this.slotLabels[i].textContent = t('disabled');
        return;
      }
      if (item.hold) {
        const { heat, overheated } = p.heat[id];
        this.slotFills[i].style.width = `${(1 - heat) * 100}%`;
        slot.classList.toggle('overheated', overheated);
        slot.classList.toggle('hot', !overheated && heat > 0.6);
        const text = overheated ? t('overheated') : heat > 0.6 ? t('hot') : t('hold');
        if (this.slotLabels[i].textContent !== text) this.slotLabels[i].textContent = text;
        return;
      }
      if (item.charges) {
        const { left, refill } = p.charges[i];
        this.segFills[i].forEach((fill, k) => {
          const amount = k < left ? 1 : k === left ? refill : 0;
          fill.style.width = `${amount * 100}%`;
          fill.parentElement.classList.toggle('full', amount >= 1);
        });
        slot.classList.toggle('ready', left > 0);
        const text = `${left}/${item.charges}`;
        if (this.slotLabels[i].textContent !== text) this.slotLabels[i].textContent = text;
        return;
      }
      const cd = p.cooldowns[i];
      const ready = cd <= 0;
      this.slotFills[i].style.width = `${(1 - cd / item.cooldown) * 100}%`;
      slot.classList.toggle('ready', ready);
      const state = ready ? t('ready') : `${cd.toFixed(1)}s`;
      const label = this.slotLabels[i];
      if (label.textContent !== state) label.textContent = state;
    });

    p.items.forEach((id, i) => {
      const button = this.touchItems[i];
      const item = ITEMS[id];
      if (item.passive) return;
      let fill;
      if (item.hold) fill = 1 - p.heat[id].heat;
      else if (item.charges) fill = (p.charges[i].left + p.charges[i].refill) / item.charges;
      else fill = 1 - p.cooldowns[i] / item.cooldown;
      button.style.setProperty('--fill', fill.toFixed(3));
      button.classList.toggle('ready', item.hold ? !p.heat[id].overheated : item.charges ? p.charges[i].left > 0 : p.cooldowns[i] <= 0);
      button.classList.toggle('off', p.disabled > 0 && item.group === 'weapons');
    });
    this.updateReticle(race, camera);
    this.updateSeeker(race, camera, dt);
    this.burnVignette.classList.toggle('on', !!p.burn && p.alive);

    this.warnTime -= dt;
    const lost = p.alive && p.offCourse > 0.3 && !p.finished;
    this.returnEl.classList.toggle('on', lost);
    if (lost) {
      const target = race.courseReturnPoint(p);
      const dx = target.x - p.pos.x;
      const dz = target.z - p.pos.z;
      const camForward = camera.getWorldDirection(this.projected);
      const camHeading = Math.atan2(camForward.x, camForward.z);
      const angle = Math.atan2(dx, dz) - camHeading;
      this.returnArrow.style.transform = `rotate(${-angle}rad)`;
    }
    if (p.wrongWay > 1 && !lost) this.warn.textContent = t('wrongWay');
    else if (this.warnTime <= 0) this.warn.textContent = '';

    this.updateBars(race, camera);
    this.updateDamage(camera, dt);
    this.placeAbilities(p, camera);
    const hull = Math.max(0, p.hp) / MAX_HP;
    this.hullFill.style.width = `${hull * 100}%`;
    this.hullFill.dataset.level = hull > 0.6 ? 'high' : hull > 0.3 ? 'mid' : 'low';
    this.hullFill.parentElement.parentElement.parentElement.classList.toggle('regen', p.regenerating);
    const pluses = p.regenerating ? '+'.repeat(p.regenRate < 8 ? 1 : p.regenRate < 16 ? 2 : 3) + ' ' : '';
    const hullText = `${pluses}${Math.ceil(hull * 100)}%`;
    if (this.hullText.textContent !== hullText) this.hullText.textContent = hullText;
    this.updateLock(race, camera, dt);
    this.drawMap(race);
  }

  placeAbilities(p, camera) {
    const v = this.projected.set(p.pos.x, p.pos.y + 1, p.pos.z).project(camera);
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight;
    this.slotsEl.style.transform = `translate(${Math.round(x + 100)}px, ${Math.round(y - 60)}px)`;
    this.slotsEl.classList.toggle('dim', !p.alive);
  }

  addDamage(target, amount) {
    const el = document.createElement('div');
    el.className = 'dmg';
    this.dmgEl.append(el);
    const popup = { target, amount, el, age: 0, drift: (Math.random() - 0.5) * 16, rise: 90 + Math.random() * 40, offset: (Math.random() - 0.5) * 18 };
    this.popups.push(popup);
    this.paintDamage(popup);
  }

  paintDamage(popup) {
    const shown = Math.max(1, Math.round(popup.amount));
    popup.el.textContent = `-${shown}`;
    popup.el.dataset.size = shown >= 25 ? 'big' : shown >= 10 ? 'mid' : 'small';
    popup.el.classList.add('bump');
  }

  updateDamage(camera, dt) {
    this.popups = this.popups.filter((p) => {
      p.age += dt;
      if (p.age > 0.9) {
        p.el.remove();
        return false;
      }
      const v = this.projected.set(p.target.pos.x, p.target.pos.y + 2.5, p.target.pos.z).project(camera);
      if (v.z > 1) {
        p.el.style.opacity = 0;
        return true;
      }
      const x = (v.x * 0.5 + 0.5) * innerWidth + p.offset + p.drift * p.age;
      const y = (-v.y * 0.5 + 0.5) * innerHeight - p.age * p.rise;
      p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      p.el.style.opacity = p.age < 0.6 ? 1 : 1 - (p.age - 0.6) / 0.3;
      return true;
    });
  }

  updateBars(race, camera) {
    race.boats.forEach((b, i) => {
      const bar = this.bars[i];
      const v = this.projected.set(b.pos.x, b.pos.y + 3.6, b.pos.z);
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      const visible = !b.isPlayer && b.alive && !b.finished && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < 170;
      if (visible !== bar.shown) {
        bar.el.style.display = visible ? 'flex' : 'none';
        bar.shown = visible;
      }
      if (!visible) return;
      const scale = Math.min(1.15, Math.max(0.6, 26 / dist));
      const x = (v.x * 0.5 + 0.5) * innerWidth;
      const y = (-v.y * 0.5 + 0.5) * innerHeight;
      bar.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) scale(${scale})`;
      const hp = Math.max(0, b.hp) / MAX_HP;
      bar.fill.style.width = `${hp * 100}%`;
      bar.fill.dataset.level = hp > 0.6 ? 'high' : hp > 0.3 ? 'mid' : 'low';
    });
  }

  updateLock(race, camera, dt) {
    const p = race.player;
    const threats = p.alive && !p.finished ? race.incomingThreats(p).filter((t) => t.kind === 'missile' && t.m.lockTime > 0) : [];
    if (!threats.length) {
      this.lock.classList.remove('on');
      this.lockBeep = 0;
      return;
    }
    const nearest = threats.reduce((a, b) => (a.eta < b.eta ? a : b));
    const urgency = Math.min(1, Math.max(0, 1 - nearest.eta / 3));
    this.lock.classList.add('on');
    this.lockPhase += dt * (4 + urgency * 22);
    const pulse = 0.5 + 0.5 * Math.sin(this.lockPhase);
    this.lockVignette.style.opacity = (0.35 + urgency * 0.4) + pulse * (0.25 + urgency * 0.2);
    this.lock.classList.toggle('flash', pulse > 0.5);

    this.lockBeep -= dt;
    if (this.lockBeep <= 0) {
      this.lockBeep = Math.max(0.06, 0.5 - urgency * 0.44);
      this.sfx.play(urgency > 0.8 ? 'lockHigh' : 'lock');
    }
    if (urgency > 0.5) race.emit('lockShake', { amount: (urgency - 0.5) * 0.5 });

    const v = this.projected.copy(nearest.m.pos).project(camera);
    let x = v.x;
    let y = v.y;
    if (v.z > 1) {
      x = -x;
      y = -y;
    }
    if (Math.abs(x) < 0.02 && Math.abs(y) < 0.02) y = -1;
    const angle = Math.atan2(-y * innerHeight, x * innerWidth);
    const rx = innerWidth * 0.42;
    const ry = innerHeight * 0.38;
    const px = innerWidth / 2 + Math.cos(angle) * rx;
    const py = innerHeight / 2 + Math.sin(angle) * ry;
    const bob = 1 + pulse * 0.15;
    this.lockArrow.style.transform = `translate(${px}px, ${py}px) rotate(${angle}rad) scale(${bob})`;
  }

  updateSeeker(race, camera, dt) {
    const p = race.player;
    const slot = p.items.indexOf('missiles');
    const ready = slot >= 0 && p.alive && race.state === 'racing' && !p.finished && p.charges[slot].left > 0 && p.disabled <= 0;
    const target = ready ? race.findTarget(p, TARGETING.missiles) : null;
    const s = this.seek;
    if (!target) {
      s.target = null;
      this.seeker.classList.remove('on', 'locked');
      return;
    }
    if (target !== s.target) {
      s.target = target;
      s.t = 0;
      s.tick = 0;
      s.drift = (Math.random() - 0.5) * 120;
      this.seeker.classList.remove('locked');
    }
    const before = s.t;
    s.t += dt;
    const k = Math.min(1, s.t / SEEK_TIME);
    const v = target.center(this.projected).project(camera);
    let sx = v.z > 1 ? -v.x : v.x;
    let sy = v.z > 1 ? -v.y : v.y;
    if (v.z > 1 && Math.hypot(sx, sy) < 0.2) sy = -1;
    const over = Math.max(Math.abs(sx) / 0.86, Math.abs(sy) / 0.74);
    const offscreen = v.z > 1 || over > 1;
    if (offscreen) {
      sx /= over;
      sy /= over;
    }
    this.seeker.classList.toggle('edge', offscreen);
    const x = (sx * 0.5 + 0.5) * innerWidth;
    const y = (-sy * 0.5 + 0.5) * innerHeight;
    const wander = (1 - k) * (1 - k);
    const jx = wander * (s.drift + Math.sin(s.t * 23) * 18);
    const jy = wander * (Math.cos(s.t * 19) * 14 - s.drift * 0.4);
    this.seeker.style.transform = `translate(${x + jx}px, ${y + jy}px)`;
    this.seeker.style.setProperty('--spread', `${26 + 70 * wander}px`);
    this.seeker.style.setProperty('--spin', `${45 * wander}deg`);
    this.seeker.classList.add('on');
    if (k < 1) {
      s.tick -= dt;
      if (s.tick <= 0) {
        s.tick = 0.17 - k * 0.1;
        this.sfx.play('seek', null, 700 + k * 900);
      }
      const text = t('tracking');
      if (this.seekLabel.textContent !== text) this.seekLabel.textContent = text;
      this.seeker.classList.toggle('blink', Math.floor(s.t * 8) % 2 === 0);
    } else if (before < SEEK_TIME) {
      this.seeker.classList.add('locked');
      this.seeker.classList.remove('blink');
      this.seekLabel.textContent = t('locked');
      this.sfx.play('seekLock');
    }
  }

  updateReticle(race, camera) {
    const p = race.player;
    let target = null;
    let label = '';
    if (p.alive && race.state === 'racing' && !p.finished) {
      for (let i = 0; i < 2; i++) {
        const id = p.items[i];
        const spec = id === 'grapple' ? race.hookSpec(p) : null;
        if (!spec || p.cooldowns[i] > 0) continue;
        target = race.findTarget(p, spec);
        if (target) {
          label = itemName(p.items[i]);
          break;
        }
      }
    }
    if (!target) {
      this.reticle.classList.remove('on');
      return;
    }
    const v = target.center(this.projected).project(camera);
    if (v.z > 1) {
      this.reticle.classList.remove('on');
      return;
    }
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight;
    this.reticle.style.transform = `translate(${x}px, ${y}px)`;
    this.reticle.dataset.label = label;
    this.reticle.classList.add('on');
  }

  drawMap(race) {
    const { ctx, track } = this;
    const w = this.map.width;
    ctx.clearRect(0, 0, w, w);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const band = (color, grow) => {
      ctx.strokeStyle = color;
      for (const seg of track.segments) {
        const chain = seg.ring ? [] : [seg.from];
        for (let i = seg.start; i <= seg.end; i += 6) chain.push(i);
        chain.push(seg.ring ? seg.start : seg.end, ...(seg.ring ? [] : [seg.to]));
        for (let k = 0; k < chain.length - 1; k++) {
          const i = chain[k];
          const j = chain[k + 1];
          ctx.lineWidth = Math.max(track.hw[i], track.hw[j]) * 2 * this.mapScale + grow;
          ctx.beginPath();
          ctx.moveTo(...this.toMap(track.px[i], track.pz[i]));
          ctx.lineTo(...this.toMap(track.px[j], track.pz[j]));
          ctx.stroke();
        }
      }
    };
    band('#0E2A47', 6);
    band('#7FE6EE', 0);

    const [sx, sy] = this.toMap(track.px[0], track.pz[0]);
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0E2A47';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    for (const f of race.features.all) {
      const [fx, fy] = this.toMap(f.x, f.z);
      ctx.fillStyle = f.kind === 'pad' ? '#FFD23F' : '#FF8A1F';
      ctx.strokeStyle = '#0E2A47';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const sorted = [...race.boats].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
    for (const b of sorted) {
      if (!b.isPlayer && b.has('camo')) continue;
      const [x, y] = this.toMap(b.pos.x, b.pos.z);
      ctx.globalAlpha = b.alive ? 1 : 0.4;
      ctx.fillStyle = `#${b.color.toString(16).padStart(6, '0')}`;
      ctx.strokeStyle = '#0E2A47';
      ctx.lineWidth = 2.5;
      if (b.isPlayer) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-b.heading);
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(7, 7);
        ctx.lineTo(0, 3);
        ctx.lineTo(-7, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }
}
