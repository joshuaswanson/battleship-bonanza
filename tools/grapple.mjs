import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'grapple', 'laser'));
let found = false;
for (let attempt = 0; attempt < 8 && !found; attempt++) {
  await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
  await wait(300);
  found = await page.evaluate(() => window.__bb.race.boats.some((b) => !b.isPlayer && b.has('spikes')));
  if (!found) { await page.keyboard.press('Escape'); await wait(100); await page.evaluate(() => document.getElementById('btn-quit').click()); await wait(200); }
}
console.log('spiked target found:', found);
await wait(4500);
await page.evaluate(() => {
  const r = window.__bb.race;
  for (const b of r.boats) b.ai.think = 1e9;
  const p = r.player;
  const t = r.boats.find((b) => !b.isPlayer && b.has('spikes'));
  const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
  t.pos.set(p.pos.x + fx * 28 + fz * 4, 0, p.pos.z + fz * 28 - fx * 4);
  t.heading = p.heading; t.vel.set(0, 0, 0); t.speed = 0; t.invuln = 0;
  p.speed = 0; p.vel.set(0, 0, 0);
  window.__t = t;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(p.pos.x + fx * 14 + fz * 22, 9, p.pos.z + fz * 14 - fx * 22);
  c.lookAt(p.pos.x + fx * 16, 2, p.pos.z + fz * 16);
  r.useItem(p, 0);
});
await wait(160);
await page.screenshot({ path: 'tools/shots/g-1.png' });
await wait(260);
await page.screenshot({ path: 'tools/shots/g-2.png' });
console.log(await page.evaluate(() => window.__bb.race.hooks.map((h) => `${h.phase} anchor=${!!h.anchor}`).join(',')));
await browser.close();
