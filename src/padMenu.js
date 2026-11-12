const REPEAT_FIRST = 0.4;
const REPEAT_NEXT = 0.16;
const STICK = 0.55;
const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FOCUSABLE = 'button:not([disabled]), a[href], input, [role="radio"], [role="switch"], [role="tab"]';
const BACK = /back|close|resume|cancel|leave/i;

function visible(el) {
  if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function scope() {
  const screens = [...document.querySelectorAll('.screen:not(.hidden)')];
  return screens.findLast((s) => s.classList.contains('screen-dim')) ?? screens.at(-1) ?? document.body;
}

const targets = () => [...scope().querySelectorAll(FOCUSABLE)].filter(visible);

function move(direction) {
  const [dx, dy] = DIRECTIONS[direction];
  const list = targets();
  if (!list.length) return;
  const current = list.includes(document.activeElement) ? document.activeElement : null;
  if (!current) return list[0].focus();
  const from = current.getBoundingClientRect();
  const fx = from.left + from.width / 2;
  const fy = from.top + from.height / 2;
  let best = null;
  let bestCost = Infinity;
  for (const el of list) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    const along = (r.left + r.width / 2 - fx) * dx + (r.top + r.height / 2 - fy) * dy;
    const across = Math.abs((r.left + r.width / 2 - fx) * dy) + Math.abs((r.top + r.height / 2 - fy) * dx);
    if (along <= 4 || across > along * 2) continue;
    const cost = along + across * 2.5;
    if (cost < bestCost) {
      bestCost = cost;
      best = el;
    }
  }
  if (!best) return;
  best.focus();
  best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function back() {
  const button = targets().find((el) => BACK.test(el.id));
  if (button) button.click();
  else dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
}

export class PadMenu {
  constructor() {
    this.heldDirection = null;
    this.wait = 0;
    this.accept = false;
    this.cancel = false;
  }

  update(dt, pad) {
    if (!pad) return;
    const [x, y] = [pad.axes[0] ?? 0, pad.axes[1] ?? 0];
    const direction = pad.buttons[12]?.pressed || y < -STICK ? 'up' : pad.buttons[13]?.pressed || y > STICK ? 'down' : pad.buttons[14]?.pressed || x < -STICK ? 'left' : pad.buttons[15]?.pressed || x > STICK ? 'right' : null;
    if (direction !== this.heldDirection) {
      this.heldDirection = direction;
      this.wait = REPEAT_FIRST;
      if (direction) move(direction);
    } else if (direction) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = REPEAT_NEXT;
        move(direction);
      }
    }
    const accept = !!pad.buttons[0]?.pressed;
    if (accept && !this.accept) (targets().includes(document.activeElement) ? document.activeElement : targets()[0])?.click();
    this.accept = accept;
    const cancel = !!pad.buttons[1]?.pressed;
    if (cancel && !this.cancel) back();
    this.cancel = cancel;
  }

  rest(pad) {
    this.accept = !!pad?.buttons[0]?.pressed;
    this.cancel = !!pad?.buttons[1]?.pressed;
    this.heldDirection = null;
  }
}
