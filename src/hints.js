import { ITEMS } from './items.js';
import { t, itemName } from './i18n.js';

const SEEN = 'bb-hints-seen';

function itemHint(id, slot, touch) {
  const item = ITEMS[id];
  const key = touch ? t(slot === 0 ? 'frontSlot' : 'backSlot') : slot === 0 ? 'O' : 'P';
  const name = itemName(id);
  if (item.passive) return { text: t('hintPassive', { name }), done: () => false, life: 4 };
  const action = slot === 0 ? 'item0' : 'item1';
  const hold = slot === 0 ? 'hold0' : 'hold1';
  return {
    text: t(item.hold ? 'hintHold' : 'hintTap', { key, name }),
    done: (state, pressed) => pressed.has(action) || state[hold],
    life: 12,
  };
}

export class Hints {
  constructor(el) {
    this.el = el;
    this.steps = [];
  }

  start(race, touch) {
    this.steps = [];
    this.current = null;
    this.el.classList.remove('on');
    if (localStorage.getItem(SEEN) || !race.player) return;
    this.steps = [
      { text: t(touch ? 'hintDriveTouch' : 'hintDrive'), done: (state) => !touch && state.throttle > 0 && state.steer !== 0, life: touch ? 5 : 12 },
      ...race.player.items.map((id, slot) => itemHint(id, slot, touch)),
    ];
    this.wait = 0.4;
  }

  update(dt, race, state, pressed) {
    if (!this.steps.length && !this.current) return;
    if (race.state !== 'racing' || !race.player?.alive) return;
    if (this.current) {
      this.current.life -= dt;
      this.current.age += dt;
      if (this.current.age > 1 && (this.current.done(state, pressed) || this.current.life <= 0)) {
        this.current = null;
        this.el.classList.remove('on');
        this.wait = 1.2;
        if (!this.steps.length) localStorage.setItem(SEEN, '1');
      }
      return;
    }
    this.wait -= dt;
    if (this.wait > 0) return;
    this.current = { ...this.steps.shift(), age: 0 };
    this.el.textContent = this.current.text;
    this.el.classList.add('on');
  }

  stop() {
    this.steps = [];
    this.current = null;
    this.el.classList.remove('on');
  }
}
