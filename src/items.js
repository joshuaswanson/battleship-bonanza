export const GROUPS = [
  { id: 'weapons', label: 'Weapons' },
  { id: 'defense', label: 'Defense' },
  { id: 'gadgets', label: 'Gadgets' },
];

export const STATS = [
  { id: 'speed', label: 'Speed', color: '#1fc8d6' },
  { id: 'tough', label: 'Toughness', color: '#4d9de0' },
  { id: 'punch', label: 'Punch', color: '#ff4141' },
  { id: 'tricks', label: 'Tricks', color: '#a77bf3' },
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

const SOLO_NAMES = {
  spikes: 'The Pufferfish',
  armor: 'The Tin Can',
  camo: 'The Floating Shrub',
  jetpack: 'The Flying Fish',
  grapple: 'The Octopus',
  emp: 'The Thundercloud',
  machinegun: 'The Woodpecker',
  laser: 'The Disco Ball',
  saw: 'The Pizza Cutter',
  missiles: 'The Fireworks Show',
  mines: 'The Sea Urchin',
};

const PAIR_NAMES = {
  'armor+camo': 'The Sneaky Turtle',
  'armor+emp': 'The Lightning Rod',
  'armor+grapple': 'The Iron Claw',
  'armor+jetpack': 'The Flying Anvil',
  'armor+laser': 'The Iron Lighthouse',
  'armor+machinegun': 'The Rolling Fortress',
  'armor+mines': 'The Armored Litterbug',
  'armor+missiles': 'The Actual Battleship',
  'armor+saw': 'The Can Opener',
  'armor+spikes': 'The Iron Porcupine',
  'camo+emp': 'The Electric Fern',
  'camo+grapple': 'The Swamp Snatcher',
  'camo+jetpack': 'The Leaping Shrub',
  'camo+laser': 'The Sniper',
  'camo+machinegun': 'The Jungle Commando',
  'camo+mines': 'The Booby Trap',
  'camo+missiles': 'The Ambush',
  'camo+saw': 'The Lawnmower',
  'camo+spikes': 'The Thorn Bush',
  'emp+grapple': 'The Jellyfish',
  'emp+jetpack': 'The Thunderbird',
  'emp+laser': 'The Tesla Tower',
  'emp+machinegun': 'The Thunderstorm',
  'emp+mines': 'The Static Trap',
  'emp+missiles': 'The Storm Chaser',
  'emp+saw': 'The Electric Razor',
  'emp+spikes': 'The Zappy Cactus',
  'grapple+jetpack': 'The Trapeze Artist',
  'grapple+laser': 'The Tractor Beam',
  'grapple+machinegun': 'The Pirate Raider',
  'grapple+mines': 'The Trapdoor Spider',
  'grapple+missiles': 'The Bounty Hunter',
  'grapple+saw': 'The Hungry Crab',
  'grapple+spikes': 'The Harpoon Hedgehog',
  'jetpack+laser': 'The Starfighter',
  'jetpack+machinegun': 'The Attack Chopper',
  'jetpack+mines': 'The Dive Bomber',
  'jetpack+missiles': 'The Rocket Overload',
  'jetpack+saw': 'The Flying Pizza Cutter',
  'jetpack+spikes': 'The Flying Cactus',
  'laser+machinegun': 'The Arcade Machine',
  'laser+mines': 'The Trip Wire',
  'laser+missiles': 'The Space Invader',
  'laser+saw': 'The Lightsaber',
  'laser+spikes': 'The Dazzling Thistle',
  'machinegun+mines': 'The Popcorn Popper',
  'machinegun+missiles': 'The Fourth of July',
  'machinegun+saw': 'The Wood Chipper',
  'machinegun+spikes': 'The Rattlesnake',
  'mines+missiles': 'The Kaboom Express',
  'mines+saw': 'The Junkyard Dog',
  'mines+spikes': 'The Caltrop Trail',
  'missiles+saw': 'The Demolition Crew',
  'missiles+spikes': 'The Pineapple Express',
  'saw+spikes': 'The Blender',
};
export function comboName(items) {
  if (items.length === 0) return 'The Plain Dinghy';
  if (items.length === 1) return SOLO_NAMES[items[0]];
  return PAIR_NAMES[[...items].sort().join('+')];
}

export const ITEMS = {
  spikes: {
    stats: { tough: 1, punch: 1 },
    name: 'Spikes',
    group: 'defense',
    passive: true,
    blurb: 'Keep other boats at a distance AND look intimidating. Grappling hooks love them though.',
  },
  armor: {
    stats: { tough: 3, speed: -2 },
    name: 'Armor',
    group: 'defense',
    passive: true,
    blurb: "Turn your boat into a heavy armored bathtub. Deflects bullets, spikes and saw blades, but you won't move as fast.",
  },
  camo: {
    stats: { tough: 1, tricks: 1 },
    name: 'Camo',
    group: 'defense',
    passive: true,
    blurb: "Missiles and the minimap can't find you, and machine guns won't lock on. As far as anyone knows, you're just a floating shrub.",
  },
  jetpack: {
    stats: { speed: 1, tricks: 2 },
    name: 'Jet pack',
    group: 'gadgets',
    cooldown: 8,
    blurb: "Who said boats can't fly? Leap over sea mines and dodge missiles and grappling hooks.",
  },
  grapple: {
    stats: { speed: 1, tricks: 2 },
    name: 'Grappling hook',
    group: 'gadgets',
    cooldown: 7,
    blurb: 'Snag any boat and get slingshotted right past it. Boats with spikes or a jet pack are extra easy to catch.',
  },
  emp: {
    stats: { tough: 1, tricks: 2 },
    name: 'EMP',
    group: 'gadgets',
    cooldown: 7,
    blurb: 'A big zappy bubble that swats away missiles and grappling hooks, and jolts anyone nearby. Rude, but effective.',
  },
  machinegun: {
    stats: { punch: 2 },
    name: 'Machine gun',
    group: 'weapons',
    hold: true,
    blurb: "Hold the trigger for a hailstorm of bullets. Just don't let it overheat!",
  },
  laser: {
    stats: { punch: 3 },
    name: 'Laser',
    group: 'weapons',
    hold: true,
    blurb: 'Hold for a sizzling beam and steer to slice up anyone in the way. Melts armor, but saw blades bounce it back at you.',
  },
  saw: {
    stats: { punch: 2, tough: 1 },
    name: 'Saw blade',
    group: 'weapons',
    passive: true,
    blurb: 'Slice up anyone who gets too close and deflect lasers!',
  },
  missiles: {
    stats: { punch: 3 },
    name: 'Heat seeking missiles',
    group: 'weapons',
    cooldown: 6,
    blurb: "Fire and forget. They chase down the nearest boat in any direction, unless it's hiding in camo.",
  },
  mines: {
    stats: { punch: 2, tricks: 1 },
    name: 'Sea mines',
    group: 'weapons',
    cooldown: 3,
    blurb: 'Leave a little present behind you. Tailgaters get launched sky high.',
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
