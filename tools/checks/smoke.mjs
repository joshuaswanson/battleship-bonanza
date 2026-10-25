import { launch, startRace, waitForGo, autopilot, check } from '../lib.mjs';

for (const map of (process.argv[2] ?? 'bay,jungle,alps,venice,midway,canyon').split(',')) {
  const t0 = Date.now();
  const { browser, page } = await launch({ width: 640, height: 400 });
  await startRace(page, { map });
  await waitForGo(page);
  const start = await page.evaluate(() => window.__bb.race.player.pos.clone());
  await autopilot(page, 4);
  await page.waitForFunction(() => window.__bb.race.time > 12, { polling: 250 });
  const moved = await page.evaluate((s) => Math.hypot(window.__bb.race.player.pos.x - s.x, window.__bb.race.player.pos.z - s.z), start);
  check(`${map}: boats race`, moved > 20, `${moved.toFixed(0)} units in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  check(`${map}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
