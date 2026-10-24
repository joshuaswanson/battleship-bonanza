import { launch, startRace, waitForGo, isolate, wait, check } from '../lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'bay', items: ['laser', 'armor'] });
await waitForGo(page);
await isolate(page);
await page.keyboard.down('KeyO');
let worst = 0;
for (let i = 0; i < 12; i++) {
  await wait(150);
  worst = Math.max(worst, await page.evaluate(() => {
    const { THREE } = window.__bb;
    const m = window.__bb.race.player.model;
    const barrel = new THREE.Vector3(0, 0, 1).applyQuaternion(m.modules.laser.getWorldQuaternion(new THREE.Quaternion()));
    const beam = window.__bb.race.lastLaserDir;
    return beam ? barrel.angleTo(beam) : 0;
  }));
}
await page.evaluate(() => {
  const p = window.__bb.race.player;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  c.position.set(p.pos.x + lx * 9, p.pos.y + 3, p.pos.z + lz * 9);
  c.lookAt(p.pos.x + Math.sin(p.heading) * 6, p.pos.y, p.pos.z + Math.cos(p.heading) * 6);
});
await wait(150);
await page.screenshot({ path: 'tools/shots/laser-aim.png' });
check('laser barrel matches the beam', worst < 0.01, `worst ${(worst * 57.3).toFixed(2)}°`);
await browser.close();
