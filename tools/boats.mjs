import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' || m.type() === 'warning' ? console.log(m.text()) : null);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(500);
await page.click('#btn-play');
const combos = (process.argv[2] ?? 'machinegun,laser;saw,missiles;jetpack,grapple;emp,mines;spikes,laser;armor,missiles;camo,saw').split(';');
for (const c of combos) {
  const items = c.split(',');
  await page.evaluate((items) => {
    const cards = [...document.querySelectorAll('.tile[aria-pressed="true"]')];
    for (const card of cards) card.click();
    for (const id of items) document.querySelector(`.tile[data-id="${id}"]`).click();
  }, items);
  await wait(900);
  const el = await page.$('.stage-col');
  await el.screenshot({ path: `tools/shots/boat-${items.join('-')}.png` });
}
await browser.close();
