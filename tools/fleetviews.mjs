import { launch, startRace, waitForGo, wait } from './lib.mjs';

const tag = process.argv[2] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map: 'midway' });
await waitForGo(page);
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
});
await wait(2000);
const shots = {
  carrier: [0.62, -1, 120, 30, 0.62, -1, 30, 18],
  carrier2: [0.14, 1, 40, 45, 0.16, 1, 80, 20],
  destroyer: [0.04, -1, 5, 12, 0.06, -1, 30, 8],
  destroyer2: [0.48, 1, 0, 10, 0.5, 1, 30, 6],
  deck: [0.62, -1, 45, 32, 0.6, -1, 85, 18],
};
for (const [name, [f, side, lat, y, f2, side2, lat2, y2]] of Object.entries(shots)) {
  await page.evaluate(([f, side, lat, y, f2, side2, lat2, y2]) => {
    const t = window.__bb.race.track;
    const k = Math.round(f * t.N);
    const k2 = Math.round(f2 * t.N);
    const a = t.point(k, side * (t.hw[k] + lat));
    const b = t.point(k2, side2 * (t.hw[k2] + lat2));
    const cam = window.__bb.camera;
    cam.position.set(a.x, y, a.z);
    cam.lookAt(b.x, y2, b.z);
  }, [f, side, lat, y, f2, side2, lat2, y2]);
  await wait(500);
  await page.screenshot({ path: `tools/shots/fleet-${name}-${tag}.png` });
}
console.log('errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
