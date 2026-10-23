import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'machinegun', 'missiles'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
await wait(4600);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  p.ai.base = 0;
  const others = r.boats.filter((b) => !b.isPlayer);
  others.forEach((o, i) => o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400));
  const v = others[0];
  v.items = ['spikes', 'laser'];
  v.pos.set(p.pos.x - Math.sin(p.heading) * 30 + Math.cos(p.heading) * 10, 0, p.pos.z - Math.cos(p.heading) * 30 - Math.sin(p.heading) * 10);
  window.__v = v;
  window.__bb.freeCam = true;
  const c = window.__bb.camera; const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  c.position.set(p.pos.x + lx * 14, 9, p.pos.z + lz * 14);
  c.lookAt(p.pos.x, 1.5, p.pos.z);
});
await wait(1500);
console.log(await page.evaluate(() => window.__bb.race.player.turrets.map((t) => `${t.id} yaw=${t.group.rotation.y.toFixed(2)}`).join(' ')));
await page.screenshot({ path: 'tools/shots/watch.png' });
await page.evaluate(() => window.__bb.race.useItem(window.__bb.race.player, 1));
await wait(450);
console.log(await page.evaluate(() => `missiles=${window.__bb.race.missiles.length} target=${window.__bb.race.missiles[0]?.target?.name} vname=${window.__v.name} dir=${window.__bb.race.missiles[0]?.dir.toArray().map((n) => n.toFixed(2))}`));
await page.screenshot({ path: 'tools/shots/watch-fire.png' });
await browser.close();
