import puppeteer from 'puppeteer-core';
import path from 'node:path';
const files = process.argv.slice(3);
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', defaultViewport: { width: 1500, height: 900 } });
const page = await browser.newPage();
await page.goto('file://' + path.resolve('tools/render/sheet.html') + '#' + files.join(','));
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: process.argv[2], fullPage: true });
await browser.close();
