import { AudioBufferRecorder } from '../../../src/AudioBufferRecorder.js';
import { GrainEngine }         from '../../../src/GrainEngine.js';
import { GrainSequencer }      from '../../../src/GrainSequencer.js';
import { OnsetDetector }       from '../../../src/OnsetDetector.js';

// ------------------------------------
// Estado global
// ------------------------------------
let audioCtx      = null;
let micSource     = null;   // fuente de micrófono compartida
let recorder      = null;
let grainEngine   = null;
let sequencer     = null;
let detector      = null;

let audioBuffer      = null;   // buffer activo para GrainEngine
let playbackSource   = null;   // reproducción directa de la muestra
let isRecording      = false;
let isRunning        = false;
let isPlayingBack    = false;
let currentMode      = 'file';
let pulseTimeout     = null;

// ------------------------------------
// Tabs de modo
// ------------------------------------
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        if (isRunning || isRecording) return;
        currentMode = tab.dataset.mode;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('visible'));
        document.getElementById(`panel-${currentMode}`).classList.add('visible');
        audioBuffer = null;
        document.getElementById('mainBtn').disabled = true;
        setStatus('Carga una fuente de audio');
    });
});

// ------------------------------------
// Modo archivo
// ------------------------------------
document.getElementById('loadBtn').addEventListener('click', async () => {
    const file = document.getElementById('audioFile').files[0];
    if (!file) { setStatus('Selecciona un archivo'); return; }

    await ensureAudioCtx();
    setStatus('Cargando...');
    try {
        const ab = await file.arrayBuffer();
        audioBuffer = await audioCtx.decodeAudioData(ab);
        document.getElementById('mainBtn').disabled = false;
        document.getElementById('playbackBtn').disabled = false;
        setStatus(`"${file.name}" cargado · ${audioBuffer.duration.toFixed(2)}s`);
    } catch (err) {
        setStatus('Error: ' + err.message);
    }
});

// ------------------------------------
// Modo micrófono
// ------------------------------------
document.getElementById('recBtn').addEventListener('click', toggleRecording);
document.getElementById('captureBtn').addEventListener('click', captureBuffer);

async function toggleRecording() {
    if (!isRecording) {
        await ensureAudioCtx();
        await ensureMicSource();

        recorder = new AudioBufferRecorder(audioCtx, micSource, 8);
        recorder.startRecording();
        isRecording = true;

        document.getElementById('recBtn').textContent = 'Detener';
        document.getElementById('recBtn').classList.add('rec');
        document.getElementById('captureBtn').disabled = false;
        setStatus('Grabando desde micrófono...');
    } else {
        recorder.stopRecording();
        isRecording = false;
        document.getElementById('recBtn').textContent = 'Grabar';
        document.getElementById('recBtn').classList.remove('rec');
        setStatus('Grabación detenida · captura la muestra para continuar');
    }
}

function captureBuffer() {
    const buf = recorder?.getRecordedBuffer();
    if (!buf) { setStatus('Graba al menos un momento antes de capturar'); return; }
    audioBuffer = buf;
    document.getElementById('mainBtn').disabled = false;
    document.getElementById('playbackBtn').disabled = false;
    setStatus(`Muestra capturada · ${audioBuffer.duration.toFixed(2)}s`);
}

// ------------------------------------
// Grids de secuencia
// ------------------------------------
buildGrid('pointerSeq', 8, 0,    1,    0.25, 2);
buildGrid('rateSeq',    8, 0.25, 2.25, 0.25, 2);

function buildGrid(containerId, steps, min, max, increment, decimals) {
    const container = document.getElementById(containerId);
    const range = max - min;
    for (let i = 0; i < steps; i++) {
        const val = parseFloat((min + (i / (steps - 1)) * range).toFixed(decimals));
        const el = document.createElement('div');
        el.className = 'step';
        el.textContent = val.toFixed(decimals);
        el.dataset.value = val;
        el.dataset.min = min;
        el.dataset.max = max;
        el.dataset.increment = increment;
        el.dataset.decimals = decimals;
        el.addEventListener('click', () => {
            const next = parseFloat((parseFloat(el.dataset.value) + parseFloat(el.dataset.increment)).toFixed(decimals));
            const wrapped = next > parseFloat(el.dataset.max) ? parseFloat(el.dataset.min) : next;
            el.dataset.value = wrapped.toFixed(decimals);
            el.textContent = wrapped.toFixed(decimals);
            updateSequences();
        });
        container.appendChild(el);
    }
}

function getGridValues(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .step`))
        .map(s => parseFloat(s.dataset.value));
}

function updateSequences() {
    if (!sequencer || !grainEngine) return;
    sequencer.removeSequence('pointer', grainEngine);
    sequencer.removeSequence('rate',    grainEngine);
    sequencer.addPointerSequence(getGridValues('pointerSeq'), grainEngine, 'absolute');
    sequencer.addRateSequence(getGridValues('rateSeq'),    grainEngine, 'absolute');
}

// ------------------------------------
// Escuchar muestra
// ------------------------------------
document.getElementById('playbackBtn').addEventListener('click', togglePlayback);

function togglePlayback() {
    if (!audioBuffer) return;
    const btn = document.getElementById('playbackBtn');

    if (!isPlayingBack) {
        playbackSource = audioCtx.createBufferSource();
        playbackSource.buffer = audioBuffer;
        playbackSource.loop = true;
        const playbackGain = audioCtx.createGain();
        playbackGain.gain.value = 0.5;
        playbackSource.connect(playbackGain);
        playbackGain.connect(audioCtx.destination);
        playbackSource.start();
        isPlayingBack = true;
        btn.textContent = 'Detener muestra';
        btn.classList.add('active');
    } else {
        stopPlayback();
    }
}

function stopPlayback() {
    if (playbackSource) {
        try { playbackSource.stop(); } catch (e) {}
        playbackSource.disconnect();
        playbackSource = null;
    }
    isPlayingBack = false;
    const btn = document.getElementById('playbackBtn');
    btn.textContent = 'Escuchar muestra';
    btn.classList.remove('active');
}

// ------------------------------------
// Botón principal
// ------------------------------------
document.getElementById('mainBtn').addEventListener('click', toggleMain);

async function toggleMain() {
    if (!isRunning) {
        await startAll();
    } else {
        stopAll();
    }
}

async function startAll() {
    if (!audioBuffer) return;
    await ensureAudioCtx();
    await ensureMicSource();

    // GrainEngine
    grainEngine = new GrainEngine(audioCtx, audioBuffer, {
        pointer:        0,
        rate:           1,
        overlaps:       parseInt(document.getElementById('overlaps').value),
        windowSize:     parseFloat(document.getElementById('windowSize').value),
        randomPosition: parseFloat(document.getElementById('randomPosition').value),
        masterAmp:      0.5,
    });
    grainEngine.connect(audioCtx.destination);
    grainEngine.start();

    // GrainSequencer (sin start() — avance por onset)
    sequencer = new GrainSequencer(audioCtx, 120, 4);
    sequencer.onStepChange = (step) => {
        document.getElementById('currentStep').textContent = step % 8;
        highlightStep(step, 8);
    };
    updateSequences();

    // OnsetDetector desde micrófono
    const threshold = parseFloat(document.getElementById('threshold').value);
    detector = new OnsetDetector(audioCtx, null, threshold);
    detector.connectSource(micSource);
    detector.start(onOnset, false);

    isRunning = true;
    document.getElementById('mainBtn').textContent = 'Detener';
    document.getElementById('mainBtn').classList.add('running');
    document.querySelectorAll('.tab').forEach(t => t.disabled = true);
    setStatus('Activo · produce sonidos frente al micrófono para avanzar el secuenciador');
}

function stopAll() {
    grainEngine?.stop();
    grainEngine?.dispose();
    detector?.stop();
    stopPlayback();
    // sequencer no tiene scheduler activo, solo limpiamos referencias
    sequencer = null;
    grainEngine = null;
    detector = null;

    isRunning = false;
    document.getElementById('mainBtn').textContent = 'Iniciar';
    document.getElementById('mainBtn').classList.remove('running');
    document.getElementById('currentStep').textContent = '—';
    document.querySelectorAll('.tab').forEach(t => t.disabled = false);
    clearHighlight();
    setStatus('Detenido');
}

// ------------------------------------
// Callback de onset → avance de secuenciador
// ------------------------------------
function onOnset(flux) {
    if (!sequencer || !grainEngine) return;

    // Disparar step actual y avanzar
    sequencer.triggerStep(audioCtx.currentTime);
    sequencer.currentStep++;

    // Feedback visual
    document.getElementById('onsetCount').textContent =
        parseInt(document.getElementById('onsetCount').textContent || 0) + 1;

    const pulse = document.getElementById('pulse');
    const scale = 1 + Math.min(flux * 6, 2.5);
    pulse.style.transform = `scale(${scale})`;
    pulse.classList.add('triggered');
    clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => {
        pulse.style.transform = 'scale(1)';
        pulse.classList.remove('triggered');
    }, 100);
}

// ------------------------------------
// Highlight de grids
// ------------------------------------
function highlightStep(step, length) {
    clearHighlight();
    const idx = step % length;
    document.querySelectorAll('#pointerSeq .step')[idx]?.classList.add('active');
    document.querySelectorAll('#rateSeq .step')[idx]?.classList.add('active');
}

function clearHighlight() {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
}

// ------------------------------------
// Sliders de GrainEngine en tiempo real
// ------------------------------------
setupSlider('overlaps',       'overlapsVal',       0, v => grainEngine?.setOverlaps(parseInt(v)));
setupSlider('windowSize',     'windowSizeVal',     2, v => grainEngine?.setWindowSizeAtTime(v));
setupSlider('randomPosition', 'randomPositionVal', 2, v => grainEngine?.setParamAtTime('randomPosition', v));
setupSlider('threshold',      'thresholdVal',      3, v => { if (detector) detector.threshold = v; });

// ------------------------------------
// Utilidades
// ------------------------------------
async function ensureAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') await audioCtx.resume();
}

async function ensureMicSource() {
    if (micSource) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micSource = audioCtx.createMediaStreamSource(stream);
}

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
