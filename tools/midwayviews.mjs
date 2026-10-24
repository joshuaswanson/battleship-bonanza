import { launch, startRace, waitForGo, wait } from './lib.mjs';

const tag = process.argv[2] ?? 'a';
const { browser, page } = await launch();
const t0 = Date.now();
await startRace(page, { map: 'midway' });
console.log('built in', ((Date.now() - t0) / 1000).toFixed(1), 's');
await waitForGo(page);
await page.evaluate(() => { window.__bb.autopilot = true; });
await wait(3000);
await page.screenshot({ path: `tools/shots/midway-race-${tag}.png` });
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
});
const views = [[0.6, 0, 8, 0.64, -1, 20], [0.12, 0, 8, 0.15, 1, 30], [0.3, 0, 10, 0.33, -1, 25], [0.45, 0, 6, 0.5, 0, 60]];
let n = 0;
for (const [f, la, y, f2, lb, y2] of views) {
  await page.evaluate(([f, la, y, f2, lb, y2]) => {
    const t = window.__bb.race.track;
    const k = Math.round(f * t.N);
    const k2 = Math.round(f2 * t.N);
    const a = t.point(k, la * t.hw[k]);
    const b = t.point(k2, lb * (t.hw[k2] + 60));
    const cam = window.__bb.camera;
    cam.position.set(a.x, y, a.z);
    cam.lookAt(b.x, y2, b.z);
  }, [f, la, y, f2, lb, y2]);
  await wait(700);
  await page.screenshot({ path: `tools/shots/midway-${n++}-${tag}.png` });
}
const close = await page.evaluate(() => {
  let carrier = null;
  window.__bb.scene.traverse((o) => { if (o.userData.burningCarrier) carrier = o.userData.burningCarrier; });
  return carrier;
});
if (close) {
  await page.evaluate((c) => { const cam = window.__bb.camera; cam.position.set(c.x + Math.cos(c.yaw) * 45, 22, c.z - Math.sin(c.yaw) * 45); cam.lookAt(c.x, 12, c.z); }, close);
  await wait(500);
  await page.screenshot({ path: `tools/shots/midway-carrier-${tag}.png` });
}
await page.evaluate(() => {
  const w = window.__bb;
  let best = null;
  w.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 14 && !best) best = o; });
  const m = new w.THREE.Matrix4(); const p = new w.THREE.Vector3();
  best.getMatrixAt(0, m); p.setFromMatrixPosition(m);
  w.camera.position.set(p.x + 9, p.y + 3, p.z + 9);
  w.camera.lookAt(p);
  window.__frozenPlane = true;
});
await page.screenshot({ path: `tools/shots/midway-plane-${tag}.png` });
console.log('errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
