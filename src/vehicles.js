import { TruckForm } from './truck.js';
import { JetForm } from './jetForm.js';
import { HeliForm } from './heliForm.js';
import { TankForm } from './tankForm.js';
import { CarForm } from './carForm.js';
import { SubForm } from './subForm.js';
import { CartForm } from './cartForm.js';
import { SkiForm } from './skiForm.js';
import { ScooterForm } from './scooterForm.js';
import { LAND_GRIP } from './race/shared.js';

const LAND_PEAK = 32;
const LOW_PEAK = 16;
const DUST = [0xc9a46b, 0xa98852];
const SNOW = [0xffffff, 0xe6f2ff];
export const DUST_IMPACT = { pool: 'puffs', colors: DUST };
const SOOT_IMPACT = { pool: 'soot', colors: DUST };

const onLand = (track, s) => track.onLand(s);
const inFlight = (track, s) => track.jetCruise(s);
const onSnow = (track, s) => track.onSnow(s);
const never = () => false;

const BASE = {
  cruising: never,
  speed: 1,
  thrust: 1,
  grip: 1,
  stretchSpeed: 1,
  launchPeak: LAND_PEAK,
  launchBlast: 0,
  plunge: false,
  rigid: true,
  mud: false,
  marks: null,
  trail: null,
  impact: null,
  shoreImpact: DUST_IMPACT,
  engine: undefined,
};

const wheeled = { cruising: onLand, grip: LAND_GRIP, rigid: false, marks: 'dirt', impact: DUST_IMPACT };
const flying = { cruising: inFlight, speed: 2.3, thrust: 4, launchPeak: LOW_PEAK };

export const VEHICLES = {
  truck: { ...BASE, ...wheeled, Form: TruckForm, mud: true, trail: 'dirt', engine: 'truck' },
  car: { ...BASE, ...wheeled, Form: CarForm, speed: 1.75, thrust: 2.8, grip: 4, marks: 'asphalt', engine: 'car' },
  scooter: { ...BASE, ...wheeled, Form: ScooterForm, speed: 1.25, thrust: 2.2, grip: 3, marks: null, engine: 'scooter' },
  tank: { ...BASE, ...wheeled, Form: TankForm, launchPeak: 15, launchBlast: 1.8, trail: 'sand', impact: SOOT_IMPACT, shoreImpact: SOOT_IMPACT, engine: 'tank' },
  jet: { ...BASE, ...flying, Form: JetForm },
  heli: { ...BASE, ...flying, Form: HeliForm },
  sub: { ...BASE, Form: SubForm, plunge: true, impact: 'bubbles' },
  cart: { ...BASE, Form: CartForm, stretchSpeed: 0.86, impact: DUST_IMPACT },
  ski: { ...BASE, Form: SkiForm, cruising: onSnow, speed: 1.5, thrust: 2.4, grip: 0.55, marks: 'snow', impact: { pool: 'puffs', colors: SNOW } },
};

export function vehicleOf(track) {
  const land = track.river?.land;
  return land ? (VEHICLES[land.form ?? land.kind] ?? null) : null;
}
