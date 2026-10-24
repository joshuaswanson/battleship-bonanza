import { launch, startRace, autopilot, waitForResults, wait, fps, check } from '../lib.mjs';

const map = process.argv[2] ?? 'jungle';
const { browser, page } = await launch();
await startRace(page, { map });
await autopilot(page);
await waitForResults(page);
await page.click('#btn-replay');
await wait(1500);
check('replay is playing', await page.evaluate(() => !document.getElementById('replay-ui').classList.contains('hidden')));
for (let i = 0; i < 6; i++) {
  await page.screenshot({ path: `tools/shots/replay-${map}-${i}.png` });
  await wait(2500);
}
const rate = await fps(page);
check('replay frame rate', rate >= 55, `${rate} fps`);
await page.click('#btn-replay-exit');
await wait(1500);
check('back to results', await page.evaluate(() => !document.getElementById('screen-results').classList.contains('hidden')));
await page.screenshot({ path: `tools/shots/results-${map}.png` });
await page.click('#btn-continue');
await wait(1800);
check('continue goes to the shipyard', await page.evaluate(() => !document.getElementById('screen-loadout').classList.contains('hidden')));
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
