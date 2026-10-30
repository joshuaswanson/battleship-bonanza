import { launch, wait, check } from '../lib.mjs';

const click = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);
const settled = (page, id) => page.waitForFunction((id) => !document.getElementById(id).classList.contains('hidden') && !document.getElementById('wipe').classList.contains('on'), { polling: 100, timeout: 240000 }, id);

for (const map of (process.argv[2] ?? 'bay,jungle,alps,venice,midway,canyon,docks,tuebingen,ctf:bay,ctf:fjord,ctf:lagoon,ctf:harbor,cp:lagoon').split(',')) {
  const { browser, page } = await launch();
  await click(page, '#btn-play');
  await settled(page, 'screen-loadout');
  await click(page, '#btn-start');
  await settled(page, 'screen-modes');
  const [kind, arena] = map.includes(':') ? map.split(':') : ['race', null];
  await click(page, `.mode-card[data-mode="${kind}"]`);
  await settled(page, 'screen-maps');
  await click(page, arena ? `.map-card[data-arena="${arena}"]` : `.map-card[data-map="${map}"]`);
  await click(page, '#btn-go');
  await settled(page, 'hud');
  await wait(4000);
  check(`${map}: race starts from the menus`, true);
  check(`${map}: no page errors`, page.errors.length === 0, page.errors[0]);
  await browser.close();
}
