import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; window.__bb.setup.items.splice(0, 2, 'grapple', 'armor'); });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(1400);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(1400);
await page.evaluate(() => document.getElementById('btn-go').click());
await wait(5000);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; if (b !== p) b.pos.x += 3000; }
  p.ai.base = 0; p.vel.set(0, 0, 0); p.speed = 0;
  window.__bb.freeCam = true;
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading), fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  const c = window.__bb.camera; c.position.set(p.pos.x + lx * 45 + fx * 25, 14, p.pos.z + lz * 45 + fz * 25); c.lookAt(p.pos.x + fx * 30, 0, p.pos.z + fz * 30);
});
await page.keyboard.press('KeyO');
for (const [n, t] of [[1, 420], [2, 350], [3, 450], [4, 500]]) {
  await wait(t);
  const st = await page.evaluate(() => { const h = window.__bb.race.hooks[0]; return h ? `phase=${h.phase} loose=${!!h.loose} len=${h.loose?.length.toFixed(1)} y=${h.pos.y.toFixed(1)}` : 'gone'; });
  console.log(n, st);
  await page.screenshot({ path: `tools/shots/rope-${n}.png` });
}
await browser.close();
