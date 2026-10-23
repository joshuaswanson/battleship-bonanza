import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.getElementById('btn-play').click());
for (let i = 0; i < 6; i++) {
  await new Promise((r) => setTimeout(r, 500));
  console.log((i + 1) * 500, await page.evaluate(() => document.getElementById('wipe').className));
}
await page.screenshot({ path: 'tools/shots/yard-hint-full.png' });
await browser.close();
