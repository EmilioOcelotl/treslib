import { GrainEngine } from '../src/GrainEngine.js';
import { GrainSequencer } from '../src/GrainSequencer.js';

// Estado global simple
let audioCtx = null;
let grainEngine = null;
let sequencer = null;
let isEngineRunning = false;
let isSequencerRunning = false;

// Inicializar cuando se cargue la página
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('Inicializando...');
    
    // Crear contexto de audio
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Configurar controles
    setupControls();
    createSequenceGrid();
    setupPresets();
    
    updateStatus('Selecciona un archivo de audio y haz clic en "Cargar Sample"');
}

function setupControls() {
    // Botón de carga
    document.getElementById('loadBtn').addEventListener('click', loadAudioFile);
    
    // Botones de control
    document.getElementById('engineBtn').addEventListener('click', toggleEngine);
    document.getElementById('seqBtn').addEventListener('click', toggleSequencer);
    
    // Sliders del engine
    setupSlider('pointer', 'pointerVal', (val) => {
        if (grainEngine) grainEngine.setPointer(val);
    });
    
    setupSlider('rate', 'rateVal', (val) => {
        if (grainEngine) grainEngine.setRate(val);
    });
    
    setupSlider('amp', 'ampVal', (val) => {
        if (grainEngine) grainEngine.setAmp(val);
    });
    
    setupSlider('windowSize', 'windowSizeVal', (val) => {
        if (grainEngine) grainEngine.setWindowSizeAtTime(val);
    });
    
    setupSlider('overlaps', 'overlapsVal', (val) => {
        if (grainEngine) grainEngine.setOverlaps(parseInt(val));
    });
    
    setupSlider('grainDensity', 'grainDensityVal', (val) => {
        if (grainEngine) grainEngine.setOverlapAtTime(val);
    });
}

function setupPresets() {
    const presets = {
        dense: {
            rate: 1,
            overlaps: 16,
            windowSize: 0.1,
            grainDensity: 0.01
        },
        subtle: {
            rate: 1,
            overlaps: 2,
            windowSize: 0.2,
            grainDensity: 0.05
        },
        cloud: {
            rate: 0.5,
            overlaps: 16,
            windowSize: 0.05,
            grainDensity: 0.005
        }
    };
    
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const presetName = e.target.dataset.preset;
            const preset = presets[presetName];
            
            if (preset && grainEngine) {
                // Aplicar preset
                grainEngine.setRate(preset.rate);
                grainEngine.setOverlaps(preset.overlaps);
                grainEngine.setWindowSizeAtTime(preset.windowSize);
                grainEngine.setOverlapAtTime(preset.grainDensity);
                
                // Actualizar sliders
                document.getElementById('rate').value = preset.rate;
                document.getElementById('rateVal').textContent = preset.rate;
                document.getElementById('overlaps').value = preset.overlaps;
                document.getElementById('overlapsVal').textContent = preset.overlaps;
                document.getElementById('windowSize').value = preset.windowSize;
                document.getElementById('windowSizeVal').textContent = preset.windowSize;
                document.getElementById('grainDensity').value = preset.grainDensity;
                document.getElementById('grainDensityVal').textContent = preset.grainDensity;
                
                updateStatus(`Preset aplicado: ${presetName}`);
            }
        });
    });
}

// ... el resto del código se mantiene igual (createSequenceGrid, getSequenceValues, etc.)

function setupSlider(sliderId, valueId, callback) {
    const slider = document.getElementById(sliderId);
    const value = document.getElementById(valueId);
    
    slider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        value.textContent = val.toFixed(2);
        callback(val);
    });
}

function createSequenceGrid() {
    const container = document.getElementById('pointerSeq');
    const steps = 8;
    
    for (let i = 0; i < steps; i++) {
        const step = document.createElement('div');
        step.className = 'step';
        step.textContent = (i * 0.1).toFixed(1);
        step.dataset.value = (i * 0.1).toFixed(2);
        
        step.addEventListener('click', () => {
            const current = parseFloat(step.dataset.value);
            let newVal = current + 0.3;
            if (newVal > 1) newVal = 0;
            
            step.dataset.value = newVal.toFixed(2);
            step.textContent = newVal.toFixed(1);
            updateSequences();
        });
        
        container.appendChild(step);
    }
}

function getSequenceValues() {
    const container = document.getElementById('pointerSeq');
    const steps = container.getElementsByClassName('step');
    const values = [];
    
    for (let step of steps) {
        values.push(parseFloat(step.dataset.value));
    }
    
    return values;
}

function updateSequences() {
    if (!sequencer || !grainEngine) return;
    
    const pointerValues = getSequenceValues();
    
    // Limpiar secuencia anterior
    sequencer.removeSequence("pointer", grainEngine);
    
    // Añadir nueva secuencia
    sequencer.addPointerSequence(pointerValues, grainEngine, "absolute");
    
    console.log('Secuencia actualizada:', pointerValues);
}

async function loadAudioFile() {
    const fileInput = document.getElementById('audioFile');
    const file = fileInput.files[0];
    
    if (!file) {
        updateStatus('Por favor selecciona un archivo de audio primero');
        return;
    }
    
    try {
        updateStatus('Cargando archivo...');
        
        // Leer el archivo como ArrayBuffer
        const arrayBuffer = await readFileAsArrayBuffer(file);
        
        // Decodificar el audio
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        console.log('Audio cargado:', audioBuffer.duration + ' segundos');
        
        // Crear engine con el audio real
        grainEngine = new GrainEngine(audioCtx, audioBuffer, {
            pointer: 0,
            rate: 1,
            overlaps: 4,
            masterAmp: 0.5,
            windowSize: 0.1,
            overlap: 0.05
        });
        
        // Conectar a salida
        grainEngine.connect(audioCtx.destination);
        
        // Crear sequencer
        sequencer = new GrainSequencer(audioCtx, 120, 4);
        
        // Configurar callback del sequencer
        sequencer.onStepChange = (stepIndex, values) => {
            document.getElementById('currentStep').textContent = stepIndex;
            highlightStep(stepIndex);
        };
        
        // Actualizar secuencias iniciales
        updateSequences();
        
        // Habilitar controles
        document.getElementById('engineBtn').disabled = false;
        document.getElementById('seqBtn').disabled = false;
        
        updateStatus('Archivo cargado! Click en "Iniciar Engine"');
        console.log('Engine creado con archivo real');
        
    } catch (error) {
        console.error('Error cargando archivo:', error);
        updateStatus('Error: ' + error.message);
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            resolve(reader.result);
        };
        
        reader.onerror = () => {
            reject(new Error('Error leyendo el archivo'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

function toggleEngine() {
    if (!grainEngine) return;
    
    if (!isEngineRunning) {
        grainEngine.start();
        isEngineRunning = true;
        document.getElementById('engineBtn').textContent = 'Detener Engine';
        updateStatus('Engine ejecutándose');
    } else {
        grainEngine.stop();
        isEngineRunning = false;
        document.getElementById('engineBtn').textContent = 'Iniciar Engine';
        updateStatus('Engine detenido');
    }
}

function toggleSequencer() {
    if (!sequencer) return;
    
    if (!isSequencerRunning) {
        sequencer.start();
        isSequencerRunning = true;
        document.getElementById('seqBtn').textContent = 'Detener Sequencer';
        updateStatus('Sequencer ejecutándose');
    } else {
        sequencer.stop();
        isSequencerRunning = false;
        document.getElementById('seqBtn').textContent = 'Iniciar Sequencer';
        updateStatus('Sequencer detenido');
        clearStepHighlight();
    }
}

function highlightStep(stepIndex) {
    clearStepHighlight();
    
    const steps = document.getElementsByClassName('step');
    if (steps[stepIndex]) {
        steps[stepIndex].classList.add('active');
    }
}

function clearStepHighlight() {
    const steps = document.getElementsByClassName('step');
    for (let step of steps) {
        step.classList.remove('active');
    }
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}