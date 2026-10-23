import { launch, startRace, waitForGo, wait, check } from './lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'jungle' });
await waitForGo(page);
await page.evaluate(() => {
  const r = window.__bb.race;
  const t = r.track;
  const p = r.player;
  const k = Math.round((t.river.tunnelIn - 40) / t.spacing) % t.N;
  p.pos.set(t.px[k], 0, t.pz[k]);
  p.heading = t.heading(k);
  p.speed = 40;
  p.vel.set(Math.sin(p.heading) * 40, 0, Math.cos(p.heading) * 40);
  p.trackIdx = k;
  p.trackS = k * t.spacing;
  p.surfaceLevel = null;
  window.__bb.cam.snap = true;
  for (const b of r.boats) if (b !== p) b.pos.x += 3000;
  window.__bb.autopilot = true;
});
const samples = [];
for (let i = 0; i < 14; i++) {
  await wait(250);
  samples.push(await page.evaluate(() => ({ y: window.__bb.race.player.pos.y, cam: window.__bb.camera.position.y })));
  if (i % 3 === 0) await page.screenshot({ path: `tools/shots/river-${i}.png` });
}
const jump = samples.findIndex((s, i) => i > 0 && s.y - samples[i - 1].y > 30);
check('boat is lifted inside the cave', jump > 0);
check('camera moves with the boat', jump > 0 && Math.abs(samples[jump].cam - samples[jump].y - (samples[jump - 1].cam - samples[jump - 1].y)) < 4);
await page.evaluate(() => {
  const r = window.__bb.race;
  const t = r.track;
  const p = r.player;
  const big = t.river.drops.find((d) => d.height > 8);
  const k = Math.round((big.s - 30) / t.spacing) % t.N;
  p.pos.set(t.px[k], 0, t.pz[k]);
  p.heading = t.heading(k);
  p.vel.set(Math.sin(p.heading) * 40, 0, Math.cos(p.heading) * 40);
  p.trackIdx = k;
  p.trackS = k * t.spacing;
  p.surfaceLevel = null;
  window.__bb.cam.snap = true;
});
let fell = false;
for (let i = 0; i < 12 && !fell; i++) {
  await wait(150);
  fell = await page.evaluate(() => !!window.__bb.race.player.air?.fall);
}
check('boat flies off the waterfall', fell);
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
