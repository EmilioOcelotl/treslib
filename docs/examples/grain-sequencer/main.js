import { GrainEngine } from '../../../src/GrainEngine.js';
import { GrainSequencer } from '../../../src/GrainSequencer.js';

let audioCtx = null;
let grainEngine = null;
let sequencer = null;
let isEngineRunning = false;
let isSequencerRunning = false;

// ------------------------------------
// Inicialización
// ------------------------------------
document.getElementById('loadBtn').addEventListener('click', loadAudio);
document.getElementById('engineBtn').addEventListener('click', toggleEngine);
document.getElementById('seqBtn').addEventListener('click', toggleSequencer);

setupSlider('bpm', 'bpmVal', 0, v => sequencer?.setTempo(v));
setupSlider('stepsPerBeat', 'stepsPerBeatVal', 0, v => sequencer?.setStepsPerBeat(parseInt(v)));
setupSlider('overlaps', 'overlapsVal', 0, v => grainEngine?.setOverlaps(parseInt(v)));
setupSlider('windowSize', 'windowSizeVal', 2, v => grainEngine?.setWindowSizeAtTime(v));

buildGrid('pointerSeq', 8, 0, 1, 0.25, 2);
buildGrid('rateSeq',    8, 0.25, 2, 0.25, 2);

// ------------------------------------
// Carga de audio
// ------------------------------------
async function loadAudio() {
    const file = document.getElementById('audioFile').files[0];
    if (!file) { setStatus('Selecciona un archivo primero'); return; }

    try {
        setStatus('Cargando...');

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        grainEngine = new GrainEngine(audioCtx, audioBuffer, {
            pointer:    0,
            rate:       1,
            overlaps:   6,
            windowSize: 0.1,
            masterAmp:  0.7,
        });
        grainEngine.connect(audioCtx.destination);

        const bpm = parseInt(document.getElementById('bpm').value);
        const stepsPerBeat = parseInt(document.getElementById('stepsPerBeat').value);
        sequencer = new GrainSequencer(audioCtx, bpm, stepsPerBeat);

        sequencer.onStepChange = (step) => {
            document.getElementById('currentStep').textContent = step;
            highlightStep('pointerSeq', step, 8);
            highlightStep('rateSeq', step, 8);
        };

        updateSequences();

        document.getElementById('engineBtn').disabled = false;
        document.getElementById('seqBtn').disabled = false;
        setStatus(`"${file.name}" cargado · ${audioBuffer.duration.toFixed(2)}s`);

    } catch (err) {
        setStatus('Error al cargar: ' + err.message);
    }
}

// ------------------------------------
// Engine
// ------------------------------------
function toggleEngine() {
    if (!grainEngine) return;
    const btn = document.getElementById('engineBtn');

    if (!isEngineRunning) {
        grainEngine.start();
        isEngineRunning = true;
        btn.textContent = 'Detener engine';
        btn.classList.add('active');
        setStatus('Engine activo');
    } else {
        grainEngine.stop();
        isEngineRunning = false;
        btn.textContent = 'Iniciar engine';
        btn.classList.remove('active');
        setStatus('Engine detenido');
    }
}

// ------------------------------------
// Sequencer
// ------------------------------------
function toggleSequencer() {
    if (!sequencer) return;
    const btn = document.getElementById('seqBtn');

    if (!isSequencerRunning) {
        sequencer.start();
        isSequencerRunning = true;
        btn.textContent = 'Detener sequencer';
        btn.classList.add('active');
    } else {
        sequencer.stop();
        isSequencerRunning = false;
        btn.textContent = 'Iniciar sequencer';
        btn.classList.remove('active');
        clearHighlight('pointerSeq');
        clearHighlight('rateSeq');
        document.getElementById('currentStep').textContent = '—';
    }
}

// ------------------------------------
// Grids de secuencia
// ------------------------------------
function buildGrid(containerId, steps, min, max, increment, decimals) {
    const container = document.getElementById(containerId);
    const range = max - min;

    for (let i = 0; i < steps; i++) {
        const val = parseFloat((min + (i / (steps - 1)) * range).toFixed(decimals));
        const step = document.createElement('div');
        step.className = 'step';
        step.textContent = val.toFixed(decimals);
        step.dataset.value = val;
        step.dataset.min = min;
        step.dataset.max = max;
        step.dataset.increment = increment;
        step.dataset.decimals = decimals;

        step.addEventListener('click', () => {
            const current = parseFloat(step.dataset.value);
            const inc = parseFloat(step.dataset.increment);
            const stepMax = parseFloat(step.dataset.max);
            const stepMin = parseFloat(step.dataset.min);
            const dec = parseInt(step.dataset.decimals);
            let next = parseFloat((current + inc).toFixed(dec));
            if (next > stepMax) next = stepMin;
            step.dataset.value = next.toFixed(dec);
            step.textContent = next.toFixed(dec);
            updateSequences();
        });

        container.appendChild(step);
    }
}

function getGridValues(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .step`))
        .map(s => parseFloat(s.dataset.value));
}

function updateSequences() {
    if (!sequencer || !grainEngine) return;

    sequencer.removeSequence('pointer', grainEngine);
    sequencer.removeSequence('rate', grainEngine);

    sequencer.addPointerSequence(getGridValues('pointerSeq'), grainEngine, 'absolute');
    sequencer.addRateSequence(getGridValues('rateSeq'), grainEngine, 'absolute');
}

function highlightStep(containerId, step, length) {
    clearHighlight(containerId);
    const steps = document.querySelectorAll(`#${containerId} .step`);
    steps[step % length]?.classList.add('active');
}

function clearHighlight(containerId) {
    document.querySelectorAll(`#${containerId} .step`)
        .forEach(s => s.classList.remove('active'));
}

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
