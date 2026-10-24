const easeIn = (u) => u * u * u;
const easeOut = (u) => 1 - (1 - u) ** 3;

export function createWipe(canvas, sfx) {
  const ctx = canvas.getContext('2d');
  let wiping = false;

  function drawIris(radius, spin) {
    const scale = Math.min(devicePixelRatio, 1.5);
    const w = Math.round(innerWidth * scale);
    const h = Math.round(innerHeight * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const cx = w / 2;
    const cy = h / 2;
    const r = radius * Math.hypot(w, h) * 0.5;
    const band = Math.max(10 * scale, r * 0.26);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0e2a47';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(cx, cy, r + band, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    if (r <= 0.5) return;
    const segments = 8;
    for (let k = 0; k < segments; k++) {
      const a0 = spin + (k / segments) * Math.PI * 2;
      const a1 = spin + ((k + 1) / segments) * Math.PI * 2;
      ctx.fillStyle = k % 2 ? '#ffffff' : '#ff4141';
      ctx.beginPath();
      ctx.arc(cx, cy, r + band, a0, a1);
      ctx.arc(cx, cy, r, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = '#0e2a47';
    ctx.lineWidth = Math.max(3 * scale, band * 0.1);
    for (const rr of [r, r + band]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function animateIris(from, to, ms, ease, spinFrom, spinTo) {
    return new Promise((done) => {
      const start = performance.now();
      const step = (now) => {
        const u = Math.min(1, Math.max(0, (now - start) / ms));
        const k = ease(u);
        drawIris(from + (to - from) * k, spinFrom + (spinTo - spinFrom) * k);
        if (u < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }

  return async function wipe(fn) {
    if (wiping) return;
    wiping = true;
    sfx.unlock();
    sfx.play('whoosh');
    canvas.classList.add('on');
    await animateIris(1.05, 0, 420, easeIn, 0, -3.5);
    await fn();
    await new Promise((r) => setTimeout(r, 120));
    sfx.play('splash');
    await animateIris(0, 1.05, 520, easeOut, -3.5, -7);
    canvas.classList.remove('on');
    wiping = false;
  };
}
