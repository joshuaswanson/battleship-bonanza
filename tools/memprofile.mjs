import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
await wait(5000);
console.log(await page.evaluate(() => {
  window.gc?.();
  const { scene } = window.__bb;
  const seen = new Set();
  const rows = [];
  let total = 0;
  let tris = 0;
  scene.traverse((o) => {
    if (!o.geometry || seen.has(o.geometry)) return;
    seen.add(o.geometry);
    let bytes = 0;
    for (const a of Object.values(o.geometry.attributes)) bytes += a.array?.byteLength ?? 0;
    if (o.geometry.index) bytes += o.geometry.index.array.byteLength;
    total += bytes;
    const count = o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position?.count ?? 0;
    rows.push([bytes, `${o.type} col=${o.material?.color?.getHexString?.()} vc=${!!o.material?.vertexColors} verts=${o.geometry.attributes.position?.count} inst=${o.count ?? ''}`]);
  });
  rows.sort((a, b) => b[0] - a[0]);
  let calls = 0;
  return `geometry bytes total ${(total / 1e6).toFixed(0)}MB, unique geometries ${seen.size}, heap ${(performance.memory.usedJSHeapSize / 1e6).toFixed(0)}MB\n` + rows.slice(0, 14).map((r) => `${(r[0] / 1e6).toFixed(1)}MB ${r[1]}`).join('\n');
}));
await browser.close();
