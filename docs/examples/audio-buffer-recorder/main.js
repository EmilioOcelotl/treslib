import { AudioBufferRecorder } from '../../../src/AudioBufferRecorder.js';
import { GrainEngine } from '../../../src/GrainEngine.js';

let audioCtx = null;
let recorder = null;
let grainEngine = null;
let isRecording = false;
let isEngineRunning = false;
let bufferStartTime = null;
let progressInterval = null;

// ------------------------------------
// Grabación
// ------------------------------------
document.getElementById('recBtn').addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const micSource = audioCtx.createMediaStreamSource(stream);
        const duration = parseInt(document.getElementById('bufferDuration').value);

        recorder = new AudioBufferRecorder(audioCtx, micSource, duration);
        recorder.startRecording();

        isRecording = true;
        bufferStartTime = audioCtx.currentTime;

        document.getElementById('recBtn').textContent = 'Detener grabación';
        document.getElementById('recBtn').classList.add('active');
        document.getElementById('recDot').classList.add('active');
        document.getElementById('recStatus').textContent = 'grabando';
        document.getElementById('grainSection').classList.add('enabled');
        document.getElementById('captureBtn').disabled = false;

        startProgressUpdate(duration);
        setStatus('Grabando desde micrófono · búfer circular activo');

    } catch (err) {
        setStatus('Error: ' + err.message);
    }
}

function stopRecording() {
    recorder?.stopRecording();
    isRecording = false;
    clearInterval(progressInterval);

    document.getElementById('recBtn').textContent = 'Iniciar grabación';
    document.getElementById('recBtn').classList.remove('active');
    document.getElementById('recDot').classList.remove('active');
    document.getElementById('recStatus').textContent = 'detenido';
    setStatus('Grabación detenida');
}

// ------------------------------------
// Progreso del búfer
// ------------------------------------
function startProgressUpdate(duration) {
    const fill = document.getElementById('bufFill');
    const timeDisplay = document.getElementById('bufTime');
    clearInterval(progressInterval);

    progressInterval = setInterval(() => {
        if (!audioCtx || !isRecording) return;
        const elapsed = audioCtx.currentTime - bufferStartTime;
        const pct = Math.min((elapsed / duration) * 100, 100);
        fill.style.width = pct + '%';
        timeDisplay.textContent = Math.min(elapsed, duration).toFixed(1) + 's';

        if (pct >= 100) {
            fill.classList.add('full');
            document.getElementById('recStatus').textContent = 'grabando (circular)';
        }
    }, 200);
}

// ------------------------------------
// Capturar y sintetizar
// ------------------------------------
document.getElementById('captureBtn').addEventListener('click', captureAndSynthesize);

function captureAndSynthesize() {
    const buffer = recorder?.getRecordedBuffer();
    if (!buffer) { setStatus('Búfer vacío, graba al menos un momento'); return; }

    // Detener engine anterior si existe
    if (grainEngine) {
        grainEngine.stop();
        grainEngine.dispose();
        isEngineRunning = false;
    }

    grainEngine = new GrainEngine(audioCtx, buffer, {
        pointer:    0,
        rate:       1,
        overlaps:   6,
        windowSize: 0.1,
        masterAmp:  0.8,
    });
    grainEngine.connect(audioCtx.destination);

    document.getElementById('engineBtn').disabled = false;
    document.getElementById('engineBtn').textContent = 'Iniciar engine';
    document.getElementById('engineBtn').classList.remove('playing');
    isEngineRunning = false;

    setStatus(`Buffer capturado · ${buffer.duration.toFixed(2)}s de audio`);
}

// ------------------------------------
// GrainEngine
// ------------------------------------
document.getElementById('engineBtn').addEventListener('click', toggleEngine);

function toggleEngine() {
    if (!grainEngine) return;
    const btn = document.getElementById('engineBtn');

    if (!isEngineRunning) {
        grainEngine.start();
        isEngineRunning = true;
        btn.textContent = 'Detener engine';
        btn.classList.add('playing');
        setStatus('Síntesis granular activa');
    } else {
        grainEngine.stop();
        isEngineRunning = false;
        btn.textContent = 'Iniciar engine';
        btn.classList.remove('playing');
        setStatus('Engine detenido');
    }
}

// ------------------------------------
// Sliders de GrainEngine
// ------------------------------------
setupSlider('pointer',        'pointerVal',        2, v => grainEngine?.setPointer(v));
setupSlider('rate',           'rateVal',           2, v => grainEngine?.setRate(v));
setupSlider('overlaps',       'overlapsVal',       0, v => grainEngine?.setOverlaps(parseInt(v)));
setupSlider('windowSize',     'windowSizeVal',     2, v => grainEngine?.setWindowSizeAtTime(v));
setupSlider('randomPosition', 'randomPositionVal', 2, v => grainEngine?.setParamAtTime('randomPosition', v));

// Duración del búfer — reinicia la grabación si está activa
document.getElementById('bufferDuration').addEventListener('input', (e) => {
    const v = parseInt(e.target.value);
    document.getElementById('bufferDurationVal').textContent = v + 's';
    if (recorder && isRecording) {
        recorder.setBufferDuration(v);
        recorder.startRecording();
        bufferStartTime = audioCtx.currentTime;
        document.getElementById('bufFill').classList.remove('full');
        startProgressUpdate(v);
    }
});

// ------------------------------------
// Utilidades
// ------------------------------------
function setupSlider(id, valId, decimals, onChange) {
    const slider = document.getElementById(id);
    const display = document.getElementById(valId);
    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        display.textContent = decimals === 0 ? v : v.toFixed(decimals);
        onChange(v);
    });
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}
