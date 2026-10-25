import { launch, startRace, waitForGo, isolate, wait } from '../lib.mjs';

const map = process.argv[2] ?? 'bay';
const tag = process.argv[3] ?? 'a';
const { browser, page } = await launch();
await startRace(page, { map });
await waitForGo(page);
await isolate(page);
await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; window.__bb.freeCam = true; });
const count = await page.evaluate(() => window.__bb.race.track.routes.length);
const shots = {
  fork: (r) => ({ from: r.from - 8, up: 9, look: r.first + 12, lookUp: 2 }),
  aerial: (r) => ({ from: r.from - 40, up: 110, look: r.first + Math.round(r.count / 2), lookUp: 0 }),
  inside: (r) => ({ from: r.first + Math.round(r.count * 0.35), up: 6, look: r.first + Math.round(r.count * 0.6), lookUp: 2 }),
  join: (r) => ({ from: r.last - 20, up: 12, look: r.to + 10, lookUp: 2 }),
};
for (let n = 0; n < count; n++) {
  for (const [name, make] of Object.entries(shots)) {
    await page.evaluate(({ n, spec }) => {
      const t = window.__bb.race.track;
      const r = t.routes[n];
      const view = spec;
      const a = t.norm(view.from);
      const b = t.norm(view.look);
      const c = window.__bb.camera;
      c.position.set(t.px[a], t.level(t.sAt[a]) + view.up, t.pz[a]);
      c.lookAt(t.px[b], t.level(t.sAt[b]) + view.lookUp, t.pz[b]);
    }, { n, spec: await page.evaluate((n) => window.__bb.race.track.routes[n], n).then(make) });
    await wait(450);
    await page.screenshot({ path: `tools/shots/route-${map}-${n}-${name}-${tag}.png` });
  }
}
console.log('routes', count, 'errors', page.errors.length, page.errors[0] ?? '');
await browser.close();
