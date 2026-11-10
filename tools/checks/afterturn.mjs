import { check } from '../lib.mjs';
import { createTrack } from '../../src/track.js';
import { MAPS } from '../../src/maps.js';

const FLIGHT = { truck: 200, sub: 200, jet: 200, cart: 220, ski: 310 };
const STRAIGHT = 300;
const MIN_RADIUS = 120;

function tightest(track, from) {
  let min = Infinity;
  for (let s = from; s < from + STRAIGHT; s += 4) {
    const a = track.heading(track.wrap(Math.round((s - 12) / track.spacing)));
    const b = track.heading(track.wrap(Math.round((s + 12) / track.spacing)));
    const turn = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    min = Math.min(min, 24 / Math.max(turn, 1e-4));
  }
  return min;
}

for (const id of Object.keys(MAPS)) {
  const track = createTrack(MAPS[id]);
  const land = track.river?.land;
  if (!land) continue;
  const landing = tightest(track, land.launch + FLIGHT[land.kind]);
  const back = tightest(track, land.lip);
  check(`${id}: gentle course after becoming a ${land.form}`, landing >= MIN_RADIUS, `${landing.toFixed(0)} m radius`);
  check(`${id}: gentle course after turning back into a boat`, back >= MIN_RADIUS, `${back.toFixed(0)} m radius`);
}
