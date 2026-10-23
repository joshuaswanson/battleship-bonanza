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
  const river = map.height
    ? {
        falls: project(...map.falls).s,
        liftStart: project(...map.lift[0]).s,
        liftEnd: project(...map.lift[1]).s,
      }
    : null;

  function level(s) {
    if (!river) return 0;
    const lower = ahead(river.falls, river.liftStart);
    const climb = ahead(river.liftStart, river.liftEnd);
    const sinceFalls = ahead(river.falls, s);
    if (sinceFalls < lower) return 0;
    if (sinceFalls < lower + climb) {
      const u = (sinceFalls - lower) / climb;
      return map.height * u * u * (3 - 2 * u);
    }
    return map.height;
  }

  function onLift(s) {
    return !!river && ahead(river.liftStart, s) < ahead(river.liftStart, river.liftEnd);
  }

  return { N, length, spacing, px, pz, tx, tz, nx, nz, wrap, project, point, heading, halfWidth: map.halfWidth, map, river, level, onLift, ahead };
}
