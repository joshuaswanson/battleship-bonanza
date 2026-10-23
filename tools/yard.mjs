import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[${m.type()}]`, m.text()));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (n) => page.screenshot({ path: `tools/shots/yard-${n}.png` });
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(600);
await page.click('#btn-play');
await wait(900);
await shot('1-open');
for (const t of await page.$$('.tile[aria-pressed="true"]')) await t.click();
await wait(400);
await page.hover('.tile[data-id="laser"]');
await page.click('.tile[data-id="laser"]');
await wait(300);
await shot('2-flying');
await wait(500);
await shot('3-dropping');
await page.click('.tile[data-id="missiles"]');
await wait(1600);
await shot('4-picked');
await page.keyboard.press('KeyQ');
await wait(200);
await shot('5-laser');
await page.keyboard.press('KeyE');
await wait(900);
await shot('6-missile');
await page.click('#btn-surprise');
await wait(1200);
await shot('7-spinning');
await wait(2500);
await shot('8-surprised');
await browser.close();
