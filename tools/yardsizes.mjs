import { launch, openShipyard, wait, check } from './lib.mjs';

const sizes = (process.argv[2] ?? '640x480,800x600,1024x768,1280x720,1366x768,1440x900,1920x1080,2560x1080,3440x1440,1280x420,1600x500,900x1000,760x900,1100x500').split(',');
for (const size of sizes) {
  const [width, height] = size.split('x').map(Number);
  const { browser, page } = await launch({ width, height });
  await openShipyard(page, ['machinegun', 'jetpack']);
  await wait(900);
  const issues = await page.evaluate(() => {
    const out = [];
    const W = innerWidth;
    const H = innerHeight;
    const screen = document.getElementById('screen-loadout');
    const visible = (el) => el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
    for (const el of screen.querySelectorAll('button, h1, h2, h3, .stats, canvas')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let clip = null;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2) {
          clip = p;
          break;
        }
      }
      if (clip) continue;
      if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.push(`${el.tagName}.${el.className || el.id} offscreen ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
    }
    const next = document.getElementById('btn-start');
    if (next) {
      const r = next.getBoundingClientRect();
      if (r.bottom > H || r.right > W || r.width < 60) out.push('next button not fully visible');
    }
    if (document.documentElement.scrollWidth > W + 1 || document.documentElement.scrollHeight > H + 1) out.push('page scrolls');
    return out;
  });
  await page.screenshot({ path: `tools/shots/yard-${size}.png` });
  check(`shipyard fits at ${size}`, issues.length === 0, issues.slice(0, 4).join('; '));
  await browser.close();
}
