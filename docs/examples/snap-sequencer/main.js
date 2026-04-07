import SnapshotCompressor from '../../../src/SnapshotCompressor.js';
import { GrainEngine }    from '../../../src/GrainEngine.js';
import { SnapToGrains }   from '../../../src/SnapToGrains.js';

const CELLS = 8;
const compressor = new SnapshotCompressor(60, 60);

let audioCtx     = null;
let grainEngine  = null;
let snapToGrains = null;
let isPlaying    = false;
let currentStep  = 0;
let stepInterval = null;
let bpm          = 60;

// ─── Snapshots generados desde presets ───
const snapshots = new Array(CELLS).fill(null);

// ─── Funciones de dibujo para cada celda ───
// Cada función recibe (ctx, w, h) y pinta en un canvas offscreen 300×300.
// La variedad de distribución espacial y contraste se traduce en
// parámetros distintos del GrainEngine.

const PRESET_FNS = [
    // 0 — Degradado radial (brillo al centro)
    (ctx, w, h) => {
        const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        g.addColorStop(0, '#fff'); g.addColorStop(1, '#000');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
    // 1 — Círculos 5×5 con tamaño creciente
    (ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
            const cx = (c + 0.5) * (w / 5);
            const cy = (r + 0.5) * (h / 5);
            const radius = (w / 5) * 0.38 * ((r * 5 + c + 1) / 25);
            ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `hsl(0,0%,${20 + (r * 5 + c) * 4}%)`; ctx.fill();
        }
    },
    // 2 — Ajedrez con gradiente por filas
    (ctx, w, h) => {
        const size = w / 8;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const v = (r + c) % 2 === 0 ? 180 + r * 9 : r * 9;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(c * size, r * size, size, size);
        }
    },
    // 3 — Ruido por píxel
    (ctx, w, h) => {
        const id = ctx.createImageData(w, h);
        for (let i = 0; i < id.data.length; i += 4) {
            const v = Math.floor(Math.random() * 256);
            id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 255;
        }
        ctx.putImageData(id, 0, 0);
    },
    // 4 — Franjas horizontales
    (ctx, w, h) => {
        for (let i = 0; i < 12; i++) {
            const v = Math.round((i / 11) * 255);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(0, i * (h / 12), w, h / 12);
        }
    },
    // 5 — Degradado radial invertido (oscuro al centro)
    (ctx, w, h) => {
        const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        g.addColorStop(0, '#000'); g.addColorStop(1, '#fff');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
    // 6 — Círculos grandes dispersos (2×2)
    (ctx, w, h) => {
        ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
        const grid = [[0,0],[1,0],[0,1],[1,1]];
        grid.forEach(([c, r], i) => {
            const cx = (c + 0.5) * (w / 2);
            const cy = (r + 0.5) * (h / 2);
            ctx.beginPath(); ctx.arc(cx, cy, w / 4 * 0.75, 0, Math.PI * 2);
            ctx.fillStyle = `hsl(0,0%,${35 + i * 15}%)`; ctx.fill();
        });
    },
    // 7 — Ruido en bloques 8×8 (textured, menos aleatorio)
    (ctx, w, h) => {
        const bw = w / 8, bh = h / 8;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            const v = Math.floor(Math.random() * 256);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(c * bw, r * bh, bw, bh);
        }
    },
];

// ─── Inicializar mosaico ───
function initMosaic() {
    const container = document.getElementById('mosaic');

    for (let i = 0; i < CELLS; i++) {
        // Generar snapshot desde preset en canvas offscreen
        const offCanvas = document.createElement('canvas');
        offCanvas.width = offCanvas.height = 300;
        PRESET_FNS[i](offCanvas.getContext('2d'), 300, 300);
        snapshots[i] = compressor.captureHydraFrame(offCanvas);

        // Crear celda visible
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;

        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 60;
        compressor.renderToCanvas(snapshots[i], canvas);

        const label = document.createElement('div');
        label.className = 'cell-label';
        label.textContent = i + 1;

        cell.appendChild(canvas);
        cell.appendChild(label);
        container.appendChild(cell);
    }
}

// ─── Carga de audio ───
document.getElementById('loadBtn').addEventListener('click', async () => {
    const file = document.getElementById('audioFile').files[0];
    if (!file) { setStatus('Selecciona un archivo primero'); return; }

    try {
        setStatus('Cargando...');
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        grainEngine = new GrainEngine(audioCtx, audioBuffer, {
            pointer: 0, rate: 1, overlaps: 4, windowSize: 0.1, masterAmp: 0.7,
        });
        grainEngine.connect(audioCtx.destination);

        snapToGrains = new SnapToGrains(audioCtx, grainEngine, {
            compressor,
            smoothingTime: 0.3,
            jitter: 0.06,
            pointerTransitionTime: stepDuration() * 0.85,
        });

        document.getElementById('playBtn').disabled = false;
        setStatus(`"${file.name}" — ${audioBuffer.duration.toFixed(2)}s`);

    } catch (err) {
        setStatus('Error al cargar: ' + err.message);
    }
});

// ─── Play / Stop ───
document.getElementById('playBtn').addEventListener('click', () => {
    if (!grainEngine || !snapToGrains) return;
    isPlaying ? stopSequencer() : startSequencer();
});

function startSequencer() {
    isPlaying = true;
    currentStep = 0;

    if (audioCtx.state === 'suspended') audioCtx.resume();
    snapToGrains.start();

    tick();
    stepInterval = setInterval(tick, stepDuration() * 1000);

    document.getElementById('playBtn').textContent = 'Detener';
    document.getElementById('playBtn').classList.add('active');
}

function stopSequencer() {
    isPlaying = false;
    clearInterval(stepInterval);
    stepInterval = null;
    snapToGrains.stop();
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
    document.getElementById('playBtn').textContent = 'Iniciar';
    document.getElementById('playBtn').classList.remove('active');
    setStatus('Detenido');
}

function tick() {
    // Highlight celda activa
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'));
    document.querySelector(`.cell[data-index="${currentStep}"]`).classList.add('active');

    // Aplicar snapshot al engine
    snapToGrains.applySnapshot(snapshots[currentStep]);

    // Actualizar estado en UI
    const snap = snapToGrains.getCurrentSnapshot();
    if (snap) {
        setStatus(
            `Paso ${currentStep + 1}/${CELLS} · ` +
            `brillo ${snap.brightness.toFixed(2)} · ` +
            `contraste ${snap.contrast.toFixed(2)} · ` +
            `complejidad ${snap.complexity.toFixed(2)}`
        );
    }

    currentStep = (currentStep + 1) % CELLS;
}

// ─── BPM ───
document.getElementById('bpm').addEventListener('input', function () {
    bpm = parseInt(this.value);
    document.getElementById('bpmVal').textContent = bpm;

    if (snapToGrains) snapToGrains.pointerTransitionTime = stepDuration() * 0.85;

    if (isPlaying) {
        clearInterval(stepInterval);
        stepInterval = setInterval(tick, stepDuration() * 1000);
    }
});

function stepDuration() {
    return 60 / bpm; // segundos por paso
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}

// ─── Arranque ───
initMosaic();
