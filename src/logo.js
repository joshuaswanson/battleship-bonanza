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

export const logoSvg = ({ boat = true } = {}) => `
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
  <g transform="translate(500 300)">
    <g class="lg-burst-pop"><g class="lg-burst">
      <polygon points="${starburst(20, 300, 222)}" fill="url(#logo-burst)" stroke="${INK}" stroke-width="10" stroke-linejoin="round" />
    </g></g>
  </g>
  ${STREAKS}
  <path id="lg-arc-top" d="M 175 205 Q 500 -15 825 205" fill="none" />
  <path id="lg-arc-bottom" d="M 105 425 Q 500 675 895 425" fill="none" />
  <path id="lg-arc-bottom-shadow" d="M 117 437 Q 512 687 907 437" fill="none" />
  <g class="lg-top">
    <path d="M 205 186 Q 500 -12 795 186" fill="none" stroke="${INK}" stroke-width="112" />
    <path d="M 205 186 Q 500 -12 795 186" fill="none" stroke="#FF4141" stroke-width="92" />
    <text class="logo-top" dy="33"><textPath href="#lg-arc-top" startOffset="50%" text-anchor="middle" textLength="560" lengthAdjust="spacingAndGlyphs">BATTLESHIP</textPath></text>
  </g>
  <g transform="translate(500 268)">
    <g class="lg-boat-in"><g class="lg-boat">${boat ? BOAT : ''}</g></g>
  </g>
  <g class="lg-main">
    <text class="logo-main logo-shadow"><textPath href="#lg-arc-bottom-shadow" startOffset="50%" text-anchor="middle" textLength="760" lengthAdjust="spacingAndGlyphs">BONANZA</textPath></text>
    <text class="logo-main"><textPath href="#lg-arc-bottom" startOffset="50%" text-anchor="middle" textLength="760" lengthAdjust="spacingAndGlyphs">BONANZA</textPath></text>
  </g>
</svg>`;
