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
const saveBtn = document.getElementById('saveBtn');
const errBox = document.getElementById("err");
const globalPauseBtn = document.getElementById("globalPauseBtn");

let engineReady = false;
let pendingCode = null;
let isRigSelected = false;
let isGlobalPaused = false;
let isSaved = false;

// --- FUNCIÓN HELPER PARA LA NUEVA SINTAXIS ---
const isNewHead = (line) => {
  let match = line.match(/(?:>\s*\[?\s*)?\b(?:bvh|duplicate)\s*\(/);
  return match && !match[0].includes('>');
};

// ==========================================
// COMUNICACIÓN CON EL MOTOR 3D
// ==========================================
window.addEventListener('message', (e) => {
  if (e.data.type === 'ready') {
    engineReady = true;
    if (pendingCode) { runCode(pendingCode); pendingCode = null; }
  } else if (e.data.type === 'error') {
    mostrarError(e.data.message);
  } else if (e.data.type === 'rigMoved') {
    const { codeIndex, x, z } = e.data;
    let code = codeEl.value;
    let lines = code.split('\n');
    let currentSpawnIndex = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (isNewHead(lines[i])) {
        if (currentSpawnIndex === codeIndex) {
          let startPos = charCount;
          let j = i;
          let endPos = charCount + lines[i].length;

          while (j < lines.length && !lines[j].includes(';')) {
            j++;
            if (j < lines.length) {
              if (isNewHead(lines[j])) break;
              endPos += 1 + lines[j].length;
            }
          }

          let statement = code.substring(startPos, endPos);
          statement = statement.replace(/\.pos\([^)]+\)/g, '').replace(/\.x\([^)]+\)/g, '').replace(/\.z\([^)]+\)/g, '');
          statement = statement.replace(/(bvh\([^)]+\)|duplicate\([^)]+\))/, `$1.pos(${Math.round(x)}, 0, ${Math.round(z)})`);

          codeEl.value = code.substring(0, startPos) + statement + code.substring(endPos);
          codeEl.dispatchEvent(new Event('input'));

          codeEl.focus();
          codeEl.setSelectionRange(startPos, startPos + statement.length);
          break;
        }
        currentSpawnIndex++;
      }
      charCount += lines[i].length + 1;
    }
  } else if (e.data.type === 'rigRotated') {
    const { codeIndex, rotX, rotY } = e.data;
    let code = codeEl.value;
    let lines = code.split('\n');
    let currentSpawnIndex = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (isNewHead(lines[i])) {
        if (currentSpawnIndex === codeIndex) {
          let startPos = charCount;
          let j = i;
          let endPos = charCount + lines[i].length;

          while (j < lines.length && !lines[j].includes(';')) {
            j++;
            if (j < lines.length) {
              if (isNewHead(lines[j])) break;
              endPos += 1 + lines[j].length;
            }
          }

          let statement = code.substring(startPos, endPos);
          statement = statement.replace(/\.rotX\([^)]+\)/g, '').replace(/\.rotY\([^)]+\)/g, '');

          let rotString = '';
          if (Math.abs(rotX) > 0.01) rotString += `.rotX(${rotX.toFixed(2)})`;
          if (Math.abs(rotY) > 0.01) rotString += `.rotY(${rotY.toFixed(2)})`;

          if (rotString !== '') {
            statement = statement.replace(/(bvh\([^)]+\)|duplicate\([^)]+\))/, `$1${rotString}`);
          }

          codeEl.value = code.substring(0, startPos) + statement + code.substring(endPos);
          codeEl.dispatchEvent(new Event('input'));

          codeEl.focus();
          codeEl.setSelectionRange(startPos, startPos + statement.length);
          break;
        }
        currentSpawnIndex++;
      }
      charCount += lines[i].length + 1;
    }
  } else if (e.data.type === 'rigSelected') {
    isRigSelected = true;
    const targetIndex = e.data.codeIndex;
    let code = codeEl.value;
    let lines = code.split('\n');
    let currentSpawnIndex = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (isNewHead(lines[i])) {
        if (currentSpawnIndex === targetIndex) {
          let startPos = charCount;
          let endPos = charCount + lines[i].length;

          let j = i;
          while (j < lines.length && !lines[j].includes(';')) {
            j++;
            if (j < lines.length) {
              if (isNewHead(lines[j])) break;
              endPos += 1 + lines[j].length;
            }
          }

          codeEl.focus();
          codeEl.setSelectionRange(startPos, endPos);
          break;
        }
        currentSpawnIndex++;
      }
      charCount += lines[i].length + 1;
    }
  } else if (e.data.type === 'rigDeselected') {
    isRigSelected = false;
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

  isGlobalPaused = false;
  if (globalPauseBtn) globalPauseBtn.textContent = 'Pause';

  // ==========================================
  // TRADUCTOR SINTAXIS VISUAL (Transpilador)
  // ==========================================
  let transpiled = code;

  // 1. Convertimos TODOS los corchetes de cierre en .play()
  transpiled = transpiled.replace(/\]/g, '.play()');

  // 2. Conectamos las flechas manteniendo el .play() intacto
  transpiled = transpiled.replace(/\.play\(\)\s*>\s*\[?\s*bvh\(/g, '.play().nextBvh(');

  // 3. Limpiamos todos los corchetes de apertura '['
  transpiled = transpiled.replace(/\[/g, '');

  // 4. Limpieza por si el usuario escribe un .play() a mano por costumbre
  transpiled = transpiled.replace(/\.play\(\)\s*\.play\(\)/g, '.play()');

  iframe.contentWindow.postMessage({ type: 'execute', code: transpiled }, '*');
}

runBtn.addEventListener("click", run);

window.addEventListener("keydown", (e) => {
  if (((e.ctrlKey || e.metaKey) && e.key === "Enter") || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s")) {
    e.preventDefault();
    run();
  }
});

// ==========================================
// BOTÓN DE PAUSA GLOBAL
// ==========================================
if (globalPauseBtn) {
  globalPauseBtn.addEventListener('click', () => {
    isGlobalPaused = !isGlobalPaused;
    if (isGlobalPaused) {
      globalPauseBtn.textContent = 'Play';
      iframe.contentWindow.postMessage({ type: 'execute', code: 'pause(true);' }, '*');
    } else {
      globalPauseBtn.textContent = 'Pause';
      iframe.contentWindow.postMessage({ type: 'execute', code: 'pause(false);' }, '*');
    }
  });
}

// ==========================================
// INTERFAZ (Botones, arrastre y redimensionado)
// ==========================================
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
    codeEl.dispatchEvent(new Event('input'));
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
  if (isRigSelected && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    iframe.contentWindow.postMessage({ type: 'remoteKey', key: e.key, shiftKey: e.shiftKey }, '*');
    return;
  }
  if (e.key === "Tab") {
    e.preventDefault();
    const start = this.selectionStart; const end = this.selectionEnd;
    const spaces = "  ";
    this.value = this.value.substring(0, start) + spaces + this.value.substring(end);
    this.selectionStart = this.selectionEnd = start + spaces.length;
    this.dispatchEvent(new Event('input'));
  }
});

// ==========================================
// SISTEMA DE GUARDADO (INTERRUPTOR / TOGGLE)
// ==========================================
saveBtn.addEventListener('click', () => {
  if (isSaved) {
    localStorage.removeItem('gestural_saved_code');
    isSaved = false;
    saveBtn.textContent = 'Guardar';
    saveBtn.classList.remove('saved');
  } else {
    localStorage.setItem('gestural_saved_code', codeEl.value);
    isSaved = true;
    saveBtn.textContent = 'Guardado';
    saveBtn.classList.add('saved');
  }
});

codeEl.addEventListener('input', () => {
  if (isSaved) {
    isSaved = false;
    saveBtn.textContent = 'Guardar *';
    saveBtn.classList.remove('saved');
  } else if (saveBtn.textContent === 'Guardar') {
    saveBtn.textContent = 'Guardar *';
  }
});

function init() {
  iframe.srcdoc = buildPreviewHtml();

  const savedCode = localStorage.getItem('gestural_saved_code');

  if (savedCode) {
    codeEl.value = savedCode;
    isSaved = true;
    saveBtn.textContent = 'Guardado';
    saveBtn.classList.add('saved');
  } else {
    const defaultExample = examples[0];
    codeEl.value = `///// ${defaultExample.name} /////\n${defaultExample.code}`;
    isSaved = false;
    saveBtn.textContent = 'Guardar';
    saveBtn.classList.remove('saved');
  }

  pendingCode = codeEl.value;
}

init();