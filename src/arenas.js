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
};
