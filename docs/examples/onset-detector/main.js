import { OnsetDetector } from '../../../src/OnsetDetector.js';

let audioCtx = null;
let detector = null;
let isRunning = false;
let onsetCount = 0;
let pulseTimeout = null;
let currentMode = 'buffer';
let audioBuffer = null;

// ------------------------------------
// Tabs de modo
// ------------------------------------
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (isRunning) return;
        currentMode = tab.dataset.mode;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('visible'));
        document.getElementById(`panel-${currentMode}`).classList.add('visible');
        updateStartButton();
        setStatus('Selecciona una fuente e inicia la detección');
    });
});

// ------------------------------------
// Carga de audio (modo buffer)
// ------------------------------------
document.getElementById('loadBtn').addEventListener('click', loadAudio);

async function loadAudio() {
    const file = document.getElementById('audioFile').files[0];
    if (!file) { setStatus('Selecciona un archivo primero'); return; }

    try {
        setStatus('Cargando...');
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const arrayBuffer = await file.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        setStatus(`"${file.name}" cargado · ${audioBuffer.duration.toFixed(2)}s`);
        updateStartButton();
    } catch (err) {
        setStatus('Error al cargar: ' + err.message);
    }
}

// ------------------------------------
// Start / Stop
// ------------------------------------
document.getElementById('startBtn').addEventListener('click', toggleDetection);

async function toggleDetection() {
    if (!isRunning) {
        await startDetection();
    } else {
        stopDetection();
    }
}

async function startDetection() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const threshold = parseFloat(document.getElementById('threshold').value);

        if (currentMode === 'buffer') {
            detector = new OnsetDetector(audioCtx, audioBuffer, threshold);
            detector.start(onOnset);

        } else {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const micSource = audioCtx.createMediaStreamSource(stream);
            detector = new OnsetDetector(audioCtx, null, threshold);
            detector.connectSource(micSource);
            detector.start(onOnset, false);
        }

        isRunning = true;
        onsetCount = 0;
        document.getElementById('onsetCount').textContent = 0;
        document.getElementById('startBtn').textContent = 'Detener';
        document.getElementById('startBtn').classList.add('active');
        document.querySelectorAll('.tab').forEach(t => t.disabled = true);
        setStatus(`Detectando · modo ${currentMode}`);

    } catch (err) {
        setStatus('Error: ' + err.message);
    }
}

function stopDetection() {
    detector?.stop();
    detector = null;
    isRunning = false;
    document.getElementById('startBtn').textContent = 'Iniciar detección';
    document.getElementById('startBtn').classList.remove('active');
    document.querySelectorAll('.tab').forEach(t => t.disabled = false);
    document.getElementById('fluxVal').textContent = '—';
    setStatus('Detenido');
}

// ------------------------------------
// Callback de onset
// ------------------------------------
function onOnset(flux) {
    onsetCount++;
    document.getElementById('onsetCount').textContent = onsetCount;
    document.getElementById('fluxVal').textContent = flux.toFixed(4);

    // Pulso visual — escala proporcional al flux
    const scale = 1 + Math.min(flux * 8, 3);
    const pulse = document.getElementById('pulse');
    pulse.style.transform = `scale(${scale})`;
    pulse.classList.add('triggered');

    clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => {
        pulse.style.transform = 'scale(1)';
        pulse.classList.remove('triggered');
    }, 120);
}

// ------------------------------------
// Threshold en tiempo real
// ------------------------------------
document.getElementById('threshold').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById('thresholdVal').textContent = v.toFixed(3);
    if (detector) detector.threshold = v;
});

// ------------------------------------
// Utilidades
// ------------------------------------
function updateStartButton() {
    const btn = document.getElementById('startBtn');
    if (currentMode === 'buffer') {
        btn.disabled = !audioBuffer;
    } else {
        btn.disabled = false;
    }
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}
