import fs from 'node:fs';

const races = JSON.parse(fs.readFileSync(process.argv[2] ?? 'tools/balance-results.json', 'utf8'));
const per = new Map();
const pairs = new Map();
const add = (map, key, row) => {
  const s = map.get(key) ?? { n: 0, place: 0, wins: 0, dealt: 0, sunk: 0, kills: 0 };
  s.n++;
  s.place += row.place;
  s.wins += row.place === 1 ? 1 : 0;
  s.dealt += row.dealt;
  s.sunk += row.sunk;
  s.kills += row.kills;
  map.set(key, s);
};
for (const race of races) {
  for (const row of race) {
    for (const id of row.items) add(per, id, row);
    add(pairs, [...row.items].sort().join(' + '), row);
  }
}
const fmt = ([key, s]) =>
  `${key.padEnd(24)} n=${String(s.n).padStart(3)}  avg place ${(s.place / s.n).toFixed(2)}  wins ${((100 * s.wins) / s.n).toFixed(0).padStart(3)}%  dealt ${(s.dealt / s.n).toFixed(0).padStart(4)}  sunk ${(s.sunk / s.n).toFixed(2)}  kills ${(s.kills / s.n).toFixed(2)}`;
console.log(`${races.length} races, average place is 3.50 by definition\n\nPer attachment (sorted by average place):`);
console.log([...per].sort((a, b) => a[1].place / a[1].n - b[1].place / b[1].n).map(fmt).join('\n'));
const common = [...pairs].filter(([, s]) => s.n >= 4).sort((a, b) => a[1].place / a[1].n - b[1].place / b[1].n);
console.log(`\nPairs seen at least 4 times (${common.length} of ${pairs.size}), best and worst:`);
console.log(common.slice(0, 6).map(fmt).join('\n'));
console.log('...');
console.log(common.slice(-6).map(fmt).join('\n'));
