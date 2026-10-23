import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; window.__bb.freeCam = true; });
const crags = await page.evaluate(() => window.__bb.world.stacks.filter((s) => s.crag));
console.log('crags', crags.length);
let n = 0;
for (const c of crags.slice(0, 3)) {
  await page.evaluate(({ x, z }) => { const cam = window.__bb.camera; cam.position.set(x + 70, 20, z + 55); cam.lookAt(x, 8, z); }, c);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `tools/shots/crag-${n++}.png` });
}
await browser.close();
