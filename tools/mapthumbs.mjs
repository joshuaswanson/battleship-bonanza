import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 960, height: 600 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
const shots = {
  bay: () => {
    const t = window.__bb.race.track; const k = Math.round(t.N * 0.93); const k2 = Math.round(t.N * 0.02);
    const c = window.__bb.camera; c.position.set(t.px[k] + t.nx[k] * 45, 26, t.pz[k] + t.nz[k] * 45); c.lookAt(t.px[k2], 0, t.pz[k2]);
  },
  jungle: () => {
    const t = window.__bb.race.track; const d = t.river.drops.find((x) => x.height > 8);
    const s = d.s + 75; const k = Math.round(s / t.spacing) % t.N; const k2 = Math.round(d.s / t.spacing) % t.N;
    const y = t.level(s); const c = window.__bb.camera; c.position.set(t.px[k] + t.nx[k] * 6, y + 9, t.pz[k] + t.nz[k] * 6); c.lookAt(t.px[k2], y + 13, t.pz[k2]);
  },
};
for (const [map, fn] of Object.entries(shots)) {
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
  await page.evaluate((m) => { window.__bb.map = m; }, map);
  await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
  await wait(4500);
  await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; document.getElementById('hud').style.display = 'none'; window.__bb.freeCam = true; });
  await page.evaluate(`(${fn.toString()})()`);
  await wait(400);
  await page.screenshot({ path: `public/maps/${map}.jpg`, type: 'jpeg', quality: 82 });
}
await browser.close();
