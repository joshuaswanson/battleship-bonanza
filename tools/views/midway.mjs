import { launch, startRace, wait, waitForGo } from '../lib.mjs';

console.log('# overview');
{
  const tag = process.argv[2] ?? 'a';
  const { browser, page } = await launch();
  const t0 = Date.now();
  await startRace(page, { map: 'midway' });
  console.log('built in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  await waitForGo(page);
  await page.evaluate(() => { window.__bb.autopilot = true; });
  await wait(3000);
  await page.screenshot({ path: `tools/shots/midway-race-${tag}.png` });
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
  });
  const views = [[0.6, 0, 8, 0.64, -1, 20], [0.12, 0, 8, 0.15, 1, 30], [0.3, 0, 10, 0.33, -1, 25], [0.45, 0, 6, 0.5, 0, 60]];
  let n = 0;
  for (const [f, la, y, f2, lb, y2] of views) {
    await page.evaluate(([f, la, y, f2, lb, y2]) => {
      const t = window.__bb.race.track;
      const k = Math.round(f * t.N);
      const k2 = Math.round(f2 * t.N);
      const a = t.point(k, la * t.hw[k]);
      const b = t.point(k2, lb * (t.hw[k2] + 60));
      const cam = window.__bb.camera;
      cam.position.set(a.x, y, a.z);
      cam.lookAt(b.x, y2, b.z);
    }, [f, la, y, f2, lb, y2]);
    await wait(700);
    await page.screenshot({ path: `tools/shots/midway-${n++}-${tag}.png` });
  }
  const close = await page.evaluate(() => {
    let carrier = null;
    window.__bb.scene.traverse((o) => { if (o.userData.burningCarrier) carrier = o.userData.burningCarrier; });
    return carrier;
  });
  if (close) {
    await page.evaluate((c) => { const cam = window.__bb.camera; cam.position.set(c.x + Math.cos(c.yaw) * 45, 22, c.z - Math.sin(c.yaw) * 45); cam.lookAt(c.x, 12, c.z); }, close);
    await wait(500);
    await page.screenshot({ path: `tools/shots/midway-carrier-${tag}.png` });
  }
  await page.evaluate(() => {
    const w = window.__bb;
    let best = null;
    w.scene.traverse((o) => { if (o.isInstancedMesh && o.count === 14 && !best) best = o; });
    const m = new w.THREE.Matrix4(); const p = new w.THREE.Vector3();
    best.getMatrixAt(0, m); p.setFromMatrixPosition(m);
    w.camera.position.set(p.x + 9, p.y + 3, p.z + 9);
    w.camera.lookAt(p);
    window.__frozenPlane = true;
  });
  await page.screenshot({ path: `tools/shots/midway-plane-${tag}.png` });
  console.log('errors', page.errors.length, page.errors[0] ?? '');
  await browser.close();
}

console.log('# battleships');
{
  const tag = process.argv[2] ?? 'a';
  const { browser, page } = await launch();
  await startRace(page, { map: 'midway' });
  await waitForGo(page);
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
  });
  await wait(2500);
  const views = [
    [40, 12, 95, 0, 8, 60],
    [-40, 14, 30, 0, 12, 10],
    [40, 14, -10, 0, 12, -10],
    [-35, 12, -100, 0, 8, -60],
    [0, 90, 5, 0, 0, 4],
    [22, 22, 0, 0, 16, 10],
  ];for (let i = 0; i < views.length; i++) {
    await page.evaluate((v) => {
      let ship = null;
      window.__bb.scene.traverse((o) => {
        if (o.userData.battleships && !ship) ship = o.userData.battleships[0];
      });
      const [ex, ey, ez, tx, ty, tz] = v;
      const c = Math.cos(ship.yaw);
      const s = Math.sin(ship.yaw);
      const w = (lx, lz) => [ship.x + lx * c + lz * s, ship.z - lx * s + lz * c];
      const [cx, cz] = w(ex, ez);
      const [lx, lz] = w(tx, tz);
      const cam = window.__bb.camera;
      cam.position.set(cx, ey, cz);
      cam.lookAt(lx, ty, lz);
    }, views[i]);
    await wait(500);
    await page.screenshot({ path: `tools/shots/battleship-${i}-${tag}.png` });
  }
  console.log('errors', page.errors.length, page.errors[0] ?? '');
  await browser.close();
}

console.log('# broadside');
{
  const { browser, page } = await launch();
  await startRace(page, { map: 'midway' });
  await waitForGo(page);
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
    let ship = null;
    window.__bb.scene.traverse((o) => {
      if (o.userData.battleships && !ship) ship = o.userData.battleships[0];
    });
    const c = Math.cos(ship.yaw);
    const s = Math.sin(ship.yaw);
    const w = (lx, lz) => [ship.x + lx * c + lz * s, ship.z - lx * s + lz * c];
    const [cx, cz] = w(95, 5);
    const [tx, tz] = w(0, 5);
    const cam = window.__bb.camera;
    cam.position.set(cx, 16, cz);
    cam.lookAt(tx, 16, tz);
  });
  await wait(1500);
  await page.evaluate(() => {
    let list = null;
    window.__bb.scene.traverse((o) => {
      if (o.userData.turrets) list = o.userData.turrets;
    });
    for (const tu of list.filter((t) => t.ship === 0)) {
      tu.targetYaw = tu.yaw;
      tu.targetPitch = tu.pitch;
      tu.retarget = 0;
      tu.cool = 0;
    }
  });
  for (let i = 0; i < 16; i++) {
    await wait(60);
    await page.screenshot({ path: `tools/shots/broadside-${String(i).padStart(2, '0')}.png` });
  }
  console.log('errors', page.errors.length, page.errors[0] ?? '');
  await browser.close();
}

console.log('# carriers');
{
  const tag = process.argv[2] ?? 'a';
  const { browser, page } = await launch();
  await startRace(page, { map: 'midway' });
  await waitForGo(page);
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
  });
  await wait(1500);
  const views = [
    [38, 14, 95, 0, 14, 105],
    [38, 14, -95, 0, 14, -112],
    [-40, 12, 0, 0, 14, 0],
    [45, 18, 15, 16, 18, 15],
    [26, 34, 34, 14, 24, 14],
    [-30, 20, 108, 0, 16, 100],
    [30, 20, -118, 0, 16, -108],
    [0, 26, 60, 12, 24, 18],
  ];for (let i = 0; i < views.length; i++) {
    await page.evaluate((v) => {
      let c = null;
      window.__bb.scene.traverse((o) => {
        if (o.userData.carriers && !c) c = o.userData.carriers[1];
      });
      const [ex, ey, ez, tx, ty, tz] = v;
      const co = Math.cos(c.yaw);
      const si = Math.sin(c.yaw);
      const w = (lx, lz) => [c.x + lx * co + lz * si, c.z - lx * si + lz * co];
      const [cx, cz] = w(ex, ez);
      const [lx, lz] = w(tx, tz);
      const cam = window.__bb.camera;
      cam.position.set(cx, ey, cz);
      cam.lookAt(lx, ty, lz);
    }, views[i]);
    await wait(400);
    await page.screenshot({ path: `tools/shots/carrier-${i}-${tag}.png` });
  }
  console.log('errors', page.errors.length, page.errors[0] ?? '');
  await browser.close();
}

console.log('# fleet');
{
  const tag = process.argv[2] ?? 'a';
  const { browser, page } = await launch();
  await startRace(page, { map: 'midway' });
  await waitForGo(page);
  await page.evaluate(() => {
    document.getElementById('hud').style.display = 'none';
    window.__bb.freeCam = true;
  });
  await wait(2000);
  const shots = {
    carrier: [0.62, -1, 120, 30, 0.62, -1, 30, 18],
    carrier2: [0.14, 1, 40, 45, 0.16, 1, 80, 20],
    destroyer: [0.04, -1, 5, 12, 0.06, -1, 30, 8],
    destroyer2: [0.48, 1, 0, 10, 0.5, 1, 30, 6],
    deck: [0.62, -1, 45, 32, 0.6, -1, 85, 18],
  };
  for (const [name, [f, side, lat, y, f2, side2, lat2, y2]] of Object.entries(shots)) {
    await page.evaluate(([f, side, lat, y, f2, side2, lat2, y2]) => {
      const t = window.__bb.race.track;
      const k = Math.round(f * t.N);
      const k2 = Math.round(f2 * t.N);
      const a = t.point(k, side * (t.hw[k] + lat));
      const b = t.point(k2, side2 * (t.hw[k2] + lat2));
      const cam = window.__bb.camera;
      cam.position.set(a.x, y, a.z);
      cam.lookAt(b.x, y2, b.z);
    }, [f, side, lat, y, f2, side2, lat2, y2]);
    await wait(500);
    await page.screenshot({ path: `tools/shots/fleet-${name}-${tag}.png` });
  }
  console.log('errors', page.errors.length, page.errors[0] ?? '');
  await browser.close();
}
