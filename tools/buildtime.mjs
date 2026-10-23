import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  window.__long = [];
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
});
const t0 = Date.now();
await page.goto('http://localhost:5288/', { waitUntil: 'load' });
console.log('load event', Date.now() - t0, 'ms');
await new Promise((r) => setTimeout(r, 6000));
console.log('long tasks [start, ms]:', JSON.stringify(await page.evaluate(() => window.__long.filter((x) => x[1] > 80))));
await browser.close();
