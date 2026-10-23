import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
await wait(300);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'machinegun', 'emp'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await page.evaluate(() => window.__bb.loadout.refresh());
await wait(1000);
await page.screenshot({ path: 'tools/shots/emp-yard.png', clip: { x: 150, y: 80, width: 520, height: 360 } });
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
await wait(4800);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  p.ai.base = 0;
  const others = r.boats.filter((b) => !b.isPlayer);
  others.forEach((o, i) => o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400));
  const v = others[0]; const w = others[1];
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  v.pos.set(p.pos.x + lx * 12 + Math.sin(p.heading) * 4, 0, p.pos.z + lz * 12 + Math.cos(p.heading) * 4);
  v.heading = p.heading; window.__v = v;
  w.pos.set(p.pos.x - lx * 10 + Math.sin(p.heading) * 8, 0, p.pos.z - lz * 10 + Math.cos(p.heading) * 8); w.heading = p.heading;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(p.pos.x - lx * 14 - Math.sin(p.heading) * 10, 12, p.pos.z - lz * 14 - Math.cos(p.heading) * 10);
  c.lookAt(p.pos.x + lx * 5, 1, p.pos.z + lz * 5);
});
await wait(400);
await page.keyboard.press('KeyP');
await wait(260);
await page.screenshot({ path: 'tools/shots/emp-blast.png' });
await page.evaluate(() => {
  const v = window.__v; v.disabled = 5;
  const c = window.__bb.camera; const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
  c.position.set(v.pos.x + lx * 9, 6, v.pos.z + lz * 9); c.lookAt(v.pos.x, 1.5, v.pos.z);
});
await wait(700);
await page.screenshot({ path: 'tools/shots/emp-short.png' });
console.log('victim disabled', await page.evaluate(() => window.__v.disabled.toFixed(2)));
await browser.close();
