import { GrainEngine } from '../src/GrainEngine.js';
import { SnapToGrains } from '../src/SnapToGrains.js';

let audioCtx = null;
let grainEngine = null;
let snapToGrains = null;

// Snapshots de ejemplo con diferentes características
const EXAMPLE_SNAPSHOTS = {
    bright: "FFFFFFFFFFFFFFF123456789ABCDEFFFFFFFFFFFFFFF123456789ABCDEF",
    dark: "000000000000000123456789ABCDE000000000000000123456789ABCDE00", 
    contrast: "FFFF0000FFFF0000123456789ABCFFFF0000FFFF0000123456789ABC",
    complex: "A1B2C3D4E5F6123456789ABCDEFA1B2C3D4E5F6123456789ABCDEFA1B2",
    smooth: "888888888888888123456789ABC888888888888888123456789ABC888"
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);

function init() {
    console.log('Inicializando SnapToGrains Test...');
    
    // Obtener referencias a los elementos del DOM
    const loadBtn = document.getElementById('loadBtn');
    const applyCustomBtn = document.getElementById('applyCustomBtn');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const snapshotInput = document.getElementById('snapshotInput');
    const status = document.getElementById('status');
    const sequenceDisplay = document.getElementById('sequenceDisplay');
    const paramDisplay = document.getElementById('paramDisplay');

    // Verificar que todos los elementos existen
    if (!loadBtn || !applyCustomBtn || !startBtn || !stopBtn) {
        console.error('No se encontraron algunos elementos del DOM');
        return;
    }

    // Configurar event listeners
    loadBtn.addEventListener('click', loadAudioFile);
    applyCustomBtn.addEventListener('click', applyCustomSnapshot);
    startBtn.addEventListener('click', startEngine);
    stopBtn.addEventListener('click', stopEngine);

    // Botones de snapshots de ejemplo
    document.querySelectorAll('.snapshot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const snapshotType = e.target.dataset.snapshot;
            applyExampleSnapshot(snapshotType);
        });
    });

    // Actualizar estado inicial
    updateStatus('Selecciona un archivo de audio para comenzar');

    // Funciones auxiliares con acceso a los elementos del DOM
    function updateStatus(message) {
        if (status) status.textContent = message;
    }

    function updateSequenceDisplay(sequence) {
        if (sequenceDisplay && sequence && sequence.length > 0) {
            sequenceDisplay.textContent = sequence.map(v => v.toFixed(2)).join(' → ');
        }
    }

    function updateParamDisplay(params) {
        if (!paramDisplay) return;
        
        paramDisplay.innerHTML = `
            <div class="param-item">
                <div>Rate</div>
                <div class="param-value">${params.rate?.toFixed(2) || '0.00'}</div>
            </div>
            <div class="param-item">
                <div>Amplitud</div>
                <div class="param-value">${params.amp?.toFixed(2) || '0.00'}</div>
            </div>
            <div class="param-item">
                <div>Overlaps</div>
                <div class="param-value">${params.overlaps || '0'}</div>
            </div>
            <div class="param-item">
                <div>Random Pitch</div>
                <div class="param-value">${params.randomPitch?.toFixed(2) || '0.00'}</div>
            </div>
            <div class="param-item">
                <div>Random Position</div>
                <div class="param-value">${params.randomPosition?.toFixed(3) || '0.000'}</div>
            </div>
        `;
    }

    async function loadAudioFile() {
        const fileInput = document.getElementById('audioFile');
        const file = fileInput.files[0];
        if (!file) {
            updateStatus('❌ Selecciona un archivo de audio primero');
            return;
        }

        updateStatus('Cargando audio...');

        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Leer y decodificar el archivo de audio
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            // Crear GrainEngine con el buffer de audio
            grainEngine = new GrainEngine(audioCtx, audioBuffer, {
                pointer: 0,
                rate: 1,
                overlaps: 4,
                masterAmp: 0.5,
                windowSize: 0.1,
                overlap: 0.05
            });

            // Conectar a la salida
            grainEngine.connect(audioCtx.destination);

            // Crear SnapToGrains con opciones de suavizado
            snapToGrains = new SnapToGrains(audioCtx, grainEngine, {
                smoothingTime: 0.5, // Más suavizado
                maxRandomPitch: 0.3,
                maxRandomPosition: 0.01
            });

            // Configurar callback para actualizar la UI cuando se aplique un snapshot
            snapToGrains.onSnapshotApplied = (params) => {
                updateParamDisplay(params);
            };

            // Habilitar controles
            applyCustomBtn.disabled = false;
            startBtn.disabled = false;
            stopBtn.disabled = false;

            updateStatus('✅ Audio cargado! Prueba los diferentes snapshots.');
            
            // Aplicar un snapshot inicial automáticamente
            setTimeout(() => {
                applyExampleSnapshot('smooth');
            }, 500);

        } catch (error) {
            console.error('Error cargando audio:', error);
            updateStatus('❌ Error cargando el archivo de audio');
        }
    }

    function applyExampleSnapshot(type) {
        if (!snapToGrains) {
            updateStatus('Primero carga un archivo de audio');
            return;
        }

        const snapshotHex = EXAMPLE_SNAPSHOTS[type];
        snapToGrains.applySnapshot(snapshotHex);
        
        // Actualizar display de secuencia
        const sequence = snapToGrains.getCurrentPointerSequence();
        updateSequenceDisplay(sequence);
        
        updateStatus(`🎨 Snapshot "${type}" aplicado. Secuencia: ${sequence?.length || 0} puntos`);
    }

    function applyCustomSnapshot() {
        if (!snapToGrains) {
            updateStatus('Primero carga un archivo de audio');
            return;
        }

        const customText = snapshotInput.value.trim();
        if (!customText) {
            updateStatus('Ingresa algún texto para el snapshot');
            return;
        }

        // Usar el texto como snapshot (se convertirá a hash)
        snapToGrains.applySnapshot(customText);
        
        const sequence = snapToGrains.getCurrentPointerSequence();
        updateSequenceDisplay(sequence);
        
        updateStatus(`🎨 Snapshot personalizado aplicado. Secuencia: ${sequence?.length || 0} puntos`);
    }

    function startEngine() {
        if (!snapToGrains) return;
        
        snapToGrains.start();
        updateStatus('▶️ Engine iniciado - Escucha los cambios dinámicos en el pointer');
        startBtn.disabled = true;
        stopBtn.disabled = false;
    }

    function stopEngine() {
        if (!snapToGrains) return;
        
        snapToGrains.stop();
        updateStatus('⏹️ Engine detenido');
        startBtn.disabled = false;
        stopBtn.disabled = true;
    }

    // Actualizar display periódicamente para mostrar cambios en tiempo real
    setInterval(() => {
        if (snapToGrains && snapToGrains.isActive) {
            const snapshot = snapToGrains.getCurrentSnapshot();
            // Podemos mostrar información del análisis actual si queremos
        }
    }, 1000);
}