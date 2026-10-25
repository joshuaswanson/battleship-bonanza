import * as THREE from 'three';

function smoothKeys(keys, f) {
  let a = keys[keys.length - 1];
  let b = keys[0];
  for (let k = 0; k < keys.length; k++) {
    if (keys[k][0] <= f) {
      a = keys[k];
      b = keys[(k + 1) % keys.length];
    }
  }
  let span = b[0] - a[0];
  let into = f - a[0];
  if (span <= 0) span += 1;
  if (into < 0) into += 1;
  const u = keys.length > 1 ? into / span : 0;
  return a[1] + (b[1] - a[1]) * u * u * (3 - 2 * u);
}

const STICK = 5;
const INTENT = 14;

export function createTrack(map, scale = 1) {
  const curve = new THREE.CatmullRomCurve3(
    map.control.map(([x, z]) => new THREE.Vector3(x * scale, 0, z * scale)),
    true,
    'centripetal',
  );
  const N = 1200;
  const BASE = 2 * N;
  const points = curve.getSpacedPoints(N);
  const length = curve.getLength();
  const spacing = length / N;
  const wrap = (i) => ((i % N) + N) % N;
  const ahead = (from, s) => (((s - from) % length) + length) % length;

  const keys = (map.widths ?? [[0, map.halfWidth]]).map(([f, w]) => [f, w * scale]);
  const routeSpecs = (map.routes ?? []).map((route) => {
    const from = wrap(Math.round(route.from * N));
    const to = wrap(Math.round(route.to * N));
    const p = (i) => points[i];
    const dir = (i) => points[(i + 1) % N].clone().sub(points[(i - 1 + N) % N]).normalize();
    const lead = route.lead ?? 30;
    const path = new THREE.CatmullRomCurve3(
      [
        p(from).clone(),
        p(from).clone().addScaledVector(dir(from), lead * scale),
        ...route.via.map(([x, z]) => new THREE.Vector3(x * scale, 0, z * scale)),
        p(to).clone().addScaledVector(dir(to), -lead * scale),
        p(to).clone(),
      ],
      false,
      'centripetal',
    );
    const count = Math.max(4, Math.round(path.getLength() / spacing));
    return { route, from, to, path, count, samples: path.getSpacedPoints(count).slice(1, -1) };
  });
  const total = BASE + routeSpecs.reduce((sum, r) => sum + r.samples.length, 0);

  const px = new Float32Array(total);
  const pz = new Float32Array(total);
  const tx = new Float32Array(total);
  const tz = new Float32Array(total);
  const nx = new Float32Array(total);
  const nz = new Float32Array(total);
  const hw = new Float32Array(total);
  const sAt = new Float32Array(total);
  const sScale = new Float32Array(total).fill(1);
  const next = new Int32Array(total).fill(-1);
  const prev = new Int32Array(total).fill(-1);
  const route = new Int16Array(total).fill(-1);

  for (let i = 0; i < N; i++) {
    px[i] = points[i].x;
    pz[i] = points[i].z;
    hw[i] = smoothKeys(keys, i / N);
    sAt[i] = i * spacing;
    next[i] = (i + 1) % N;
    prev[i] = (i - 1 + N) % N;
  }

  const routes = [];
  const forks = new Map();
  const joins = new Map();
  let cursor = BASE;
  routeSpecs.forEach((spec, id) => {
    const first = cursor;
    const count = spec.samples.length;
    const span = ahead(spec.from * spacing, spec.to * spacing);
    const realLength = spec.path.getLength();
    const width = (spec.route.halfWidth ?? map.halfWidth) * scale;
    const taper = Math.min(8, Math.floor(count / 4));
    spec.samples.forEach((p, k) => {
      const i = first + k;
      px[i] = p.x;
      pz[i] = p.z;
      const u = (k + 1) / (count + 1);
      sAt[i] = (spec.from * spacing + u * span) % length;
      sScale[i] = span / realLength;
      const edge = Math.min(k + 1, count - k) / (taper + 1);
      const blend = Math.min(1, edge);
      const ends = k < count / 2 ? hw[spec.from] : hw[spec.to];
      hw[i] = ends + (width - ends) * blend * blend * (3 - 2 * blend);
      route[i] = id;
      next[i] = k === count - 1 ? spec.to : i + 1;
      prev[i] = k === 0 ? spec.from : i - 1;
    });
    const info = { id, from: spec.from, to: spec.to, first, last: first + count - 1, count, length: realLength, span, halfWidth: width };
    routes.push(info);
    forks.set(spec.from, info);
    joins.set(spec.to, info);
    cursor += count;
  });

  const forkOf = new Int16Array(total).fill(-1);
  const zone = Math.round(60 / spacing);
  for (const r of routes) {
    for (let k = -Math.round(20 / spacing); k < zone; k++) forkOf[wrap(r.from + k)] = r.id;
    for (let k = 0; k < Math.min(zone, r.count); k++) forkOf[r.first + k] = r.id;
  }

  const tangent = (i) => {
    const a = prev[i];
    const b = next[i];
    const dx = px[b] - px[a];
    const dz = pz[b] - pz[a];
    const len = Math.hypot(dx, dz) || 1;
    tx[i] = dx / len;
    tz[i] = dz / len;
    nx[i] = tz[i];
    nz[i] = -tx[i];
  };
  for (let i = 0; i < N; i++) tangent(i);
  for (let i = BASE; i < total; i++) tangent(i);
  for (const r of routes) {
    const k = r.first + Math.min(r.count - 1, Math.round(45 / spacing));
    const m = wrap(r.from + Math.round(45 / spacing));
    r.side = (px[k] - px[m]) * nx[m] + (pz[k] - pz[m]) * nz[m] > 0 ? 1 : -1;
  }

  const norm = (idx) => {
    const i = Math.round(idx);
    return i >= BASE && i < total ? i : wrap(i);
  };

  const step = (idx, k, choose = null) => {
    let i = norm(idx);
    k = Math.round(k);
    for (; k > 0; k--) {
      const fork = forks.get(i);
      i = fork && choose?.(fork) ? fork.first : next[i];
    }
    for (; k < 0; k++) i = prev[i];
    return i;
  };

  const forkNear = (idx) => routes[forkOf[norm(idx)]] ?? null;

  const mainIndex = (idx) => {
    const i = norm(idx);
    return i < N ? i : wrap(Math.round(sAt[i] / spacing));
  };

  const neighbors = (i, out) => {
    out.length = 0;
    out.push(next[i], prev[i]);
    const fork = forks.get(i);
    if (fork) out.push(fork.first);
    const join = joins.get(i);
    if (join) out.push(join.last);
    return out;
  };

  const seen = new Uint32Array(total);
  let stamp = 0;
  const queue = new Int32Array(total);
  const depth = new Int32Array(total);
  const near = [];

  function nearestFrom(x, z, hint, window, want) {
    stamp++;
    let head = 0;
    let tail = 0;
    queue[tail] = hint;
    depth[tail++] = 0;
    seen[hint] = stamp;
    let best = hint;
    let bestD = Infinity;
    let bestScore = Infinity;
    const home = want ?? route[hint];
    while (head < tail) {
      const i = queue[head];
      const d = depth[head++];
      const dx = x - px[i];
      const dz = z - pz[i];
      const dist = dx * dx + dz * dz;
      const score = route[i] === home ? dist : (Math.sqrt(dist) + (want === undefined ? STICK : INTENT)) ** 2;
      if (score < bestScore) {
        bestScore = score;
        bestD = dist;
        best = i;
      }
      if (d >= window) continue;
      for (const j of neighbors(i, near)) {
        if (seen[j] === stamp) continue;
        seen[j] = stamp;
        queue[tail] = j;
        depth[tail++] = d + 1;
      }
    }
    return [best, bestD];
  }

  function project(x, z, hint = -1, window = 60, want = undefined) {
    let best = 0;
    let bestD = Infinity;
    if (hint < 0) {
      for (let i = 0; i < total; i++) {
        if (i === N) i = BASE;
        if (i >= total) break;
        const dx = x - px[i];
        const dz = z - pz[i];
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    } else {
      [best, bestD] = nearestFrom(x, z, norm(hint), window, want);
    }
    const dx = x - px[best];
    const dz = z - pz[best];
    return {
      idx: best,
      lateral: dx * nx[best] + dz * nz[best],
      s: sAt[best] + (dx * tx[best] + dz * tz[best]) * sScale[best],
      distance: Math.sqrt(bestD),
      route: route[best],
    };
  }

  function point(idx, lateral = 0) {
    const i = norm(idx);
    return { x: px[i] + nx[i] * lateral, z: pz[i] + nz[i] * lateral };
  }

  function heading(idx) {
    const i = norm(idx);
    return Math.atan2(tx[i], tz[i]);
  }

  const widthAt = (idx) => hw[norm(idx)];

  const segments = [{ start: 0, end: N - 1, ring: true, route: -1 }, ...routes.map((r) => ({ start: r.first, end: r.last, ring: false, route: r.id, from: r.from, to: r.to }))];

  let river = null;
  if (map.river) {
    const [tunnelIn, seam, tunnelOut] = map.river.tunnel.map((f) => Math.round((f * length) / spacing) * spacing);
    const drops = map.river.drops.map(([f, height]) => ({ s: f * length, height }));
    river = {
      speed: map.river.speed ?? 1,
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

  return {
    N,
    total,
    length,
    spacing,
    px,
    pz,
    tx,
    tz,
    nx,
    nz,
    hw,
    sAt,
    sScale,
    next,
    prev,
    route,
    routes,
    forks,
    forkNear,
    segments,
    wrap,
    norm,
    step,
    mainIndex,
    project,
    point,
    heading,
    halfWidth: map.halfWidth * scale,
    scale,
    widthAt,
    banked: !!(map.river || map.banked),
    map,
    river,
    level,
    inTunnel,
    pastSeam,
    ahead,
  };
}
