import * as THREE from 'three';

export const HALF_WIDTH = 28;

const CONTROL = [
  [0, 0], [140, -10], [260, 30], [330, 130], [300, 240], [190, 270],
  [110, 200], [20, 230], [-60, 320], [-190, 310], [-280, 200], [-260, 80],
  [-310, -40], [-230, -150], [-100, -120],
];

export function createTrack() {
  const curve = new THREE.CatmullRomCurve3(
    CONTROL.map(([x, z]) => new THREE.Vector3(x, 0, z)),
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

  return { N, length, spacing, px, pz, tx, tz, nx, nz, wrap, project, point, heading, halfWidth: HALF_WIDTH };
}
