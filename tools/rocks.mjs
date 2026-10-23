import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; window.__bb.freeCam = true; });
const shores = await page.evaluate(() => window.__bb.world.shores.filter((s) => s.rot === 0).map((s) => [s.x, s.z, s.rx]));
const seen = [];
let n = 0;
for (const [x, z, r] of shores) {
  if (seen.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 60) || r < 10) continue;
  seen.push([x, z]);
  await page.evaluate(({ x, z, r }) => { const c = window.__bb.camera; c.position.set(x + r * 4 + 40, 22, z + r * 3 + 40); c.lookAt(x, 25, z); }, { x, z, r });
  await new Promise((res) => setTimeout(res, 300));
  await page.screenshot({ path: `tools/shots/rock-${n++}.png` });
  if (n >= 6) break;
}
await browser.close();
