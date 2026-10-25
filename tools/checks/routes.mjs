import { launch, startRace, autopilot, check } from '../lib.mjs';

for (const map of (process.argv[2] ?? 'bay').split(',')) {
  const { browser, page } = await launch({ width: 640, height: 400 });
  await startRace(page, { map });
  await page.evaluate(() => {
    const { race } = window.__bb;
    const base = 2 * race.track.N;
    const stats = (window.__routes = { onRoute: 0, onMain: 0, jumps: 0, worstJump: 0, laps: new Map() });
    const last = new Map();
    const update = race.update.bind(race);
    race.update = (...a) => {
      update(...a);
      for (const b of race.boats) {
        if (!b.alive || b.finished) continue;
        const prev = last.get(b);
        if (prev !== undefined) {
          const jump = Math.abs(b.dist - prev);
          stats.worstJump = Math.max(stats.worstJump, jump);
          if (jump > 40) stats.jumps++;
        }
        last.set(b, b.dist);
        const key = `${b.index}:${b.lap}`;
        if (b.trackIdx >= base) stats.laps.set(key, 'route');
        else if (!stats.laps.has(key)) stats.laps.set(key, 'main');
      }
    };
  });
  await autopilot(page, 6);
  await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), { timeout: 300000, polling: 1000 });
  const r = await page.evaluate(() => {
    const s = window.__routes;
    const values = [...s.laps.values()];
    return { route: values.filter((v) => v === 'route').length, main: values.filter((v) => v === 'main').length, jumps: s.jumps, worst: s.worstJump, finished: window.__bb.race.boats.filter((b) => b.finished).length };
  });
  check(`${map}: race finishes`, r.finished === 6, `${r.finished}/6`);
  check(`${map}: boats take both routes`, r.route > 2 && r.main > 2, `${r.route} laps on a route, ${r.main} on the main line`);
  check(`${map}: race progress never jumps`, r.jumps === 0, `worst step ${r.worst.toFixed(2)}`);
  check(`${map}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
