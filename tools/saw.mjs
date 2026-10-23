import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'saw', 'jetpack'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
await wait(4600);
// Park a victim beside the player and watch the saw work.
const out = await page.evaluate(async () => {
  const r = window.__bb.race;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; }
  const p = r.player;
  p.ai.base = 0;
  const v = r.boats.find((b) => !b.isPlayer);
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  v.pos.set(p.pos.x + lx * 5.2 + Math.sin(p.heading) * 1.5, 0, p.pos.z + lz * 5.2 + Math.cos(p.heading) * 1.5);
  v.heading = p.heading; v.hp = 100; v.invuln = 0; v.items = ['spikes', 'laser']; v.vel.set(0, 0, 0); v.speed = 0; p.vel.set(0, 0, 0); p.speed = 0;
  window.__v = v;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(p.pos.x - Math.sin(p.heading) * 12 - lx * 6, 9, p.pos.z - Math.cos(p.heading) * 12 - lz * 6);
  c.lookAt(p.pos.x + lx * 2, 1.5, p.pos.z + lz * 2);
  return 'placed';
});
for (let i = 0; i < 8; i++) {
  await wait(180);
  console.log(await page.evaluate(() => {
    const r = window.__bb.race; const p = r.player; const v = window.__v;
    const blade = p.model.saw.getWorldPosition(p.pos.clone());
    const pivot = p.model.sawYaw.getWorldPosition(p.pos.clone());
    return `yaw=${p.sawState.yaw.toFixed(2)} spin=${p.sawState.spin.toFixed(1)} bladeDist=${v.distanceToAxis(blade).toFixed(2)} pivotDist=${v.distanceToAxis2D(pivot.x, pivot.z).toFixed(2)} hp=${v.hp} vy=${(v.yOffset - p.yOffset).toFixed(2)} bladeY=${blade.y.toFixed(2)} vCenterY=${v.center().y.toFixed(2)}`;
  }));
}
await page.screenshot({ path: 'tools/shots/saw-race.png' });
console.log('victim hp after 1.5s next to saw:', await page.evaluate(() => window.__v.hp));
await browser.close();
