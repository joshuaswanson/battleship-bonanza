import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1600, height: 1100, deviceScaleFactor: 1.5 } });
const page = await browser.newPage();
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
  document.getElementById('game').style.display = 'none';
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  const screen = document.getElementById('screen-title');
  screen.style.background = 'none';
  for (const el of screen.querySelectorAll('.title-menu, .title-credit')) el.style.visibility = 'hidden';
});
await new Promise((r) => setTimeout(r, 300));
await (await page.$('.title-logo')).screenshot({ path: '.github/logo.png', omitBackground: true });
await browser.close();
