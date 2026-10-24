import { launch, startRace, waitForGo, check } from '../lib.mjs';

const map = process.argv[2] ?? 'venice';
const { browser, page } = await launch();
await page.evaluate(() => { window.__bb.keepArrays = true; });
const t0 = Date.now();
await startRace(page, { map });
console.log(`built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await waitForGo(page);
const result = await page.evaluate(() => {
  const { THREE, race, venueGroup, world } = window.__bb;
  const ray = new THREE.Raycaster();
  const skip = (o) => {
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    return m.side === THREE.BackSide || m.isShaderMaterial || m.transparent;
  };
  const rand = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const t = race.track;
  let agree = 0;
  let total = 0;
  let collideMs = 0;
  let worst = 0;
  let hits = 0;
  const misses = [];
  for (let k = 0; k < 800; k++) {
    const i = Math.floor(rand() * t.N);
    const p = t.point(i, (rand() - 0.5) * t.hw[i] * 1.6);
    const origin = new THREE.Vector3(p.x, 1.6 + rand() * 2, p.z);
    const a = rand() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sin(a), -0.02 + rand() * 0.25, Math.cos(a)).normalize();
    const far = 70;
    const c0 = performance.now();
    const mine = world.raycast(origin, dir, far);
    collideMs += performance.now() - c0;
    ray.set(origin, dir);
    ray.far = dir.y < 0 ? Math.min(far, (origin.y + 0.3) / -dir.y) : far;
    const truth = ray.intersectObject(venueGroup, true).find((h) => !skip(h.object));
    total++;
    const tm = mine ? mine.t : null;
    const tt = truth ? truth.distance : null;
    if (tt !== null) hits++;
    if ((tm === null) === (tt === null) && (tm === null || Math.abs(tm - tt) < 0.05)) agree++;
    else misses.push({ k, origin: origin.toArray().map((v) => +v.toFixed(1)), dir: dir.toArray().map((v) => +v.toFixed(3)), mine: tm && +tm.toFixed(2), truth: tt && +tt.toFixed(2), what: truth?.object.type });
    if (tm !== null && tt !== null) worst = Math.max(worst, Math.abs(tm - tt));
  }
  return { agree, total, hits, worst, ms: collideMs / total, misses: misses.slice(0, 12) };
});
console.log(JSON.stringify(result, null, 1));
check(`${map}: collider matches the drawn scenery`, result.agree / result.total > 0.99, `${result.agree}/${result.total} agree, ${result.hits} hit scenery`);
check(`${map}: rays are fast`, result.ms < 1, `${result.ms.toFixed(3)} ms per ray`);
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
