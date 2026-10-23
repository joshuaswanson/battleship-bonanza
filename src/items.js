export const GROUPS = [
  { id: 'weapons' },
  { id: 'defense' },
  { id: 'gadgets' },
];

export const STATS = [
  { id: 'speed', color: '#1fc8d6' },
  { id: 'tough', color: '#4d9de0' },
  { id: 'punch', color: '#ff4141' },
  { id: 'tricks', color: '#a77bf3' },
];

const BASE_STATS = { speed: 4, tough: 2, punch: 1, tricks: 1 };

export function statsFor(items) {
  const stats = { ...BASE_STATS };
  for (const id of items) {
    for (const [key, delta] of Object.entries(ITEMS[id].stats)) stats[key] += delta;
  }
  for (const key of Object.keys(stats)) stats[key] = Math.max(1, Math.min(5, stats[key]));
  return stats;
}


export const ITEMS = {
  spikes: {
    stats: { tough: 1, punch: 1 },
    group: 'defense',
    passive: true,
  },
  armor: {
    stats: { tough: 3, speed: -2 },
    group: 'defense',
    passive: true,
  },
  camo: {
    stats: { tough: 1, tricks: 1 },
    group: 'defense',
    passive: true,
  },
  jetpack: {
    stats: { speed: 1, tricks: 2 },
    group: 'gadgets',
    cooldown: 8,
  },
  grapple: {
    stats: { speed: 1, tricks: 2 },
    group: 'gadgets',
    cooldown: 7,
  },
  emp: {
    stats: { tough: 1, tricks: 2 },
    group: 'gadgets',
    cooldown: 7,
  },
  machinegun: {
    stats: { punch: 2 },
    group: 'weapons',
    hold: true,
  },
  laser: {
    stats: { punch: 3 },
    group: 'weapons',
    hold: true,
  },
  saw: {
    stats: { punch: 2, tough: 1 },
    group: 'weapons',
    passive: true,
  },
  missiles: {
    stats: { punch: 3 },
    group: 'weapons',
    cooldown: 6,
  },
  mines: {
    stats: { punch: 2, tricks: 1 },
    group: 'weapons',
    cooldown: 3,
  },
};

export const ITEM_IDS = Object.keys(ITEMS);

export const ICONS = {
  spikes: '<path d="M2 20 L6 6 L10 20 L14 6 L18 20 L22 6" /><path d="M1 21 H23" />',
  armor: '<path d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z" /><path d="M8 11 H16 M12 7 V15" />',
  camo: '<path d="M2 12 C5 6.5 8.5 5 12 5 C15.5 5 19 6.5 22 12 C19 17.5 15.5 19 12 19 C8.5 19 5 17.5 2 12 Z" /><circle cx="12" cy="12" r="3" /><path d="M4 21 L20 3" />',
  jetpack: '<rect x="5" y="3" width="5" height="12" rx="2.5" /><rect x="14" y="3" width="5" height="12" rx="2.5" /><path d="M7.5 17 L6 22 M7.5 17 L9 22 M16.5 17 L15 22 M16.5 17 L18 22" />',
  grapple: '<path d="M12 2 V14" /><path d="M5 11 C5 17 8 20 12 20 C16 20 19 17 19 11" /><path d="M5 11 L2 14 M19 11 L22 14" />',
  emp: '<circle cx="12" cy="12" r="10" /><path d="M13 4 L7 13 H12 L10 20 L17 10 H12 Z" />',
  machinegun: '<path d="M3 7 H15 L19 9 L15 11 H3 Z" /><path d="M3 15 H15 L19 17 L15 19 H3 Z" /><path d="M21 8 V10 M21 16 V18" />',
  laser: '<path d="M2 12 H15" /><circle cx="19" cy="12" r="3" /><path d="M19 4 V6 M19 18 V20 M24 12 H22 M23 7 L21.5 8.5 M23 17 L21.5 15.5" />',
  saw: '<circle cx="12" cy="12" r="3" /><path d="M12 1 L14 5 L18 3 L18 7.5 L22.5 7.5 L20 11 L23 14 L19 15.5 L20 20 L15.5 19 L14 23 L11 20 L7.5 22.5 L7 18 L2.5 17.5 L4.5 13.5 L1 10.5 L5 9 L4 4.5 L8.5 5.5 Z" />',
  missiles: '<path d="M4 20 L8 16 M8 16 L16 8 C18 6 21 3 21 3 C21 3 18 6 16 8" /><path d="M16 8 L18 10 L8.5 19.5 L4.5 15.5 L14 6 Z" /><path d="M5.5 14.5 L2 14 L5 11 M9.5 18.5 L10 22 L13 19" />',
  mines: '<circle cx="12" cy="13" r="6" /><path d="M12 3 V7 M12 19 V23 M2 13 H6 M18 13 H22 M5 6 L7.5 8.5 M19 6 L16.5 8.5 M5 20 L7.5 17.5 M19 20 L16.5 17.5" />',
};

export function iconSvg(id) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg>`;
}
