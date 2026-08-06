import * as THREE from "three";

const stage = document.getElementById("globe-stage");
const canvas = document.getElementById("globe-canvas");

let renderer;
let scene;
let camera;
let globe;
let atmosphere;
let animId = 0;
let running = false;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function createGlobeTexture() {
  // Equirectangular: at the equator, 1px X ≈ 1px Y in angle — text stays unstretched
  const w = 2048;
  const h = 1024;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#5c0812";
  ctx.fillRect(0, 0, w, h);

  const poles = ctx.createLinearGradient(0, 0, 0, h);
  poles.addColorStop(0, "rgba(0, 0, 0, 0.35)");
  poles.addColorStop(0.35, "rgba(0, 0, 0, 0)");
  poles.addColorStop(0.65, "rgba(0, 0, 0, 0)");
  poles.addColorStop(1, "rgba(0, 0, 0, 0.4)");
  ctx.fillStyle = poles;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(255, 205, 215, 0.11)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 5; i += 1) {
    const y = (i / 5) * h;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  const eqY = h * 0.5;
  ctx.strokeStyle = "rgba(255, 220, 230, 0.2)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, eqY);
  ctx.lineTo(w, eqY);
  ctx.stroke();

  // Two opposite phrases — one in front, one behind, never stacked
  const phrase = "WORLD OF SOLUTIONS";
  ctx.font = "700 56px Outfit, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "rgba(20, 0, 4, 0.6)";
  ctx.lineWidth = 6;

  for (let i = 0; i < 2; i += 1) {
    const x = (i + 0.5) * (w / 2);
    ctx.strokeText(phrase, x, eqY);
    ctx.fillText(phrase, x, eqY);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildScene() {
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
  renderer.toneMappingExposure = 1.08;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 40);
  camera.position.set(0, 0, 3.12);

  scene.add(new THREE.AmbientLight(0xffeef0, 0.62));
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(2.2, 2.4, 3);
  const fill = new THREE.DirectionalLight(0xff8a98, 0.28);
  fill.position.set(-2.4, -0.2, 1.8);
  const rim = new THREE.DirectionalLight(0xff1a35, 0.55);
  rim.position.set(-1.2, 0.6, -2.6);
  scene.add(key, fill, rim);

  globe = new THREE.Group();
  scene.add(globe);

  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      new THREE.MeshStandardMaterial({
        map: createGlobeTexture(),
        metalness: 0.22,
        roughness: 0.38,
        emissive: 0x2a050a,
        emissiveIntensity: 0.14,
      })
    )
  );

  atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.04, 48, 48),
    new THREE.MeshBasicMaterial({
      color: 0xff3d58,
      transparent: true,
      opacity: 0.1,
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

  const t = now * 0.001;
  globe.rotation.y = t * 0.38;
  globe.rotation.x = Math.sin(t * 0.18) * 0.03;
  if (atmosphere) {
    atmosphere.material.opacity = 0.09 + Math.sin(t * 0.7) * 0.015;
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

  const boot = () => {
    try {
      buildScene();
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
