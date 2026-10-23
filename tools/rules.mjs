import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);

async function race(items) {
  await page.evaluate((items) => window.__bb.setup.items.splice(0, 2, ...items), items);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await wait(150);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await wait(4600);
  // Freeze the AI so only scripted actions happen.
  await page.evaluate(() => {
    const r = window.__bb.race;
    for (const b of r.boats) { b.ai.think = 1e9; b.hp = 100; b.invuln = 0; }
    window.__setup = (items, dist = 22, lateral = 0) => {
      const p = r.player;
      const t = r.boats.find((b) => !b.isPlayer);
      const others = r.boats.filter((b) => !b.isPlayer && b !== t);
      others.forEach((o, i) => { o.pos.set(p.pos.x + 300 + i * 20, 0, p.pos.z + 300); o.ko = 0; });
      t.items = items;
      t.model.missileMount ??= p.pos.clone().set(0, 1.2, 0);
      const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
      t.pos.set(p.pos.x + fx * dist - fz * lateral, 0, p.pos.z + fz * dist + fx * lateral);
      t.heading = p.heading; t.vel.set(0, 0, 0); t.speed = 0; t.hp = 100; p.hp = 100; t.invuln = 0; p.invuln = 0; t.ko = 0;
      p.cooldowns = [0, 0]; t.cooldowns = [0, 0];
      return t;
    };
  });
}
const ev = (fn, ...args) => page.evaluate(fn, ...args);

await race(['laser', 'emp']);
console.log('laser vs saw:', await ev(() => { const r = window.__bb.race; const t = __setup(['saw']); r.useItem(r.player, 0); return `player hp ${r.player.hp}, target hp ${t.hp}`; }));
console.log('laser vs plain:', await ev(() => { const r = window.__bb.race; const t = __setup(['spikes']); r.useItem(r.player, 0); return `player hp ${r.player.hp}, target hp ${t.hp}`; }));
console.log('laser vs armor:', await ev(() => { const r = window.__bb.race; const t = __setup(['armor']); r.useItem(r.player, 0); return `target hp ${t.hp}`; }));
await ev(() => { const r = window.__bb.race; const t = __setup(['missiles', 'grapple'], 30); t.heading += Math.PI; r.player.items = ['laser', 'emp']; window.__t = t; r.actions.missiles.call(r, t); return r.missiles[0]?.target?.name; }).then((x) => console.log('AI missile targets:', x));
await wait(250);
console.log('EMP vs missile:', await ev(() => { const r = window.__bb.race; r.useItem(r.player, 1); return 'used'; }));
await wait(600);
console.log('  after:', await ev(() => { const r = window.__bb.race; return `player hp ${r.player.hp}, missiles ${r.missiles.map((m) => 'fizzle=' + m.fizzle.toFixed(2) + ' tgt=' + (m.target?.name ?? 'none')).join(',')}`; }));

await page.keyboard.press('Escape'); await wait(100);
await ev(() => document.getElementById('btn-quit').click()); await wait(150);
await race(['machinegun', 'grapple']);
console.log('MG vs armor:', await ev(async () => { const r = window.__bb.race; const t = __setup(['armor'], 18); r.useItem(r.player, 0); await new Promise((res) => setTimeout(res, 1500)); return `target hp ${t.hp}`; }));
console.log('MG vs plain:', await ev(async () => { const r = window.__bb.race; const t = __setup(['camo'], 18); r.useItem(r.player, 0); await new Promise((res) => setTimeout(res, 1500)); return `target hp ${t.hp}`; }));
console.log('grapple vs plain:', await ev(() => { const r = window.__bb.race; __setup(['camo'], 40); r.useItem(r.player, 1); return `hook target ${r.hooks.at(-1).target?.name ?? 'none'}`; }));
console.log('grapple vs jetpack:', await ev(() => { const r = window.__bb.race; const t = __setup(['jetpack'], 40); r.player.cooldowns = [0, 0]; r.useItem(r.player, 1); return `hook target ${r.hooks.at(-1).target?.name ?? 'none'} (expected ${t.name})`; }));
await wait(700);
console.log('  hook phase:', await ev(() => window.__bb.race.hooks.map((h) => h.phase).join(',')));
console.log('missile vs camo player:', await ev(() => { const r = window.__bb.race; const t = __setup(['missiles'], 30); t.heading += Math.PI; r.player.items = ['camo', 'grapple']; r.actions.missiles.call(r, t); return `target ${r.missiles.at(-1).target?.name ?? 'none'}`; }));
await browser.close();
