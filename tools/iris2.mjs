import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 800 } });
const page = await browser.newPage();
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(1200);
await page.click('#btn-play');
await page.waitForFunction(() => document.getElementById('wipe').classList.contains('reveal'), { polling: 'raf' });
for (const [n, ms] of [[1, 120], [2, 260]]) {
  await page.evaluate((ms) => { for (const a of document.getAnimations()) if (a.animationName?.includes('open')) { a.pause(); a.currentTime = ms; } }, ms);
  await wait(100);
  await page.screenshot({ path: `tools/shots/irisopen-${n}.png` });
}
await browser.close();
