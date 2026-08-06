import * as THREE from "three";

const stage = document.getElementById("globe-stage");
const canvas = document.getElementById("globe-canvas");

let renderer;
let scene;
let camera;
let globe;
let globeMat;
let atmosphere;
let animId = 0;
let running = false;
let startTime = 0;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

async function createNightMaps() {
  const w = 2048;
  const h = 1024;
  const base = document.createElement("canvas");
  base.width = w;
  base.height = h;
  const bctx = base.getContext("2d", { willReadFrequently: true });

  const glow = document.createElement("canvas");
  glow.width = w;
  glow.height = h;
  const gctx = glow.getContext("2d");

  const img = await loadImage("images/earth-map.jpg");
  bctx.drawImage(img, 0, 0, w, h);

  const frame = bctx.getImageData(0, 0, w, h);
  const data = frame.data;
  const land = new Uint8Array(w * h);

  for (let p = 0, i = 0; p < land.length; p += 1, i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isOcean = b > r + 12 && b > g + 4 && b > 70;
    const isDeepWater = b > r && b > g && r < 60 && g < 90;
    land[p] = isOcean || isDeepWater ? 0 : 1;
  }

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = y * w + x;
      const i = p * 4;
      const lum = (data[i] * 0.3 + data[i + 1] * 0.5 + data[i + 2] * 0.2) / 255;
      const polar = Math.abs(y / h - 0.5) * 2;
      const poleShade = 1 - polar * 0.2;

      let edge = 0;
      if (land[p]) {
        const l = land[y * w + ((x - 1 + w) % w)];
        const r = land[y * w + ((x + 1) % w)];
        const u = land[Math.max(0, y - 1) * w + x];
        const d = land[Math.min(h - 1, y + 1) * w + x];
        if (!l || !r || !u || !d) edge = 1;
      }

      if (!land[p]) {
        const dpt = (0.9 + lum * 0.15) * poleShade;
        data[i] = Math.round(34 * dpt);
        data[i + 1] = Math.round(38 * dpt);
        data[i + 2] = Math.round(48 * dpt);
      } else {
        const dpt = (0.84 + lum * 0.22) * poleShade;
        data[i] = Math.round(58 * dpt);
        data[i + 1] = Math.round(28 * dpt);
        data[i + 2] = Math.round(36 * dpt);
        if (edge) {
          data[i] = Math.round(118 * poleShade);
          data[i + 1] = Math.round(42 * poleShade);
          data[i + 2] = Math.round(54 * poleShade);
        }
      }
    }
  }
  bctx.putImageData(frame, 0, 0);

  const shine = bctx.createRadialGradient(w * 0.34, h * 0.28, 0, w * 0.34, h * 0.28, h * 0.4);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.16)");
  shine.addColorStop(0.4, "rgba(255, 190, 205, 0.05)");
  shine.addColorStop(1, "rgba(0, 0, 0, 0)");
  bctx.fillStyle = shine;
  bctx.fillRect(0, 0, w, h);

  gctx.fillStyle = "#000";
  gctx.fillRect(0, 0, w, h);

  for (let y = 1; y < h; y += 2) {
    for (let x = 1; x < w; x += 2) {
      const p = y * w + x;
      if (!land[p]) continue;
      const l = land[y * w + ((x - 1 + w) % w)];
      const r = land[y * w + ((x + 1) % w)];
      const u = land[Math.max(0, y - 1) * w + x];
      const d = land[Math.min(h - 1, y + 1) * w + x];
      const coastal = !l || !r || !u || !d ? 1 : 0;
      const n = hash2(x * 0.41, y * 0.67);
      const n2 = hash2(x * 2.1, y * 1.7);
      const threshold = coastal ? 0.2 + n2 * 0.16 : 0.07 + n2 * 0.07;
      if (n > threshold) continue;
      const bright = 175 + Math.floor(n2 * 80);
      gctx.fillStyle = `rgb(${bright}, ${28 + Math.floor(n * 30)}, ${42 + Math.floor(n2 * 28)})`;
      gctx.fillRect(x, y, coastal || n2 > 0.7 ? 2 : 1, coastal || n2 > 0.7 ? 2 : 1);
    }
  }

  gctx.globalCompositeOperation = "lighter";
  for (let y = 5; y < h; y += 5) {
    for (let x = 5; x < w; x += 5) {
      if (!land[y * w + x]) continue;
      const n = hash2(x * 0.19, y * 0.33);
      if (n > 0.3) continue;
      const rad = 5 + n * 10;
      const grd = gctx.createRadialGradient(x, y, 0, x, y, rad);
      grd.addColorStop(0, `rgba(255, 140, 155, ${0.3 + n * 0.35})`);
      grd.addColorStop(0.5, `rgba(210, 18, 40, ${0.14 + n * 0.16})`);
      grd.addColorStop(1, "rgba(100, 0, 12, 0)");
      gctx.fillStyle = grd;
      gctx.beginPath();
      gctx.arc(x, y, rad, 0, Math.PI * 2);
      gctx.fill();
    }
  }

  const metros = [
    [0.21, 0.31], [0.24, 0.35], [0.27, 0.33],
    [0.29, 0.57], [0.5, 0.25], [0.52, 0.27], [0.54, 0.26],
    [0.56, 0.4], [0.72, 0.3], [0.78, 0.34], [0.81, 0.36],
    [0.84, 0.66], [0.63, 0.37],
  ];
  metros.forEach(([nx, ny], idx) => {
    const x = nx * w;
    const y = ny * h;
    const rad = 18 + (idx % 3) * 6;
    const grd = gctx.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, "rgba(255, 235, 240, 0.92)");
    grd.addColorStop(0.2, "rgba(255, 65, 85, 0.7)");
    grd.addColorStop(0.55, "rgba(180, 8, 28, 0.28)");
    grd.addColorStop(1, "rgba(70, 0, 10, 0)");
    gctx.fillStyle = grd;
    gctx.beginPath();
    gctx.arc(x, y, rad, 0, Math.PI * 2);
    gctx.fill();
  });
  gctx.globalCompositeOperation = "source-over";

  bctx.globalCompositeOperation = "lighter";
  bctx.globalAlpha = 0.94;
  bctx.drawImage(glow, 0, 0);
  bctx.globalAlpha = 1;
  bctx.globalCompositeOperation = "source-over";

  const colorMap = new THREE.CanvasTexture(base);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.needsUpdate = true;

  const emissiveMap = new THREE.CanvasTexture(glow);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.needsUpdate = true;

  return { colorMap, emissiveMap };
}

async function buildScene() {
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 96;

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    premultipliedAlpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 40);
  camera.position.set(0, 0, 3.12);

  scene.add(new THREE.AmbientLight(0xd0d5e0, 0.52));
  const key = new THREE.DirectionalLight(0xffffff, 0.75);
  key.position.set(2.4, 2.5, 3.1);
  const rim = new THREE.DirectionalLight(0xff4560, 0.5);
  rim.position.set(-1.8, 0.5, -2.3);
  scene.add(key, rim);

  globe = new THREE.Group();
  scene.add(globe);

  const { colorMap, emissiveMap } = await createNightMaps();
  const maxAniso = renderer.capabilities?.getMaxAnisotropy?.() || 4;
  colorMap.anisotropy = Math.min(8, maxAniso);
  emissiveMap.anisotropy = Math.min(8, maxAniso);

  globeMat = new THREE.MeshStandardMaterial({
    map: colorMap,
    emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 1.45,
    metalness: 0.12,
    roughness: 0.55,
  });
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 96), globeMat));

  atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.045, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff6174,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  globe.add(atmosphere);
}

let lastCanvasW = 0;
let lastCanvasH = 0;

function onResize() {
  if (!renderer || !camera || !canvas) return;
  const w = canvas.clientWidth || 96;
  const h = canvas.clientHeight || 96;
  if (w < 2 || h < 2) return;
  if (w === lastCanvasW && h === lastCanvasH) return;
  lastCanvasW = w;
  lastCanvasH = h;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function animate(now) {
  if (!running) return;
  animId = requestAnimationFrame(animate);
  if (document.hidden) return;

  if (!startTime) startTime = now;
  const t = now * 0.001;

  globe.rotation.y = t * 0.28;
  globe.rotation.x = Math.sin(t * 0.14) * 0.02;

  if (globeMat) {
    globeMat.emissiveIntensity = 1.35 + Math.sin(t * 1.1) * 0.1;
  }
  if (atmosphere) {
    atmosphere.material.opacity = 0.1 + Math.sin(t * 0.55) * 0.02;
  }

  renderer.render(scene, camera);
}

function startLoop() {
  if (running || prefersReducedMotion()) return;
  running = true;
  animId = requestAnimationFrame(animate);
}

function syncScrollScale() {
  const header = document.querySelector(".header");
  if (!header) return;
  const maxScroll = 280;
  const y = Math.min(Math.max(window.scrollY, 0), maxScroll);
  const t = y / maxScroll;
  header.style.setProperty("--header-compact", t.toFixed(3));
  onResize();
}

function init() {
  if (!canvas || !stage) return;

  if (prefersReducedMotion()) {
    stage.classList.add("is-static");
    return;
  }

  const boot = async () => {
    try {
      await buildScene();
      onResize();
      syncScrollScale();
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", syncScrollScale, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) onResize();
      });
      startLoop();
    } catch (err) {
      console.error("Logo globe failed:", err);
      stage.classList.add("is-static");
    }
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(boot).catch(boot);
  } else {
    boot();
  }
}

init();
