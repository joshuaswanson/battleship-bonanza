import { launch, startRace, waitForGo, isolate, wait } from '../lib.mjs';

const map = process.argv[2] ?? 'bay';
const tag = process.argv[3] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map });
await waitForGo(page);
await isolate(page);
const count = await page.evaluate(() => window.__bb.race.track.islands.length);
for (let n = 0; n < count; n++) {
  await page.evaluate((n) => {
    const t = window.__bb.race.track;
    const island = t.islands[n];
    const p = window.__bb.race.player;
    const i = t.wrap(island.start - Math.round(30 / t.spacing));
    p.pos.set(t.px[i], p.pos.y, t.pz[i]);
    p.trackIdx = i;
    p.heading = t.heading(i);
    p.vel.set(0, 0, 0);
    p.speed = 0;
    window.__bb.cam.snap = true;
  }, n);
  await wait(400);
  await page.screenshot({ path: `tools/shots/split-${map}-${n}-race-${tag}.png` });
  await page.evaluate((n) => {
    const t = window.__bb.race.track;
    const island = t.islands[n];
    const mid = t.wrap(island.start + Math.round(island.len / 2));
    const before = t.wrap(island.start - Math.round(60 / t.spacing));
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
    const c = window.__bb.camera;
    c.position.set(t.px[before], t.level(before * t.spacing) + 70, t.pz[before]);
    c.lookAt(t.px[mid], t.level(mid * t.spacing), t.pz[mid]);
  }, n);
  await wait(500);
  await page.screenshot({ path: `tools/shots/split-${map}-${n}-aerial-${tag}.png` });
  await page.evaluate((n) => {
    const t = window.__bb.race.track;
    const island = t.islands[n];
    const at = t.wrap(island.start - Math.round(25 / t.spacing));
    const mid = t.wrap(island.start + Math.round(island.len * 0.3));
    const c = window.__bb.camera;
    c.position.set(t.px[at], t.level(at * t.spacing) + 6, t.pz[at]);
    c.lookAt(t.px[mid], t.level(mid * t.spacing) + 3, t.pz[mid]);
  }, n);
  await wait(400);
  await page.screenshot({ path: `tools/shots/split-${map}-${n}-fork-${tag}.png` });
  await page.evaluate(() => {
    document.getElementById('hud').style.display = '';
    window.__bb.freeCam = false;
  });
}
console.log('islands', count, 'errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
