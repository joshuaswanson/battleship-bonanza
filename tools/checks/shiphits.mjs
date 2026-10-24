import { launch, startRace, waitForGo, isolate, wait, check } from '../lib.mjs';

const { browser, page } = await launch();
await startRace(page, { map: 'midway' });
await waitForGo(page);
await isolate(page);
const decks = await page.evaluate(() => {
  let data;
  window.__bb.scene.traverse((o) => { if (o.userData.decks) data = o.userData; });
  window.__ud = data;
  return data.decks.map((d) => ({ L: Math.round(d.rz * 2), max: Math.round(Math.max(...d.tops)), mid: Math.round(d.tops[20]), ends: [Math.round(d.tops[0]), Math.round(d.tops.at(-1))] }));
});
console.log(JSON.stringify(decks));
check('every ship has a deck profile', decks.every((d) => d.mid > 4 && d.max > d.mid - 1), JSON.stringify(decks.map((d) => d.mid)));
await page.evaluate(() => {
  window.__booms = 0;
  const fx = window.__bb.race.fx;
  const explosion = fx.explosion.bind(fx);
  fx.explosion = (x, y, z, p) => {
    if (y > 2) window.__booms++;
    return explosion(x, y, z, p);
  };
  window.__bb.steps = 4;
});
await wait(process.env.QUICK ? 0 : 30000);
const natural = await page.evaluate(() => window.__booms);
console.log('shipboard explosions in 120 s of play:', natural);
await page.evaluate(() => { window.__bb.steps = 1; });
const at = await page.evaluate(() => {
  const { THREE } = window.__bb;
  const d = window.__ud.decks.find((x) => x.rz > 80 && x.rz < 100);
  const lz = d.rz * 0.3;
  const p = new THREE.Vector3(d.x + Math.sin(d.rot) * lz, d.tops[Math.floor((0.3 / 2 + 0.5) * 40)], d.z + Math.cos(d.rot) * lz);
  window.__ud.hitShip(p, 1.8);
  window.__bb.freeCam = true;
  document.getElementById('hud').style.display = 'none';
  const cam = window.__bb.camera;
  cam.position.set(p.x + Math.cos(d.rot) * 60, p.y + 25, p.z - Math.sin(d.rot) * 60);
  cam.lookAt(p);
  return p;
});
await wait(250);
await page.screenshot({ path: 'tools/shots/shiphit-0.png' });
await wait(3000);
await page.screenshot({ path: 'tools/shots/shiphit-1.png' });
check('no page errors', page.errors.length === 0, page.errors[0]);
await browser.close();
