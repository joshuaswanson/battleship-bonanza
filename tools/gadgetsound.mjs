import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

async function played(items, key, ms, setup) {
  const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await page.mouse.click(5, 5);
  await startRace(page, { map: 'bay', items });
  await waitForGo(page);
  await isolate(page);
  await wait(500);
  if (setup) await page.evaluate(setup);
  await page.evaluate(() => {
    const sfx = window.__bb.sfx;
    window.__samples = {};
    const sample = sfx.sample.bind(sfx);
    sfx.sample = (name, ...a) => {
      const ok = sample(name, ...a);
      if (ok) window.__samples[name] = (window.__samples[name] ?? 0) + 1;
      return ok;
    };
  });
  await page.keyboard.press(key);
  await wait(ms);
  const out = await page.evaluate(() => window.__samples);
  if (page.errors.length) check('no page errors', false, page.errors[0]);
  await browser.close();
  return out;
}

const emp = await played(['machinegun', 'emp'], 'KeyP', 800, () => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer);
  v.pos.set(p.pos.x + Math.sin(p.heading) * 10, 0, p.pos.z + Math.cos(p.heading) * 10);
  v.trackIdx = p.trackIdx;
});
check('EMP plays the recorded blast', emp.emp === 1, JSON.stringify(emp));
check('stunned boats zap', (emp.zap ?? 0) >= 1, JSON.stringify(emp));
const miss = await played(['grapple', 'armor'], 'KeyO', 2500);
check('hook throw plays', miss.hook === 1, JSON.stringify(miss));
check('missed hook reels with clicks', (miss.reel ?? 0) >= 1, JSON.stringify(miss));
const hit = await played(['grapple', 'armor'], 'KeyO', 1200, () => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer && !b.has('saw') && !b.has('jetpack'));
  v.pos.set(p.pos.x + Math.sin(p.heading) * 40, 0, p.pos.z + Math.cos(p.heading) * 40);
  v.trackIdx = p.trackIdx;
  v.invuln = 0;
});
check('hook catch clangs', hit.hookcatch === 1, JSON.stringify(hit));
