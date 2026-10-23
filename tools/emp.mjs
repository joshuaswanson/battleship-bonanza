import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'emp', 'laser'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
await wait(4600);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  p.ai.base = 0;
  const v = r.boats.find((b) => !b.isPlayer && b.model.sags.length === 2) ?? r.boats.find((b) => !b.isPlayer);
  v.pos.set(p.pos.x + Math.cos(p.heading) * 12, 0, p.pos.z - Math.sin(p.heading) * 12);
  v.heading = p.heading;
  window.__v = v;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(v.pos.x + Math.cos(p.heading) * 9 - Math.sin(p.heading) * 3, 5, v.pos.z - Math.sin(p.heading) * 9 - Math.cos(p.heading) * 3);
  c.lookAt(v.pos.x, 2, v.pos.z);
});
await wait(300);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
await page.screenshot({ path: 'tools/shots/emp-0.png' });
console.log(await page.evaluate(() => { window.__bb.race.useItem(window.__bb.race.player, 0); return 'fired'; }));
await wait(700);
console.log(await page.evaluate(() => `disabled=${window.__v.disabled.toFixed(2)} items=${window.__v.items} used=${window.__bb.race.useItem(window.__v, 0)}`));
await page.screenshot({ path: 'tools/shots/emp-1.png' });
await wait(2000);
await page.screenshot({ path: 'tools/shots/emp-2.png' });
await browser.close();
