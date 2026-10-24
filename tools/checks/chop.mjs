import { launch, startRace, waitForGo, isolate, wait, check } from '../lib.mjs';

const map = process.argv[2] ?? 'alps';
const { browser, page } = await launch();
await startRace(page, { map, items: ['laser', 'armor'] });
await waitForGo(page);
await isolate(page);
await page.evaluate(() => {
  const r = window.__bb.race;
  const t = r.track;
  const p = r.player;
  const tree = r.chopper.trees.find((tr) => {
    const pr = t.project(tr.x, tr.z);
    const gap = pr.distance - t.hw[pr.idx];
    return gap > 3 && gap < 14 && tr.height > 8;
  });
  const pr = t.project(tree.x, tree.z);
  const q = t.point(pr.idx, Math.sign(pr.lateral) * (t.hw[pr.idx] - 8));
  p.pos.set(q.x, 0, q.z);
  p.trackIdx = pr.idx;
  p.vel.set(0, 0, 0);
  p.speed = 0;
  p.heading = Math.atan2(tree.x - q.x, tree.z - q.z);
  window.__tree = tree;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  const sx = Math.cos(p.heading);
  const sz = -Math.sin(p.heading);
  c.position.set((p.pos.x + tree.x) / 2 + sx * 16, tree.base + 8, (p.pos.z + tree.z) / 2 + sz * 16);
  c.lookAt((p.pos.x + tree.x) / 2, tree.base + 4, (p.pos.z + tree.z) / 2);
});
await page.keyboard.down('KeyO');
for (let i = 0; i < 8; i++) {
  await wait(220);
  await page.screenshot({ path: `tools/shots/chop-${map}-${i}.png` });
  if (i === 2) await page.keyboard.up('KeyO');
}
const state = await page.evaluate(() => ({ cut: window.__tree.cut, falling: window.__bb.race.chopper.falling.length }));
check('laser fells the tree', state.cut && state.falling > 0);
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
