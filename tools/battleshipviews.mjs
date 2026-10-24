import { launch, startRace, waitForGo, wait } from './lib.mjs';

const tag = process.argv[2] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map: 'midway' });
await waitForGo(page);
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
});
await wait(2500);
const views = [
  [90, 25, 70, 0, 14, 0],
  [55, 14, -10, 0, 18, 30],
  [-40, 30, -110, 0, 10, -30],
  [20, 45, 20, 0, 22, 15],
];
for (let i = 0; i < views.length; i++) {
  await page.evaluate((v) => {
    let ship = null;
    window.__bb.scene.traverse((o) => {
      if (o.userData.battleships && !ship) ship = o.userData.battleships[0];
    });
    const [ex, ey, ez, tx, ty, tz] = v;
    const c = Math.cos(ship.yaw);
    const s = Math.sin(ship.yaw);
    const w = (lx, lz) => [ship.x + lx * c + lz * s, ship.z - lx * s + lz * c];
    const [cx, cz] = w(ex, ez);
    const [lx, lz] = w(tx, tz);
    const cam = window.__bb.camera;
    cam.position.set(cx, ey, cz);
    cam.lookAt(lx, ty, lz);
  }, views[i]);
  await wait(500);
  await page.screenshot({ path: `tools/shots/battleship-${i}-${tag}.png` });
}
console.log('errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
