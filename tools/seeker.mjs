import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'bay', items: ['missiles', 'armor'] });
await waitForGo(page);
await isolate(page);
await page.evaluate(() => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer && !b.has('camo'));
  v.pos.set(p.pos.x + Math.sin(p.heading) * 35 + Math.cos(p.heading) * 6, 0, p.pos.z + Math.cos(p.heading) * 35 - Math.sin(p.heading) * 6);
  v.trackIdx = p.trackIdx;
});
await wait(250);
const state = () => page.evaluate(() => ({ cls: document.getElementById('hud-seeker').className, label: document.querySelector('.sk-label').textContent }));
const tracking = await state();
await page.screenshot({ path: 'tools/shots/seek-tracking.png' });
check('tracking shows first', /on/.test(tracking.cls) && !/locked/.test(tracking.cls) && tracking.label === 'TRACKING', JSON.stringify(tracking));
await wait(900);
const locked = await state();
await page.screenshot({ path: 'tools/shots/seek-locked.png' });
check('then locks on', /locked/.test(locked.cls) && locked.label === 'LOCKED', JSON.stringify(locked));
await browser.close();
