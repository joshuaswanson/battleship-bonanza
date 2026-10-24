import { launch, startRace, waitForGo, wait } from './lib.mjs';

const shots = {
  bay: () => {
    const t = window.__bb.race.track;
    const k = Math.round(0.2 * t.N) - 30;
    const k2 = Math.round(0.2 * t.N) + 10;
    const c = window.__bb.camera;
    c.position.set(t.px[k] + t.nx[k] * 4, 6, t.pz[k] + t.nz[k] * 4);
    c.lookAt(t.px[k2], 13, t.pz[k2]);
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
  alps: () => {
    const t = window.__bb.race.track;
    const k = Math.round(0.12 * t.N);
    const k2 = Math.round(0.15 * t.N);
    const a = t.point(k, t.hw[k] + 10);
    const b = t.point(k2, -(t.hw[k2] + 80));
    const c = window.__bb.camera;
    c.position.set(a.x, 10, a.z);
    c.lookAt(b.x, 22, b.z);
  },
  venice: () => {
    let r = 0;
    window.__bb.scene.traverse((o) => {
      if (o.userData.rialto != null) r = o.userData.rialto;
    });
    const t = window.__bb.race.track;
    const k = r - Math.round(45 / t.spacing);
    const c = window.__bb.camera;
    c.position.set(t.px[k], 5, t.pz[k]);
    c.lookAt(t.px[r], 9, t.pz[r]);
  },
};
const only = process.argv[2]?.split(',');
for (const [map, aim] of Object.entries(shots)) {
  if (only && !only.includes(map)) continue;
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
