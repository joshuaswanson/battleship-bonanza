import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'jungle'; });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(5000);
for (const [n, drop] of [[0, 1], [1, 2]]) {
  await page.evaluate((drop) => {
    const t = window.__bb.race.track; const d = t.river.drops[drop];
    const k = Math.round((d.s + 30) / t.spacing) % t.N;
    window.__bb.freeCam = true;
    const c = window.__bb.camera; const y = t.level(d.s + 30);
    c.position.set(t.px[k] + t.nx[k] * 12, y + 9, t.pz[k] + t.nz[k] * 12);
    const k2 = Math.round(d.s / t.spacing) % t.N;
    c.lookAt(t.px[k2], y + 3, t.pz[k2]);
  }, drop);
  await wait(300);
  await page.screenshot({ path: `tools/shots/cascade-${n}.png` });
}
await browser.close();
