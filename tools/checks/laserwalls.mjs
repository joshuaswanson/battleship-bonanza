import { launch, startRace, waitForGo, isolate, wait, check } from '../lib.mjs';

const map = process.argv[2] ?? 'venice';
const spots = (process.argv[3] ?? '0.01,0.04,0.08,0.13,0.3,0.45,0.62,0.8').split(',').map(Number);
const tag = process.argv[4] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map, items: ['laser', 'armor'] });
await waitForGo(page);
await isolate(page);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; window.__bb.freeCam = true; });
for (const f of spots) {
  for (const side of [-1, 1]) {
    const setup = await page.evaluate((f, side) => {
      const { race, THREE } = window.__bb;
      const t = race.track;
      const p = race.player;
      const i = Math.round(f * t.N) % t.N;
      const mid = t.point(i, 0);
      const h = t.heading(i) + side * (Math.PI / 2 - 0.25);
      const dir = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
      const hit = window.__bb.world.raycast(new THREE.Vector3(mid.x, 2, mid.z), dir, 200);
      const stand = hit ? Math.max(0, hit.t - 16) : 0;
      p.pos.set(mid.x + dir.x * stand, p.pos.y, mid.z + dir.z * stand);
      p.vel.set(0, 0, 0);
      p.speed = 0;
      p.trackIdx = i;
      const base = h - side * 0.45;
      p.heading = base;
      window.__sweep = { base, side, i };
      return { i, wall: hit && hit.t };
    }, f, side);
    await page.keyboard.down('KeyO');
    for (let k = 0; k < 24; k++) {
      await page.evaluate((k) => {
        const { race } = window.__bb;
        const p = race.player;
        const s = window.__sweep;
        p.heading = s.base + s.side * (k / 24) * 0.9;
        p.vel.set(0, 0, 0);
        p.speed = 0;
        const c = window.__bb.camera;
        const back = s.base + s.side * 0.45;
        c.position.set(p.pos.x - Math.sin(back) * 4 + Math.cos(back) * 5 * s.side, p.pos.y + 4, p.pos.z - Math.cos(back) * 4 - Math.sin(back) * 5 * s.side);
        c.lookAt(p.pos.x + Math.sin(back) * 16, p.pos.y + 3, p.pos.z + Math.cos(back) * 16);
      }, k);
      await wait(60);
    }
    await page.keyboard.up('KeyO');
    await wait(150);
    await page.screenshot({ path: `tools/shots/lw-${map}-${f}-${side > 0 ? 'r' : 'l'}-${tag}.png` });
  }
}
const audit = await page.evaluate(() => {
  const { THREE, race, world } = window.__bb;
  const mesh = race.fx.decals.kinds.burn.mesh;
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let floating = 0;
  let rimOff = 0;
  let rimTotal = 0;
  const bad = [];
  for (let k = 0; k < mesh.count; k++) {
    mesh.getMatrixAt(k, m);
    m.decompose(pos, q, scale);
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const u = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const probe = (p) => world.raycast(p.clone().addScaledVector(n, 0.5), n.clone().negate(), 0.9);
    if (!probe(pos)) {
      floating++;
      if (bad.length < 8) bad.push(pos.toArray().map((x) => +x.toFixed(1)));
    }
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      rimTotal++;
      if (!probe(pos.clone().addScaledVector(u, a * scale.x * 0.35).addScaledVector(v, b * scale.x * 0.35))) rimOff++;
    }
  }
  return { burns: mesh.count, floating, rimOff: rimOff / Math.max(1, rimTotal), bad };
});
console.log(JSON.stringify(audit));
check('burns sit on surfaces', audit.burns > 50 && audit.floating === 0, `${audit.floating} of ${audit.burns} floating, ${(audit.rimOff * 100).toFixed(1)}% of rim points off a surface`);
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
