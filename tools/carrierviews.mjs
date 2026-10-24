import { launch, startRace, waitForGo, wait } from './lib.mjs';

const tag = process.argv[2] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map: 'midway' });
await waitForGo(page);
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
});
await wait(1500);
const views = [
  [38, 14, 95, 0, 14, 105],
  [38, 14, -95, 0, 14, -112],
  [-40, 12, 0, 0, 14, 0],
  [45, 18, 15, 16, 18, 15],
  [26, 34, 34, 14, 24, 14],
  [-30, 20, 108, 0, 16, 100],
  [30, 20, -118, 0, 16, -108],
  [0, 26, 60, 12, 24, 18],
];for (let i = 0; i < views.length; i++) {
  await page.evaluate((v) => {
    let c = null;
    window.__bb.scene.traverse((o) => {
      if (o.userData.carriers && !c) c = o.userData.carriers[1];
    });
    const [ex, ey, ez, tx, ty, tz] = v;
    const co = Math.cos(c.yaw);
    const si = Math.sin(c.yaw);
    const w = (lx, lz) => [c.x + lx * co + lz * si, c.z - lx * si + lz * co];
    const [cx, cz] = w(ex, ez);
    const [lx, lz] = w(tx, tz);
    const cam = window.__bb.camera;
    cam.position.set(cx, ey, cz);
    cam.lookAt(lx, ty, lz);
  }, views[i]);
  await wait(400);
  await page.screenshot({ path: `tools/shots/carrier-${i}-${tag}.png` });
}
console.log('errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
