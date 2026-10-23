import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
await page.mouse.click(5, 5);
await startRace(page, { map: 'bay', items: ['machinegun', 'armor'] });
await waitForGo(page);
await isolate(page);
check('gun samples load', await page.evaluate(() => window.__bb.sfx.samples?.gun?.length === 3));
await page.evaluate(() => {
  const sfx = window.__bb.sfx;
  window.__shots = 0;
  const sample = sfx.sample.bind(sfx);
  sfx.sample = (...a) => {
    const ok = sample(...a);
    if (ok && a[0] === 'gun') window.__shots++;
    return ok;
  };
});
await page.keyboard.down('KeyO');
await wait(800);
await page.keyboard.up('KeyO');
const shots = await page.evaluate(() => window.__shots);
check('machine gun plays recorded shots', shots > 5, `${shots} shots`);
await browser.close();
