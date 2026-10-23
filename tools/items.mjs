import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const url = 'http://localhost:5288/';
const out = 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(url, { waitUntil: 'networkidle0' });
await wait(800);

const pairs = (process.argv[2] ?? 'missiles,grapple;mines,emp;machinegun,saw;jetpack,laser;armor,camo').split(';').map((p) => p.split(','));
for (const items of pairs) {
  const tag = items.join('-');
  await page.evaluate((items) => {
    window.__bb.setup.items.splice(0, 2, ...items);
  }, items);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await wait(300);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await wait(4500);
  await page.keyboard.down('KeyW');
  await wait(1500);
  // Place a target 26 units ahead with spikes + jetpack in its logic, and make it drive.
  const info = await page.evaluate(() => {
    const race = window.__bb.race;
    const p = race.player;
    const t = race.boats.find((b) => !b.isPlayer);
    t.items = ['spikes', 'jetpack'];
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    t.pos.set(p.pos.x + fx * 26, 0, p.pos.z + fz * 26);
    t.heading = p.heading;
    t.trackIdx = p.trackIdx;
    t.vel.copy(p.vel);
    t.speed = p.speed * 0.8;
    t.hp = 100;
    window.__target = t;
    return { player: p.items, target: t.name };
  });
  for (let slot = 0; slot < 2; slot++) {
    const id = items[slot];
    const before = await page.evaluate(() => window.__target.hp);
    const used = await page.evaluate((slot) => window.__bb.race.useItem(window.__bb.race.player, slot), slot);
    await wait(id === 'mines' ? 100 : 350);
    await page.screenshot({ path: `${out}/item-${tag}-${id}-a.png` });
    await wait(900);
    await page.screenshot({ path: `${out}/item-${tag}-${id}-b.png` });
    const after = await page.evaluate(() => {
      const r = window.__bb.race;
      return { hp: window.__target.hp, missiles: r.missiles.length, mines: r.mines.length, hooks: r.hooks.map((h) => h.phase), air: !!r.player.air };
    });
    console.log(tag, id, 'used', used, 'target hp', before, '->', after.hp, JSON.stringify(after));
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Escape');
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-quit').click());
  await wait(300);
  await page.evaluate(() => document.getElementById('btn-back').click());
  await wait(300);
}
console.log(logs.filter((l) => !l.includes('[vite]')).slice(0, 30).join('\n'));
await browser.close();
