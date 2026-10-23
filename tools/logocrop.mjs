import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => {
  const s = document.createElement('div');
  s.style.cssText = 'position:fixed;left:720px;top:0;width:2px;height:100%;background:magenta;z-index:99';
  document.body.append(s);
});
await (await page.$('.title-logo')).screenshot({ path: 'tools/shots/logo-crop.png' });
await browser.close();
