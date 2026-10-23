import { launch, startRace, waitForGo, wait } from './lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'jungle' });
await waitForGo(page);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; window.__bb.freeCam = true; });
for (const [name, s, lat] of [['a', 300, -8], ['b', 900, 6], ['c', 1150, 0]]) {
  await page.evaluate(({ s, lat }) => {
    const t = window.__bb.race.track; const k = Math.round(s / t.spacing) % t.N; const k2 = Math.round((s + 40) / t.spacing) % t.N;
    const y = t.level(s); const c = window.__bb.camera;
    c.position.set(t.px[k] + t.nx[k] * lat, y + 4, t.pz[k] + t.nz[k] * lat);
    c.lookAt(t.px[k2] + t.nx[k2] * (lat > 0 ? 25 : -25), y + 3, t.pz[k2] + t.nz[k2] * (lat > 0 ? 25 : -25));
  }, { s, lat });
  await wait(400);
  await page.screenshot({ path: `tools/shots/bank-${name}.png` });
}
await browser.close();
