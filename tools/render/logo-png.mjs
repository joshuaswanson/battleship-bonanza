import { launch, wait } from '../lib.mjs';

const { browser, page } = await launch({ width: 1600, height: 1100, scale: 1.5 });
await wait(2500);
await page.evaluate(() => {
  document.getElementById('game').style.display = 'none';
  document.documentElement.style.background = 'transparent';
  document.body.style.background = 'transparent';
  const screen = document.getElementById('screen-title');
  screen.style.background = 'none';
  for (const el of screen.querySelectorAll('.title-menu, .title-credit')) el.style.visibility = 'hidden';
});
await wait(300);
await (await page.$('.title-logo')).screenshot({ path: '.github/logo.png', omitBackground: true });
await browser.close();
