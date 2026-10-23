import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 300)); });
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'jungle'; });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(5000);
// outside view of entrance
await page.evaluate(() => {
  const t = window.__bb.race.track; const k = Math.round((t.river.tunnelIn - 70) / t.spacing) % t.N;
  window.__bb.freeCam = true;
  const c = window.__bb.camera; const y = t.level(t.river.tunnelIn - 70);
  c.position.set(t.px[k] + t.nx[k] * 10, y + 14, t.pz[k] + t.nz[k] * 10);
  const k2 = Math.round(t.river.tunnelIn / t.spacing) % t.N;
  c.lookAt(t.px[k2], y + 8, t.pz[k2]);
});
await wait(300);
await page.screenshot({ path: 'tools/shots/tunnel-entrance.png' });
await page.evaluate(() => {
  const t = window.__bb.race.track; const k = Math.round((t.river.tunnelOut + 60) / t.spacing) % t.N;
  const c = window.__bb.camera; const y = t.level(t.river.tunnelOut + 60);
  c.position.set(t.px[k] + t.nx[k] * 8, y + 12, t.pz[k] + t.nz[k] * 8);
  const k2 = Math.round(t.river.tunnelOut / t.spacing) % t.N;
  c.lookAt(t.px[k2], y + 6, t.pz[k2]);
});
await wait(300);
await page.screenshot({ path: 'tools/shots/tunnel-exit.png' });
await page.evaluate(() => {
  window.__bb.freeCam = false;
  const r = window.__bb.race; const t = r.track; const p = r.player;
  const k = Math.round((t.river.tunnelIn - 40) / t.spacing) % t.N;
  p.pos.set(t.px[k], 0, t.pz[k]); p.heading = t.heading(k); p.speed = 40; p.vel.set(Math.sin(p.heading) * 40, 0, Math.cos(p.heading) * 40);
  p.trackIdx = k; p.trackS = k * t.spacing; p.surfaceLevel = null; window.__bb.cam.snap = true;
  for (const b of r.boats) if (b !== p) b.pos.x += 2000;
  window.__bb.autopilot = true;
});
for (let i = 0; i < 12; i++) {
  await wait(300);
  const s = await page.evaluate(() => { const r = window.__bb.race; const p = r.player; return `s=${p.trackS.toFixed(0)} y=${p.pos.y.toFixed(1)} camY=${window.__bb.camera.position.y.toFixed(1)}`; });
  console.log(i, s);
  await page.screenshot({ path: `tools/shots/tunnel-${i}.png` });
}
await browser.close();
