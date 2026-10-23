import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = 'tools/shots';
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });

await page.goto(url, { waitUntil: 'networkidle0' });
await wait(2500);
await shot('1-title');
await page.click('#btn-play');
await wait(1200);
await shot('2-loadout');
await page.evaluate(() => { window.__bb.setup.items.splice(0, 2, 'missiles', 'laser'); window.__bb.loadout.refresh(); });
await wait(600);
await shot('3-loadout-picked');
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(1500);
await shot('4-countdown');
await wait(3000);
await page.keyboard.down('KeyW');
await wait(3000);
await shot('5-racing');
await page.keyboard.press('KeyO');
await wait(250);
await shot('6-item1');
await page.keyboard.press('KeyP');
await wait(150);
await shot('7-item2');
await page.keyboard.down('KeyA');
await wait(1200);
await page.keyboard.up('KeyA');
await wait(4000);
await shot('8-later');
const state = await page.evaluate(() => document.getElementById('hud-place').textContent + ' ' + document.getElementById('hud-lap').textContent + ' ' + document.getElementById('hud-time').textContent);
console.log('HUD:', state);
console.log(logs.filter((l) => !l.includes('[vite]')).slice(0, 30).join('\n'));
await browser.close();
