import { launch, wait, check } from './lib.mjs';

const { browser, page } = await launch();
await wait(1500);
await page.screenshot({ path: 'tools/shots/title-nudge.png' });
check('nudge shows before any input', await page.evaluate(() => !document.getElementById('sound-nudge').classList.contains('hidden')));
await page.click('#sound-nudge');
await wait(600);
check('title music starts after tapping the nudge', await page.evaluate(() => !window.__bb.sfx.tracks.menu.paused));
check('nudge hides', await page.evaluate(() => document.getElementById('sound-nudge').classList.contains('hidden')));
check('still on the title', await page.evaluate(() => !document.getElementById('screen-title').classList.contains('hidden')));
await browser.close();
