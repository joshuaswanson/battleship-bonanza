import { launch, startRace, wait, check } from './lib.mjs';

const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
await page.mouse.click(5, 5);
await wait(800);
const playing = () => page.evaluate(() => Object.entries(window.__bb.sfx.tracks).filter(([, a]) => !a.paused).map(([n]) => n).join(',') || 'none');
check('menu music on the title', (await playing()) === 'menu');
await startRace(page, { map: 'bay' });
await wait(500);
check('race music during a race', (await playing()) === 'race');
await page.keyboard.press('Escape');
await wait(300);
check('race music ducks when paused', await page.evaluate(() => window.__bb.sfx.tracks.race.volume < 0.2));
await page.click('#btn-menu');
await wait(1500);
check('menu music back on the title', (await playing()) === 'menu');
await browser.close();
