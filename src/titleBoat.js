import * as THREE from 'three';
import { buildBoat } from './boatModel.js';
import { SUN_DIR } from './world.js';
import { toon, outlined, INK } from './toon.js';
import { createWater } from './water.js';

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

    const { root, body, minigun, towRings } = buildBoat(0xff5a5f, ['machinegun']);
    for (const ring of towRings) for (const mesh of ring.userData.parts) mesh.visible = false;
    minigun.parent.rotation.x = 0;
    minigun.rotation.x = -0.22;
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

const RX = 2.35;
const RZ = 4.0;

function splash() {
  const group = new THREE.Group();
  group.position.set(0, -0.75, -0.5);

  const sea = createWater({ geometry: new THREE.CircleGeometry(1, 72).scale(RX * 1.55, RZ * 1.32, 1) });
  sea.mesh.position.y = -0.15;
  group.add(sea.mesh);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.06, 6, 96).rotateX(Math.PI / 2).scale(RX * 1.55, 1, RZ * 1.32),
    new THREE.MeshBasicMaterial({ color: INK }),
  );
  rim.position.y = -0.1;
  group.add(rim);
  group.add(outlined(new THREE.TorusGeometry(1, 0.22, 10, 96).rotateX(Math.PI / 2).scale(RX * 1.5, 1, RZ * 1.29), toon(0xffffff), 0.04));

  const around = 120;
  const rows = 10;
  const pos = [];
  const col = [];
  const index = [];
  const low = new THREE.Color(0x35d6e0);
  const high = new THREE.Color(0xffffff);
  const c = new THREE.Color();
  const crest = [];
  for (let i = 0; i <= around; i++) {
    const a = (i / around) * Math.PI * 2;
    const height = 0.75 + 0.55 * Math.pow(Math.sin(a * 5 + 0.7), 2) + 0.2 * Math.sin(a * 11);
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const flare = 1 + 0.45 * t * t;
      const x = Math.cos(a) * RX * flare;
      const z = Math.sin(a) * RZ * (1 + 0.25 * t * t);
      const y = height * Math.sin((t * Math.PI) / 2);
      pos.push(x, y, z);
      c.copy(low).lerp(high, Math.pow(t, 0.7));
      col.push(c.r, c.g, c.b);
      if (j === rows) crest.push(new THREE.Vector3(x, y, z));
    }
  }
  for (let i = 0; i < around; i++) {
    for (let j = 0; j < rows; j++) {
      const p = i * (rows + 1) + j;
      const q = p + rows + 1;
      index.push(p, q, p + 1, q, q + 1, p + 1);
    }
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  sheet.setIndex(index);
  sheet.computeVertexNormals();
  group.add(new THREE.Mesh(sheet, toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide })));
  const edge = new THREE.CatmullRomCurve3(crest, true);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(edge, 240, 0.06, 6, true), new THREE.MeshBasicMaterial({ color: INK })));
  return group;
}
