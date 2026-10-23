import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'bay'; });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'flamethrower', 'missiles'));
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
await wait(4800);
console.log('AI flamethrowers when player has one:', await page.evaluate(() => window.__bb.race.boats.filter((b) => !b.isPlayer && b.has('flamethrower')).length));
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) { b.ai.think = 1e9; b.ai.base = 0; b.vel.set(0, 0, 0); b.speed = 0; }
  p.ai.base = 0;
  const others = r.boats.filter((b) => !b.isPlayer);
  others.forEach((o, i) => { o.items = ['spikes', 'camo'].includes(o.items[0]) ? o.items : o.items; o.pos.set(p.pos.x + 400 + i * 30, 0, p.pos.z + 400); });
  const v = others[0];
  v.items = ['spikes', 'jetpack'];
  v.pos.set(p.pos.x + Math.sin(p.heading) * 9, 0, p.pos.z + Math.cos(p.heading) * 9);
  v.heading = p.heading; v.hp = 100; v.lastFired = 1e9;
  window.__v = v;
  window.__bb.freeCam = true;
  const c = window.__bb.camera; const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  c.position.set(p.pos.x + lx * 16 - Math.sin(p.heading) * 4, 9, p.pos.z + lz * 16 - Math.cos(p.heading) * 4);
  c.lookAt(p.pos.x + Math.sin(p.heading) * 6, 1.5, p.pos.z + Math.cos(p.heading) * 6);
});
await page.keyboard.down('KeyO');
await wait(900);
await page.screenshot({ path: 'tools/shots/ft-race.png' });
await page.keyboard.up('KeyO');
const afterSpray = await page.evaluate(() => `hp=${window.__v.hp.toFixed(0)} burning=${!!window.__v.burn}`);
await wait(2000);
console.log('flame:', afterSpray, '-> 2s later', await page.evaluate(() => `hp=${window.__v.hp.toFixed(0)} burning=${!!window.__v.burn}`));
await page.screenshot({ path: 'tools/shots/ft-burn.png' });
// propane: put two boats next to the player, kill the player
console.log(await page.evaluate(async () => {
  const r = window.__bb.race; const p = r.player;
  const others = r.boats.filter((b) => !b.isPlayer).slice(0, 3);
  const before = others.map((o, i) => {
    const a = (i / 3) * Math.PI * 2;
    o.pos.set(p.pos.x + Math.cos(a) * 8, 0, p.pos.z + Math.sin(a) * 8);
    o.vel.set(0, 0, 0); o.hp = 100; o.invuln = 0; o.lastFired = 1e9;
    return { o, x: o.pos.x, z: o.pos.z };
  });
  const c = window.__bb.camera; c.position.set(p.pos.x + 30, 22, p.pos.z + 30); c.lookAt(p.pos.x, 0, p.pos.z);
  p.invuln = 0;
  r.damage(p, 999, others[0], 'saw');
  await new Promise((res) => setTimeout(res, 400));
  return 'blast: ' + before.map(({ o, x, z }) => `moved ${Math.hypot(o.pos.x - x, o.pos.z - z).toFixed(1)} hp ${o.hp.toFixed(0)}`).join(' | ') + ` exploded=${p.exploded} visible=${p.model.root.visible}`;
}));
await page.screenshot({ path: 'tools/shots/ft-blast.png' });
await wait(3000);
console.log('after respawn:', await page.evaluate(() => { const p = window.__bb.race.player; return `alive=${p.alive} exploded=${p.exploded} invuln=${p.invuln.toFixed(2)}`; }));
// missiles: different targets
console.log(await page.evaluate(async () => {
  const r = window.__bb.race; const p = r.player;
  const others = r.boats.filter((b) => !b.isPlayer && !b.has('camo'));
  others.forEach((o, i) => { o.pos.set(p.pos.x + Math.sin(p.heading) * (30 + i * 12), 0, p.pos.z + Math.cos(p.heading) * (30 + i * 12)); o.invuln = 0; });
  p.cooldowns = [0, 0]; p.disabled = 0;
  r.useItem(p, 1);
  await new Promise((res) => setTimeout(res, 700));
  return 'missile targets: ' + r.missiles.filter((m) => m.owner === p).map((m) => m.target?.name).join(', ');
}));
await browser.close();
