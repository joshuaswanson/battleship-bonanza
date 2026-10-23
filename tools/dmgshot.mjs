import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
await wait(200);
await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1400));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1400));
await wait(6000);
await page.evaluate(async () => {
  const r = window.__bb.race; const p = r.player;
  for (const b of r.boats) b.ai.think = 1e9;
  const v = r.boats.find((b) => !b.isPlayer);
  v.pos.set(p.pos.x + Math.sin(p.heading) * 18, 0, p.pos.z + Math.cos(p.heading) * 18);
  v.heading = p.heading; v.vel.set(0, 0, 0); v.speed = 0; v.invuln = 0; v.hp = 100;
  for (const amount of [2, 2, 2, 7, 2, 14, 2, 32]) {
    r.damage(v, amount, p, 'bullet');
    await new Promise((res) => setTimeout(res, 70));
  }
});
await wait(80);
console.log(await page.evaluate(() => [...document.querySelectorAll('.dmg')].map((e) => e.textContent).join(' ')));
await page.screenshot({ path: 'tools/shots/dmg.png' });
await browser.close();
