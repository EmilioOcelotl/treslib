import { GrainEngine } from '../../../src/GrainEngine.js';

let audioCtx = null;
let grainEngine = null;
let isEngineRunning = false;

const PRESETS = {
    dense: { rate: 1,   overlaps: 16, windowSize: 0.1,  randomPosition: 0.05, randomPitch: 0 },
    cloud: { rate: 0.5, overlaps: 16, windowSize: 0.05, randomPosition: 0.2,  randomPitch: 0.1 },
    subtle:{ rate: 1,   overlaps: 2,  windowSize: 0.2,  randomPosition: 0,    randomPitch: 0 },
};

// ------------------------------------
// Inicialización
// ------------------------------------
document.getElementById('loadBtn').addEventListener('click', loadAudio);
document.getElementById('engineBtn').addEventListener('click', toggleEngine);

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

setupSlider('pointer',        'pointerVal',        2, v => grainEngine?.setPointer(v));
setupSlider('rate',           'rateVal',           2, v => grainEngine?.setRate(v));
setupSlider('overlaps',       'overlapsVal',       0, v => grainEngine?.setOverlaps(parseInt(v)));
setupSlider('windowSize',     'windowSizeVal',     2, v => grainEngine?.setWindowSizeAtTime(v));
setupSlider('amp',            'ampVal',            2, v => grainEngine?.setAmp(v));
setupSlider('randomPosition', 'randomPositionVal', 2, v => grainEngine?.setParamAtTime('randomPosition', v));
setupSlider('randomPitch',    'randomPitchVal',    2, v => grainEngine?.setParamAtTime('randomPitch', v));

buildSequenceGrid();

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
            overlaps:   4,
            windowSize: 0.1,
            masterAmp:  0.7,
        });
        grainEngine.connect(audioCtx.destination);

        document.getElementById('engineBtn').disabled = false;
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
// Presets
// ------------------------------------
function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset || !grainEngine) return;

    grainEngine.setRate(preset.rate);
    grainEngine.setOverlaps(preset.overlaps);
    grainEngine.setWindowSizeAtTime(preset.windowSize);
    grainEngine.setParamAtTime('randomPosition', preset.randomPosition);
    grainEngine.setParamAtTime('randomPitch', preset.randomPitch);

    syncSlider('rate',           preset.rate,           2);
    syncSlider('overlaps',       preset.overlaps,       0);
    syncSlider('windowSize',     preset.windowSize,     2);
    syncSlider('randomPosition', preset.randomPosition, 2);
    syncSlider('randomPitch',    preset.randomPitch,    2);

    setStatus(`Preset: ${name}`);
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

function syncSlider(id, value, decimals) {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + 'Val');
    if (slider) slider.value = value;
    if (display) display.textContent = decimals === 0 ? value : value.toFixed(decimals);
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}
