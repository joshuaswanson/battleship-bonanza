import { DIFFICULTIES, MEDALS } from './difficulty.js';
import { MAPS } from './maps.js';

const KEY = 'bb-records';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === 'object') return saved;
  } catch {}
  return {};
}

const records = load();

export const courseOf = (map) => MAPS[map]?.course ?? 1;

export function recordOf(map) {
  const record = records[map];
  if (!record) return null;
  return (record.course ?? 1) === courseOf(map) ? record : { ...record, best: null };
}

export function saveResult(map, difficulty, place, time) {
  const before = recordOf(map) ?? {};
  const earned = place === 1 ? DIFFICULTIES[difficulty].medal : null;
  const newMedal = earned && MEDALS.indexOf(earned) > MEDALS.indexOf(before.medal) ? earned : null;
  const newBest = before.best == null || time < before.best;
  records[map] = { best: newBest ? time : before.best, medal: newMedal ?? before.medal ?? null, course: courseOf(map) };
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {}
  return { newBest, newMedal, best: records[map].best, previous: before.best ?? null };
}
