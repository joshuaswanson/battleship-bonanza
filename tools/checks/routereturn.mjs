import { launch, startRace, waitForGo, isolate, wait, check } from '../lib.mjs';

for (const map of (process.argv[2] ?? 'bay,jungle,alps,venice,midway,canyon').split(',')) {
  const { browser, page } = await launch({ width: 640, height: 400 });
  await startRace(page, { map });
  await waitForGo(page);
  await isolate(page);
  const r = await page.evaluate(async () => {
    const { race } = window.__bb;
    const t = race.track;
    const p = race.player;
    const route = t.routes[0];
    const frames = (n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const out = {};
    const mid = route.first + Math.round(route.count / 2);
    let near = route.from;
    let best = Infinity;
    for (let j = route.from; j !== route.to; j = t.next[j]) {
      const d = Math.hypot(t.px[j] - t.px[mid], t.pz[j] - t.pz[mid]);
      if (d < best) {
        best = d;
        near = j;
      }
    }
    const place = (x, z, idx, heading) => {
      p.pos.set(x, p.pos.y, z);
      p.trackIdx = idx;
      p.trackS = t.sAt[idx];
      p.heading = heading;
      p.vel.set(0, 0, 0);
      p.speed = 0;
      p.offCourse = 0;
    };
    place(t.px[mid], t.pz[mid], near, t.heading(mid));
    await frames(20);
    out.onRoute = { route: t.route[p.trackIdx], off: p.offCourse };
    place(t.px[near], t.pz[near], mid, t.heading(near));
    await frames(20);
    out.onMain = { route: t.route[p.trackIdx], off: p.offCourse };
    const gx = (t.px[mid] + t.px[near]) / 2;
    const gz = (t.pz[mid] + t.pz[near]) / 2;
    place(gx, gz, near, t.heading(near));
    await frames(4);
    const target = race.courseReturnPoint(p);
    const into = t.project(target.x, target.z);
    out.gap = { targetInside: Math.abs(into.lateral) < t.hw[into.idx], dist: +Math.hypot(target.x - gx, target.z - gz).toFixed(1), gap: +best.toFixed(1) };
    return out;
  });
  check(`${map}: a boat in the route channel is tracked on the route`, r.onRoute.route === 0 && r.onRoute.off === 0, JSON.stringify(r.onRoute));
  check(`${map}: a boat in the main channel is tracked on the main line`, r.onMain.route === -1 && r.onMain.off === 0, JSON.stringify(r.onMain));
  check(`${map}: return to course points into a channel`, r.gap.targetInside && r.gap.dist < r.gap.gap, JSON.stringify(r.gap));
  check(`${map}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
