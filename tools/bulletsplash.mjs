import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'bay', items: ['machinegun', 'jetpack'] });
await waitForGo(page);
await isolate(page);
await page.evaluate(() => {
  const r = window.__bb.race;
  window.__splashes = 0;
  const splash = r.fx.splash.bind(r.fx);
  r.fx.splash = (...a) => {
    if (a[3] === 0.35) window.__splashes++;
    return splash(...a);
  };
});
await page.keyboard.down('KeyO');
await wait(1200);
await page.evaluate(() => {
  const p = window.__bb.race.player;
  window.__bb.freeCam = true;
  const c = window.__bb.camera;
  c.position.set(p.pos.x + Math.cos(p.heading) * 14 - Math.sin(p.heading) * 6, 7, p.pos.z - Math.sin(p.heading) * 14 - Math.cos(p.heading) * 6);
  c.lookAt(p.pos.x + Math.sin(p.heading) * 30, 0, p.pos.z + Math.cos(p.heading) * 30);
});
await wait(300);
await page.screenshot({ path: 'tools/shots/bullet-splash.png' });
await page.keyboard.up('KeyO');
const n = await page.evaluate(() => window.__splashes);
check('bullets splash into the water', n > 8, `${n} splashes`);
check('jet pack sample loads', await page.evaluate(() => window.__bb.sfx.samples?.jetpack?.length === 1));
await browser.close();
