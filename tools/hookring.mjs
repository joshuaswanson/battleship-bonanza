import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'grapple', 'laser'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
await wait(4600);
const info = await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  p.ai.base = 0;
  const others = r.boats.filter((b) => !b.isPlayer);
  others.forEach((o, i) => o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400));
  const v = others[0];
  v.items = ['laser', 'mines'];
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  v.pos.set(p.pos.x + fx * 30, 0, p.pos.z + fz * 30);
  v.heading = p.heading;
  window.__v = v;
  r.useItem(p, 0);
  const h = r.hooks.at(-1);
  return `target=${h.target?.name} anchorIsTowRing=${v.model.towRings.includes(h.anchor)}`;
});
console.log(info);
await wait(450);
await page.evaluate(() => {
  const r = window.__bb.race; const h = r.hooks.at(-1); const v = window.__v;
  const a = h.anchor.getWorldPosition(v.pos.clone());
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(a.x + Math.cos(v.heading) * 4 - Math.sin(v.heading) * 3, a.y + 2.2, a.z - Math.sin(v.heading) * 4 - Math.cos(v.heading) * 3);
  c.lookAt(a.x, a.y, a.z);
  c.fov = 40; c.updateProjectionMatrix();
  window.__bb.steps = 0;
});
await wait(150);
console.log(await page.evaluate(() => { const h = window.__bb.race.hooks.at(-1); return `phase=${h.phase} gap=${h.pos.distanceTo(h.anchor.getWorldPosition(h.pos.clone())).toFixed(2)}`; }));
await page.screenshot({ path: 'tools/shots/hookring.png' });
await browser.close();
