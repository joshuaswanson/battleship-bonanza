import { check, isolate, launch, startRace, wait, waitForGo } from '../lib.mjs';

console.log('# engine');
{
  const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await page.mouse.click(5, 5);
  await startRace(page, { map: 'bay' });
  await waitForGo(page);
  const gain = () => page.evaluate(() => window.__bb.sfx.engineGain.gain.value);
  await wait(1200);
  check('engine silent without W', (await gain()) < 0.005, (await gain()).toFixed(3));
  await page.keyboard.down('KeyW');
  await wait(1200);
  check('engine plays while W is held', (await gain()) > 0.03, (await gain()).toFixed(3));
  await page.keyboard.up('KeyW');
  await wait(1200);
  check('engine fades after W is released', (await gain()) < 0.005, (await gain()).toFixed(3));
  await browser.close();
}

console.log('# weapon sounds');
{
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
}

console.log('# machine gun');
{
  const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await page.mouse.click(5, 5);
  await startRace(page, { map: 'bay', items: ['machinegun', 'armor'] });
  await waitForGo(page);
  await isolate(page);
  check('gun samples load', await page.evaluate(() => window.__bb.sfx.samples?.gun?.length === 3));
  await page.evaluate(() => {
    const sfx = window.__bb.sfx;
    window.__shots = 0;
    const sample = sfx.sample.bind(sfx);
    sfx.sample = (...a) => {
      const ok = sample(...a);
      if (ok && a[0] === 'gun') window.__shots++;
      return ok;
    };
  });
  await page.keyboard.down('KeyO');
  await wait(800);
  await page.keyboard.up('KeyO');
  const shots = await page.evaluate(() => window.__shots);
  check('machine gun plays recorded shots', shots > 5, `${shots} shots`);
  await browser.close();
}

console.log('# flamethrower');
{
  const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await page.mouse.click(5, 5);
  await startRace(page, { map: 'bay', items: ['flamethrower', 'armor'] });
  await waitForGo(page);
  await isolate(page);
  const level = () => page.evaluate(() => window.__bb.sfx.flame.out.gain.value);
  await wait(400);
  check('flamethrower silent when idle', (await level()) < 0.005);
  await page.keyboard.down('KeyO');
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await wait(100);
    samples.push(await level());
  }
  check('flamethrower roars steadily while held', Math.min(...samples.slice(2)) > 0.2, samples.map((x) => x.toFixed(2)).join(' '));
  await page.keyboard.up('KeyO');
  await wait(1000);
  check('roar fades after release', (await level()) < 0.02, (await level()).toFixed(3));
  check('no page errors', page.errors.length === 0, page.errors[0]);
  await browser.close();
}

console.log('# saw');
{
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
}

console.log('# gadgets');
{
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
}

console.log('# music');
{
  const { browser, page } = await launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  await page.mouse.click(5, 5);
  await wait(800);
  const playing = () => page.evaluate(() => Object.entries(window.__bb.sfx.tracks).filter(([, a]) => !a.paused).map(([n]) => n).join(',') || 'none');
  check('menu music on the title', (await playing()) === 'menu');
  await startRace(page, { map: 'bay' });
  check('no music during the countdown', (await playing()) === 'none');
  const t0 = Date.now();
  await page.waitForFunction(() => window.__bb.race.state === 'racing', { polling: 50 });
  await wait(300);
  check('race music starts on Go', (await playing()) === 'race', `go after ${Date.now() - t0} ms`);
  await page.keyboard.press('Escape');
  await wait(300);
  check('race music ducks when paused', await page.evaluate(() => window.__bb.sfx.tracks.race.volume < 0.2));
  await page.click('#btn-menu');
  await wait(1500);
  check('menu music back on the title', (await playing()) === 'menu');
  await browser.close();
}

console.log('# title music');
{
  const { browser, page } = await launch();
  await wait(1500);
  await page.screenshot({ path: 'tools/shots/title-nudge.png' });
  check('nudge shows before any input', await page.evaluate(() => !document.getElementById('sound-nudge').classList.contains('hidden')));
  await page.click('#sound-nudge');
  await wait(600);
  check('title music starts after tapping the nudge', await page.evaluate(() => !window.__bb.sfx.tracks.menu.paused));
  check('nudge hides', await page.evaluate(() => document.getElementById('sound-nudge').classList.contains('hidden')));
  check('still on the title', await page.evaluate(() => !document.getElementById('screen-title').classList.contains('hidden')));
  await browser.close();
}
