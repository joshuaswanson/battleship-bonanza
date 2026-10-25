import { launch, startRace, autopilot, check } from '../lib.mjs';

for (const map of (process.argv[2] ?? 'bay').split(',')) {
  const { browser, page } = await launch({ width: 640, height: 400 });
  await startRace(page, { map });
  await page.evaluate(() => {
    const { race } = window.__bb;
    window.__split = { inside: 0, worst: 0, sides: {}, samples: 0 };
    const update = race.update.bind(race);
    race.update = (...a) => {
      update(...a);
      const t = race.track;
      for (const b of race.boats) {
        const i = b.trackIdx;
        if (!t.isl[i] || !b.alive || b.yOffset > 0.5) continue;
        const pr = t.project(b.pos.x, b.pos.z, i);
        const into = t.isl[pr.idx] - Math.abs(pr.lateral);
        window.__split.samples++;
        if (into > 0) window.__split.inside++;
        window.__split.worst = Math.max(window.__split.worst, into);
        if (t.isl[pr.idx] > t.islands[0].island * 0.8) window.__split.sides[pr.lateral < 0 ? 'left' : 'right'] = (window.__split.sides[pr.lateral < 0 ? 'left' : 'right'] ?? 0) + 1;
      }
    };
  });
  await autopilot(page, 6);
  await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), { timeout: 300000, polling: 1000 });
  const r = await page.evaluate(() => ({ ...window.__split, finished: window.__bb.race.boats.filter((b) => b.finished).length }));
  check(`${map}: race finishes`, r.finished === 6, `${r.finished}/6`);
  check(`${map}: no boat ends up on the island`, r.inside === 0, `${r.inside} of ${r.samples} samples inside, worst ${r.worst.toFixed(2)}`);
  check(`${map}: boats use both channels`, (r.sides.left ?? 0) > 20 && (r.sides.right ?? 0) > 20, JSON.stringify(r.sides));
  check(`${map}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
