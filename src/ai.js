const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createAI() {
  return {
    lane: (Math.random() - 0.5) * 22,
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
  const half = track.halfWidth;

  ai.laneT += dt * 0.3;
  ai.dodgeTime -= dt;
  if (ai.dodgeTime <= 0) ai.dodge *= Math.exp(-3 * dt);

  const look = Math.round((16 + Math.abs(b.speed) * 0.5) / track.spacing);
  const idx = track.wrap(b.trackIdx + look);
  const lane = clamp(ai.lane + Math.sin(ai.laneT) * 6 + ai.dodge, -(half - 5), half - 5);
  const target = track.point(idx, lane);
  const desired = Math.atan2(target.x - b.pos.x, target.z - b.pos.z);
  const diff = wrapAngle(desired - b.heading);

  b.control.steer = clamp(-diff * 2.6, -1, 1);
  b.control.throttle = Math.abs(diff) > 0.9 ? 0.5 : 1;

  avoidMines(race, b, ai);

  if (race.player && !race.attract && !b.isPlayer) {
    const gap = race.player.dist - b.dist;
    b.skill = ai.base * clamp(1 + gap / 1800, 0.93, 1.12);
  } else {
    b.skill = ai.base;
  }

  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = 0.2 + Math.random() * 0.35;
    if (race.state === 'racing' && (race.clock > 2.5 || race.attract)) useItems(race, b, ai);
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
    if (b.cooldowns[slot] > 0) continue;
    if (shouldUse(race, b, b.items[slot], ai)) race.useItem(b, slot);
  }
}

function shouldUse(race, b, id, ai) {
  const r = Math.random();
  switch (id) {
    case 'machinegun': {
      const t = race.findTarget(b, { range: 75, minDot: 0.9 });
      return !!t && !t.has('armor') && r < ai.aggression;
    }
    case 'laser': {
      const t = race.findTarget(b, { range: 130, minDot: 0.96 });
      if (!t) return false;
      if (t.has('saw') && !b.has('saw')) return r < 0.08;
      return r < ai.aggression;
    }
    case 'saw': {
      const t = race.findTarget(b, { range: 10, minDot: 0.75 });
      return !!t && !t.has('armor');
    }
    case 'missiles': {
      const t = race.findTarget(b, { range: 170, minDot: 0.25, filter: (o) => !o.has('camo') });
      return !!t && r < ai.aggression * 0.8;
    }
    case 'grapple': {
      const t = race.findTarget(b, {
        range: 110,
        minDot: 0.6,
        minRange: 18,
        filter: (o) => o.has('spikes') || o.has('jetpack'),
      });
      return !!t && r < ai.aggression;
    }
    case 'emp': {
      const threatened =
        race.missiles.some((m) => m.target === b && m.fizzle <= 0 && m.pos.distanceTo(b.pos) < 40) ||
        race.hooks.some((h) => h.target === b && h.phase !== 'retract');
      return threatened && r < 0.85;
    }
    case 'jetpack': {
      const idx = race.track.wrap(b.trackIdx + Math.round(40 / race.track.spacing));
      const straight = Math.abs(wrapAngle(race.track.heading(idx) - b.heading)) < 0.12;
      return straight && b.speed > 25 && r < 0.12;
    }
    case 'mines': {
      const behind = race.boats.some((o) => {
        if (o === b || !o.alive) return false;
        const dx = o.pos.x - b.pos.x;
        const dz = o.pos.z - b.pos.z;
        const d = Math.hypot(dx, dz);
        return d < 45 && (dx * Math.sin(b.heading) + dz * Math.cos(b.heading)) / d < -0.7;
      });
      return behind ? r < ai.aggression : r < 0.03;
    }
  }
  return false;
}
