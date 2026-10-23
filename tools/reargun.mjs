import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
async function trial(items, key, behind, label, shot) {
  await page.evaluate((items) => window.__bb.setup.items.splice(0, 2, ...items), items);
  await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
  await wait(4600);
  await page.evaluate((behind) => {
    const r = window.__bb.race; const p = r.player;
    for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; b.gun.trigger = false; b.laser.trigger = false; }
    p.ai.base = 0;
    const others = r.boats.filter((b) => !b.isPlayer);
    others.forEach((o, i) => o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400));
    const v = others[0];
    v.items = ['spikes', 'jetpack']; v.hp = 100; v.invuln = 0;
    const d = behind ? -24 : 24;
    v.pos.set(p.pos.x + Math.sin(p.heading) * d, 0, p.pos.z + Math.cos(p.heading) * d);
    v.heading = p.heading;
    window.__v = v;
    window.__bb.freeCam = true;
    const c = window.__bb.camera; const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
    c.position.set(p.pos.x + lx * 22, 12, p.pos.z + lz * 22);
    c.lookAt(p.pos.x, 1, p.pos.z);
  }, behind);
  await wait(800);
  await page.keyboard.down(key);
  await wait(1300);
  if (shot) await page.screenshot({ path: `tools/shots/${shot}.png` });
  await page.keyboard.up(key);
  console.log(label, await page.evaluate(() => `target hp ${window.__v.hp}`));
  await page.keyboard.press('Escape');
  await wait(100);
  await page.evaluate(() => document.getElementById('btn-quit').click());
  await wait(300);
}
await trial(['laser', 'machinegun'], 'KeyP', true, 'rear MG vs boat behind:', 'rear-mg');
await trial(['laser', 'machinegun'], 'KeyP', false, 'rear MG vs boat ahead:', null);
await trial(['machinegun', 'laser'], 'KeyP', true, 'rear laser vs boat behind:', 'rear-laser');
await trial(['laser', 'machinegun'], 'KeyO', false, 'front laser vs boat ahead:', null);
await browser.close();
