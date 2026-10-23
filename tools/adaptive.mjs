import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 960, height: 600 } });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const playerBase of [1.0, 0.8]) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
  await wait(400);
  await page.evaluate(() => document.getElementById('btn-play').click());
await new Promise((r) => setTimeout(r, 1400)); // PLAYWAIT
  await wait(200);
  await page.evaluate(() => document.getElementById('btn-start').click());
await new Promise((r) => setTimeout(r, 1000));
await page.evaluate(() => document.getElementById('btn-go').click());
await new Promise((r) => setTimeout(r, 1000));
  await page.evaluate((base) => {
    const bb = window.__bb; bb.autopilot = true; bb.steps = 6;
    const r = bb.race; r.player.ai.base = base;
    window.__hits = { player: 0, aheadAI: 0, behindAI: 0 };
    const orig = r.damage.bind(r);
    r.damage = (target, amount, source, kind, opts) => {
      if (source && source !== target && !source.isPlayer && kind !== 'fire') {
        const key = target.isPlayer ? 'player' : target.dist > r.player.dist ? 'aheadAI' : 'behindAI';
        window.__hits[key] += amount;
      }
      return orig(target, amount, source, kind, opts);
    };
  }, playerBase);
  console.log(`player base ${playerBase}`);
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    await wait(4000);
    const s = await page.evaluate(() => {
      const r = window.__bb.race; const p = r.player;
      const gaps = r.boats.filter((b) => !b.isPlayer).map((b) => Math.round(b.dist - p.dist)).sort((a, b) => b - a);
      const h = window.__hits;
      return { line: `t=${r.clock.toFixed(0)} place=${p.place} gaps=[${gaps.join(',')}] dmg toPlayer=${h.player.toFixed(0)} aheadAI=${h.aheadAI.toFixed(0)} behindAI=${h.behindAI.toFixed(0)}`, done: p.finished };
    });
    console.log('  ' + s.line);
    if (s.done) break;
  }
  await page.close();
}
await browser.close();
