import { DIFFICULTIES, MEDALS } from './difficulty.js';

const KEY = 'bb-records';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') return saved;
  } catch {}
  return {};
}

const records = load();

export const recordOf = (map) => records[map] ?? null;

export function saveResult(map, difficulty, place, time) {
  const before = records[map] ?? {};
  const earned = place === 1 ? DIFFICULTIES[difficulty].medal : null;
  const newMedal = earned && MEDALS.indexOf(earned) > MEDALS.indexOf(before.medal) ? earned : null;
  const newBest = !(before.best <= time);
  records[map] = { best: newBest ? time : before.best, medal: newMedal ?? before.medal ?? null };
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {}
  return { newBest, newMedal, best: records[map].best, previous: before.best ?? null };
}
