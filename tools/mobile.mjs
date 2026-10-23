import puppeteer, { KnownDevices } from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [label, setup] of [['iPhone', (p) => p.emulate(KnownDevices['iPhone 15 Pro'])], ['desktop', (p) => p.setViewport({ width: 1280, height: 760 })]]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await setup(page);
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(label, await page.evaluate(() => JSON.stringify({ coarse: matchMedia('(pointer: coarse)').matches, anyFine: matchMedia('(any-pointer: fine)').matches, touchOnly: document.body.classList.contains('touch-only'), playVisible: getComputedStyle(document.querySelector('.title-menu')).display !== 'none' })));
  await page.screenshot({ path: `tools/shots/mobile-${label}.png` });
  await page.close();
}
await browser.close();
