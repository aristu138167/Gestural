import { examples } from './examples.js';

function buildPreviewHtml() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin:0; height:100%; overflow:hidden; background:#111; }
    canvas { width:100%; height:100%; display:block; outline: none; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.159.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <canvas id="c" tabindex="1"></canvas>
  <script type="module" src="./bvhApi.js"></script>
</body>
</html>`;
}

const iframe = document.getElementById("preview");
const codeEl = document.getElementById("code");
const runBtn = document.getElementById("run");
const toggleBtn = document.getElementById("toggle");
const overlay = document.getElementById("overlay");
const bar = document.getElementById("bar");
const resizeHandle = document.getElementById("resizeHandle");
const randomBtn = document.getElementById("randomBtn");
const errBox = document.getElementById("err");

let engineReady = false;
let pendingCode = null;
let isRigSelected = false;

// --- ESCUCHAMOS LOS MENSAJES DEL MOTOR 3D ---
window.addEventListener('message', (e) => {
  if (e.data.type === 'ready') {
    engineReady = true;
    if (pendingCode) { runCode(pendingCode); pendingCode = null; }
  } else if (e.data.type === 'error') {
    mostrarError(e.data.message);

    // 1. EL USUARIO HA MOVIDO UN PERSONAJE
  } else if (e.data.type === 'rigMoved') {
    const { codeIndex, x, z } = e.data;
    let code = codeEl.value;
    let lines = code.split('\n');
    let currentSpawnIndex = 0;
    let charCount = 0; // Añadimos el contador aquí también

    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:bvh|duplicate)\s*\(/.test(lines[i])) {
        if (currentSpawnIndex === codeIndex) {
          let line = lines[i];
          line = line.replace(/\.pos\([^)]+\)/g, '').replace(/\.x\([^)]+\)/g, '').replace(/\.z\([^)]+\)/g, '');
          line = line.replace(/(bvh\([^)]+\)|duplicate\([^)]+\))/, `$1.pos(${Math.round(x)}, 0, ${Math.round(z)})`);
          lines[i] = line;

          codeEl.value = lines.join('\n');
          // Mantenemos el subrayado tras actualizar los números
          codeEl.setSelectionRange(charCount, charCount + line.length);
          break;
        }
        currentSpawnIndex++;
      }
      charCount += lines[i].length + 1;
    }

    // 2. EL USUARIO HA ROTADO UN PERSONAJE
  } else if (e.data.type === 'rigRotated') {
    const { codeIndex, rotX, rotY } = e.data;
    let code = codeEl.value;
    let lines = code.split('\n');
    let currentSpawnIndex = 0;
    let charCount = 0; // Añadimos el contador aquí también

    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:bvh|duplicate)\s*\(/.test(lines[i])) {
        if (currentSpawnIndex === codeIndex) {
          let line = lines[i];
          line = line.replace(/\.rotX\([^)]+\)/g, '').replace(/\.rotY\([^)]+\)/g, '');

          let rotString = '';
          if (Math.abs(rotX) > 0.01) rotString += `.rotX(${rotX.toFixed(2)})`;
          if (Math.abs(rotY) > 0.01) rotString += `.rotY(${rotY.toFixed(2)})`;

          if (rotString !== '') {
            line = line.replace(/(bvh\([^)]+\)|duplicate\([^)]+\))/, `$1${rotString}`);
          }
          lines[i] = line;

          codeEl.value = lines.join('\n');
          // Mantenemos el subrayado tras actualizar los números
          codeEl.setSelectionRange(charCount, charCount + line.length);
          break;
        }
        currentSpawnIndex++;
      }
      charCount += lines[i].length + 1;
    }

    // 3. EL USUARIO HA HECHO CLIC EN UN PERSONAJE
  } else if (e.data.type === 'rigSelected') {
    isRigSelected = true; // Avisamos de que hay selección
    const targetIndex = e.data.codeIndex;
    let code = codeEl.value;
    let lines = code.split('\n');
    let currentSpawnIndex = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (/\b(?:bvh|duplicate)\s*\(/.test(lines[i])) {
        if (currentSpawnIndex === targetIndex) {

          // Magia: Forzamos el foco en el editor para que el navegador pinte el azul
          codeEl.focus();
          codeEl.setSelectionRange(charCount, charCount + lines[i].length);
          break;
        }
        currentSpawnIndex++;
      }
      charCount += lines[i].length + 1;
    }

    // 4. EL USUARIO HA HECHO CLIC EN EL VACÍO
  } else if (e.data.type === 'rigDeselected') {
    isRigSelected = false; // Apagamos la selección
    codeEl.setSelectionRange(codeEl.selectionEnd, codeEl.selectionEnd);
  }
});

function mostrarError(msg) {
  if (errBox) { errBox.style.display = "block"; errBox.textContent = msg; }
  else { console.error(msg); }
}

function run() {
  if (!engineReady) { pendingCode = codeEl.value; }
  else { runCode(codeEl.value); }
}

function runCode(code) {
  if (errBox) errBox.style.display = 'none';
  iframe.contentWindow.postMessage({ type: 'execute', code: code }, '*');
}

runBtn.addEventListener("click", run);
window.addEventListener("keydown", (e) => {
  if (((e.ctrlKey || e.metaKey) && e.key === "Enter") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) {
    e.preventDefault(); run();
  }
});

const loader = document.getElementById("loader");
let currentExampleIndex = 0;
let debounceTimer = null;

if (randomBtn) {
  randomBtn.addEventListener("click", () => {
    let randomIndex;
    do { randomIndex = Math.floor(Math.random() * examples.length); } while (randomIndex === currentExampleIndex || randomIndex === 0);
    currentExampleIndex = randomIndex;
    const selected = examples[currentExampleIndex];
    codeEl.value = `///// ${selected.name} /////\n${selected.code}`;
    if (loader) loader.style.display = "block";
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { run(); if (loader) loader.style.display = "none"; }, 3000);
  });
}

let prevSize = null;
toggleBtn.addEventListener("click", () => {
  const minimized = overlay.classList.toggle("minimized");
  if (minimized) {
    prevSize = { width: overlay.style.width || "", height: overlay.style.height || "" };
    overlay.style.height = bar.offsetHeight + "px"; toggleBtn.textContent = "Show";
  } else {
    if (prevSize) { overlay.style.width = prevSize.width; overlay.style.height = prevSize.height; }
    else { overlay.style.width = ""; overlay.style.height = ""; }
    toggleBtn.textContent = "Hide";
  }
});

let dragging = false; let startX = 0, startY = 0; let startLeft = 0, startTop = 0;
bar.addEventListener("pointerdown", (e) => {
  if (e.target && e.target.tagName === "BUTTON") return;
  dragging = true; bar.setPointerCapture(e.pointerId);
  const rect = overlay.getBoundingClientRect();
  startX = e.clientX; startY = e.clientY; startLeft = rect.left; startTop = rect.top;
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - startX; const dy = e.clientY - startY;
  const left = Math.max(8, Math.min(window.innerWidth - overlay.offsetWidth - 8, startLeft + dx));
  const top = Math.max(8, Math.min(window.innerHeight - overlay.offsetHeight - 8, startTop + dy));
  overlay.style.left = `${left}px`; overlay.style.top = `${top}px`;
});
window.addEventListener("pointerup", () => { dragging = false; });

let resizing = false; let startW = 0, startH = 0, startRX = 0, startRY = 0;
resizeHandle.addEventListener("pointerdown", (e) => {
  resizing = true; resizeHandle.setPointerCapture(e.pointerId);
  startW = overlay.offsetWidth; startH = overlay.offsetHeight;
  startRX = e.clientX; startRY = e.clientY; e.preventDefault();
});
window.addEventListener("pointermove", (e) => {
  if (!resizing) return;
  const newW = startW + (e.clientX - startRX); const newH = startH + (e.clientY - startRY);
  const w = Math.max(320, Math.min(window.innerWidth - 16, newW));
  const h = Math.max(220, Math.min(window.innerHeight - 16, newH));
  overlay.style.width = `${w}px`; overlay.style.height = `${h}px`;
});
window.addEventListener("pointerup", () => { resizing = false; });

codeEl.addEventListener("keydown", function (e) {
  // 1. Si hay un muñeco seleccionado, atrapamos las flechas y se las mandamos al 3D
  if (isRigSelected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault(); // Evitamos que el cursor de texto se mueva y quite el azul
    iframe.contentWindow.postMessage({ type: 'remoteKey', key: e.key, shiftKey: e.shiftKey }, '*');
    return;
  }

  // 2. Comportamiento normal del Tabulador
  if (e.key === "Tab") {
    e.preventDefault();
    const start = this.selectionStart; const end = this.selectionEnd;
    const spaces = "  ";
    this.value = this.value.substring(0, start) + spaces + this.value.substring(end);
    this.selectionStart = this.selectionEnd = start + spaces.length;
  }
});

function init() {
  iframe.srcdoc = buildPreviewHtml();
  const defaultExample = examples[0];
  codeEl.value = `///// ${defaultExample.name} /////\n${defaultExample.code}`;
  run();
}

init();