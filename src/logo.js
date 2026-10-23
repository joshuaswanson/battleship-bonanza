export const LOGO_SVG = `
<svg class="logo" viewBox="0 0 1000 400" role="img" aria-label="Battleship Bonanza">
  <defs>
    <linearGradient id="logo-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF38A"/>
      <stop offset="0.5" stop-color="#FFD23F"/>
      <stop offset="1" stop-color="#FF9A1F"/>
    </linearGradient>
  </defs>
  <g transform="translate(150 0) skewX(-14)">
    <g class="logo-streaks">
      <polygon points="-30,196 120,188 120,206" fill="#FF4141" stroke="#0E2A47" stroke-width="6" stroke-linejoin="miter"/>
      <polygon points="-70,236 108,226 108,248" fill="#FFFFFF" stroke="#0E2A47" stroke-width="6" stroke-linejoin="miter"/>
      <polygon points="-10,276 96,268 96,284" fill="#1FC8D6" stroke="#0E2A47" stroke-width="6" stroke-linejoin="miter"/>
    </g>
    <polygon points="196,30 800,30 800,136 176,136" fill="#FF4141" stroke="#0E2A47" stroke-width="10"/>
    <polygon points="800,30 838,30 838,136 800,136" fill="#0E2A47"/>
    <text x="490" y="120" text-anchor="middle" textLength="560" lengthAdjust="spacingAndGlyphs" class="logo-top">BATTLESHIP</text>
    <text x="512" y="326" text-anchor="middle" textLength="740" lengthAdjust="spacingAndGlyphs" class="logo-main logo-shadow">BONANZA</text>
    <text x="500" y="314" text-anchor="middle" textLength="740" lengthAdjust="spacingAndGlyphs" class="logo-main">BONANZA</text>
    <path d="M 96 350 L 900 326 L 930 338 L 120 378 Z" fill="#FFFFFF" stroke="#0E2A47" stroke-width="8" stroke-linejoin="miter"/>
  </g>
</svg>`;
