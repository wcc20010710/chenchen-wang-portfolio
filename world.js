/* =========================================================
   CHENCHEN WANG — NEXUS WORLD
   Procedural WebGL city / golden core / atmospheric systems
   ========================================================= */

import * as THREE from './assets/vendor/three.module.js';

const canvas = document.querySelector('#world');
const hero = document.querySelector('.hero');

if (!canvas || !hero) {
  throw new Error('Hero world canvas not found.');
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 960px)').matches;
const isTablet = window.matchMedia('(max-width: 1100px)').matches;
const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.35 : 1.7);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: false,
    powerPreference: 'high-performance',
    failIfMajorPerformanceCaveat: false
  });
} catch (error) {
  document.documentElement.classList.add('no-webgl');
  console.warn('WebGL unavailable, using static fallback.', error);
  throw error;
}

renderer.setPixelRatio(DPR);
renderer.setSize(hero.clientWidth, hero.clientHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
renderer.setClearColor(0x090d12, 1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090d12);
scene.fog = new THREE.FogExp2(0x0b1118, 0.0108);

const camera = new THREE.PerspectiveCamera(isMobile ? 45 : 38, hero.clientWidth / hero.clientHeight, 0.1, 300);
const CAMERA_BASE = new THREE.Vector3(9.2, isMobile ? 28.6 : 27.5, isMobile ? 46 : 43);
const CAMERA_TARGET = new THREE.Vector3(0.5, isMobile ? 5.2 : 4.7, -3.2);
camera.position.copy(CAMERA_BASE);
camera.lookAt(CAMERA_TARGET);

const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
const clock = new THREE.Clock();
const mouseEase = 0.045;

/* ------------------------------------------------------------------
   Procedural helpers
   ------------------------------------------------------------------ */

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x1a1a1f);
const pick = (items) => items[Math.floor(rand() * items.length)];

function makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, 'rgba(255,255,255,0.72)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTexture = makeGlowTexture();

function makeWindowTexture(variant = 0) {
  const w = 256;
  const h = 512;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = variant === 1 ? '#070b10' : variant === 2 ? '#080b0f' : '#060a0e';
  ctx.fillRect(0, 0, w, h);

  // structural vertical mullions
  for (let x = 0; x <= w; x += 32) {
    ctx.fillStyle = 'rgba(2, 5, 8, 0.42)';
    ctx.fillRect(x, 0, 2, h);
  }

  const cols = 7;
  const rows = 29;
  const cw = w / cols;
  const rh = h / rows;
  const warmBias = variant === 1 ? 0.27 : variant === 2 ? 0.1 : 0.16;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + 8;
      const y = row * rh + 8;
      const ww = cw - 16;
      const wh = rh - 14;
      const lit = rand();
      if (lit < 0.38) {
        const isWarm = rand() < warmBias;
        const alpha = 0.42 + rand() * 0.58;
        const color = isWarm
          ? `rgba(255, 188, 121, ${alpha})`
          : rand() > 0.76
            ? `rgba(242, 250, 249, ${alpha * 0.86})`
            : `rgba(111, 235, 244, ${alpha})`;
        ctx.shadowColor = isWarm ? 'rgba(255, 165, 95, 0.75)' : 'rgba(100, 232, 244, 0.72)';
        ctx.shadowBlur = rand() > 0.5 ? 9 : 0;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, ww, wh);
        ctx.shadowBlur = 0;
      } else if (lit < 0.56) {
        ctx.fillStyle = 'rgba(24, 38, 48, 0.62)';
        ctx.fillRect(x, y, ww, wh);
      }
    }
  }

  // a few whole illuminated floors
  for (let i = 0; i < 3; i++) {
    const y = 26 + Math.floor(rand() * (rows - 4)) * rh;
    ctx.fillStyle = variant === 1 ? 'rgba(250, 180, 118, 0.35)' : 'rgba(94, 214, 223, 0.22)';
    ctx.fillRect(0, y, w, 2);
  }

  // grime / light falloff
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(2, 4, 7, 0.28)');
  grad.addColorStop(0.5, 'rgba(2, 4, 7, 0)');
  grad.addColorStop(1, 'rgba(2, 4, 7, 0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeCircuitTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  // glassy translucent base
  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, 'rgba(9, 24, 29, 0.78)');
  base.addColorStop(0.48, 'rgba(4, 14, 19, 0.62)');
  base.addColorStop(1, 'rgba(12, 20, 22, 0.8)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // faint grid
  ctx.strokeStyle = 'rgba(105, 224, 231, 0.055)';
  ctx.lineWidth = 1;
  for (let x = 32; x < size; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  for (let y = 32; y < size; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  // circuit traces, both edges only so the centre stays legible
  const traceColors = ['rgba(126, 247, 255, 0.95)', 'rgba(255, 211, 139, 0.9)', 'rgba(255, 160, 100, 0.82)'];
  for (let i = 0; i < 22; i++) {
    const side = i % 2;
    let x = side === 0 ? 48 + rand() * 150 : size - 48 - rand() * 150;
    let y = 110 + rand() * (size - 220);
    const horizontal = rand() > 0.35;
    const color = pick(traceColors);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = rand() > 0.72 ? 4 : 2.4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 2 + Math.floor(rand() * 4);
    for (let s = 0; s < steps; s++) {
      const length = 22 + rand() * 88;
      if ((s % 2 === 0) === horizontal) {
        x += side === 0 ? length : -length * 0.2;
      } else {
        y += rand() > 0.5 ? length : -length;
      }
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, rand() > 0.7 ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // vivid inner border
  ctx.strokeStyle = 'rgba(109, 238, 245, 0.65)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(90, 230, 240, 0.7)';
  ctx.shadowBlur = 18;
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.shadowBlur = 0;

  // concentric tech rings
  ctx.strokeStyle = 'rgba(216, 181, 117, 0.38)';
  ctx.lineWidth = 1;
  [224, 274, 316].forEach((r, i) => {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, i * 0.8, Math.PI * 1.4 + i * 0.8);
    ctx.stroke();
  });

  // central medallion
  const cx = size / 2;
  const cy = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = 'rgba(216, 181, 117, 0.9)';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-132, -132, 264, 264);
  ctx.strokeStyle = 'rgba(93, 224, 232, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-112, -112, 224, 224);
  ctx.restore();

  // central crosshair
  ctx.strokeStyle = 'rgba(93, 224, 232, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 170, cy);
  ctx.lineTo(cx - 54, cy);
  ctx.moveTo(cx + 54, cy);
  ctx.lineTo(cx + 170, cy);
  ctx.moveTo(cx, cy - 170);
  ctx.lineTo(cx, cy - 54);
  ctx.moveTo(cx, cy + 54);
  ctx.lineTo(cx, cy + 170);
  ctx.stroke();

  // centre type
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(120, 242, 250, 0.55)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = 'rgba(250, 249, 243, 1)';
  ctx.font = '500 104px "Space Grotesk", Arial, sans-serif';
  ctx.letterSpacing = '11px';
  ctx.fillText('NEXUS', cx + 6, cy + 12);
  ctx.shadowBlur = 14;
  ctx.fillStyle = 'rgba(255, 212, 141, 1)';
  ctx.font = '500 24px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '9px';
  ctx.fillText('CORE / 07', cx + 3, cy + 60);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(126, 239, 247, 0.9)';
  ctx.font = '400 14px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '4px';
  ctx.fillText('SMART LIVING SYSTEM', cx, cy + 96);
  ctx.strokeStyle = 'rgba(255, 212, 141, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 86, cy + 110);
  ctx.lineTo(cx + 86, cy + 110);
  ctx.stroke();

  // corner brackets + frame
  const bracket = 50;
  ctx.strokeStyle = 'rgba(216, 181, 117, 0.9)';
  ctx.lineWidth = 2;
  const corners = [
    [34, 34, 1, 1],
    [size - 34, 34, -1, 1],
    [34, size - 34, 1, -1],
    [size - 34, size - 34, -1, -1]
  ];
  corners.forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x + dx * bracket, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * bracket);
    ctx.stroke();
  });

  // data labels
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(122, 239, 246, 0.96)';
  ctx.font = '400 17px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('CITY.SYNC  /  ONLINE', 58, 84);
  ctx.fillStyle = 'rgba(242, 239, 231, 0.48)';
  ctx.fillText('SECTOR 07 // NODE 024', 58, 108);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 165, 104, 0.95)';
  ctx.fillText('ENERGY 80%', size - 58, size - 88);
  ctx.fillStyle = 'rgba(242, 239, 231, 0.46)';
  ctx.fillText('LAT 34.7986 / LON 114.3074', size - 58, size - 64);

  // horizontal strip readouts
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    const y = 160 + i * 24;
    ctx.fillStyle = `rgba(93, 224, 232, ${0.08 + i * 0.02})`;
    ctx.fillRect(54, y, 60 + i * 26, 2);
  }
  for (let i = 0; i < 4; i++) {
    const x = size - 112 - i * 18;
    ctx.fillStyle = `rgba(216, 181, 117, ${0.25 - i * 0.04})`;
    ctx.fillRect(x, size - 160, 2, 46 + i * 8);
  }

  // scanline texture
  ctx.fillStyle = 'rgba(0, 0, 0, 0.11)';
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeFrameGlowTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 206, 128, 0.92)';
  ctx.shadowColor = 'rgba(240, 183, 95, 0.9)';
  ctx.shadowBlur = 42;
  ctx.lineWidth = 7;
  ctx.strokeRect(118, 118, 276, 276);
  ctx.shadowBlur = 18;
  ctx.strokeStyle = 'rgba(255, 230, 183, 0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(118, 118, 276, 276);
  ctx.restore();

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePlazaTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  const glow = (color, blur = 14) => {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  };

  // concentric rings
  const rings = [
    [135, 'rgba(216, 181, 117, 0.8)', 2],
    [188, 'rgba(93, 224, 232, 0.5)', 1.5],
    [286, 'rgba(93, 224, 232, 0.36)', 1.4],
    [374, 'rgba(216, 181, 117, 0.42)', 1.2],
    [452, 'rgba(93, 224, 232, 0.2)', 1]
  ];
  rings.forEach(([radius, color, width]) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    glow(color, 12);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  // broken arcs
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 185, 112, 0.72)' : 'rgba(109, 238, 245, 0.62)';
    ctx.lineWidth = 5;
    glow(i % 2 === 0 ? 'rgba(255, 170, 90, 0.7)' : 'rgba(100, 239, 247, 0.55)', 18);
    ctx.arc(cx, cy, 325, 0.24 + i * 1.57, 0.84 + i * 1.57);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // radial tick system
  for (let i = 0; i < 96; i++) {
    const angle = (i / 96) * Math.PI * 2;
    const inner = i % 8 === 0 ? 398 : 426;
    const outer = i % 8 === 0 ? 452 : 440;
    ctx.beginPath();
    ctx.strokeStyle = i % 8 === 0 ? 'rgba(255, 203, 134, 0.75)' : 'rgba(93, 224, 232, 0.32)';
    ctx.lineWidth = i % 8 === 0 ? 2.5 : 1;
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.stroke();
  }

  // central landing pad
  ctx.beginPath();
  ctx.fillStyle = 'rgba(6, 25, 28, 0.8)';
  ctx.arc(cx, cy, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 203, 134, 0.95)';
  ctx.lineWidth = 3;
  glow('rgba(255, 190, 110, 0.8)', 20);
  ctx.arc(cx, cy, 104, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(112, 240, 247, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.arc(cx, cy, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // technical annotation around the pad
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(129, 240, 247, 0.8)';
  ctx.font = '400 17px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '8px';
  ctx.fillText('NEXUS / LANDING CORE', cx, cy + 158);

  ctx.fillStyle = 'rgba(242, 239, 231, 0.3)';
  ctx.font = '400 12px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '4px';
  ctx.fillText('34.7986 N  /  114.3074 E', cx, cy + 182);

  // cardinal crosses
  ['N', 'E', 'S', 'W'].forEach((label, i) => {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * 490;
    const y = cy + Math.sin(a) * 490;
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(242, 239, 231, 0.4)';
    ctx.lineWidth = 1;
    ctx.moveTo(x - 9, y);
    ctx.lineTo(x + 9, y);
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x, y + 9);
    ctx.stroke();
    ctx.fillStyle = 'rgba(242, 239, 231, 0.55)';
    ctx.font = '400 14px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(label, x + 22, y + 5);
  });

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function makeTextTexture({ kicker, title, accent = '#5de0e8' }) {
  const w = 512;
  const h = 170;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = 'rgba(6, 12, 16, 0.72)';
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.strokeStyle = 'rgba(242, 239, 231, 0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(2.5, 2.5, w - 5, h - 5);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, 32);
  ctx.lineTo(2, 2);
  ctx.lineTo(32, 2);
  ctx.moveTo(w - 32, h - 2);
  ctx.lineTo(w - 2, h - 2);
  ctx.lineTo(w - 2, h - 32);
  ctx.stroke();

  ctx.fillStyle = accent;
  ctx.font = '400 12px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '4px';
  ctx.fillText(kicker, 24, 35);

  ctx.fillStyle = 'rgba(242, 239, 231, 0.94)';
  ctx.font = '500 27px "Space Grotesk", Arial, sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(title, 24, 84);

  ctx.fillStyle = 'rgba(242, 239, 231, 0.35)';
  ctx.font = '300 11px "JetBrains Mono", Consolas, monospace';
  ctx.letterSpacing = '2px';
  ctx.fillText('REALTIME / 34.7986 N', 24, 124);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

/* ------------------------------------------------------------------
   Sky
   ------------------------------------------------------------------ */

const sky = new THREE.Mesh(
  new THREE.PlaneGeometry(310, 190),
  new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 uv = vUv;
        vec3 top = vec3(0.023, 0.035, 0.049);
        vec3 bottom = vec3(0.075, 0.098, 0.104);
        vec3 col = mix(bottom, top, smoothstep(0.0, 0.88, uv.y));

        float warm = exp(-pow((uv.y - 0.23) * 5.7, 2.0)) * exp(-pow((uv.x - 0.70) * 2.3, 2.0));
        col += vec3(0.20, 0.085, 0.038) * warm * 0.85;

        float cool = exp(-pow((uv.y - 0.33) * 3.8, 2.0)) * exp(-pow((uv.x - 0.18) * 3.0, 2.0));
        col += vec3(0.02, 0.09, 0.11) * cool * 0.8;

        float grain = hash(floor(uv * vec2(900.0, 520.0)) + floor(uTime * 2.0));
        col += (grain - 0.5) * 0.012;

        gl_FragColor = vec4(col, 1.0);
      }
    `
  })
);
sky.position.set(0, 37, -108);
scene.add(sky);

// distant stars / sky dust
{
  const count = isMobile ? 90 : 180;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * 190;
    positions[i * 3 + 1] = 25 + rand() * 65;
    positions[i * 3 + 2] = -92 + rand() * 18;
    const c = new THREE.Color(rand() > 0.88 ? 0xf2a365 : 0x7bb8c4);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.5,
    map: glowTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const stars = new THREE.Points(geo, mat);
  scene.add(stars);
}

/* ------------------------------------------------------------------
   Light
   ------------------------------------------------------------------ */

scene.add(new THREE.HemisphereLight(0x88c5cc, 0x16100c, 0.7));

const keyLight = new THREE.DirectionalLight(0xffc18d, 1.9);
keyLight.position.set(16, 28, 24);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x6edbe6, 1.25);
fillLight.position.set(-24, 17, -14);
scene.add(fillLight);

const coreLight = new THREE.PointLight(0xffaa5d, 280, 38, 2);
coreLight.position.set(4.4, 12.6, 7);
scene.add(coreLight);

const rimLight = new THREE.PointLight(0x5ddce5, 180, 30, 2);
rimLight.position.set(-4, 8, 10);
scene.add(rimLight);

/* ------------------------------------------------------------------
   Ground plane / road grid
   ------------------------------------------------------------------ */

const groundMat = new THREE.ShaderMaterial({
  transparent: false,
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color(0x071016) },
    uColorB: { value: new THREE.Color(0x0d2027) },
    uCyan: { value: new THREE.Color(0x3bbec7) },
    uOrange: { value: new THREE.Color(0xc0703d) }
  },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vWorld;
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uCyan;
    uniform vec3 uOrange;

    float gridLine(vec2 p, float scale) {
      vec2 coord = p * scale;
      vec2 derivative = fwidth(coord);
      vec2 grid = abs(fract(coord - 0.5) - 0.5) / max(derivative, vec2(0.0001));
      return 1.0 - min(min(grid.x, grid.y), 1.0);
    }

    void main() {
      vec2 p = vWorld.xz;
      float radius = length(p);
      float lineA = gridLine(p, 0.23);
      float lineB = gridLine(p, 0.055);
      float lineC = gridLine(p, 0.01);

      vec3 col = mix(uColorA, uColorB, smoothstep(10.0, 70.0, radius));
      float gridFade = 1.0 - smoothstep(36.0, 100.0, radius);
      col += uCyan * lineA * 0.075 * gridFade;
      col += uCyan * lineB * 0.055 * gridFade;
      col += uOrange * lineC * 0.022 * gridFade;

      // central plaza aura
      float plaza = exp(-pow((radius - 10.0) * 0.22, 2.0));
      float pulse = 0.5 + 0.5 * sin(radius * 1.4 - uTime * 0.5);
      col += uCyan * plaza * 0.035 * (0.55 + pulse * 0.45);
      col += uOrange * exp(-pow((radius - 20.0) * 0.34, 2.0)) * 0.018;

      // dissolve the plane into the atmosphere before the horizon
      float horizon = smoothstep(38.0, 112.0, radius);
      col = mix(col, vec3(0.048, 0.063, 0.071), horizon * 0.94);

      gl_FragColor = vec4(col, 1.0);
    }
  `
});
const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.12;
scene.add(ground);

// luminous ground aura
const auraMat = new THREE.MeshBasicMaterial({
  map: glowTexture,
  color: 0x1c5d65,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false
});
const aura = new THREE.Mesh(new THREE.PlaneGeometry(78, 78), auraMat);
aura.rotation.x = -Math.PI / 2;
aura.position.y = 0.02;
scene.add(aura);

// central plaza geometry
const plaza = new THREE.Group();
{
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(9.2, 9.5, 0.22, 72),
    new THREE.MeshStandardMaterial({
      color: 0x0a1217,
      metalness: 0.72,
      roughness: 0.25,
      emissive: 0x071216,
      emissiveIntensity: 0.6
    })
  );
  disc.position.y = 0.1;
  plaza.add(disc);

  const goldRing = new THREE.Mesh(
    new THREE.TorusGeometry(7.45, 0.035, 4, 96),
    new THREE.MeshBasicMaterial({
      color: 0xd8b575,
      transparent: true,
      opacity: 0.9,
      toneMapped: false
    })
  );
  goldRing.rotation.x = Math.PI / 2;
  goldRing.position.y = 0.23;
  plaza.add(goldRing);

  const cyanRing = new THREE.Mesh(
    new THREE.TorusGeometry(8.95, 0.02, 4, 96),
    new THREE.MeshBasicMaterial({
      color: 0x5de0e8,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  cyanRing.rotation.x = Math.PI / 2;
  cyanRing.position.y = 0.24;
  plaza.add(cyanRing);

  // radial tick lights
  const tickPositions = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r1 = i % 4 === 0 ? 8.1 : 8.25;
    const r2 = i % 4 === 0 ? 8.45 : 8.35;
    tickPositions.push(
      Math.cos(a) * r1, 0.24, Math.sin(a) * r1,
      Math.cos(a) * r2, 0.24, Math.sin(a) * r2
    );
  }
  const tickGeo = new THREE.BufferGeometry();
  tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
  const ticks = new THREE.LineSegments(
    tickGeo,
    new THREE.LineBasicMaterial({
      color: 0x79e6ec,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  plaza.add(ticks);

  const sigil = new THREE.Mesh(
    new THREE.PlaneGeometry(19.8, 19.8),
    new THREE.MeshBasicMaterial({
      map: makePlazaTexture(),
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  sigil.rotation.x = -Math.PI / 2;
  sigil.position.y = 0.28;
  plaza.add(sigil);

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(29, 29),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0x2b7780,
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.265;
  plaza.add(pool);
}
scene.add(plaza);

// beam of light from plaza to core
{
  const geo = new THREE.CylinderGeometry(0.025, 0.14, 11.2, 8, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xd8b575,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.position.set(4.4, 5.8, 4.1);
  scene.add(beam);
}

/* ------------------------------------------------------------------
   City
   ------------------------------------------------------------------ */

const landMarks = [
  { x: -26, z: -14, w: 4.2, h: 24, d: 4.2, color: 0x5de0e8, rot: 0.2 },
  { x: 26, z: -23, w: 4.6, h: 31, d: 4.0, color: 0xd8b575, rot: -0.4 },
  { x: -17, z: -32, w: 4.0, h: 21, d: 4.8, color: 0x5de0e8, rot: 0.1 },
  { x: 31, z: 4, w: 3.6, h: 18, d: 4.4, color: 0xf2975b, rot: 0.5 },
  { x: -36, z: 8, w: 3.8, h: 16, d: 3.8, color: 0x5de0e8, rot: -0.2 }
];

function createLandmarks() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({
    color: 0x0f171e,
    metalness: 0.72,
    roughness: 0.25,
    emissive: 0x071015,
    emissiveIntensity: 0.7
  });
  const windowTex = makeWindowTexture(1);

  landMarks.forEach((land, index) => {
    const tower = new THREE.Group();
    tower.position.set(land.x, 0, land.z);

    const body = new THREE.Mesh(new THREE.BoxGeometry(land.w, land.h, land.d), dark);
    body.position.y = land.h / 2;
    tower.add(body);

    // narrow upper volume / crown
    const crownHeight = land.h * 0.22;
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(land.w * 0.24, land.w * 0.42, crownHeight, 4),
      dark
    );
    crown.position.y = land.h + crownHeight / 2 - 0.2;
    crown.rotation.y = Math.PI / 4;
    tower.add(crown);

    // thin light fin on two sides
    const stripMat = new THREE.MeshBasicMaterial({
      color: land.color,
      transparent: true,
      opacity: index === 1 ? 0.9 : 0.7,
      toneMapped: false
    });
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.045, land.h * 0.82, 0.045), stripMat);
    fin.position.set(-land.w / 2 - 0.01, land.h * 0.48, land.d / 2 + 0.01);
    tower.add(fin);

    const fin2 = fin.clone();
    fin2.position.set(land.w / 2 + 0.01, land.h * 0.54, -land.d / 2 - 0.01);
    tower.add(fin2);

    // balcony bands
    for (let b = 1; b < 4; b++) {
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(land.w + 0.06, 0.035, land.d + 0.06),
        new THREE.MeshBasicMaterial({
          color: b % 2 === 0 ? land.color : 0x203b42,
          transparent: true,
          opacity: b % 2 === 0 ? 0.55 : 0.35,
          toneMapped: false
        })
      );
      band.position.y = (land.h / 4) * b;
      tower.add(band);
    }

    // roof ring + antenna
    const roofRing = new THREE.Mesh(
      new THREE.TorusGeometry(land.w * 0.44, 0.045, 4, 40),
      new THREE.MeshBasicMaterial({
        color: land.color,
        transparent: true,
        opacity: 0.75,
        toneMapped: false
      })
    );
    roofRing.rotation.x = Math.PI / 2;
    roofRing.position.y = land.h + 0.16;
    tower.add(roofRing);

    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.045, 4.2, 5),
      new THREE.MeshBasicMaterial({ color: 0x98aeb0, toneMapped: false })
    );
    antenna.position.y = land.h + 2.1;
    tower.add(antenna);

    const beacon = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: land.color,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      })
    );
    beacon.scale.set(2.4, 2.4, 1);
    beacon.position.y = land.h + 4.3;
    tower.add(beacon);

    // visible window strips on crown
    const crownLight = new THREE.Mesh(
      new THREE.BoxGeometry(land.w * 0.56, 0.04, land.d * 0.56),
      new THREE.MeshBasicMaterial({
        map: windowTex,
        color: 0x9aeaf0,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      })
    );
    crownLight.position.y = land.h + crownHeight * 0.55;
    tower.add(crownLight);

    tower.rotation.y = land.rot;
    group.add(tower);
  });

  return group;
}

function createCity() {
  const group = new THREE.Group();
  const spacing = 4.45;
  const xCount = 12;
  const zMin = -8;
  const zMax = 5;
  const roofPositions = [];
  const roofColors = [];
  const edgePositions = [];
  const edgeColors = [];

  const textures = [makeWindowTexture(0), makeWindowTexture(1), makeWindowTexture(2)];
  const materials = textures.map((texture, i) => new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: i === 1 ? 1.85 : i === 2 ? 1.45 : 2.15,
    color: new THREE.Color(i === 1 ? 0x584b40 : 0x3d4c54),
    metalness: 0.32,
    roughness: 0.46
  }));

  const groups = [[], [], []];
  const roofMatrices = [];
  const dummy = new THREE.Object3D();
  const size = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  for (let ix = -xCount; ix <= xCount; ix++) {
    for (let iz = zMin; iz <= zMax; iz++) {
      const x = ix * spacing + (rand() - 0.5) * 0.44;
      const z = iz * spacing + (rand() - 0.5) * 0.44;
      const distance = Math.hypot(x, z);

      if (distance < 14.4) continue;
      if (rand() < 0.11) continue;
      if (Math.abs(x) > 54 || z > 24) continue;

      let skipLandmark = false;
      landMarks.forEach((land) => {
        if (Math.hypot(x - land.x, z - land.z) < Math.max(land.w, land.d) * 1.1 + 2.4) skipLandmark = true;
      });
      if (skipLandmark) continue;

      let w = 2.15 + rand() * 1.5;
      let d = 2.15 + rand() * 1.5;
      if (rand() > 0.86) {
        w *= 1.18;
        d *= 0.82;
      }

      let h;
      if (distance < 23) {
        h = 1.0 + Math.pow(rand(), 1.55) * 3.4;
      } else {
        h = 1.8 + Math.pow(rand(), 1.6) * 10.8;
        if (rand() > 0.89) h += 5.3 + rand() * 7;
      }

      // the further from the plaza, the taller the skyline; keep sight lines to the core open
      h *= 0.74 + Math.min(distance / 48, 1) * 0.56;
      if (z > 9) h *= 0.68;
      if (distance < 30) h = Math.min(h, 5.6);

      const variant = Math.floor(rand() * 3);
      dummy.position.set(x, h / 2, z);
      dummy.scale.set(w, h, d);
      dummy.rotation.set(0, rand() > 0.82 ? Math.PI * 0.5 : 0, 0);
      dummy.updateMatrix();
      groups[variant].push(dummy.matrix.clone());

      // roof cap
      dummy.position.set(x, h + 0.07, z);
      dummy.scale.set(w * 1.03, 0.14, d * 1.03);
      dummy.updateMatrix();
      roofMatrices.push(dummy.matrix.clone());

      // rooftop telemetry lights
      if (rand() > 0.5) {
        roofPositions.push(x + (rand() - 0.5) * w * 0.7, h + 0.3, z + (rand() - 0.5) * d * 0.7);
        const color = rand() > 0.78 ? new THREE.Color(0xf2975b) : new THREE.Color(0x7ce8ef);
        roofColors.push(color.r, color.g, color.b);
      }

      // selected buildings get clean neon edge silhouettes
      if (rand() > 0.52 && distance > 17) {
        const top = h + 0.04;
        const halfW = w / 2;
        const halfD = d / 2;
        const corners = [
          [-halfW, -halfD], [halfW, -halfD], [halfW, halfD], [-halfW, halfD]
        ];
        const c = rand() > 0.82 ? new THREE.Color(0xf2975b) : new THREE.Color(0x4fbec8);
        corners.forEach(([cx, cz]) => {
          edgePositions.push(x + cx, 0.12, z + cz, x + cx, top, z + cz);
          edgeColors.push(c.r, c.g, c.b, c.r * 0.3, c.g * 0.3, c.b * 0.3);
        });
        for (let k = 0; k < 4; k++) {
          const a = corners[k];
          const b = corners[(k + 1) % 4];
          edgePositions.push(x + a[0], top, z + a[1], x + b[0], top, z + b[1]);
          edgeColors.push(c.r, c.g, c.b, c.r * 0.6, c.g * 0.6, c.b * 0.6);
        }
      }
    }
  }

  const geometry = new THREE.BoxGeometry(1, 1, 1);

  groups.forEach((matrices, i) => {
    if (!matrices.length) return;
    const mesh = new THREE.InstancedMesh(geometry, materials[i], matrices.length);
    matrices.forEach((m, index) => mesh.setMatrixAt(index, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });

  // dark flat roofs, one draw call
  const roofMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x080d12,
      metalness: 0.62,
      roughness: 0.32,
      emissive: 0x071015,
      emissiveIntensity: 0.5
    }),
    roofMatrices.length
  );
  roofMatrices.forEach((m, i) => roofMesh.setMatrixAt(i, m));
  roofMesh.instanceMatrix.needsUpdate = true;
  roofMesh.computeBoundingSphere();
  group.add(roofMesh);

  // neon edge lines
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeColors, 3));
  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  group.add(edges);

  // rooftop lights
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofPositions, 3));
  roofGeo.setAttribute('color', new THREE.Float32BufferAttribute(roofColors, 3));
  const roofLights = new THREE.Points(
    roofGeo,
    new THREE.PointsMaterial({
      size: 0.55,
      map: glowTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true
    })
  );
  group.add(roofLights);

  return group;
}

scene.add(createCity());
scene.add(createLandmarks());

/* ------------------------------------------------------------------
   Elevated ring roads + traffic
   ------------------------------------------------------------------ */

const orbitMeshes = [];
function createRing(radius, color, opacity, y = 0.25) {
  const points = [];
  const segments = 160;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius * 0.92));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  const line = new THREE.LineLoop(geo, mat);
  scene.add(line);
  return line;
}

createRing(13.4, 0x5de0e8, 0.5, 0.32);
createRing(19.8, 0xf2975b, 0.36, 0.28);
createRing(30.5, 0x4db0b8, 0.18, 0.22);

function createOrbit(radius, count, color, speed, phase, y, scaleZ = 0.92) {
  const positions = new Float32Array(count * 3);
  const phases = [];
  for (let i = 0; i < count; i++) {
    phases.push((i / count) * Math.PI * 2 + rand() * 0.12);
    positions[i * 3 + 1] = y;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color,
    size: 0.42,
    map: glowTexture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    sizeAttenuation: true
  });
  const points = new THREE.Points(geo, mat);
  points.userData = { radius, phases, speed, phase, y, scaleZ, positions, geo };
  orbitMeshes.push(points);
  scene.add(points);
}

createOrbit(13.4, isMobile ? 30 : 64, 0x75e5ec, 0.044, 0, 0.45);
createOrbit(19.8, isMobile ? 26 : 52, 0xf2975b, -0.032, 1.5, 0.42);
createOrbit(9.4, isMobile ? 15 : 32, 0xd8b575, 0.062, 0.8, 0.38, 1);

/* ------------------------------------------------------------------
   The golden core
   ------------------------------------------------------------------ */

const core = new THREE.Group();
core.position.set(isMobile ? 5.1 : 4.4, isMobile ? 12.2 : 11.2, 4.1);
core.scale.setScalar(isMobile ? 0.82 : 1);
core.rotation.y = -0.08;
scene.add(core);

const CORE_FLOAT = core.position.y;
const circuitTexture = makeCircuitTexture();
const coreGlowMat = new THREE.MeshBasicMaterial({
  map: glowTexture,
  color: 0x2d7a83,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  toneMapped: false
});
const coreGlow = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), coreGlowMat);
coreGlow.position.z = -1.4;
core.add(coreGlow);

// second warm aura offset behind
const warmGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 12),
  new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0x9b5828,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })
);
warmGlow.position.set(1.4, -0.6, -1.6);
core.add(warmGlow);

// soft golden bloom around the square housing
const frameGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(12.8, 12.8),
  new THREE.MeshBasicMaterial({
    map: makeFrameGlowTexture(),
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })
);
frameGlow.position.z = -0.55;
core.add(frameGlow);

const goldMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8b575,
  metalness: 0.8,
  roughness: 0.22,
  emissive: 0x6e4519,
  emissiveIntensity: 0.55
});

const blackGlass = new THREE.MeshBasicMaterial({
  color: 0x031015,
  transparent: true,
  opacity: 0.82,
  side: THREE.DoubleSide,
  depthWrite: false
});

const frameSize = 7.3;
const barThickness = 0.16;
const frameDepth = 0.3;

const frame = new THREE.Group();
const topBar = new THREE.Mesh(new THREE.BoxGeometry(frameSize, barThickness, frameDepth), goldMaterial);
topBar.position.y = frameSize / 2;
const bottomBar = topBar.clone();
bottomBar.position.y = -frameSize / 2;
const leftBar = new THREE.Mesh(new THREE.BoxGeometry(barThickness, frameSize, frameDepth), goldMaterial);
leftBar.position.x = -frameSize / 2;
const rightBar = leftBar.clone();
rightBar.position.x = frameSize / 2;
frame.add(topBar, bottomBar, leftBar, rightBar);

// corner nodes
const cornerGeo = new THREE.BoxGeometry(0.34, 0.34, 0.42);
[
  [-frameSize / 2, -frameSize / 2],
  [frameSize / 2, -frameSize / 2],
  [-frameSize / 2, frameSize / 2],
  [frameSize / 2, frameSize / 2]
].forEach(([x, y]) => {
  const cornerNode = new THREE.Mesh(cornerGeo, goldMaterial);
  cornerNode.position.set(x, y, 0);
  frame.add(cornerNode);
});
core.add(frame);

// additive halo bars around the physical gold frame
const haloMat = new THREE.MeshBasicMaterial({
  color: 0xffc47a,
  transparent: true,
  opacity: 0.13,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
});
const haloTop = new THREE.Mesh(new THREE.BoxGeometry(frameSize + 0.42, 0.52, 0.05), haloMat);
haloTop.position.set(0, frameSize / 2, -0.02);
const haloBottom = haloTop.clone();
haloBottom.position.y = -frameSize / 2;
const haloLeft = new THREE.Mesh(new THREE.BoxGeometry(0.52, frameSize + 0.42, 0.05), haloMat);
haloLeft.position.set(-frameSize / 2, 0, -0.02);
const haloRight = haloLeft.clone();
haloRight.position.x = frameSize / 2;
core.add(haloTop, haloBottom, haloLeft, haloRight);

// inner secondary frame
const innerFrame = new THREE.Group();
const inset = 0.48;
const innerMat = new THREE.MeshBasicMaterial({
  color: 0x5de0e8,
  transparent: true,
  opacity: 0.34,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
});
const it = new THREE.Mesh(new THREE.BoxGeometry(frameSize - inset * 2, 0.02, 0.04), innerMat);
it.position.y = frameSize / 2 - inset;
const ib = it.clone();
ib.position.y = -frameSize / 2 + inset;
const il = new THREE.Mesh(new THREE.BoxGeometry(0.02, frameSize - inset * 2, 0.04), innerMat);
il.position.x = -frameSize / 2 + inset;
const ir = il.clone();
ir.position.x = frameSize / 2 - inset;
innerFrame.add(it, ib, il, ir);
core.add(innerFrame);

// dark glass backing
const pane = new THREE.Mesh(new THREE.PlaneGeometry(frameSize - 0.22, frameSize - 0.22), blackGlass);
pane.position.z = -0.04;
pane.renderOrder = 2;
core.add(pane);

// circuit surface
const circuitMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uMap: { value: circuitTexture },
    uTime: { value: 0 },
    uOpacity: { value: 0.95 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    uniform sampler2D uMap;
    uniform float uTime;
    uniform float uOpacity;

    void main() {
      vec2 uv = vUv;
      float glitchBand = step(0.992, fract(uv.y * 2.0 + uTime * 0.031));
      uv.x += glitchBand * 0.003 * sin(uTime * 8.0);

      vec4 tex = texture2D(uMap, uv);
      float sweep = exp(-pow((fract(uTime * 0.045) - uv.y) * 13.0, 2.0));
      float scan = 0.96 + 0.04 * sin(uv.y * 420.0 + uTime * 8.0);
      float edge = 1.0 - smoothstep(0.0, 0.035, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));

      vec3 col = tex.rgb * scan;
      col += vec3(0.36, 0.72, 0.78) * sweep * 0.5;
      col += vec3(0.68, 0.42, 0.16) * edge * 0.2;

      float alpha = tex.a * uOpacity;
      alpha = max(alpha, sweep * 0.08);
      gl_FragColor = vec4(col, alpha);
    }
  `
});
const circuitSurface = new THREE.Mesh(new THREE.PlaneGeometry(frameSize - 0.22, frameSize - 0.22), circuitMat);
circuitSurface.position.z = 0.13;
circuitSurface.renderOrder = 3;
core.add(circuitSurface);

// thin scan bar over the circuit
const scanBar = new THREE.Mesh(
  new THREE.PlaneGeometry(frameSize - 0.3, 0.009),
  new THREE.MeshBasicMaterial({
    color: 0x9cf3f7,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
);
scanBar.position.z = 0.16;
core.add(scanBar);

// soft screen reflection
const screenGlow = new THREE.Mesh(
  new THREE.PlaneGeometry(frameSize - 0.4, frameSize - 0.4),
  new THREE.MeshBasicMaterial({
    map: glowTexture,
    color: 0x0f4c53,
    transparent: true,
    opacity: 0.2,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  })
);
screenGlow.position.z = 0.02;
core.add(screenGlow);

// pulsing node lights on the circuit
const coreNodes = [];
for (let i = 0; i < (isMobile ? 8 : 14); i++) {
  const node = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: rand() > 0.7 ? 0xd8b575 : 0x5de0e8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  const x = (rand() - 0.5) * 5.8;
  const y = (rand() - 0.5) * 5.8;
  if (Math.abs(x) < 1.8 && Math.abs(y) < 1.8) {
    node.position.set(x * 1.9, y * 1.9, 0.2);
  } else {
    node.position.set(x, y, 0.2);
  }
  const scale = 0.34 + rand() * 0.4;
  node.scale.set(scale, scale, 1);
  node.userData.phase = rand() * Math.PI * 2;
  node.userData.base = 0.35 + rand() * 0.5;
  coreNodes.push(node);
  core.add(node);
}

// orbiting HUD rings around the frame
const hudRingGroup = new THREE.Group();
hudRingGroup.position.z = -0.7;
core.add(hudRingGroup);

const ringMaterial = new THREE.LineBasicMaterial({
  color: 0x5de0e8,
  transparent: true,
  opacity: 0.46,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
});

function makeDashedRing(radius, dashes, color, opacity, lineWidthIgnored, offset = 0) {
  const verts = [];
  const step = (Math.PI * 2) / dashes;
  for (let i = 0; i < dashes; i++) {
    const a1 = i * step + offset;
    const a2 = a1 + step * 0.36;
    verts.push(Math.cos(a1) * radius, Math.sin(a1) * radius, 0, Math.cos(a2) * radius, Math.sin(a2) * radius, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  });
  return new THREE.LineSegments(geo, mat);
}

hudRingGroup.add(makeDashedRing(5.65, 72, 0x5de0e8, 0.32, 1, 0));
hudRingGroup.add(makeDashedRing(6.4, 12, 0xd8b575, 0.5, 1, 0.08));

const arcGeo = new THREE.BufferGeometry().setFromPoints(
  Array.from({ length: 80 }, (_, i) => {
    const a = (i / 79) * Math.PI * 0.62 - Math.PI * 0.15;
    return new THREE.Vector3(Math.cos(a) * 7.2, Math.sin(a) * 7.2, 0);
  })
);
const arc = new THREE.Line(arcGeo, new THREE.LineBasicMaterial({
  color: 0xf2975b,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false
}));
hudRingGroup.add(arc);

// four corner brackets outside the device
{
  const bVerts = [];
  const o = 4.65;
  const len = 0.9;
  const pairs = [
    [-o, o, 1, -1], [o, o, -1, -1],
    [-o, -o, 1, 1], [o, -o, -1, 1]
  ];
  pairs.forEach(([x, y, dx, dy]) => {
    bVerts.push(x, y, 0, x + dx * len, y, 0);
    bVerts.push(x, y, 0, x, y + dy * len, 0);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(bVerts, 3));
  const brackets = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color: 0xd8b575,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false
  }));
  hudRingGroup.add(brackets);
}

// labels
const labelSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeTextTexture({ kicker: 'GOLDEN NODE / LIVE', title: 'NEXUS CORE 07' }),
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false
  })
);
labelSprite.scale.set(4.8, 1.6, 1);
labelSprite.position.set(0, 4.9, 0.5);
labelSprite.renderOrder = 5;
core.add(labelSprite);

// wire down to the plaza / energy conduit
{
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.04, 10.6, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xd8b575,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    })
  );
  conduit.position.set(0, -8.0, 0);
  core.add(conduit);
}

/* ------------------------------------------------------------------
   Volumetric beams
   ------------------------------------------------------------------ */

const beamMaterials = [];
function createVolumetricBeam(x, z, height, radius, color, opacity) {
  const geo = new THREE.CylinderGeometry(radius, 0.18, height, 36, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uTime;

      void main() {
        float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.35);
        float vertical = smoothstep(0.02, 0.35, vUv.y) * (1.0 - smoothstep(0.58, 1.0, vUv.y));
        float flicker = 0.82 + 0.18 * sin(uTime * 0.6 + vUv.y * 9.0 + vUv.x * 8.0);
        float alpha = edge * vertical * uOpacity * flicker;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.position.set(x, height / 2, z);
  beamMaterials.push(mat);
  scene.add(beam);
}

createVolumetricBeam(-21, -17, 31, 3.2, 0x4bd5de, 0.17);
createVolumetricBeam(27, -18, 36, 3.8, 0xd8b575, 0.11);
createVolumetricBeam(23, 13, 22, 2.6, 0xf2975b, 0.1);
createVolumetricBeam(-34, 6, 18, 2.2, 0x5de0e8, 0.09);

// spot cone descending on the core
{
  const geo = new THREE.CylinderGeometry(0.25, 6.4, 21, 40, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xf7d9a4) },
      uTime: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vView;
      uniform vec3 uColor;
      uniform float uTime;
      void main() {
        float edge = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 1.8);
        float fade = smoothstep(0.0, 0.3, vUv.y) * (1.0 - smoothstep(0.7, 1.0, vUv.y));
        float shimmer = 0.9 + 0.1 * sin(uTime * 0.9 + vUv.y * 7.0);
        gl_FragColor = vec4(uColor, edge * fade * 0.017 * shimmer);
      }
    `
  });
  const spot = new THREE.Mesh(geo, mat);
  spot.position.set(4.4, 23.8, 4.1);
  beamMaterials.push(mat);
  scene.add(spot);
}

/* ------------------------------------------------------------------
   Data particles
   ------------------------------------------------------------------ */

const particleCount = isMobile ? 380 : isTablet ? 520 : 740;
const particlePositions = new Float32Array(particleCount * 3);
const particleColors = new Float32Array(particleCount * 3);
const particleSizes = new Float32Array(particleCount);
const particleSpeeds = new Float32Array(particleCount);
const particleOffsets = new Float32Array(particleCount);

for (let i = 0; i < particleCount; i++) {
  const angle = rand() * Math.PI * 2;
  const radius = 7 + Math.sqrt(rand()) * 48;
  particlePositions[i * 3] = Math.cos(angle) * radius;
  particlePositions[i * 3 + 1] = rand() * 28;
  particlePositions[i * 3 + 2] = Math.sin(angle) * radius * 0.84;
  const warm = rand() > 0.7;
  const color = warm ? new THREE.Color(0xf2975b) : new THREE.Color(0x75e6ed);
  particleColors[i * 3] = color.r;
  particleColors[i * 3 + 1] = color.g;
  particleColors[i * 3 + 2] = color.b;
  particleSizes[i] = 0.7 + rand() * 2.5;
  particleSpeeds[i] = 0.25 + rand() * 1.2;
  particleOffsets[i] = rand() * Math.PI * 2;
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
particleGeo.setAttribute('aColor', new THREE.BufferAttribute(particleColors, 3));
particleGeo.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));

const particleMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uPixelRatio: { value: DPR },
    uTime: { value: 0 }
  },
  vertexShader: /* glsl */ `
    attribute vec3 aColor;
    attribute float aSize;
    varying vec3 vColor;
    varying float vAlpha;
    uniform float uPixelRatio;
    uniform float uTime;

    void main() {
      vColor = aColor;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPixelRatio * (160.0 / max(-mvPosition.z, 1.0));
      gl_PointSize = clamp(gl_PointSize, 0.7, 9.0);
      vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.7 + position.x * 0.25 + position.z * 0.18));
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec2 p = gl_PointCoord - 0.5;
      float d = length(p);
      float core = smoothstep(0.5, 0.0, d);
      float halo = smoothstep(0.5, 0.12, d) * 0.3;
      float alpha = (core + halo) * vAlpha;
      gl_FragColor = vec4(vColor, alpha);
    }
  `
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// data streams rising from key towers
const streamCount = isMobile ? 110 : 190;
const streamPositions = new Float32Array(streamCount * 3);
const streamData = [];
for (let i = 0; i < streamCount; i++) {
  const tower = landMarks[i % landMarks.length];
  const radius = 0.4 + rand() * 1.8;
  streamPositions[i * 3] = tower.x + (rand() - 0.5) * radius;
  streamPositions[i * 3 + 1] = tower.h + rand() * 9;
  streamPositions[i * 3 + 2] = tower.z + (rand() - 0.5) * radius;
  streamData.push({
    baseX: streamPositions[i * 3],
    baseZ: streamPositions[i * 3 + 2],
    speed: 1.6 + rand() * 3.4,
    phase: rand(),
    amp: 0.2 + rand() * 0.9,
    color: rand() > 0.6 ? 1 : 0
  });
}
const streamGeo = new THREE.BufferGeometry();
streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
const streamColors = new Float32Array(streamCount * 3);
streamData.forEach((s, i) => {
  const c = s.color ? new THREE.Color(0xf2a365) : new THREE.Color(0x5de0e8);
  streamColors[i * 3] = c.r;
  streamColors[i * 3 + 1] = c.g;
  streamColors[i * 3 + 2] = c.b;
});
streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));
const streamPoints = new THREE.Points(
  streamGeo,
  new THREE.PointsMaterial({
    size: 0.32,
    map: glowTexture,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    sizeAttenuation: true
  })
);
scene.add(streamPoints);

/* ------------------------------------------------------------------
   Interaction / resize / render
   ------------------------------------------------------------------ */

window.addEventListener('pointermove', (event) => {
  pointer.tx = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.ty = (event.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });

function onResize() {
  const w = hero.clientWidth;
  const h = hero.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  bloom.setSize();
  if (reduceMotion) window.requestAnimationFrame(() => bloom.render(0));
}

let resizeTimer;
const ro = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 80);
});
ro.observe(hero);
window.addEventListener('orientationchange', onResize);

let isVisible = true;
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    isVisible = entry.isIntersecting;
  });
}, { threshold: 0.02 });
io.observe(hero);

// scroll parallax is intentionally tiny
let scrollProgress = 0;
function updateScrollProgress() {
  const max = hero.offsetHeight || 1;
  scrollProgress = Math.min(1, Math.max(0, window.scrollY / max));
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

/* ------------------------------------------------------------------
   Lightweight bloom pipeline (threshold -> separable blur -> composite)
   No external postprocessing modules required.
   ------------------------------------------------------------------ */

class BloomPipeline {
  constructor(rendererInstance, sceneInstance, cameraInstance) {
    this.renderer = rendererInstance;
    this.scene = sceneInstance;
    this.camera = cameraInstance;

    const targetOptions = {
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };

    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, {
      ...targetOptions,
      depthBuffer: true
    });
    this.sceneRT.texture.colorSpace = THREE.LinearSRGBColorSpace;

    this.brightRT = new THREE.WebGLRenderTarget(1, 1, targetOptions);
    this.blurA = new THREE.WebGLRenderTarget(1, 1, targetOptions);
    this.blurB = new THREE.WebGLRenderTarget(1, 1, targetOptions);
    this.blurC = new THREE.WebGLRenderTarget(1, 1, targetOptions);

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    this.brightMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        uThreshold: { value: 0.52 },
        uKnee: { value: 0.22 }
      },
      vertexShader: this.vertexShader(),
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform float uThreshold;
        uniform float uKnee;
        void main() {
          vec3 color = texture2D(tScene, vUv).rgb;
          float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
          float mask = smoothstep(uThreshold, uThreshold + uKnee, luminance);
          gl_FragColor = vec4(color * mask, 1.0);
        }
      `
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tDiffuse: { value: null },
        uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uRadius: { value: 1 }
      },
      vertexShader: this.vertexShader(),
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 uTexel;
        uniform vec2 uDirection;
        uniform float uRadius;

        void main() {
          vec2 step = uTexel * uDirection * uRadius;
          vec3 result = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
          result += texture2D(tDiffuse, vUv + step * 1.3846153846).rgb * 0.3162162162;
          result += texture2D(tDiffuse, vUv - step * 1.3846153846).rgb * 0.3162162162;
          result += texture2D(tDiffuse, vUv + step * 3.2307692308).rgb * 0.0702702703;
          result += texture2D(tDiffuse, vUv - step * 3.2307692308).rgb * 0.0702702703;
          gl_FragColor = vec4(result, 1.0);
        }
      `
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tBloom: { value: this.blurC.texture },
        uStrength: { value: 0.66 },
        uTime: { value: 0 }
      },
      vertexShader: this.vertexShader(),
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float uStrength;
        uniform float uTime;

        vec3 toSRGB(vec3 color) {
          return mix(
            1.055 * pow(max(color, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
            color * 12.92,
            step(color, vec3(0.0031308))
          );
        }

        void main() {
          vec2 dir = vUv - 0.5;
          float fringing = length(dir) * 0.0022;
          vec3 base;
          base.r = texture2D(tScene, vUv + dir * fringing).r;
          base.g = texture2D(tScene, vUv).g;
          base.b = texture2D(tScene, vUv - dir * fringing).b;

          vec3 bloom = texture2D(tBloom, vUv).rgb;
          vec3 color = base + bloom * uStrength;

          // barely-there signal grain in the dark areas
          float grain = fract(sin(dot(vUv * 1024.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          color += (grain - 0.5) * 0.008;

          gl_FragColor = vec4(toSRGB(max(color, vec3(0.0))), 1.0);
        }
      `
    });

    this.setSize();
  }

  vertexShader() {
    return /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;
  }

  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = Math.max(1, size.x);
    const height = Math.max(1, size.y);
    this.sceneRT.setSize(width, height);

    const bloomWidth = Math.max(1, Math.floor(width * 0.48));
    const bloomHeight = Math.max(1, Math.floor(height * 0.48));
    [this.brightRT, this.blurA, this.blurB, this.blurC].forEach((rt) => rt.setSize(bloomWidth, bloomHeight));
    this.blurTexel = new THREE.Vector2(1 / bloomWidth, 1 / bloomHeight);
  }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  blur(source, targetA, targetB, radius) {
    this.blurMaterial.uniforms.tDiffuse.value = source;
    this.blurMaterial.uniforms.uTexel.value.copy(this.blurTexel);
    this.blurMaterial.uniforms.uDirection.value.set(1, 0);
    this.blurMaterial.uniforms.uRadius.value = radius;
    this.pass(this.blurMaterial, targetA);

    this.blurMaterial.uniforms.tDiffuse.value = targetA.texture;
    this.blurMaterial.uniforms.uDirection.value.set(0, 1);
    this.pass(this.blurMaterial, targetB);
  }

  render(elapsed = 0) {
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(this.scene, this.camera);

    this.brightMaterial.uniforms.tScene.value = this.sceneRT.texture;
    this.pass(this.brightMaterial, this.brightRT);

    this.blur(this.brightRT.texture, this.blurA, this.blurB, 1.0);
    this.blur(this.blurB.texture, this.blurA, this.blurC, 2.3);

    this.compositeMaterial.uniforms.tScene.value = this.sceneRT.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.blurC.texture;
    this.compositeMaterial.uniforms.uTime.value = elapsed;
    this.pass(this.compositeMaterial, null);
  }
}

const bloom = new BloomPipeline(renderer, scene, camera);

const target = new THREE.Vector3();
const clockTime = { value: 0 };

function updateOrbits(t) {
  orbitMeshes.forEach((orbit, index) => {
    const { radius, phases, speed, phase, y, scaleZ, positions, geo } = orbit.userData;
    for (let i = 0; i < phases.length; i++) {
      const a = phases[i] + t * speed + phase;
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = y + Math.sin(t * 1.4 + i * 0.7) * 0.06;
      positions[i * 3 + 2] = Math.sin(a) * radius * scaleZ;
    }
    geo.attributes.position.needsUpdate = true;
  });
}

function updateParticles(dt, t) {
  const positions = particleGeo.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 1] += dt * particleSpeeds[i] * 0.55;
    if (positions[i * 3 + 1] > 30) {
      positions[i * 3 + 1] = 0.6 + rand() * 2;
      const angle = rand() * Math.PI * 2;
      const radius = 7 + Math.sqrt(rand()) * 48;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 2] = Math.sin(angle) * radius * 0.84;
    }
  }
  particleGeo.attributes.position.needsUpdate = true;
  particleMat.uniforms.uTime.value = t;

  const streams = streamGeo.attributes.position.array;
  for (let i = 0; i < streamCount; i++) {
    const data = streamData[i];
    streams[i * 3 + 1] += dt * data.speed;
    const maxY = 27 + data.amp * 8;
    if (streams[i * 3 + 1] > maxY) {
      streams[i * 3 + 1] = 4 + rand() * 4;
    }
    streams[i * 3] = data.baseX + Math.sin(t * 0.5 + data.phase * 10 + streams[i * 3 + 1] * 0.2) * data.amp * 0.35;
    streams[i * 3 + 2] = data.baseZ + Math.cos(t * 0.4 + data.phase * 8 + streams[i * 3 + 1] * 0.17) * data.amp * 0.35;
  }
  streamGeo.attributes.position.needsUpdate = true;
}

function animate() {
  requestAnimationFrame(animate);
  if (!isVisible || document.hidden) return;

  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  clockTime.value = t;

  pointer.x += (pointer.tx - pointer.x) * mouseEase;
  pointer.y += (pointer.ty - pointer.y) * mouseEase;

  // camera breathe / aisle
  const camDrift = reduceMotion ? 0 : 1;
  camera.position.x = CAMERA_BASE.x + pointer.x * 1.4 * camDrift + scrollProgress * 0.8;
  camera.position.y = CAMERA_BASE.y - pointer.y * 0.55 * camDrift + scrollProgress * 1.2;
  camera.position.z = CAMERA_BASE.z + scrollProgress * 2.4;
  target.set(
    CAMERA_TARGET.x + pointer.x * 0.6,
    CAMERA_TARGET.y + pointer.y * 0.3,
    CAMERA_TARGET.z
  );
  camera.lookAt(target);

  // core float & pointer tilt
  if (!reduceMotion) {
    core.position.y = CORE_FLOAT + Math.sin(t * 0.72) * 0.16;
    core.rotation.y = -0.08 + pointer.x * 0.07 + Math.sin(t * 0.23) * 0.025;
    core.rotation.x = pointer.y * 0.025;
    core.rotation.z = Math.sin(t * 0.19) * 0.006;
  }

  circuitMat.uniforms.uTime.value = t;
  groundMat.uniforms.uTime.value = t;
  sky.material.uniforms.uTime.value = t;
  beamMaterials.forEach((mat, index) => {
    if (mat.uniforms.uTime) mat.uniforms.uTime.value = t + index * 1.7;
  });

  // scanner passes up / down
  scanBar.position.y = Math.sin(t * 0.45) * (frameSize * 0.42);
  scanBar.material.opacity = 0.1 + Math.abs(Math.sin(t * 0.45)) * 0.14;

  hudRingGroup.rotation.z = t * 0.025;
  arc.rotation.z = -t * 0.018;

  coreNodes.forEach((node) => {
    node.material.opacity = node.userData.base + Math.sin(t * 1.8 + node.userData.phase) * 0.22;
    const s = node.scale.x;
    node.scale.setScalar(0.32 + Math.abs(Math.sin(t * 0.7 + node.userData.phase)) * 0.16);
    node.scale.z = 1;
    node.position.z = 0.19 + Math.sin(t * 0.25 + node.userData.phase) * 0.015;
    node.material.opacity = Math.max(0.1, node.material.opacity);
  });

  labelSprite.material.opacity = 0.82 + Math.sin(t * 1.2) * 0.06;
  coreGlow.material.opacity = 0.26 + Math.sin(t * 0.8) * 0.06;
  frameGlow.material.opacity = 0.6 + Math.sin(t * 1.1) * 0.12;
  aura.material.opacity = 0.23 + Math.sin(t * 0.34) * 0.05;
  plaza.rotation.y = reduceMotion ? 0 : t * 0.008;

  updateOrbits(t);
  updateParticles(dt, t);

  bloom.render(t);
}

if (reduceMotion) {
  // one carefully composed still frame
  onResize();
  bloom.render(0);
  document.documentElement.classList.add('world-static');
} else {
  animate();
}

// expose a tiny debug interface while building
window.__NEXUS__ = {
  scene,
  camera,
  renderer,
  core,
  get visible() { return isVisible; }
};
