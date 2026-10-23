import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1000, height: 640 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
await wait(300);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'machinegun', 'emp'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
await wait(7000);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  p.ai.base = 0;
  window.__bb.freeCam = true;
  const o = p.model.empOrb.getWorldPosition(p.pos.clone());
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  const c = window.__bb.camera; c.position.set(o.x + lx * 5, o.y + 1.2, o.z + lz * 5); c.lookAt(o.x, o.y - 0.4, o.z);
});
console.log('fps', await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })));
console.log(await page.evaluate(() => { const fx = window.__bb.race.fx; return `arcs live=${fx.arcs.items.filter((i) => i.life > 0).length} halo=${window.__bb.race.player.model.empHalo.material.opacity.toFixed(2)}`; }));
for (let i = 0; i < 3; i++) { await wait(130); await page.screenshot({ path: `tools/shots/empidle-${i}.png` }); }
await browser.close();
