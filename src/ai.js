import { ITEMS } from './items.js';

const HOLD_RANGE = { machinegun: 75, laser: 70, flamethrower: 15, saw: 13 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createAI() {
  return {
    lane: (Math.random() - 0.5) * 22,
    thrillSeeker: Math.random() < 0.65,
    laneT: Math.random() * 10,
    dodge: 0,
    dodgeTime: 0,
    think: Math.random(),
    base: 0.9 + Math.random() * 0.08,
    aggression: 0.35 + Math.random() * 0.45,
  };
}

export function driveAI(race, b, dt) {
  const ai = b.ai;
  const track = race.track;

  ai.laneT += dt * 0.3;
  ai.dodgeTime -= dt;
  if (ai.dodgeTime <= 0) ai.dodge *= Math.exp(-3 * dt);

  const look = Math.round((16 + Math.abs(b.speed) * 0.5) / track.spacing);
  const target = race.mode ? dodged(race.mode.navigate(race, b, look), b, ai) : courseTarget(race, b, look);
  const desired = Math.atan2(target.x - b.pos.x, target.z - b.pos.z);
  const diff = wrapAngle(desired - b.heading);

  b.control.steer = clamp(-diff * 2.6, -1, 1);
  b.control.throttle = Math.abs(diff) > 0.9 ? 0.5 : 1;

  avoidMines(race, b, ai);
  avoidRocks(race, b, ai);
  if (race.hazards) avoidHazards(race, b, ai);
  for (const heat of Object.values(b.heat)) if (heat.heat > 0.85) heat.trigger = false;

  if (race.player && !race.attract && !b.isPlayer && !race.mode) {
    const gap = race.player.dist - b.dist;
    b.skill = ai.base * clamp(1 + gap / 1000, 0.8, 1.18);
  } else {
    b.skill = ai.base;
  }

  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = race.incomingThreats(b).length ? 0.08 : 0.2 + Math.random() * 0.35;
    if (race.state === 'racing' && (race.clock > 2.5 || race.attract)) useItems(race, b, ai);
  }
}

function courseTarget(race, b, look) {
  const ai = b.ai;
  const track = race.track;
  const choose = (fork) => chooseRoute(race, b, fork);
  const idx = track.step(b.trackIdx, look, choose);
  const half = track.hw[idx];
  const feature = ai.thrillSeeker ? race.features.nearestAhead(b, 70, choose) : null;
  const wanted = feature ? feature.lateral : ai.lane + Math.sin(ai.laneT) * 6;
  let lane = clamp(wanted + ai.dodge, -(half - 5), half - 5);
  const fork = track.forkNear(b.trackIdx) ?? track.forkNear(idx);
  if (fork && track.route[idx] === -1 && ai.routes?.[fork.id] === false) lane = fork.side > 0 ? Math.min(lane, -2) : Math.max(lane, 2);
  return track.point(idx, lane);
}

function dodged(target, b, ai) {
  if (!ai.dodge) return target;
  const dx = target.x - b.pos.x;
  const dz = target.z - b.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: target.x + (dz / len) * ai.dodge, z: target.z - (dx / len) * ai.dodge };
}

function chooseRoute(race, b, fork) {
  const ai = b.ai;
  ai.routes ??= {};
  ai.routeLap ??= {};
  if (ai.routeLap[fork.id] !== b.lap) {
    ai.routeLap[fork.id] = b.lap;
    ai.routes[fork.id] = Math.random() < (fork.pick ?? 0.5);
  }
  return ai.routes[fork.id];
}

function avoidRocks(race, b, ai) {
  if (ai.dodgeTime > 0) return;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  for (const rock of race.shores) {
    const r = Math.max(rock.rx, rock.rz);
    if (r > 12) continue;
    const dx = rock.x - b.pos.x;
    const dz = rock.z - b.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0 || ahead > 26 + r) continue;
    const side = dx * -fz + dz * fx;
    if (Math.abs(side) > r + 4) continue;
    ai.dodge = side > 0 ? 8 + r : -8 - r;
    ai.dodgeTime = 0.6;
    return;
  }
}

function avoidHazards(race, b, ai) {
  if (ai.dodgeTime > 0) return;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  for (const o of race.hazards.obstacles) {
    if (o.drum && ai.thrillSeeker) continue;
    const dx = o.x - b.pos.x;
    const dz = o.z - b.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0 || ahead > 24 + o.r) continue;
    const side = dx * -fz + dz * fx;
    if (Math.abs(side) > o.r + 3.5) continue;
    ai.dodge = side > 0 ? 7 + o.r : -7 - o.r;
    ai.dodgeTime = 0.5;
    return;
  }
}

function avoidMines(race, b, ai) {
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  for (const mine of race.mines) {
    const dx = mine.pos.x - b.pos.x;
    const dz = mine.pos.z - b.pos.z;
    const ahead = dx * fx + dz * fz;
    if (ahead < 0 || ahead > 32) continue;
    const side = dx * -fz + dz * fx;
    if (Math.abs(side) > 4.5) continue;
    if (b.has('jetpack') && Math.random() < 0.7) {
      const slot = b.items.indexOf('jetpack');
      if (ahead < 18 && race.useItem(b, slot)) return;
    }
    ai.dodge = side > 0 ? 9 : -9;
    ai.dodgeTime = 0.8;
    return;
  }
}

function useItems(race, b, ai) {
  for (let slot = 0; slot < 2; slot++) {
    const id = b.items[slot];
    if (ITEMS[id].hold) b.aim[id] = race.findTarget(b, { ...race.gunArc(b, id, HOLD_RANGE[id]), filter: (o) => race.willAttack(b, o) });
    if (b.items[slot] === 'machinegun') {
      const t = b.aim.machinegun;
      b.heat.machinegun.trigger = !!t && !t.has('armor') && b.heat.machinegun.heat < 0.7 && Math.random() < ai.aggression + 0.3;
      continue;
    }
    if (b.items[slot] === 'flamethrower') {
      const t = b.aim.flamethrower;
      b.heat.flamethrower.trigger = !!t && b.heat.flamethrower.heat < 0.75 && Math.random() < ai.aggression + 0.4;
      continue;
    }
    if (b.items[slot] === 'saw') {
      const t = b.aim.saw;
      b.heat.saw.trigger = !!t && !t.has('armor') && !t.has('spikes') && b.heat.saw.heat < 0.75 && Math.random() < ai.aggression + 0.4;
      continue;
    }
    if (b.items[slot] === 'laser') {
      const t = b.aim.laser;
      b.heat.laser.trigger = !!t && b.heat.laser.heat < 0.7 && Math.random() < ai.aggression + 0.3;
      continue;
    }
    if (b.cooldowns[slot] > 0) continue;
    if (shouldUse(race, b, b.items[slot], ai)) race.useItem(b, slot);
  }
}

function shouldUse(race, b, id, ai) {
  const r = Math.random();
  switch (id) {
    case 'missiles': {
      const t = race.findTarget(b, { range: 170, minDot: -1, filter: (o) => !o.has('camo') && race.willAttack(b, o) });
      return !!t && r < ai.aggression * 0.45;
    }
    case 'grapple': {
      const t = race.findTarget(b, { ...race.hookSpec(b), minRange: 18 });
      return !!t && !(race.sawCuts(t, b) && r < 0.8) && r < ai.aggression;
    }
    case 'emp': {
      const incoming = race.missiles.some((m) => m.target === b && m.fizzle <= 0 && m.pos.distanceTo(b.pos) < 40);
      const armedNearby = race.boats.some(
        (o) => o !== b && o.alive && o.disabled <= 0 && Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) < 20 && o.items.some((id) => ['machinegun', 'laser', 'saw'].includes(id)),
      );
      return (incoming && r < 0.85) || (armedNearby && r < 0.25);
    }
    case 'jetpack': {
      const threat = race.incomingThreats(b).some((t) => t.eta < 0.4);
      if (threat) return r < 0.6;
      const idx = race.track.wrap(b.trackIdx + Math.round(40 / race.track.spacing));
      const straight = Math.abs(wrapAngle(race.track.heading(idx) - b.heading)) < 0.12;
      return straight && b.speed > 25 && r < 0.12;
    }
    case 'mines': {
      const t = race.findTarget(b, { ...race.gunArc(b, 'mines', 45), filter: (o) => race.willAttack(b, o) });
      return t ? r < ai.aggression : r < 0.03;
    }
  }
  return false;
}
