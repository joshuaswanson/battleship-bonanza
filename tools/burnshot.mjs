import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
await wait(500);
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(6000);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer);
  v.pos.set(p.pos.x + Math.sin(p.heading) * 14, 0, p.pos.z + Math.cos(p.heading) * 14);
  v.heading = p.heading; v.hp = 100; v.invuln = 0; v.vel.copy(p.vel); v.speed = p.speed;
  r.ignite(v, p); v.burn.time = 99;
  window.__v = v;
});
await wait(600);
await page.screenshot({ path: 'tools/shots/burn-chase.png' });
await page.evaluate(() => {
  const v = window.__v; const r = window.__bb.race;
  for (const b of r.boats) { b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  window.__bb.freeCam = true;
  const c = window.__bb.camera; const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
  c.position.set(v.pos.x + lx * 14, 7, v.pos.z + lz * 14); c.lookAt(v.pos.x, 2, v.pos.z);
});
await wait(1500);
await page.screenshot({ path: 'tools/shots/burn-side.png' });
await browser.close();
