import * as THREE from 'three';

export function createTrack(map) {
  const curve = new THREE.CatmullRomCurve3(
    map.control.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  const N = 1200;
  const points = curve.getSpacedPoints(N);
  const length = curve.getLength();
  const spacing = length / N;

  const px = new Float32Array(N);
  const pz = new Float32Array(N);
  const tx = new Float32Array(N);
  const tz = new Float32Array(N);
  const nx = new Float32Array(N);
  const nz = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    px[i] = points[i].x;
    pz[i] = points[i].z;
  }
  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    const prev = (i - 1 + N) % N;
    const dx = px[next] - px[prev];
    const dz = pz[next] - pz[prev];
    const len = Math.hypot(dx, dz);
    tx[i] = dx / len;
    tz[i] = dz / len;
    nx[i] = tz[i];
    nz[i] = -tx[i];
  }

  const wrap = (i) => ((i % N) + N) % N;

  function project(x, z, hint = -1, window = 60) {
    let best = 0;
    let bestD = Infinity;
    const from = hint < 0 ? 0 : hint - window;
    const to = hint < 0 ? N - 1 : hint + window;
    for (let k = from; k <= to; k++) {
      const i = wrap(k);
      const dx = x - px[i];
      const dz = z - pz[i];
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const dx = x - px[best];
    const dz = z - pz[best];
    return {
      idx: best,
      lateral: dx * nx[best] + dz * nz[best],
      s: best * spacing + dx * tx[best] + dz * tz[best],
      distance: Math.sqrt(bestD),
    };
  }

  function point(idx, lateral = 0) {
    const i = wrap(Math.round(idx));
    return { x: px[i] + nx[i] * lateral, z: pz[i] + nz[i] * lateral };
  }

  function heading(idx) {
    const i = wrap(Math.round(idx));
    return Math.atan2(tx[i], tz[i]);
  }

  const ahead = (from, s) => (((s - from) % length) + length) % length;
  let river = null;
  if (map.river) {
    const [tunnelIn, seam, tunnelOut] = map.river.tunnel.map((f) => f * length);
    const drops = map.river.drops.map(([f, height]) => ({ s: f * length, height }));
    river = {
      slope: map.river.slope,
      drops,
      tunnelIn,
      seam,
      tunnelOut,
      top: map.river.slope * length + drops.reduce((sum, d) => sum + d.height, 0),
    };
  }

  function level(s, lap = 0) {
    if (!river) return 0;
    const d = ahead(river.seam, s) + lap * length;
    let h = river.top - river.slope * d;
    for (const drop of river.drops) if (d > ahead(river.seam, drop.s)) h -= drop.height;
    return h;
  }

  function inTunnel(s) {
    return !!river && ahead(river.tunnelIn, s) < ahead(river.tunnelIn, river.tunnelOut);
  }

  function pastSeam(s) {
    return ahead(river.seam, s) < ahead(river.seam, river.tunnelOut) + 100;
  }

  return { N, length, spacing, px, pz, tx, tz, nx, nz, wrap, project, point, heading, halfWidth: map.halfWidth, map, river, level, inTunnel, pastSeam, ahead };
}
