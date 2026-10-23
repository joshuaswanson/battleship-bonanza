import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1000, height: 640 } });
const page = await browser.newPage();
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'machinegun', 'emp'));
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(7000);
const shoot = async (name, fn) => {
  await page.evaluate((src) => {
    const r = window.__bb.race; const p = r.player;
    for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
    p.ai.base = 0; window.__bb.freeCam = true;
    const o = p.model.empOrb.getWorldPosition(p.pos.clone());
    const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
    const c = window.__bb.camera; c.position.set(o.x + lx * 4, o.y + 0.8, o.z + lz * 4); c.lookAt(o.x, o.y, o.z);
    new Function('p', src)(p);
  }, fn);
  await wait(150);
  await page.screenshot({ path: `tools/shots/${name}.png`, clip: { x: 300, y: 150, width: 400, height: 340 } });
};
await shoot('dbg-a', '');
await shoot('dbg-b', 'p.model.empHalo.visible = false;');
console.log(await page.evaluate(() => { const p = window.__bb.race.player; const c = p.model.empCore; return `core type=${c.type} children=${c.children.length} scale=${c.scale.x.toFixed(2)} mat=${c.material?.type}`; }));
await browser.close();
