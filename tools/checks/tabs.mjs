import { launch, openShipyard, wait, check } from '../lib.mjs';
for (const [w, h] of [[1280, 760], [844, 390]]) {
  const { browser, page } = await launch({ width: w, height: h });
  await openShipyard(page, ['machinegun', 'jetpack']);
  await wait(500);
  const moves = await page.evaluate(async () => {
    const tray = document.querySelector('.tray');
    const tabs = [...document.querySelectorAll('.tab')];
    const top0 = tray.getBoundingClientRect().top;
    const heights = new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().height)));
    let worst = 0;
    for (const tab of [tabs[1], tabs[2], tabs[0]]) {
      tab.click();
      for (let f = 0; f < 20; f++) {
        await new Promise((r) => requestAnimationFrame(r));
        worst = Math.max(worst, Math.abs(tray.getBoundingClientRect().top - top0));
      }
    }
    return { worst, heights: [...heights] };
  });
  check(`${w}: tray stays still while switching tabs`, moves.worst < 0.5, JSON.stringify(moves));
  await page.screenshot({ path: `tools/shots/tabs-${w}.png` });
  await browser.close();
}
