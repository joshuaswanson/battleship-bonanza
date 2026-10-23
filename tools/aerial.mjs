import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));
await page.evaluate(() => { document.getElementById('ui').style.display = 'none'; window.__bb.freeCam = true; const c = window.__bb.camera; c.position.set(0, 520, 380); c.lookAt(0, 0, 80); c.far = 3000; c.updateProjectionMatrix(); });
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: 'tools/shots/aerial.png' });
await browser.close();
