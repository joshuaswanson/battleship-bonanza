import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 1280, height: 760 } });
const page = await browser.newPage();
const wait = (t) => new Promise((r) => setTimeout(r, t));
await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
for (const map of (process.argv[2] ?? 'bay,jungle').split(',')) {
  await page.evaluate((m) => { window.__bb.map = m; }, map);
  await page.evaluate(() => document.getElementById('btn-play').click());
  await wait(1500);
  await page.evaluate(() => document.getElementById('btn-start').click());
  await wait(1500);
  await page.evaluate(() => document.getElementById('btn-go').click());
  await wait(4000);
  console.log(map, await page.evaluate(() => {
    const { scene } = window.__bb;
    const rows = [];
    let calls = 0;
    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
    scene.traverse((o) => {
      if (!o.isMesh || !visible(o)) return;
      calls++;
      const g = o.geometry;
      const t = (g.index ? g.index.count : g.attributes.position.count) / 3;
      const n = o.isInstancedMesh ? o.count : 1;
      rows.push([t * n, `${o.isInstancedMesh ? 'inst' : 'mesh'} ${o.material.type === 'ShaderMaterial' ? 'outline/shader' : o.material.type} col=${o.material.color?.getHexString?.()} tris=${t} x${n}`]);
    });
    rows.sort((a, b) => b[0] - a[0]);
    const total = rows.reduce((s, r) => s + r[0], 0);
    const boatMeshes = window.__bb.race.boats.reduce((s, b) => { let c = 0; b.model.root.traverse((o) => { if (o.isMesh) c++; }); return s + c; }, 0);
    return `meshes=${calls} boatMeshes=${boatMeshes} total=${(total / 1e6).toFixed(2)}M\n` + rows.slice(0, 16).map((r) => `${(r[0] / 1e6).toFixed(2)}M ${r[1]}`).join('\n');
  }));
  await page.goto('http://localhost:5288/', { waitUntil: 'networkidle0' });
}
await browser.close();
