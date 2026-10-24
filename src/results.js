import { t, ordinal } from './i18n.js';
import { formatTime } from './hud.js';

const $ = (id) => document.getElementById(id);

const BADGE_KEYS = { winner: 'badgeWinner', damage: 'badgeDamage', sinks: 'badgeSinks', tank: 'badgeTank', fishFood: 'badgeFishFood', air: 'badgeAir' };
const badgeSvg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const BADGE_ICONS = {
  winner: badgeSvg('<path d="M4 8 L8 12 L12 5 L16 12 L20 8 L18 18 H6 Z"/>'),
  damage: badgeSvg('<path d="M13 2 L5 14 H11 L10 22 L19 9 H13 Z"/>'),
  sinks: badgeSvg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 1 V5 M12 19 V23 M1 12 H5 M19 12 H23"/>'),
  tank: badgeSvg('<path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z"/>'),
  fishFood: badgeSvg('<path d="M3 12 C7 6 14 6 18 12 C14 18 7 18 3 12 Z"/><path d="M18 12 L22 8 V16 Z"/><circle cx="8" cy="11" r="1.2"/>'),
  air: badgeSvg('<path d="M2 14 L10 12 L13 4 L15 4 L14 11 L21 9 L22 11 L14 14 L15 20 L13 20 L10 15 L3 16 Z"/>'),
};

export function awardBadges(boats) {
  const out = new Map(boats.map((b) => [b, []]));
  const top = (key, value, ok = (v) => v > 0, low = false) => {
    let best = null;
    for (const b of boats) {
      const v = value(b);
      if (!ok(v)) continue;
      if (!best || (low ? v < value(best) : v > value(best))) best = b;
    }
    if (best) out.get(best).push(key);
  };
  const winner = boats.find((b) => b.finishOrder === 1);
  if (winner) out.get(winner).push('winner');
  top('damage', (b) => b.stats.dealt);
  top('sinks', (b) => b.stats.kills);
  top('tank', (b) => b.stats.taken, (v) => v >= 0, true);
  top('fishFood', (b) => b.stats.sunk);
  top('air', (b) => b.stats.jumps);
  return out;
}

export function renderResults(race) {
  const p = race.player;
  const badges = awardBadges(race.boats);
  $('results-title').textContent = p.finished ? t('youFinished', { place: ordinal(p.finishOrder), n: p.finishOrder }) : t('raceOver');
  $('standings').innerHTML = `<li class="st-head"><span></span><span></span><span></span><span></span><span class="st-mini"><span>${t('colDmg')}</span><span>${t('colKo')}</span><span>${t('colSunk')}</span></span></li>` + race.order
    .map((b) => {
      const time = b.finished ? formatTime(b.finishTime) : t('lapN', { n: b.lap });
      const items = (badges.get(b) ?? []).map((k) => `<em class="badge badge-${k}">${BADGE_ICONS[k]}${t(BADGE_KEYS[k])}</em>`).join('');
      return `<li class="${b.isPlayer ? 'me' : ''}">
        <span class="st-place">${ordinal(b.place)}</span>
        <span class="st-dot" style="--paint:#${b.color.toString(16).padStart(6, '0')}"></span>
        <span class="st-name">${b.name}<span class="badges">${items}</span></span>
        <span class="st-time">${time}</span>
        <span class="st-mini" title="${t('statDealt')} / ${t('statKills')} / ${t('statSunk')}"><span>${Math.round(b.stats.dealt)}</span><span>${b.stats.kills}</span><span>${b.stats.sunk}</span></span>
      </li>`;
    })
    .join('');
  const me = p.stats;
  const cards = [
    [t('statDealt'), Math.round(me.dealt)],
    [t('statKills'), me.kills],
    [t('statSunk'), me.sunk],
  ];
  $('race-stats').innerHTML = cards.map(([label, value]) => `<div class="stat-card"><span>${label}</span><b>${value}</b></div>`).join('');
}
