import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(300);
await page.evaluate(() => { window.__bb.map = 'jungle'; });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
const t0 = Date.now();
await page.evaluate(() => document.getElementById('btn-start').click());
console.log('start click took', Date.now() - t0, 'ms');
await wait(1500);
await page.screenshot({ path: 'tools/shots/jungle-start.png' });
const info = await page.evaluate(() => { const t = window.__bb.race.track; return `length=${t.length.toFixed(0)} falls=${t.river.falls.toFixed(0)} lift=${t.river.liftStart.toFixed(0)}-${t.river.liftEnd.toFixed(0)}`; });
console.log(info);
await wait(4000);
await page.screenshot({ path: 'tools/shots/jungle-race.png' });
// aerial over falls
await page.evaluate(() => {
  const r = window.__bb.race; const t = r.track; const i = Math.floor(t.river.falls / t.spacing);
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(t.px[i] + t.nx[i] * 70 + t.tx[i] * 40, 45, t.pz[i] + t.nz[i] * 70 + t.tz[i] * 40);
  c.lookAt(t.px[i] + t.tx[i] * 10, 8, t.pz[i] + t.tz[i] * 10);
});
await wait(500);
await page.screenshot({ path: 'tools/shots/jungle-falls.png' });
await page.evaluate(() => {
  const r = window.__bb.race; const t = r.track; const i = Math.floor((t.river.liftStart + t.river.liftEnd) / 2 / t.spacing);
  const c = window.__bb.camera;
  c.position.set(t.px[i] + t.nx[i] * 60, 40, t.pz[i] + t.nz[i] * 60);
  c.lookAt(t.px[i], 10, t.pz[i]);
});
await wait(500);
await page.screenshot({ path: 'tools/shots/jungle-lift.png' });
await page.evaluate(() => { const c = window.__bb.camera; c.position.set(0, 600, 120); c.lookAt(0, 0, 130); });
await wait(500);
await page.screenshot({ path: 'tools/shots/jungle-aerial.png' });
// player falls test
await page.evaluate(() => {
  window.__bb.freeCam = false;
  const r = window.__bb.race; const t = r.track; const p = r.player;
  const i = t.wrap(Math.floor(t.river.falls / t.spacing) - 30);
  p.pos.set(t.px[i], 0, t.pz[i]); p.heading = t.heading(i); p.speed = 40; p.vel.set(Math.sin(p.heading) * 40, 0, Math.cos(p.heading) * 40);
  p.trackIdx = i; p.trackS = i * t.spacing; p.surfaceLevel = null;
  window.__bb.autopilot = true;
});
for (let k = 0; k < 6; k++) {
  await wait(250);
  const s = await page.evaluate(() => { const p = window.__bb.race.player; return `y=${p.pos.y.toFixed(1)} yOff=${p.yOffset.toFixed(1)} fall=${!!p.air?.fall} lvl=${p.surfaceLevel?.toFixed(1)}`; });
  console.log('fall', k, s);
  if (k === 1 || k === 3) await page.screenshot({ path: `tools/shots/jungle-fall${k}.png` });
}
await browser.close();
