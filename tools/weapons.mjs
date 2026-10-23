import { launch, startRace, waitForGo, wait, check } from './lib.mjs';

async function scenario(items, setup) {
  const { browser, page } = await launch();
  await startRace(page, { map: 'bay', items });
  await waitForGo(page);
  await page.evaluate(() => {
    const r = window.__bb.race;
    const p = r.player;
    for (const b of r.boats) {
      b.ai.think = 1e9;
      b.ai.base = 0;
      b.vel.set(0, 0, 0);
      b.speed = 0;
      if (b !== p) b.pos.x += 3000;
    }
    p.ai.base = 0;
    window.__place = (o, ahead, side) => {
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      o.pos.set(p.pos.x + fx * ahead + Math.cos(p.heading) * side, 0, p.pos.z + fz * ahead - Math.sin(p.heading) * side);
      o.heading = p.heading;
      o.hp = 100;
      o.invuln = 0;
      o.lastFired = 1e9;
    };
  });
  const result = await setup(page);
  if (page.errors.length) check(`no page errors with ${items}`, false, page.errors[0]);
  await browser.close();
  return result;
}

async function holdAt(items, key, ahead, side, victimItems = ['jetpack', 'machinegun']) {
  return scenario(items, async (page) => {
    await page.evaluate(({ ahead, side, victimItems }) => {
      const v = window.__bb.race.boats.find((b) => !b.isPlayer);
      v.items = victimItems;
      window.__place(v, ahead, side);
      window.__v = v;
    }, { ahead, side, victimItems });
    await page.keyboard.down(key);
    await wait(1200);
    await page.keyboard.up(key);
    return page.evaluate(() => 100 - window.__v.hp);
  });
}

const hits = (label, dmg) => check(label, dmg > 0, `${dmg.toFixed(0)} damage`);
const misses = (label, dmg) => check(label, dmg === 0, `${dmg.toFixed(0)} damage`);

hits('front machine gun hits a boat ahead', await holdAt(['machinegun', 'jetpack'], 'KeyO', 30, 0));
misses('front machine gun ignores a boat 45° off', await holdAt(['machinegun', 'jetpack'], 'KeyO', 12, 12));
hits('back machine gun hits a boat behind', await holdAt(['spikes', 'machinegun'], 'KeyP', -18, -14));
misses('back machine gun ignores a boat ahead', await holdAt(['spikes', 'machinegun'], 'KeyP', 30, 0));
hits('back laser hits a boat behind', await holdAt(['grapple', 'laser'], 'KeyP', -25, 6));
hits('front flamethrower aims at a boat 45° off', await holdAt(['flamethrower', 'camo'], 'KeyO', 7, 7));
hits('back flamethrower hits a boat behind', await holdAt(['armor', 'flamethrower'], 'KeyP', -10, 3));
hits('front saw cuts a boat alongside', await holdAt(['saw', 'camo'], 'KeyO', 1.5, 5.2));
misses('back saw ignores a boat ahead', await holdAt(['camo', 'saw'], 'KeyP', 3.5, 5.2));
misses('spikes block the saw', await holdAt(['saw', 'camo'], 'KeyO', 1.5, 5.2, ['spikes', 'jetpack']));

const heat = await scenario(['saw', 'camo'], async (page) => {
  await page.keyboard.down('KeyO');
  await wait(3000);
  const hot = await page.evaluate(() => window.__bb.race.player.heat.saw.overheated);
  await page.keyboard.up('KeyO');
  return hot;
});
check('holding the saw overheats it', heat);

const missiles = await scenario(['missiles', 'armor'], async (page) => {
  await page.evaluate(() => {
    const others = window.__bb.race.boats.filter((b) => !b.isPlayer && !b.has('camo'));
    others.forEach((o, i) => window.__place(o, 30 + i * 15, (i - 1) * 10));
  });
  const shots = [];
  const names = new Set();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('KeyO');
    await wait(450);
    shots.push(await page.evaluate(() => window.__bb.race.player.charges[0].left));
    for (const n of await page.evaluate(() => window.__bb.race.missiles.map((m) => m.target?.name))) names.add(n);
  }
  return { shots, targets: names.size };
});
check('missiles use one charge per press', missiles.shots.join() === '2,1,0,0', missiles.shots.join());
check('missiles spread over targets', missiles.targets >= 2, `${missiles.targets} targets`);

const hook = await scenario(['grapple', 'armor'], async (page) => {
  await page.keyboard.press('KeyO');
  await wait(900);
  return page.evaluate(() => !!window.__bb.race.hooks[0]?.loose);
});
check('a missed hook goes slack', hook);

const cut = await scenario(['saw', 'camo'], async (page) =>
  page.evaluate(() => {
    const r = window.__bb.race;
    const o = r.boats.find((b) => !b.isPlayer);
    window.__place(o, 40, 0);
    const ahead = r.sawCuts(r.player, o);
    window.__place(o, -40, 0);
    return { ahead, behind: r.sawCuts(r.player, o) };
  }),
);
check('a front saw cuts hooks thrown from ahead', cut.ahead);
check('a front saw misses hooks thrown from behind', !cut.behind);
