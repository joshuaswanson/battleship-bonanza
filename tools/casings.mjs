import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
await wait(300);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'machinegun', 'jetpack'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
await wait(5500);
await page.keyboard.down('KeyO');
await wait(500);
await page.evaluate(() => {
  const p = window.__bb.race.player; window.__bb.freeCam = true;
  const c = window.__bb.camera; const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  c.position.set(p.pos.x - lx * 9 - Math.sin(p.heading) * 2, 5, p.pos.z - lz * 9 - Math.cos(p.heading) * 2);
  c.lookAt(p.pos.x, 1.5, p.pos.z);
});
await wait(250);
await page.screenshot({ path: 'tools/shots/casings.png' });
await page.keyboard.up('KeyO');
await browser.close();
