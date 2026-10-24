import { launch, startRace, autopilot, wait, fps } from '../lib.mjs';

for (const map of (process.argv[2] ?? 'bay,jungle').split(',')) {
  const { browser, page } = await launch();
  await startRace(page, { map });
  await autopilot(page, 1);
  await wait(6000);
  const m0 = await page.metrics();
  const rate = await fps(page, 4000);
  const m1 = await page.metrics();
  const frames = rate * 4;
  const info = await page.evaluate(() => {
    const i = window.__bb.renderer.info;
    return `${i.render.calls} draw calls, ${(i.render.triangles / 1e6).toFixed(2)}M triangles, heap ${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)} MB`;
  });
  console.log(`${map}: ${rate} fps, script ${(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / frames).toFixed(2)} ms/frame, ${info}`);
  await browser.close();
}
