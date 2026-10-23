import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.__bb.map = 'jungle'; });
await page.evaluate(() => document.getElementById('btn-play').click());
await wait(1400);
await page.evaluate(() => document.getElementById('btn-start').click());
await wait(1400);
await page.evaluate(() => document.getElementById('btn-go').click());
await wait(4000);
console.log(await page.evaluate(() => {
  const { THREE, scene } = window.__bb; window.__bb.freeCam = true;
  const t = window.__bb.race.track; const r = t.river; const s = r.tunnelOut - 30;
  const k = Math.round(s / t.spacing) % t.N; const k2 = Math.round((s + 30) / t.spacing) % t.N;
  const y = r.top - r.slope * (s - r.seam);
  const from = new THREE.Vector3(t.px[k], y + 4, t.pz[k]);
  const out = [];
  for (const dy of [-2, 0, 2, 5]) {
    const to = new THREE.Vector3(t.px[k2], y + 4 + dy, t.pz[k2]);
    const ray = new THREE.Raycaster(from, to.clone().sub(from).normalize(), 0, 200);
    const hits = ray.intersectObjects(scene.children, true).filter((h) => h.object.visible && h.object.material && !h.object.material.side !== undefined);
    out.push(`dy=${dy}: ` + hits.slice(0, 3).map((h) => `${h.distance.toFixed(1)} ${h.object.material.type} col=${h.object.material.color?.getHexString?.() ?? '-'} vc=${!!h.object.material.vertexColors} verts=${h.object.geometry.attributes.position.count} parentKids=${h.object.parent?.children.length}`).join(' | '));
  }
  return out.join('\n');
}));
await browser.close();
