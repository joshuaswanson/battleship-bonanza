import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; window.__bb.setup.items.splice(0, 2, 'saw', 'camo'); });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(1400);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(1400);
await page.evaluate(() => document.getElementById('btn-go').click());
await wait(5000);
for (const [label, ahead, side] of [['25 ahead, 20 left', 25, 20], ['25 ahead, 20 right', 25, -20], ['behind', -20, 5]]) {
  await page.evaluate(({ ahead, side }) => {
    const r = window.__bb.race; const p = r.player;
    for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
    p.ai.base = 0;
    const others = r.boats.filter((b) => !b.isPlayer);
    others.forEach((o, i) => o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400));
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading), lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
    others[0].pos.set(p.pos.x + fx * ahead + lx * side, 0, p.pos.z + fz * ahead + lz * side);
  }, { ahead, side });
  await wait(800);
  console.log(label, 'saw yaw', await page.evaluate(() => window.__bb.race.player.sawState.yaw.toFixed(2)));
}
await browser.close();
