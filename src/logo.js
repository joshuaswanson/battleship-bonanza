const INK = '#0E2A47';

function starburst(spikes, outer, inner) {
  const points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    points.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return points.join(' ');
}

const HULL = 'M -200 0 L 170 0 Q 215 -4 245 -52 Q 236 34 172 86 L -168 86 Q -196 86 -204 58 Z';

const BOAT = `
  <path d="${HULL}" transform="rotate(-9)" fill="#FF5A5F" stroke="${INK}" stroke-width="11" stroke-linejoin="round" />
`;

const STREAKS = `
  <g class="lg-streaks" stroke="${INK}" stroke-width="6" stroke-linejoin="miter">
    <polygon points="40,250 250,238 250,258" fill="#FF4141" />
    <polygon points="10,296 236,284 236,306" fill="#FFFFFF" />
    <polygon points="60,342 226,332 226,350" fill="#1FC8D6" />
    <polygon points="960,226 760,236 760,218" fill="#FF4141" />
    <polygon points="990,276 770,284 770,264" fill="#FFFFFF" />
    <polygon points="945,324 784,330 784,314" fill="#1FC8D6" />
  </g>
`;

export const logoSvg = ({ boat = true, main = true, art = true } = {}) => `
<svg class="logo" viewBox="0 0 1000 600" role="img" aria-label="Battleship Bonanza">
  <defs>
    <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF38A"/>
      <stop offset="0.5" stop-color="#FFD23F"/>
      <stop offset="1" stop-color="#FF9A1F"/>
    </linearGradient>
    <radialGradient id="logo-burst">
      <stop offset="0" stop-color="#FFF6B0"/>
      <stop offset="0.6" stop-color="#FFD23F"/>
      <stop offset="1" stop-color="#FF8A1F"/>
    </radialGradient>
  </defs>
  ${art ? `  <g transform="translate(500 300)">
    <g class="lg-burst-pop"><g class="lg-burst">
      <polygon points="${starburst(20, 300, 222)}" fill="url(#logo-burst)" stroke="${INK}" stroke-width="10" stroke-linejoin="round" />
    </g></g>
  </g>
  ${STREAKS}
  <g class="lg-top">
    <path d="M 205 186 Q 500 -12 795 186" fill="none" stroke="${INK}" stroke-width="112" />
    <path d="M 205 186 Q 500 -12 795 186" fill="none" stroke="#FF4141" stroke-width="92" />
    <g class="logo-top" data-arc="top" data-text="BATTLESHIP"></g>
  </g>
  <g transform="translate(500 268)">
    <g class="lg-boat-in"><g class="lg-boat">${boat ? BOAT : ''}</g></g>
  </g>
` : ''}
  ${main ? `  <g class="lg-main">
    <g class="logo-main logo-shadow" data-arc="bottom" data-text="BONANZA" transform="translate(12 12)"></g>
    <g class="logo-main" data-arc="bottom" data-text="BONANZA"></g>
  </g>
` : ''}
</svg>`;

const ARCS = {
  top: { from: [205, 186], control: [500, -12], to: [795, 186], length: 560, size: 96, dy: 33 },
  bottom: { from: [105, 425], control: [500, 675], to: [895, 425], length: 760, size: 236, dy: 0 },
};

function sampleArc({ from, control, to }) {
  const points = [];
  let total = 0;
  for (let i = 0; i <= 600; i++) {
    const t = i / 600;
    const x = (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0] + t * t * to[0];
    const y = (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1] + t * t * to[1];
    if (i) total += Math.hypot(x - points[i - 1].x, y - points[i - 1].y);
    points.push({ x, y, s: total });
  }
  return { points, total };
}

function pointAt({ points }, s) {
  let i = 1;
  while (i < points.length - 1 && points[i].s < s) i++;
  const a = points[i - 1];
  const b = points[i];
  const k = (s - a.s) / (b.s - a.s || 1);
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export async function layoutLogoText(root) {
  await Promise.all([document.fonts.load('900 96px "Saira Condensed"'), document.fonts.load('900 236px "Saira Condensed"')]);
  const ctx = document.createElement('canvas').getContext('2d');
  for (const group of root.querySelectorAll('[data-arc]')) {
    const arc = ARCS[group.dataset.arc];
    const sampled = sampleArc(arc);
    ctx.font = `900 ${arc.size}px "Saira Condensed"`;
    const letters = [...group.dataset.text];
    const widths = letters.map((ch) => ctx.measureText(ch).width);
    const natural = widths.reduce((sum, w) => sum + w, 0);
    const squeeze = arc.length / natural;
    let s = (sampled.total - arc.length) / 2;
    group.replaceChildren();
    letters.forEach((ch, i) => {
      const advance = widths[i] * squeeze;
      const p = pointAt(sampled, s + advance / 2);
      s += advance;
      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('y', arc.dy);
      text.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${((p.angle * 180) / Math.PI).toFixed(2)}) scale(${squeeze.toFixed(3)} 1)`);
      text.textContent = ch;
      group.append(text);
    });
  }
}
