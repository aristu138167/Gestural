function escapeForScript(code) {
  return code.replace(/<\/script>/gi, "<\\/script>");
}

function buildPreviewHtml(userCode) {
  const threeVersion = "0.159.0";
  const threeModule = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/build/three.module.js`;
  const orbitControls = `https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/controls/OrbitControls.js`;

  const prelude = `
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
        "three": "${threeModule}",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@${threeVersion}/examples/jsm/"
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

const defaultCode = `// Template estilo SBCode (1 cubo)
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshNormalMaterial({ wireframe: true })
);
scene.add(cube);

const clock = new THREE.Clock();
update = () => {
  const delta = clock.getDelta();
  cube.rotation.x += delta;
  cube.rotation.y += delta;
};
`;

const iframe = document.getElementById("preview");
const codeEl = document.getElementById("code");
const runBtn = document.getElementById("run");
const toggleBtn = document.getElementById("toggle");
const overlay = document.getElementById("overlay");

codeEl.value = localStorage.getItem("sbcode_lite_code") || defaultCode;

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

toggleBtn.addEventListener("click", () => {
  overlay.classList.toggle("minimized");
  toggleBtn.textContent = overlay.classList.contains("minimized") ? "Show" : "Hide";
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

run();