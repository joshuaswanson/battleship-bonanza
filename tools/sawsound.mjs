import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
await page.mouse.click(5, 5);
await startRace(page, { map: 'bay', items: ['saw', 'camo'] });
await waitForGo(page);
await isolate(page);
const level = () => page.evaluate(() => ({ hum: window.__bb.sfx.saw.out.gain.value, grind: window.__bb.sfx.saw.grind.gain.value }));
await wait(500);
check('saw is silent when idle', (await level()).hum < 0.005);
await page.keyboard.down('KeyO');
const samples = [];
for (let i = 0; i < 10; i++) {
  await wait(100);
  samples.push((await level()).hum);
}
const steady = samples.slice(4);
check('saw hum is steady while held', Math.min(...steady) > 0.1 && Math.max(...steady) - Math.min(...steady) < 0.02, steady.map((x) => x.toFixed(3)).join(' '));
await page.evaluate(() => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer && !b.has('spikes') && !b.has('armor'));
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  v.pos.set(p.pos.x + lx * 5.2 + Math.sin(p.heading) * 2, 0, p.pos.z + lz * 5.2 + Math.cos(p.heading) * 2);
  v.trackIdx = p.trackIdx;
  v.heading = p.heading;
  v.invuln = 0;
});
await wait(500);
check('grinding layer comes in while cutting', (await level()).grind > 0.1, (await level()).grind.toFixed(3));
await page.keyboard.up('KeyO');
await wait(1500);
check('saw fades out after release', (await level()).hum < 0.02, (await level()).hum.toFixed(3));
await browser.close();
