import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => window.__bb.setup.items.splice(0, 2, 'flamethrower', 'missiles'));
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(6000);
await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer);
  v.pos.set(p.pos.x + Math.sin(p.heading) * 20, 0, p.pos.z + Math.cos(p.heading) * 20);
  p.invuln = 0;
  r.damage(p, 999, v, 'saw');
});
for (let i = 0; i < 4; i++) {
  await wait(i === 0 ? 60 : 250);
  const t = await page.evaluate(() => document.getElementById('game').style.transform);
  console.log('frame', i, 'transform', t);
  await page.screenshot({ path: `tools/shots/quake-${i}.png` });
}
await wait(1500);
console.log('after', JSON.stringify(await page.evaluate(() => document.getElementById('game').style.transform)));
await browser.close();
