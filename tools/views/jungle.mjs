import { launch, startRace, wait, waitForGo } from '../lib.mjs';

console.log('# cave entrance');
{
  const tag = process.argv[2] ?? 'a';
  const { browser, page } = await launch();
  await startRace(page, { map: 'jungle' });
  await waitForGo(page);
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
  });
  const views = {
    front: `const k = Math.round((r.tunnelIn - 70) / t.spacing); const k2 = Math.round(r.tunnelIn / t.spacing); return [t.px[k], t.level(k * t.spacing) + 8, t.pz[k], t.px[k2], t.level(k2 * t.spacing) + 16, t.pz[k2]];`,
    left: `const k = Math.round((r.tunnelIn - 40) / t.spacing); const k2 = Math.round((r.tunnelIn - 14) / t.spacing); return [t.px[k] + t.nx[k] * 10, t.level(k * t.spacing) + 10, t.pz[k] + t.nz[k] * 10, t.px[k2] - t.nx[k2] * (t.hw[k2] + 10), t.level(k2 * t.spacing) + 16, t.pz[k2] - t.nz[k2] * (t.hw[k2] + 10)];`,
    right: `const k = Math.round((r.tunnelIn - 40) / t.spacing); const k2 = Math.round((r.tunnelIn - 14) / t.spacing); return [t.px[k] - t.nx[k] * 10, t.level(k * t.spacing) + 10, t.pz[k] - t.nz[k] * 10, t.px[k2] + t.nx[k2] * (t.hw[k2] + 10), t.level(k2 * t.spacing) + 16, t.pz[k2] + t.nz[k2] * (t.hw[k2] + 10)];`,
    high: `const k = Math.round((r.tunnelIn - 60) / t.spacing); const k2 = Math.round(r.tunnelIn / t.spacing); return [t.px[k], t.level(k * t.spacing) + 40, t.pz[k], t.px[k2], t.level(k2 * t.spacing) + 10, t.pz[k2]];`,
  };
  for (const [name, body] of Object.entries(views)) {
    await page.evaluate(`(() => { const t = window.__bb.race.track; const r = t.river; const [a,b,c,d,e,f] = (() => { ${body} })(); const cam = window.__bb.camera; cam.position.set(a,b,c); cam.lookAt(d,e,f); })()`);
    await wait(500);
    await page.screenshot({ path: `tools/shots/cave-${name}-${tag}.png` });
  }
  console.log('errors', page.errors.length, page.errors[0] ?? '');
  await browser.close();
}

console.log('# river banks');
{
  const { browser, page } = await launch();
  await startRace(page, { map: 'jungle' });
  await waitForGo(page);
  await page.evaluate(() => { document.getElementById('hud').style.display = 'none'; window.__bb.freeCam = true; });
  for (const [name, s, lat] of [['a', 300, -8], ['b', 900, 6], ['c', 1150, 0]]) {
    await page.evaluate(({ s, lat }) => {
      const t = window.__bb.race.track; const k = Math.round(s / t.spacing) % t.N; const k2 = Math.round((s + 40) / t.spacing) % t.N;
      const y = t.level(s); const c = window.__bb.camera;
      c.position.set(t.px[k] + t.nx[k] * lat, y + 4, t.pz[k] + t.nz[k] * lat);
      c.lookAt(t.px[k2] + t.nx[k2] * (lat > 0 ? 25 : -25), y + 3, t.pz[k2] + t.nz[k2] * (lat > 0 ? 25 : -25));
    }, { s, lat });
    await wait(400);
    await page.screenshot({ path: `tools/shots/bank-${name}.png` });
  }
  await browser.close();
}
