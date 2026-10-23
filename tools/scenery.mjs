import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1280, height: 760 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(800);
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; window.__bb.freeCam = true; });
const isl = await page.evaluate(() => window.__bb.world.islands.filter((o) => o.r > 12).sort((a, b) => b.r - a.r).slice(0, 12));
const views = isl.filter((_, i) => i % 2 === 0).map((o) => [[o.x + o.r * 1.05 + 6, 5, o.z + o.r * 0.8 + 6], [o.x, 9, o.z]]);
const unused = [
  [[60, 14, -60], [140, 6, 40]],
  [[-150, 10, 120], [-260, 5, 200]],
  [[200, 30, 120], [60, 0, 160]],
  [[-60, 8, -90], [-200, 6, -60]],
  [[320, 12, 60], [380, 6, 260]],
  [[0, 70, 0], [-100, 0, 160]],
];
let i = 0;
for (const [p, l] of views) {
  await page.evaluate((p, l) => { const c = window.__bb.camera; c.position.set(...p); c.lookAt(...l); c.fov = 60; c.updateProjectionMatrix(); }, p, l);
  await wait(400);
  await page.screenshot({ path: `tools/shots/scene-${i++}.png` });
}
await browser.close();
