const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;

const turned = ([x, z, ...rest], heading) => (heading === undefined ? [-x, -z, ...rest] : [-x, -z, heading + Math.PI, ...rest.slice(1)]);
const mirrored = (spots, headed = false) => spots.flatMap((s) => (s[0] === 0 && s[1] === 0 ? [s] : [s, turned(s, headed ? s[2] : undefined)]));

function ellipseLoop(rx, rz, count) {
  return Array.from({ length: count }, (_, k) => {
    const a = (k / count) * Math.PI * 2;
    return [Math.cos(a) * rx, Math.sin(a) * rz];
  });
}

export const ARENAS = {
  bay: {
    id: 'bay',
    halfWidth: 30,
    control: ellipseLoop(300, 180, 16),
    arena: {
      rx: 390,
      rz: 240,
      bases: [[-310, 0], [310, 0]],
      islands: mirrored([[0, 0, 24, 46], [120, 95, 15, 38], [175, -75, 10, 52], [70, -150, 13, 30], [235, 140, 9, 44], [-30, 115, 8, 34], [205, 30, 7, 26]]),
      arches: mirrored([[0, 150, EAST, 20]], true),
    },
    pads: mirrored([[-230, 90, EAST], [-230, -90, EAST], [0, 75, EAST]], true),
    ramps: mirrored([[-150, 50, EAST], [-60, -55, WEST]], true),
  },
  fjord: {
    id: 'fjord',
    halfWidth: 30,
    control: ellipseLoop(290, 170, 16),
    arena: {
      rx: 380,
      rz: 235,
      bases: [[-300, 0], [300, 0]],
      obstacles: mirrored([
        [0, 0, 36, 22, 0.3, 15, 'chapel'],
        [140, 95, 21, 14, 0.6, 12, 'pines'],
        [175, -85, 15, 26, -0.4, 14, 'pines'],
        [70, -140, 18, 12, 0.2, 9, 'pines'],
        [245, 140, 13, 13, 0, 10, 'pines'],
        [-35, 122, 11, 17, 0.9, 8, 'rocks'],
        [215, 28, 9, 9, 0, 6, 'rocks'],
      ]),
    },
    pads: mirrored([[-230, 90, EAST], [-230, -90, EAST], [0, 72, EAST]], true),
    ramps: mirrored([[-150, 45, EAST], [-70, -62, WEST]], true),
  },
  lagoon: {
    id: 'lagoon',
    halfWidth: 30,
    control: ellipseLoop(290, 175, 16),
    arena: {
      rx: 385,
      rz: 240,
      bases: [[-305, 0], [305, 0]],
      obstacles: mirrored([
        [0, 0, 31, 31, 0, 2, 'pyramid'],
        [125, 85, 10, 10, 0, 2, 'tiki'],
        [185, -75, 10, 10, 0, 2, 'tiki'],
        [60, -135, 10, 10, 0, 2, 'tiki'],
        [240, 135, 19, 12, 0.5, 4, 'ruin'],
        [-40, 128, 15, 10, -0.3, 4, 'ruin'],
        [215, 30, 9, 9, 0, 13, 'palms'],
        [95, 165, 8, 8, 0, 11, 'palms'],
      ]),
    },
    pads: mirrored([[-235, 90, EAST], [-235, -90, EAST], [0, 78, EAST]], true),
    ramps: mirrored([[-150, 40, EAST], [-80, -70, WEST]], true),
  },
  harbor: {
    id: 'harbor',
    halfWidth: 30,
    control: ellipseLoop(290, 170, 16),
    arena: {
      rx: 380,
      rz: 230,
      bases: [[-300, 0], [300, 0]],
      obstacles: mirrored([
        [0, 0, 60, 11, 0.45, 0, 'ship'],
        [130, 92, 24, 8, 0.3, 0, 'barge'],
        [175, -78, 22, 8, -0.6, 0, 'barge'],
        [62, -138, 20, 7, 0.1, 0, 'barge'],
        [242, 135, 17, 7, 0.9, 0, 'barge'],
        [-45, 122, 15, 6, -0.2, 0, 'pontoon'],
        [212, 26, 7, 7, 0, 0, 'beacon'],
      ]),
    },
    pads: mirrored([[-230, 88, EAST], [-230, -88, EAST], [0, 74, EAST]], true),
    ramps: mirrored([[-150, 42, EAST], [-78, -64, WEST]], true),
  },
};
