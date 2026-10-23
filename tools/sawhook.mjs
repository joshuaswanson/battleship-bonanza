import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; window.__bb.setup.items.splice(0, 2, 'grapple', 'armor'); });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(1500);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(1500);
await page.evaluate(() => document.getElementById('btn-go').click());
await wait(5000);
for (const [label, sawItems, facing] of [['saw side facing hook', true, true], ['saw side facing away', true, false], ['no saw', false, true]]) {
  const res = await page.evaluate(async ({ sawItems, facing }) => {
    facing = facing;
    const r = window.__bb.race; const p = r.player;
    for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; if (b !== p) b.pos.x += 3000; }
    p.ai.base = 0; p.vel.set(0, 0, 0); p.speed = 0; p.cooldowns = [0, 0];
    const v = r.boats.find((b) => !b.isPlayer && b.has('saw') === sawItems && !b.has('camo'));
    if (!v) return 'no matching boat';
    const front = v.items.indexOf('saw') !== 1;
    facing = (front === facing) ? Math.PI : 0;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    v.pos.set(p.pos.x + fx * 40, 0, p.pos.z + fz * 40); v.heading = p.heading + facing; v.invuln = 0;
    await new Promise((res) => setTimeout(res, 200));
    r.useItem(p, 0);
    await new Promise((res) => setTimeout(res, 900));
    const h = r.hooks.find((x) => x.owner === p);
    return h ? `phase=${h.phase} loose=${!!h.loose}` : 'hook gone';
  }, { sawItems, facing });
  console.log(label, res);
}
await browser.close();
