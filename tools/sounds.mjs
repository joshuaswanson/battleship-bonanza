import { launch, startRace, waitForGo, isolate, wait, check } from './lib.mjs';

async function count(items, key, ms, setup) {
  const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await page.mouse.click(5, 5);
  await startRace(page, { map: 'bay', items });
  await waitForGo(page);
  await isolate(page);
  if (setup) await page.evaluate(setup);
  await page.evaluate(() => {
    const sfx = window.__bb.sfx;
    window.__played = {};
    const play = sfx.play.bind(sfx);
    sfx.play = (name, pos) => {
      window.__played[name] = (window.__played[name] ?? 0) + 1;
      return play(name, pos);
    };
  });
  await page.keyboard.down(key);
  await wait(ms);
  await page.keyboard.up(key);
  const played = await page.evaluate(() => window.__played);
  await browser.close();
  return played;
}

const saw = await count(['saw', 'camo'], 'KeyO', 1500, () => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer && !b.has('spikes') && !b.has('armor'));
  const lx = Math.cos(p.heading), lz = -Math.sin(p.heading);
  v.pos.set(p.pos.x + lx * 5.2 + Math.sin(p.heading) * 1.5, 0, p.pos.z + lz * 5.2 + Math.cos(p.heading) * 1.5);
  v.heading = p.heading;
  v.invuln = 0;
});
check('saw whines while held', (saw.sawSpin ?? 0) >= 3, `${saw.sawSpin} spins`);
check('saw grinds while cutting', (saw.saw ?? 0) >= 1, `${saw.saw} grinds`);
const missiles = await count(['missiles', 'armor'], 'KeyO', 300, () => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer && !b.has('camo'));
  v.pos.set(p.pos.x + Math.sin(p.heading) * 40, 0, p.pos.z + Math.cos(p.heading) * 40);
});
check('missile launch plays', (missiles.missile ?? 0) >= 1, `${missiles.missile} launches`);
const mines = await count(['armor', 'mines'], 'KeyP', 100, () => {
  const r = window.__bb.race;
  const p = r.player;
  const v = r.boats.find((b) => !b.isPlayer);
  window.__victim = v;
});
check('dropping a mine plops', (mines.plop ?? 0) >= 1);
const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
await startRace(page, { map: 'bay', items: ['armor', 'mines'] });
await waitForGo(page);
await isolate(page);
await page.keyboard.press('KeyP');
await wait(1500);
const boom = await page.evaluate(async () => {
  const r = window.__bb.race;
  const sfx = window.__bb.sfx;
  let heard = 0;
  const play = sfx.play.bind(sfx);
  sfx.play = (name, pos) => {
    if (name === 'mineBoom') heard++;
    return play(name, pos);
  };
  const mine = r.mines[0];
  r.player.pos.x += 60;
  const v = r.boats.find((b) => !b.isPlayer);
  v.pos.set(mine.pos.x, 0, mine.pos.z);
  v.trackIdx = r.track.project(mine.pos.x, mine.pos.z).idx;
  v.invuln = 0;
  await new Promise((res) => setTimeout(res, 400));
  return heard;
});
check('a mine hit plays the mine explosion', boom >= 1);
await browser.close();
