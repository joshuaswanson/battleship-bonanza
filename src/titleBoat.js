import * as THREE from 'three';
import { buildBoat } from './boatModel.js';
import { SUN_DIR } from './world.js';
import { toon, outlined, mulberry32 } from './toon.js';

export class TitleBoat {
  constructor(container) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'title-boat';
    container.append(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9fd8e8, 1.6));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
    sun.position.copy(SUN_DIR).multiplyScalar(10);
    this.scene.add(sun);
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
    this.camera.position.set(0, 3.4, 21);
    this.camera.lookAt(0, 0.4, 0);

    const { root, body } = buildBoat(0xff5a5f, ['machinegun']);
    root.rotation.y = 0.5;
    body.rotation.x = -0.32;
    root.position.y = 0.3;
    this.scene.add(root);
    this.scene.add(splash());

    new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = this.canvas;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
    }).observe(this.canvas);
  }
}

function splash() {
  const group = new THREE.Group();
  const rand = mulberry32(7);
  const ball = new THREE.SphereGeometry(1, 16, 12);
  const white = toon(0xffffff);
  const aqua = toon(0x7fe6ee);
  const add = (x, y, z, r, material) => {
    const mesh = outlined(ball, material, 0.08);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(r);
    group.add(mesh);
  };
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(Math.cos(a) * 3.4, -1.3 + rand() * 0.4, Math.sin(a) * 2.2, 0.55 + rand() * 0.35, i % 3 ? white : aqua);
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = 4 + rand() * 2.6;
    add(Math.cos(a) * d, -0.6 + rand() * 3, Math.sin(a) * d * 0.5, 0.15 + rand() * 0.22, rand() < 0.5 ? white : aqua);
  }
  return group;
}
