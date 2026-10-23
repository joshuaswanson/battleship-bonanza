import puppeteer from 'puppeteer-core';
const tag = process.argv[2] ?? 'a';
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
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
const views = [
  ['bank', 300, 4, 3, 30, 1.3],
  ['low', 520, -8, 1.2, 25, 4],
  ['high', 650, 0, 22, 60, 2],
];
for (const [name, s, lat, h, ahead, look] of views) {
  await page.evaluate(({ s, lat, h, ahead, look }) => {
    const t = window.__bb.race.track; const k = Math.round(s / t.spacing) % t.N; const k2 = Math.round((s + ahead) / t.spacing) % t.N;
    window.__bb.freeCam = true;
    const y = t.level(s);
    const c = window.__bb.camera;
    c.position.set(t.px[k] + t.nx[k] * lat, y + h, t.pz[k] + t.nz[k] * lat);
    c.lookAt(t.px[k2] + t.nx[k2] * (lat > 0 ? 20 : -20), y + h + look * 3, t.pz[k2] + t.nz[k2] * (lat > 0 ? 20 : -20));
  }, { s, lat, h, ahead, look });
  await wait(300);
  await page.screenshot({ path: `tools/shots/trees-${name}-${tag}.png` });
}
await browser.close();
