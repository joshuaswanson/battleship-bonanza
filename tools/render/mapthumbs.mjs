import { launch, startRace, waitForGo, wait } from '../lib.mjs';

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
    let castle = null;
    window.__bb.scene.traverse((o) => {
      if (o.userData.castle) castle = o.userData.castle;
    });
    const t = window.__bb.race.track;
    const p = t.project(castle.x, castle.z);
    const k = p.idx - Math.round(30 / t.spacing);
    const from = t.point(k, Math.sign(p.lateral) * t.hw[t.wrap(k)] * 0.2);
    const c = window.__bb.camera;
    c.position.set(from.x, 8, from.z);
    c.lookAt(castle.x, 11, castle.z);
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
  canyon: () => {
    const t = window.__bb.race.track;
    const d = [...t.river.drops].sort((a, b) => b.height - a.height)[0];
    const s = d.s + 80;
    const k = Math.round(s / t.spacing) % t.N;
    const k2 = Math.round(d.s / t.spacing) % t.N;
    const y = t.level(s);
    const c = window.__bb.camera;
    c.position.set(t.px[k] + t.nx[k] * 7, y + 7, t.pz[k] + t.nz[k] * 7);
    c.lookAt(t.px[k2], y + 17, t.pz[k2]);
  },
  docks: () => {
    const t = window.__bb.race.track;
    const k = Math.round(0.9 * t.N);
    const k2 = Math.round(0.985 * t.N) % t.N;
    const from = t.point(k, t.hw[k] * 0.5);
    const to = t.point(k2, -t.hw[k2] * 0.55);
    const c = window.__bb.camera;
    c.position.set(from.x, 9, from.z);
    c.lookAt(to.x, 16, to.z);
  },
  midway: () => {
    let c = null;
    window.__bb.scene.traverse((o) => {
      if (o.userData.burningCarrier) c = o.userData.burningCarrier;
    });
    const cam = window.__bb.camera;
    cam.position.set(c.x + Math.cos(c.yaw) * 70 + Math.sin(c.yaw) * 60, 14, c.z - Math.sin(c.yaw) * 70 + Math.cos(c.yaw) * 60);
    cam.lookAt(c.x, 24, c.z);
  },
};
const only = process.argv[2]?.split(',');
for (const [map, aim] of Object.entries(shots)) {
  if (only && !only.includes(map)) continue;
  const { browser, page } = await launch({ width: 960, height: 600 });
  await startRace(page, { map });
  await waitForGo(page);
  await wait(map === 'midway' ? 4000 : 1500);
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
