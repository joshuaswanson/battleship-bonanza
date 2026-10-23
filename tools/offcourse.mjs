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
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
await wait(4600);
await page.keyboard.down('KeyW');
await page.keyboard.down('KeyD');
await wait(2500);
await page.keyboard.up('KeyD');
await wait(3500);
console.log(await page.evaluate(() => {
  const r = window.__bb.race; const p = r.player;
  const pr = r.track.project(p.pos.x, p.pos.z, p.trackIdx);
  return `lateral=${pr.lateral.toFixed(1)} offCourse=${p.offCourse.toFixed(1)}s speed=${p.speed.toFixed(1)} warning=${document.getElementById('hud-return').classList.contains('on')}`;
}));
await page.screenshot({ path: 'tools/shots/offcourse.png' });
await page.keyboard.up('KeyW');
await browser.close();
