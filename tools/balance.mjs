import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const races = Number(process.argv[2] ?? 40);
const out = process.argv[3] ?? 'tools/balance-results.json';
const url = process.argv[4] ?? 'http://localhost:5288/';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  defaultViewport: { width: 640, height: 400 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
const results = [];
for (let n = 0; n < races; n++) {
  await page.evaluate((map) => {
    window.__bb.steps = 10;
    window.__bb.map = map;
    return window.__bb.simRace();
  }, n % 2 ? 'jungle' : 'bay');
  const t0 = Date.now();
  let done = false;
  while (!done && Date.now() - t0 < 90000) {
    await new Promise((r) => setTimeout(r, 1000));
    done = await page.evaluate(() => window.__bb.race.boats.every((b) => b.finished) || window.__bb.race.clock > 420);
  }
  const rows = await page.evaluate(() =>
    window.__bb.race.order.map((b) => ({ map: window.__bb.race.track.map.id, items: b.items, place: b.place, finished: b.finished, time: b.finishTime, ...b.stats })),
  );
  results.push(rows);
  fs.writeFileSync(out, JSON.stringify(results));
  console.log(`race ${n + 1}/${races} done in ${((Date.now() - t0) / 1000).toFixed(0)}s, winner ${rows[0].items.join('+')}`);
}
await browser.close();
