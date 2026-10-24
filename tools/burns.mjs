import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

const map = process.argv[2] ?? 'bay';
const { browser, page } = await launch();
await startRace(page, { map });
await waitForGo(page);
await isolate(page);
const found = await page.evaluate(() => {
  const { THREE, race } = window.__bb;
  const p = race.player.pos;
  let best = null;
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    const hit = race.surfaceHit(new THREE.Vector3(p.x, 2, p.z), new THREE.Vector3(p.x + Math.cos(a) * 250, 2, p.z + Math.sin(a) * 250));
    if (hit && (!best || hit.point.distanceTo(p) < best.point.distanceTo(p))) best = hit;
  }
  if (!best) return null;
  const n = best.normal;
  const side = new THREE.Vector3(-n.z, 0, n.x).normalize();
  for (let k = 0; k < 30; k++) {
    const at = best.point.clone().addScaledVector(side, (k - 15) * 0.3).add(new THREE.Vector3(0, Math.sin(k * 0.3) * 0.8, 0));
    race.fx.impact('burn', at, n, 0.8 + Math.random() * 0.3);
  }
  window.__bb.freeCam = true;
  document.getElementById('hud').style.display = 'none';
  const cam = window.__bb.camera;
  cam.position.copy(best.point).addScaledVector(n, 9).add(new THREE.Vector3(0, 1.5, 0));
  cam.lookAt(best.point);
  return true;
});
check('found a wall to burn', !!found);
await wait(300);
await page.screenshot({ path: `tools/shots/burns-hot-${map}.png` });
await wait(9000);
await page.screenshot({ path: `tools/shots/burns-cool-${map}.png` });
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
