import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; window.__bb.freeCam = true; });
for (const [kind, i, name] of [['pads', 1, 'pad'], ['ramps', 0, 'ramp']]) {
  await page.evaluate(({ kind, i }) => {
    const f = window.__bb.race.features[kind][i];
    const c = window.__bb.camera;
    const bx = -Math.sin(f.heading), bz = -Math.cos(f.heading);
    c.position.set(f.x + bx * 16 + bz * 6, 7, f.z + bz * 16 - bx * 6);
    c.lookAt(f.x, 1, f.z);
  }, { kind, i });
  await wait(300);
  await page.screenshot({ path: `tools/shots/close-${name}.png` });
}
await browser.close();
