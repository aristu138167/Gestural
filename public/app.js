function escapeForScript(code) {
  return code.replace(/<\/script>/gi, "<\\/script>");
}

function buildPreviewHtml(userCode) {
  const threeVersion = "0.159.0";
  const threeModule = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/build/three.module.js`;
  const orbitControls = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/controls/OrbitControls.js`;
  const bvhLoader = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/loaders/BVHLoader.js`;

  const prelude = `
import * as THREE from "three";
import { OrbitControls } from "${orbitControls}";
import { BVHLoader } from "${bvhLoader}";

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 1000);
camera.position.set(3, 2, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 2);
scene.add(light);

// Params editables
// El usuario puede hacer: __SB.params.rotSpeed = 2.0; etc.
const params = {
  rotSpeed: 0,
  animSpeed: 1.0,
  scale: 1.0,
  scrub: 0.0,
  pause: false,
  showSkeleton: true
};
window.__SB = { params };

let update = () => {};

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animate() {
  resize();
  controls.update();
  update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html, body { margin:0; height:100%; overflow:hidden; background:#111; }
    canvas { width:100%; height:100%; display:block; }
    #err {
      position:fixed; left:0; right:0; bottom:0;
      max-height:40%;
      overflow:auto;
      font:12px/1.4 Consolas, monospace;
      color:#ffb4b4;
      background:rgba(0,0,0,0.70);
      padding:10px;
      white-space:pre-wrap;
      display:none;
    }
  </style>

  <script type="importmap">
    {
      "imports": {
        "three": "${threeModule}"
      }
    }
  </script>
</head>
<body>
  <canvas id="c"></canvas>
  <div id="err"></div>

  <script type="module">
    const errBox = document.getElementById("err");
    function showErr(msg) {
      errBox.style.display = "block";
      errBox.textContent += "\\n" + msg;
    }
    window.addEventListener("error", (e) => showErr(e.error?.stack || e.message || e.type));
    window.addEventListener("unhandledrejection", (e) => showErr(e.reason?.stack || e.reason || "Unhandled rejection"));

    ${prelude}

    try {
      ${escapeForScript(userCode)}
    } catch (e) {
      showErr(e?.stack || e);
    }

    animate();
  </script>
</body>
</html>`;
}

const defaultCode = `// BVH starter (pirouette.bvh)
// Requiere: /assets/pirouette.bvh en tu server local

let mixer = null;
let root = null;
let skeletonHelper = null;
let action = null;

const clock = new THREE.Clock();

scene.add(new THREE.GridHelper(400, 10));
camera.position.set(0, 200, 300);
camera.lookAt(0, 120, 0);

const P = window.__SB.params;

/////////////////////////////////////////////
// Cambia aquí valores por defecto si quieres:
P.animSpeed = 1.0;
P.scale = 1.0;
P.pause = false;
P.showSkeleton = true;
// P.rotSpeed = 0.0;
// P.scrub = 0.0;
/////////////////////////////////////////////

const loader = new BVHLoader();
loader.load("/assets/pirouette.bvh", (result) => {
  root = result.skeleton.bones[0];

  skeletonHelper = new THREE.SkeletonHelper(root);
  scene.add(root);
  scene.add(skeletonHelper);

  mixer = new THREE.AnimationMixer(root);
  action = mixer.clipAction(result.clip);
  action.play();
}, undefined, (err) => console.error("BVH load error:", err));

update = () => {
  const dt = clock.getDelta();

  if (mixer && action) {
    if (!P.pause) {
      mixer.timeScale = P.animSpeed;
      mixer.update(dt);
    }

    // Si quieres que P.scrub mande, descomenta:
    // action.paused = true;
    // action.time = action.getClip().duration * P.scrub;
  }

  if (root) {
    root.rotation.y += dt * P.rotSpeed;
    root.scale.setScalar(P.scale);
  }

  if (skeletonHelper) {
    skeletonHelper.visible = P.showSkeleton;
  }
};
`;

const iframe = document.getElementById("preview");
const codeEl = document.getElementById("code");
const runBtn = document.getElementById("run");
const toggleBtn = document.getElementById("toggle");
const overlay = document.getElementById("overlay");

// codeEl.value = localStorage.getItem("sbcode_lite_code") || defaultCode;
localStorage.removeItem("sbcode_lite_code");
codeEl.value = defaultCode;

function run() {
  localStorage.setItem("sbcode_lite_code", codeEl.value);
  iframe.srcdoc = buildPreviewHtml(codeEl.value);
}

runBtn.addEventListener("click", run);

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    run();
  }
});

let prevSize = null; // { width, height }

toggleBtn.addEventListener("click", () => {
  const minimized = overlay.classList.toggle("minimized");

  if (minimized) {
    // guarda tamaño actual (incluye el que vino de resize)
    prevSize = {
      width: overlay.style.width || "",
      height: overlay.style.height || "",
    };

    // mantener el ancho actual, pero colapsar altura a la cabecera
    overlay.style.height = bar.offsetHeight + "px";

    // (opcional) si quieres fijar también el ancho actual por si estaba en %
    // overlay.style.width = overlay.offsetWidth + "px";

    toggleBtn.textContent = "Show";
  } else {
    // restaurar tamaño previo
    if (prevSize) {
      overlay.style.width = prevSize.width;
      overlay.style.height = prevSize.height;
    } else {
      overlay.style.width = "";
      overlay.style.height = "";
    }

    toggleBtn.textContent = "Hide";
  }
});

// --- DRAG del overlay (tipo Hydra) ---
let dragging = false;
let startX = 0, startY = 0;
let startLeft = 0, startTop = 0;

const bar = document.getElementById("bar");

bar.addEventListener("pointerdown", (e) => {
  // Si pinchas un botón, no arrastres
  const t = e.target;
  if (t && t.tagName === "BUTTON") return;

  dragging = true;
  bar.setPointerCapture(e.pointerId);

  const rect = overlay.getBoundingClientRect();
  startX = e.clientX;
  startY = e.clientY;
  startLeft = rect.left;
  startTop = rect.top;
});

window.addEventListener("pointermove", (e) => {
  if (!dragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  const left = Math.max(8, Math.min(window.innerWidth - overlay.offsetWidth - 8, startLeft + dx));
  const top  = Math.max(8, Math.min(window.innerHeight - overlay.offsetHeight - 8, startTop + dy));

  overlay.style.left = `${left}px`;
  overlay.style.top = `${top}px`;
});

window.addEventListener("pointerup", () => {
  dragging = false;
});

// --- RESIZE del overlay (esquina) ---
const resizeHandle = document.getElementById("resizeHandle");

let resizing = false;
let startW = 0, startH = 0, startRX = 0, startRY = 0;

resizeHandle.addEventListener("pointerdown", (e) => {
  resizing = true;
  resizeHandle.setPointerCapture(e.pointerId);

  startW = overlay.offsetWidth;
  startH = overlay.offsetHeight;
  startRX = e.clientX;
  startRY = e.clientY;

  e.preventDefault();
});

window.addEventListener("pointermove", (e) => {
  if (!resizing) return;

  const newW = startW + (e.clientX - startRX);
  const newH = startH + (e.clientY - startRY);

  const w = Math.max(320, Math.min(window.innerWidth - 16, newW));
  const h = Math.max(220, Math.min(window.innerHeight - 16, newH));

  overlay.style.width = `${w}px`;
  overlay.style.height = `${h}px`;
});

window.addEventListener("pointerup", () => {
  resizing = false;
});

run();