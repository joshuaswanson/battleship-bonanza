import { launch, wait } from '../lib.mjs';

const { browser, page } = await launch({ width: 1280, height: 760 });
await wait(2500);
await page.screenshot({ path: 'tools/shots/title.png' });
await browser.close();
