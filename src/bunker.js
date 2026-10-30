import * as THREE from 'three';
import { outlined, toon } from './toon.js';
import { merge } from './hullForm.js';

const WIDTH = 38;
const TALL = 12;
const DEEP = 24;
const WALL = 4;
const TEXEL = 0.055;

function boardForm() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const c = canvas.getContext('2d');
  c.fillStyle = '#a9a69b';
  c.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 42) {
    c.fillStyle = y % 84 ? '#a2a094' : '#b0ada2';
    c.fillRect(0, y, 512, 42);
    c.fillStyle = 'rgba(70,66,58,0.45)';
    c.fillRect(0, y, 512, 2.5);
    for (let x = (y / 42) % 2 ? 60 : 200; x < 512; x += 280) c.fillRect(x, y, 2.5, 42);
  }
  for (let k = 0; k < 150; k++) {
    c.fillStyle = `rgba(50,46,40,${0.05 + Math.random() * 0.12})`;
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    c.fillRect(x, y, 2 + Math.random() * 5, 12 + Math.random() * 90);
  }
  for (let k = 0; k < 90; k++) {
    c.fillStyle = 'rgba(60,56,50,0.5)';
    c.beginPath();
    c.arc(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 4, 0, 6.3);
    c.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function sootMark() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(128, 62, 14, 128, 62, 124);
  g.addColorStop(0, 'rgba(12,10,8,0.95)');
  g.addColorStop(0.5, 'rgba(18,15,12,0.45)');
  g.addColorStop(1, 'rgba(18,15,12,0)');
  c.fillStyle = g;
  c.scale(1, 0.5);
  c.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function worldUV(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = [];
  for (let k = 0; k < pos.count; k++) {
    const flat = Math.abs(nor.getY(k)) > 0.7;
    uv.push(((flat ? pos.getX(k) : pos.getX(k) + pos.getZ(k)) * TEXEL), (flat ? pos.getZ(k) : pos.getY(k)) * TEXEL);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

function slab(w, h, d, x, y, z, bevel = 0.4) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -h / 2);
  shape.lineTo(w / 2, -h / 2);
  shape.lineTo(w / 2, h / 2);
  shape.lineTo(-w / 2, h / 2);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 }).translate(x, y, z - d / 2 + bevel);
}

function apertured(w, h, holeW, holeLow, holeHigh, depth, z) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(w / 2, h);
  shape.lineTo(-w / 2, h);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-holeW * 0.8, holeLow);
  hole.lineTo(holeW * 0.8, holeLow);
  hole.lineTo(holeW, holeHigh);
  hole.lineTo(-holeW, holeHigh);
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.35, bevelThickness: 0.35, bevelSegments: 1 }).translate(0, 0, z);
}

export function casemate() {
  const concrete = toon(0xffffff, { map: boardForm() });
  const dark = toon(0x121110);
  const steel = toon(0x3c4044);
  const front = DEEP / 2;
  const wings = [1, -1].map((side) => slab(3, TALL - 1, 18, 0, (TALL - 1) / 2, 0).rotateY(side * 0.55).translate(side * (WIDTH / 2 + 3), 0, front + 2));
  const shell = merge([
    apertured(WIDTH, TALL, 12, 4.2, 8.2, WALL - 1, front - WALL),
    apertured(WIDTH - 4, TALL - 1, 7.6, 4.8, 7.6, 1.6, front - WALL - 2),
    slab(WIDTH + 7, 3.4, DEEP + 10, 0, TALL + 1.7, 2.5, 0.6),
    slab(WIDTH + 9, 1.2, 3, 0, TALL + 0.1, front + 7, 0.3),
    slab(WIDTH, TALL, DEEP - WALL - 3, 0, TALL / 2, -3.5),
    ...wings,
  ].map(worldUV));
  const group = new THREE.Group();
  group.add(outlined(shell, concrete, 0.14));
  group.add(new THREE.Mesh(merge([slab(WIDTH - 5, TALL - 1.5, 0.6, 0, TALL / 2, front - WALL - 3.6)]), dark));
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(38, 13), new THREE.MeshBasicMaterial({ map: sootMark(), transparent: true, depthWrite: false }));
  stain.position.set(0, 6.6, front + 0.42);
  group.add(stain);
  const barrel = new THREE.CylinderGeometry(0.42, 0.56, 15, 12).rotateX(Math.PI / 2).translate(0, 6.2, front + 5);
  const brake = new THREE.CylinderGeometry(0.82, 0.82, 1.6, 12).rotateX(Math.PI / 2).translate(0, 6.2, front + 12.6);
  const mantlet = new THREE.SphereGeometry(2.4, 12, 8).scale(1.5, 1, 0.8).translate(0, 6.2, front - 2.6);
  group.add(outlined(merge([barrel, brake, mantlet]), steel, 0.08));
  return { group, muzzles: { gun: new THREE.Vector3(0, 6.2, front + 13.6), guns: [new THREE.Vector3(-8.6, 6.4, front + 0.6), new THREE.Vector3(8.6, 6.4, front + 0.6)] } };
}
