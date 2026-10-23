import { launch, startRace, waitForGo, wait, check } from './lib.mjs';

const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
await page.mouse.click(5, 5);
await startRace(page, { map: 'bay' });
await waitForGo(page);
const gain = () => page.evaluate(() => window.__bb.sfx.engineGain.gain.value);
await wait(1200);
check('engine silent without W', (await gain()) < 0.005, (await gain()).toFixed(3));
await page.keyboard.down('KeyW');
await wait(1200);
check('engine plays while W is held', (await gain()) > 0.03, (await gain()).toFixed(3));
await page.keyboard.up('KeyW');
await wait(1200);
check('engine fades after W is released', (await gain()) < 0.005, (await gain()).toFixed(3));
await browser.close();
