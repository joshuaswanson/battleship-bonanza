import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
for (const map of ['bay', 'jungle']) {
  await page.evaluate((m) => { window.__bb.map = m; }, map);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await wait(1500);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await wait(1500);
  await page.evaluate(() => document.getElementById('btn-go').click());
  await wait(1500);
  await page.evaluate(() => { window.__bb.autopilot = true; });
  await wait(6000);
  const m0 = await page.metrics();
  const f0 = await page.evaluate(() => window.__bb.frames ?? 0);
  const t0 = Date.now();
  const frames = await page.evaluate(() => new Promise((res) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 4000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
  const m1 = await page.metrics();
  const info = await page.evaluate(() => { const i = window.__bb.renderer.info; return `calls=${i.render.calls} tris=${(i.render.triangles / 1e6).toFixed(2)}M geoms=${i.memory.geometries} heap=${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)}MB`; });
  console.log(map, `fps=${(frames / 4).toFixed(0)} script/frame=${(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / frames).toFixed(2)}ms task/frame=${(((m1.TaskDuration - m0.TaskDuration) * 1000) / frames).toFixed(2)}ms`, info);
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
}
await browser.close();
