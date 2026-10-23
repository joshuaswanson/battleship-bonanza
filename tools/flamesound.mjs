import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
await page.mouse.click(5, 5);
await startRace(page, { map: 'bay', items: ['flamethrower', 'armor'] });
await waitForGo(page);
await isolate(page);
const level = () => page.evaluate(() => window.__bb.sfx.flame.out.gain.value);
await wait(400);
check('flamethrower silent when idle', (await level()) < 0.005);
await page.keyboard.down('KeyO');
const samples = [];
for (let i = 0; i < 8; i++) {
  await wait(100);
  samples.push(await level());
}
check('flamethrower roars steadily while held', Math.min(...samples.slice(2)) > 0.2, samples.map((x) => x.toFixed(2)).join(' '));
await page.keyboard.up('KeyO');
await wait(1000);
check('roar fades after release', (await level()) < 0.02, (await level()).toFixed(3));
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
