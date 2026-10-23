import { launch, openShipyard, wait } from './lib.mjs';

const items = (process.argv[2] ?? 'machinegun,jetpack').split(',');
const out = process.argv[3] ?? `tools/shots/shipyard-${items.join('-')}.png`;
const { browser, page } = await launch({ width: 1280, height: 800 });
await openShipyard(page, items);
await wait(800);
await page.screenshot({ path: out, clip: { x: 0, y: 60, width: 780, height: 420 } });
await browser.close();
