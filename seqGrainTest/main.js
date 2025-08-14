import { Grain } from '../src/Grain.js';
import { Sequencer } from '../src/Sequencer.js';
import { Clock } from '../src/Clock.js';

let audioCtx;
let grain;
let pointerSeq, freqSeq, windowSeq;
let clock;

// Referencias a DOM
const audioInput = document.getElementById('audioFile');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');
const smoothnessSlider = document.getElementById('smoothnessSlider');
const bpmControl = document.getElementById('bpmControl');

// Verificar elementos del DOM
if (!audioInput || !startBtn || !stopBtn || !toggleModeBtn) {
    console.error('Error: Faltan elementos del DOM');
    alert('Error: La aplicación no se pudo inicializar correctamente');
}

// Cargar audio
audioInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        grain = new Grain(audioCtx);
        grain.setParam('overlaps', 0.1);
        grain.setParam('windowSize', 0.9);
        grain.setParam('windowRandRatio', 0.9);
        grain.load(audioBuffer);
        
        console.log('Audio cargado correctamente');
    } catch (error) {
        console.error('Error al cargar audio:', error);
        alert('Error al cargar el archivo de audio');
    }
});

// Configurar secuenciadores con suavizado
function setupSequencers() {
    const smoothness = smoothnessSlider ? parseFloat(smoothnessSlider.value) : 0.5;
    const bpm = bpmControl ? parseInt(bpmControl.value) : 60;

    // Secuenciador de posición con suavizado
    pointerSeq = new Sequencer(
        Array.from({ length: 16 }, (_, i) => i / 15), // 0 a 1 en 16 pasos
        bpm,
        'absolute',
        smoothness
    );
    pointerSeq.setTarget(grain, 'pointer');

    // Secuenciador de pitch con suavizado
    freqSeq = new Sequencer(
        Array.from({ length: 8 }, () => 0.1 + Math.random() * 2), // 0.8 a 1.2
        bpm * 2,
        'absolute',
        smoothness
    );
    freqSeq.setTarget(grain, 'freqScale');

    // Secuenciador de tamaño de ventana
    windowSeq = new Sequencer(
        Array.from({ length: 4 }, () => 0.1 + Math.random() * 0.9), // 0.1 a 0.2
        bpm / 2,
        'absolute',
        smoothness
    );
    windowSeq.setTarget(grain, 'windowSize');

    // Clock para actualización de parámetros
    clock = new Clock(audioCtx, bpm, 4);
    clock.subscribe(() => {
        grain.updateParams();
    });
}

// Controladores de botones
startBtn.addEventListener('click', async () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    if (!grain?.buffer) {
        alert('Primero carga un archivo de audio');
        return;
    }

    if (!pointerSeq) setupSequencers();

    pointerSeq.start();
    freqSeq.start();
    windowSeq.start();
    clock.start();
    grain.start();
});

stopBtn.addEventListener('click', () => {
    pointerSeq?.stop();
    freqSeq?.stop();
    windowSeq?.stop();
    clock?.stop();
    grain?.stop();
});

toggleModeBtn.addEventListener('click', () => {
    if (grain) {
        grain.relative = !grain.relative;
        toggleModeBtn.textContent = grain.relative ? 
            'Modo Relativo (ON)' : 'Modo Relativo (OFF)';
    }
});

// Controladores adicionales
if (smoothnessSlider) {
    smoothnessSlider.addEventListener('input', () => {
        const smoothness = parseFloat(smoothnessSlider.value);
        [pointerSeq, freqSeq, windowSeq].forEach(seq => {
            if (seq) seq.setSmoothness(smoothness);
        });
    });
}

if (bpmControl) {
    bpmControl.addEventListener('input', () => {
        if (pointerSeq) setupSequencers();
    });
}