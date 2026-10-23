import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'jetpack', 'machinegun'));
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(4600);
// Fire an enemy missile at the player from behind, then jump at different times.
const trial = (jumpEta) => page.evaluate(async (jumpEta) => {
  const r = window.__bb.race;
  for (const b of r.boats) { b.ai.think = 1e9; b.gun.trigger = false; }
  const p = r.player;
  p.hp = 100; p.invuln = 0; p.cooldowns = [0, 0]; p.air = null;
  const shooter = r.boats.find((b) => !b.isPlayer);
  shooter.model.missileMount ??= shooter.model.body;
  shooter.pos.set(p.pos.x - Math.sin(p.heading) * 40, 0, p.pos.z - Math.cos(p.heading) * 40);
  shooter.heading = p.heading;
  r.actions.missiles.call(r, shooter);
  const m = r.missiles.at(-1);
  m.target = p;
  for (let i = 0; i < 400; i++) {
    await new Promise((res) => requestAnimationFrame(res));
    const t = r.incomingThreats(p).find((x) => x.m === m);
    if (!t) break;
    if (t.eta < jumpEta) { r.useItem(p, 0); break; }
  }
  await new Promise((res) => setTimeout(res, 2500));
  return `jump at eta<${jumpEta}: hp ${p.hp}`;
}, jumpEta);
console.log(await trial(0.3));
console.log(await trial(1.5));
const feed = await page.evaluate(() => document.getElementById('hud-feed').textContent);
console.log('feed:', feed);
await page.click('#btn-pause');
await wait(300);
await page.screenshot({ path: 'tools/shots/pause.png' });
await page.click('#btn-menu');
await wait(500);
console.log('title visible:', await page.evaluate(() => !document.getElementById('screen-title').classList.contains('hidden')));
await browser.close();
