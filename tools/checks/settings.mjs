import { launch, wait, check } from '../lib.mjs';

for (const [w, h] of [[1280, 760], [844, 390]]) {
  const { browser, page } = await launch({ width: w, height: h });
  await wait(2000);
  await page.screenshot({ path: `tools/shots/title-${w}.png` });
  await page.evaluate(() => document.getElementById('btn-settings').click());
  await wait(500);
  await page.screenshot({ path: `tools/shots/settings-${w}.png` });
  await page.evaluate(() => document.getElementById('btn-credits').click());
  await wait(300);
  await page.keyboard.press('Escape');
  await wait(300);
  const open = await page.evaluate(() => ['screen-settings', 'screen-credits'].filter((id) => !document.getElementById(id).classList.contains('hidden')));
  check(`${w}: Escape from credits returns to settings`, open.join() === 'screen-settings', open.join());
  check(`${w}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
