import SnapshotCompressor from '../../../src/SnapshotCompressor.js';

const compressor = new SnapshotCompressor(80, 80);

const sourceCanvas  = document.getElementById('sourceCanvas');
const resultCanvas  = document.getElementById('resultCanvas');
const srcCtx        = sourceCanvas.getContext('2d');
let currentRotation = 0;
let lastHex         = '';

// ------------------------------------
// Presets de fuente
// ------------------------------------
const presets = {
    gradient(ctx, w, h) {
        const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2);
        g.addColorStop(0,   '#ffffff');
        g.addColorStop(0.5, '#888888');
        g.addColorStop(1,   '#000000');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Franja diagonal
        const g2 = ctx.createLinearGradient(0, 0, w, h);
        g2.addColorStop(0, 'rgba(255,255,255,0.4)');
        g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, w, h);
    },

    circles(ctx, w, h) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        const cols = 5, rows = 5;
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const cx = (col + 0.5) * (w / cols);
                const cy = (row + 0.5) * (h / rows);
                const r  = (w / cols) * 0.38 * ((row * cols + col + 1) / (cols * rows));
                ctx.beginPath();
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(0,0%,${20 + (row * cols + col) * 4}%)`;
                ctx.fill();
            }
        }
    },

    checkers(ctx, w, h) {
        const size = w / 8;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const bright = (row + col) % 2 === 0;
                // Vary brightness per row for gradient-like effect
                const v = bright ? 180 + row * 9 : row * 9;
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(col * size, row * size, size, size);
            }
        }
    },

    noise(ctx, w, h) {
        const id = ctx.createImageData(w, h);
        for (let i = 0; i < id.data.length; i += 4) {
            const v = Math.floor(Math.random() * 256);
            id.data[i] = id.data[i+1] = id.data[i+2] = v;
            id.data[i+3] = 255;
        }
        ctx.putImageData(id, 0, 0);
    },

    stripes(ctx, w, h) {
        const count = 12;
        for (let i = 0; i < count; i++) {
            const v = Math.round((i / (count - 1)) * 255);
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(0, i * (h / count), w, h / count);
        }
        // Añadir franja vertical suave
        const gv = ctx.createLinearGradient(0, 0, w, 0);
        gv.addColorStop(0,   'rgba(255,255,255,0.3)');
        gv.addColorStop(0.5, 'rgba(255,255,255,0)');
        gv.addColorStop(1,   'rgba(0,0,0,0.3)');
        ctx.fillStyle = gv;
        ctx.fillRect(0, 0, w, h);
    }
};

function drawPreset(name) {
    srcCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    presets[name](srcCtx, sourceCanvas.width, sourceCanvas.height);
}

// ------------------------------------
// Botones de preset
// ------------------------------------
document.querySelectorAll('button[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('button[data-preset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        drawPreset(btn.dataset.preset);
        captureAndCompress();
    });
});

// ------------------------------------
// Captura y compresión
// ------------------------------------
function captureAndCompress() {
    const t0 = performance.now();
    lastHex = compressor.captureHydraFrame(sourceCanvas);
    const ms = (performance.now() - t0).toFixed(1);

    // Renderizar resultado
    resultCanvas.width  = compressor.targetWidth;
    resultCanvas.height = compressor.targetHeight;
    compressor.renderToCanvas(lastHex, resultCanvas, currentRotation);

    // Mostrar hex
    const bytes     = lastHex.length / 2;
    const srcPixels = sourceCanvas.width * sourceCanvas.height;
    const ratio     = ((bytes / srcPixels) * 100).toFixed(1);

    document.getElementById('hexMeta').textContent =
        `${bytes} bytes · ${lastHex.length} chars hex · ratio ${ratio}% del original · ${ms}ms`;
    document.getElementById('hexPreview').textContent =
        lastHex.substring(0, 128) + (lastHex.length > 128 ? '…' : '');

    document.getElementById('status').textContent =
        `Capturado ${compressor.targetWidth}×${compressor.targetHeight}px desde ${sourceCanvas.width}×${sourceCanvas.height}px`;
}

document.getElementById('btnCapture').addEventListener('click', captureAndCompress);

document.getElementById('btnRotate').addEventListener('click', () => {
    currentRotation = (currentRotation + 90) % 360;
    if (lastHex) {
        compressor.renderToCanvas(lastHex, resultCanvas, currentRotation);
        document.getElementById('status').textContent = `Rotación: ${currentRotation}°`;
    }
});

// ------------------------------------
// Visualizar la matriz de dithering
// ------------------------------------
function renderDitherGrid() {
    const matrix = compressor.ditherMatrix;
    const container = document.getElementById('ditherGrid');
    const max = 15 * 4; // 60

    matrix.forEach(row => {
        row.forEach(val => {
            const cell = document.createElement('div');
            cell.className = 'dither-cell';
            cell.textContent = val / 4; // mostrar valor original 0–15
            const brightness = Math.round((val / max) * 80);
            cell.style.background = `rgb(${brightness},${brightness},${brightness})`;
            cell.style.color = brightness > 40 ? '#000' : '#888';
            container.appendChild(cell);
        });
    });
}

// ------------------------------------
// Inicio
// ------------------------------------
drawPreset('gradient');
captureAndCompress();
renderDitherGrid();
