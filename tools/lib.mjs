import puppeteer from 'puppeteer-core';

export const URL = process.env.BB_URL ?? 'http://localhost:5288/';
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const GPU = process.env.CI ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];

export async function launch({ width = 1280, height = 760, scale = 1, args = [] } = {}) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    protocolTimeout: process.env.CI ? 600000 : 180000,
    args: [...GPU, '--enable-precise-memory-info', ...args],
    defaultViewport: { width, height, deviceScaleFactor: scale },
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(process.env.CI ? 300000 : 30000);
  page.errors = [];
  page.on('pageerror', (e) => {
    page.errors.push(e.message);
    console.log('[pageerror]', process.env.BB_STACK ? e.stack : e.message);
  });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  if (process.env.CI) await page.evaluate(() => { if (window.__bb) window.__bb.skipRender = true; });
  return { browser, page };
}

export async function openShipyard(page, items) {
  if (items) await page.evaluate((items) => window.__bb.setup.items.splice(0, 2, ...items), items);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await page.waitForFunction(() => !document.getElementById('screen-loadout').classList.contains('hidden') && !document.getElementById('wipe').classList.contains('on'), { polling: 100 });
  await page.evaluate(() => window.__bb.loadout.refresh());
}

export async function startRace(page, { map = 'bay', items } = {}) {
  await page.evaluate((map) => {
    window.__bb.map = map;
  }, map);
  await openShipyard(page, items);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await page.waitForFunction(() => !document.getElementById('screen-modes').classList.contains('hidden') && !document.getElementById('wipe').classList.contains('on'), { polling: 100 });
  await page.evaluate(() => document.querySelector('.mode-card[data-mode="race"]').click());
  await page.waitForFunction(() => !document.getElementById('screen-maps').classList.contains('hidden') && !document.getElementById('wipe').classList.contains('on'), { polling: 100 });
  await page.evaluate(() => document.getElementById('btn-go').click());
  await page.waitForFunction(() => window.__bb.race && !window.__bb.race.attract && !document.getElementById('wipe').classList.contains('on'), { polling: 100, timeout: process.env.CI ? 300000 : 60000 });
}

export async function waitForGo(page) {
  await page.waitForFunction(() => window.__bb.race.state === 'racing', { polling: 100 });
}

export async function isolate(page) {
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
  });
}

export async function autopilot(page, steps = 6) {
  await page.evaluate((steps) => {
    window.__bb.autopilot = true;
    window.__bb.steps = steps;
  }, steps);
}

export async function waitForResults(page, timeout = 300000) {
  await page.waitForFunction(() => !document.getElementById('screen-results').classList.contains('hidden'), { timeout, polling: 1000 });
  await page.evaluate(() => {
    window.__bb.autopilot = false;
    window.__bb.steps = 1;
  });
}

export async function fps(page, ms = 2000) {
  return page.evaluate(
    (ms) =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < ms) requestAnimationFrame(f);
          else res(Math.round((n * 1000) / ms));
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
}

export function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) process.exitCode = 1;
}
