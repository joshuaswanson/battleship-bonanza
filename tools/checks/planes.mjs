import { launch, startRace, waitForGo, wait, fps, check } from '../lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'midway' });
await waitForGo(page);
await page.evaluate(() => { window.__bb.autopilot = true; });
const sample = () => page.evaluate(() => {
  let squads;
  window.__bb.scene.traverse((o) => { if (o.userData.squads) squads = o.userData.squads; });
  const out = {};
  for (const [name, s] of Object.entries(squads)) {
    const a = s.mesh.instanceMatrix.array;
    out[name] = Array.from({ length: s.count }, (_, i) => [a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14], a[i * 16]]);
  }
  return { t: performance.now(), out };
});
const a = await sample();
await wait(500);
const b = await sample();
const dt = (b.t - a.t) / 1000;
for (const name of ['blue', 'green', 'bombers']) {
  const v = a.out[name].map((p, i) => [p, b.out[name][i]]).filter(([p, q]) => p[3] && q[3]).map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / dt).sort((x, y) => x - y);
  console.log(name, 'speeds', v.map((x) => x.toFixed(0)).join(' '));
}
await page.evaluate(() => {
  document.getElementById('hud').style.display = 'none';
  window.__bb.freeCam = true;
  const cam = window.__bb.camera;
  cam.position.set(0, 60, 300);
  cam.lookAt(0, 60, 0);
});
for (let k = 0; k < 4; k++) {
  await wait(250);
  await page.screenshot({ path: `tools/shots/planes-${k}.png` });
}
const f = await fps(page);
check('midway fps', f > 50, f);
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
