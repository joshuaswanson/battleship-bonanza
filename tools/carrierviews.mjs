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
  [110, 30, 40, 0, 16, 0],
  [-90, 22, -60, 0, 18, 0],
  [60, 50, 140, 0, 18, 30],
  [30, 24, 20, 18, 30, 14],
  [-20, 25, -120, 0, 18, -80],
  [0, 110, 0, 0, 0, 1],
];
for (let i = 0; i < views.length; i++) {
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
