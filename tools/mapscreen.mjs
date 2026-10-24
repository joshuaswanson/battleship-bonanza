import { launch, openShipyard, wait } from './lib.mjs';

for (const [w, h] of (process.argv[2] ?? '1280x760,1101x514').split(',').map((s) => s.split('x').map(Number))) {
  const { browser, page } = await launch({ width: w, height: h });
  await openShipyard(page);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await page.waitForFunction(() => !document.getElementById('screen-maps').classList.contains('hidden') && !document.getElementById('wipe').classList.contains('on'), { polling: 100 });
  await wait(900);
  await page.screenshot({ path: `tools/shots/mapscreen-${w}.png` });
  await browser.close();
}
