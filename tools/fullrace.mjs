import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await page.evaluate(() => { window.__bb.autopilot = true; window.__bb.steps = 6; });
const t0 = Date.now();
let shot = 0;
while (Date.now() - t0 < 90000) {
  await wait(3000);
  const s = await page.evaluate(() => {
    const r = window.__bb.race;
    return { clock: r.clock.toFixed(0), order: r.order.map((b) => `${b.place}.${b.name}${b.isPlayer ? '*' : ''} L${b.lap} hp${Math.round(b.hp)}${b.finished ? ' F' : ''}`).join(' | '), results: !document.getElementById('screen-results').classList.contains('hidden'), feed: document.getElementById('hud-feed').textContent };
  });
  console.log(s.clock, s.order, s.results ? 'RESULTS' : '');
  if (shot++ % 4 === 1) await page.screenshot({ path: `tools/shots/full-${shot}.png` });
  if (s.results) break;
}
await wait(1500);
await page.screenshot({ path: 'tools/shots/full-results.png' });
console.log(logs.filter((l) => !l.includes('[vite]')).slice(0, 20).join('\n'));
await browser.close();
