import puppeteer from 'puppeteer-core';
const [items, key = '', delay = '0', name = 'demo'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.click('#btn-play');
await page.evaluate((items) => {
  window.__bb.setup.items.splice(0, 2, ...items.split(','));
  window.__bb.loadout.refresh();
}, items);
await wait(1500);
if (key) await page.keyboard.press(key);
await wait(Number(delay));
await (await page.$('#stage')).screenshot({ path: `tools/shots/${name}.png` });
await browser.close();
