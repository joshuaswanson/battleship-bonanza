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
    this.camera.position.set(0, 3.4, 19);
    this.camera.lookAt(0, 0.4, 0);

    const { root, body } = buildBoat(0xff5a5f, ['machinegun']);
    root.rotation.y = 0.5;
    body.rotation.x = -0.32;
    root.position.y = 0.3;
    this.scene.add(root);
    root.add(splash());

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
  group.position.set(0, -0.85, -0.6);
  const rand = mulberry32(7);
  const cone = new THREE.ConeGeometry(1, 1, 10).translate(0, 0.5, 0);
  const white = toon(0xffffff);
  const aqua = toon(0x7fe6ee);
  const up = new THREE.Vector3(0, 1, 0);
  const petals = 22;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + rand() * 0.15;
    const x = Math.cos(a) * 2.25;
    const z = Math.sin(a) * 3.9;
    const height = 0.8 + rand() * 1.1 + (i % 2 ? 0 : 0.5);
    const width = 0.32 + rand() * 0.14;
    const petal = outlined(cone.clone().scale(width, height, width), i % 3 ? white : aqua, 0.05);
    petal.position.set(x, 0, z);
    const out = new THREE.Vector3(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.4).normalize();
    petal.quaternion.setFromUnitVectors(up, out);
    group.add(petal);
  }
  const foam = outlined(new THREE.TorusGeometry(1, 0.32, 10, 48).rotateX(Math.PI / 2).scale(2.3, 1, 3.95), white, 0.05);
  group.add(foam);
  return group;
}
