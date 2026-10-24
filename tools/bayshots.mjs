import { launch, startRace, waitForGo, wait } from './lib.mjs';

const tag = process.argv[2] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map: 'bay' });
await waitForGo(page);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; window.__bb.autopilot = true; });
await wait(2500);
await page.screenshot({ path: `tools/shots/bay-chase-${tag}.png` });
const views = [
  ['arch', (t) => { const k = Math.round(0.2 * t.N) - 25; const k2 = Math.round(0.2 * t.N) + 10; return [t.px[k] + t.nx[k] * 4, 5, t.pz[k] + t.nz[k] * 4, t.px[k2], 14, t.pz[k2]]; }],
  ['low', (t) => { const k = Math.round(0.6 * t.N); const k2 = Math.round(0.66 * t.N); return [t.px[k], 3, t.pz[k], t.px[k2], 12, t.pz[k2]]; }],
  ['aerial', (t) => [0, 260, 420, 0, 0, 100]],
  ['cliff', (t) => { const k = Math.round(0.33 * t.N); return [t.px[k], 6, t.pz[k], t.px[k], 50, t.pz[k] + 300]; }],
  ['cliff2', (t) => [-200, 30, 160, 100, 40, 520]],
];
await page.evaluate(() => { window.__bb.freeCam = true; });
for (const [name, fn] of views) {
  await page.evaluate(`(() => { const t = window.__bb.race.track; const [a,b,c,d,e,f] = (${fn.toString()})(t); const cam = window.__bb.camera; cam.position.set(a,b,c); cam.lookAt(d,e,f); })()`);
  await wait(400);
  await page.screenshot({ path: `tools/shots/bay-${name}-${tag}.png` });
}
await browser.close();
