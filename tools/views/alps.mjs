import { launch, startRace, waitForGo, wait } from '../lib.mjs';

const tag = process.argv[2] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map: 'alps' });
await waitForGo(page);
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
});
const views = {
  valley: [0.45, 20, 18, 0.5, 120, 20],
  lake: [0.05, -10, 14, 0.15, -150, 40],
  slopes: [0.7, 15, 12, 0.72, 90, 30],
};
for (const [name, [f, lat, y, f2, lat2, y2]] of Object.entries(views)) {
  await page.evaluate(([f, lat, y, f2, lat2, y2]) => {
    const t = window.__bb.race.track;
    const k = Math.round(f * t.N);
    const k2 = Math.round(f2 * t.N);
    const a = t.point(k, Math.sign(lat) * (t.hw[k] + Math.abs(lat)));
    const b = t.point(k2, Math.sign(lat2) * (t.hw[k2] + Math.abs(lat2)));
    const cam = window.__bb.camera;
    cam.position.set(a.x, y, a.z);
    cam.lookAt(b.x, y2, b.z);
  }, [f, lat, y, f2, lat2, y2]);
  await wait(500);
  await page.screenshot({ path: `tools/shots/alps-${name}-${tag}.png` });
}
const fixed = {
  peak: [[0, 40, 150], [110, 150, 500]],
  cliffs: [[-150, 70, 0], [-400, 60, 200]],
  meadow: [[60, 14, -40], [140, 0, -60]],
};
for (const [name, [from, to]] of Object.entries(fixed)) {
  await page.evaluate(([from, to]) => {
    const cam = window.__bb.camera;
    cam.position.set(...from);
    cam.lookAt(...to);
  }, [from, to]);
  await wait(500);
  await page.screenshot({ path: `tools/shots/alps-${name}-${tag}.png` });
}
await browser.close();
