import { launch, startRace, autopilot, waitForResults, wait, check } from './lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'bay' });
await autopilot(page, 8);
await waitForResults(page);
const song = await page.evaluate(() => window.__bb.sfx.musicLength('race'));
await page.evaluate(() => { window.__bb.steps = 8; });
await page.waitForFunction((song) => window.__bb.race.time > window.__bb.recorder.start + song + 10, { polling: 200, timeout: 120000 }, song);
await page.evaluate(() => { window.__bb.steps = 1; });
await page.evaluate(() => document.getElementById('btn-replay').click());
await page.waitForFunction(() => window.__bb.replay && !document.getElementById('replay-ui').classList.contains('hidden'), { polling: 100 });
const r = await page.evaluate(() => ({ start: window.__bb.recorder.start, end: window.__bb.replay.end, last: window.__bb.recorder.frames.at(-1).t }));
check('replay ends 1 s after the song', Math.abs(r.end - (r.start + 1 + song + 1)) < 0.01, JSON.stringify({ ...r, song }));
await wait(4000);
const sync = await page.evaluate(() => {
  const music = window.__bb.sfx.tracks.race;
  return { music: music.currentTime, replay: window.__bb.replay.time - window.__bb.recorder.start - 1, loop: music.loop, paused: music.paused };
});
check('song follows the replay', Math.abs(sync.music - sync.replay) < 0.3 && !sync.loop, JSON.stringify(sync));
await page.evaluate(() => { window.__bb.steps = 8; });
await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), { polling: 200, timeout: 120000 });
const after = await page.evaluate(() => ({ time: window.__bb.replay?.time, loop: window.__bb.sfx.tracks.race.loop }));
check('results return after the replay', after.loop, JSON.stringify(after));
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
