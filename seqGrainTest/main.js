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
        grain.setParam('windowSize', 0.15);
        grain.setParam('windowRandRatio', 0.05);
        grain.load(audioBuffer);
        
        console.log('Audio cargado correctamente');
        alert('Audio cargado. Presiona Iniciar para reproducir.');
    } catch (error) {
        console.error('Error al cargar audio:', error);
        alert('Error al cargar el archivo de audio');
    }
});

// Configurar secuenciadores
function setupSequencers() {
    // Secuenciador de posición
    pointerSeq = new Sequencer(
        Array.from({ length: 16 }, (_, i) => i / 15), // 0 a 1 en 16 pasos
        60, // BPM
        'absolute'
    );
    pointerSeq.setTarget(grain, 'pointer');

    // Secuenciador de pitch
    freqSeq = new Sequencer(
        Array.from({ length: 8 }, () => 0.8 + Math.random() * 0.4), // 0.8 a 1.2
        120,
        'absolute'
    );
    freqSeq.setTarget(grain, 'freqScale');

    // Secuenciador de tamaño de ventana
    windowSeq = new Sequencer(
        Array.from({ length: 4 }, () => 0.1 + Math.random() * 0.1), // 0.1 a 0.2
        30,
        'absolute'
    );
    windowSeq.setTarget(grain, 'windowSize');

    // Clock para actualización de parámetros
    clock = new Clock(audioCtx, 60, 4);
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