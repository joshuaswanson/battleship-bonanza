const BINDINGS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  item0: ['KeyO'],
  item1: ['KeyP'],
  pause: ['Escape'],
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
    addEventListener('blur', () => {
      this.held.clear();
      this.touch.clear();
    });
    this.touch = new Set();
    this.touchQueued = new Set();
    this.touchMode = false;
  }

  bindTouch(root) {
    const pointers = new Map();
    const refresh = () => {
      this.touch.clear();
      for (const action of pointers.values()) this.touch.add(action);
    };
    for (const button of root.querySelectorAll('[data-touch]')) {
      const action = button.dataset.touch;
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        this.touchMode = true;
        pointers.set(e.pointerId, action);
        this.touchQueued.add(action);
        button.classList.add('down');
        refresh();
      });
      const release = (e) => {
        pointers.delete(e.pointerId);
        button.classList.remove('down');
        refresh();
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('contextmenu', (e) => e.preventDefault());
    }
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
    for (const action of this.touchQueued) if (action === 'item0' || action === 'item1') pressed.add(action);
    this.touchQueued.clear();

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

    if (this.touchMode) {
      if (!throttle) throttle = this.touch.has('brake') ? -1 : 1;
      if (!steer) steer = (this.touch.has('right') ? 1 : 0) - (this.touch.has('left') ? 1 : 0);
    }
    this.state.throttle = throttle;
    this.state.steer = steer;
    this.state.hold0 = this.isHeld('item0') || this.touch.has('item0') || !!pad?.buttons[0]?.pressed || !!pad?.buttons[4]?.pressed;
    this.state.hold1 = this.isHeld('item1') || this.touch.has('item1') || !!pad?.buttons[1]?.pressed || !!pad?.buttons[5]?.pressed;
    this.pressed = pressed;
    return this.state;
  }
}
