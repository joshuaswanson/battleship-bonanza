import { launch, startRace, waitForGo, wait } from './lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'midway' });
await waitForGo(page);
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
  let ship = null;
  window.__bb.scene.traverse((o) => {
    if (o.userData.battleships && !ship) ship = o.userData.battleships[0];
  });
  const c = Math.cos(ship.yaw);
  const s = Math.sin(ship.yaw);
  const w = (lx, lz) => [ship.x + lx * c + lz * s, ship.z - lx * s + lz * c];
  const [cx, cz] = w(95, 5);
  const [tx, tz] = w(0, 5);
  const cam = window.__bb.camera;
  cam.position.set(cx, 16, cz);
  cam.lookAt(tx, 16, tz);
});
await wait(1500);
await page.evaluate(() => {
  let list = null;
  window.__bb.scene.traverse((o) => {
    if (o.userData.turrets) list = o.userData.turrets;
  });
  for (const tu of list.filter((t) => t.ship === 0)) {
    tu.targetYaw = tu.yaw;
    tu.targetPitch = tu.pitch;
    tu.retarget = 0;
    tu.cool = 0;
  }
});
for (let i = 0; i < 16; i++) {
  await wait(60);
  await page.screenshot({ path: `tools/shots/broadside-${String(i).padStart(2, '0')}.png` });
}
console.log('errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
