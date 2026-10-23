import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const wait = (t) => new Promise((r) => setTimeout(r, t));
async function scenario(items, key, place, victimItems = ['jetpack', 'machinegun'], shot) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
  await wait(300);
  await page.evaluate((items) => window.__bb.setup.items.splice(0, 2, ...items), items);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await wait(4800);
  await page.evaluate(({ place, victimItems }) => {
    const r = window.__bb.race; const p = r.player;
    for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
    p.ai.base = 0;
    const others = r.boats.filter((b) => !b.isPlayer);
    others.forEach((o, i) => o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400));
    const v = others[0];
    v.items = victimItems;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading), lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
    v.pos.set(p.pos.x + fx * place[0] + lx * place[1], 0, p.pos.z + fz * place[0] + lz * place[1]);
    v.heading = p.heading; v.hp = 100; v.invuln = 0; v.lastFired = 1e9;
    window.__v = v;
  }, { place, victimItems });
  await page.keyboard.down(key);
  await wait(1200);
  if (shot) await page.screenshot({ path: `tools/shots/${shot}.png` });
  await page.keyboard.up(key);
  const out = await page.evaluate(() => {
    const p = window.__bb.race.player;
    const yaws = p.model.swivels.map((s) => `${s.id}:${s.group.rotation.y.toFixed(2)}`).join(' ');
    return `victim hp=${window.__v.hp.toFixed(0)} | ${yaws}`;
  });
  await page.close();
  return out;
}
const cases = [
  ['front mg, target 30 ahead', ['machinegun', 'jetpack'], 'KeyO', [30, 0]],
  ['front mg, target 15 left-ahead 45deg', ['machinegun', 'jetpack'], 'KeyO', [12, 12]],
  ['back mg, target 25 behind-right', ['spikes', 'machinegun'], 'KeyP', [-18, -14], undefined, 'arc-backmg'],
  ['back mg, target 30 ahead', ['spikes', 'machinegun'], 'KeyP', [30, 0]],
  ['back laser, target behind', ['grapple', 'laser'], 'KeyP', [-25, 6]],
  ['back saw, target alongside-behind', ['camo', 'saw'], 'KeyP', [-2.5, 5.2]],
  ['back saw, target alongside-ahead', ['camo', 'saw'], 'KeyP', [3.5, 5.2]],
  ['front saw, target alongside-ahead', ['saw', 'camo'], 'KeyO', [1.5, 5.2]],
  ['front saw vs spikes', ['saw', 'camo'], 'KeyO', [1.5, 5.2], ['spikes', 'jetpack']],
  ['front flamethrower, target 45deg ahead', ['flamethrower', 'camo'], 'KeyO', [7, 7]],
  ['front mg, target 45deg ahead (control)', ['machinegun', 'camo'], 'KeyO', [7, 7]],
  ['back flamethrower, target behind', ['armor', 'flamethrower'], 'KeyP', [-10, 3], undefined, 'arc-backflame'],
];
for (const [label, items, key, place, victim, shot] of cases) console.log(label.padEnd(38), await scenario(items, key, place, victim, shot));
await browser.close();
