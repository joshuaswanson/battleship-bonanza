import { launch, startRace, autopilot, waitForResults, check } from './lib.mjs';

const maps = (process.argv[2] ?? 'bay,jungle').split(',');
for (const map of maps) {
  const { browser, page } = await launch();
  await startRace(page, { map });
  await autopilot(page);
  await waitForResults(page);
  const finished = await page.evaluate(() => window.__bb.race.boats.filter((b) => b.finished).length);
  check(`${map}: race finishes`, finished === 6, `${finished}/6 finished`);
  check(`${map}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
