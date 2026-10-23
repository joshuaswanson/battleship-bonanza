import { launch, startRace, waitForGo, wait } from './lib.mjs';

const shots = {
  bay: () => {
    const t = window.__bb.race.track;
    const k = Math.round(t.N * 0.93);
    const k2 = Math.round(t.N * 0.02);
    const c = window.__bb.camera;
    c.position.set(t.px[k] + t.nx[k] * 45, 26, t.pz[k] + t.nz[k] * 45);
    c.lookAt(t.px[k2], 0, t.pz[k2]);
  },
  jungle: () => {
    const t = window.__bb.race.track;
    const d = t.river.drops.find((x) => x.height > 8);
    const s = d.s + 75;
    const k = Math.round(s / t.spacing) % t.N;
    const k2 = Math.round(d.s / t.spacing) % t.N;
    const y = t.level(s);
    const c = window.__bb.camera;
    c.position.set(t.px[k] + t.nx[k] * 6, y + 9, t.pz[k] + t.nz[k] * 6);
    c.lookAt(t.px[k2], y + 13, t.pz[k2]);
  },
};
for (const [map, aim] of Object.entries(shots)) {
  const { browser, page } = await launch({ width: 960, height: 600 });
  await startRace(page, { map });
  await waitForGo(page);
  await wait(1500);
  await page.evaluate(() => {
    document.getElementById('ui').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
  });
  await page.evaluate(`(${aim.toString()})()`);
  await wait(400);
  await page.screenshot({ path: `public/maps/${map}.jpg`, type: 'jpeg', quality: 82 });
  await browser.close();
}
