const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  item0: ['KeyO'],
  item1: ['KeyP'],
  pause: ['Escape'],
  mute: ['KeyM'],
};

const PAD_BUTTONS = { item0: [0, 4], item1: [1, 2, 5], pause: [9] };

export class Input {
  constructor() {
    this.held = new Set();
    this.queued = new Set();
    this.padPrev = {};
    this.state = { throttle: 0, steer: 0 };
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (!e.repeat) this.queued.add(e.code);
      this.held.add(e.code);
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => this.held.clear());
  }

  isHeld(action) {
    return BINDINGS[action].some((code) => this.held.has(code));
  }

  poll() {
    const pressed = new Set();
    for (const [action, codes] of Object.entries(BINDINGS)) {
      if (codes.some((code) => this.queued.has(code))) pressed.add(action);
    }
    this.queued.clear();

    let throttle = (this.isHeld('up') ? 1 : 0) - (this.isHeld('down') ? 1 : 0);
    let steer = (this.isHeld('right') ? 1 : 0) - (this.isHeld('left') ? 1 : 0);

    const pad = navigator.getGamepads?.().find(Boolean);
    if (pad) {
      const stick = pad.axes[0] ?? 0;
      if (Math.abs(stick) > 0.15) steer = stick;
      const gas = pad.buttons[7]?.value ?? 0;
      const brake = pad.buttons[6]?.value ?? 0;
      if (gas > 0.05 || brake > 0.05) throttle = gas - brake;
      for (const [action, buttons] of Object.entries(PAD_BUTTONS)) {
        const down = buttons.some((b) => pad.buttons[b]?.pressed);
        if (down && !this.padPrev[action]) pressed.add(action);
        this.padPrev[action] = down;
      }
    }

    this.state.throttle = throttle;
    this.state.steer = steer;
    this.pressed = pressed;
    return this.state;
  }
}
