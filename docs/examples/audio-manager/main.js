import AudioManager from '../../../src/AudioManager.js';

let manager = null;
let isAmbientOn = true;
let eventEntries = [];

// ------------------------------------
// Inicio — requiere gesto del usuario
// ------------------------------------
document.getElementById('initOverlay').addEventListener('click', init);

async function init() {
    manager = new AudioManager();

    // Esperar a que el contexto esté listo
    await waitForContext();

    const overlay = document.getElementById('initOverlay');
    overlay.classList.add('hidden');

    document.getElementById('ambientDot').classList.add('active');
    document.getElementById('ambientStatus').textContent = 'activo';

    enableControls();
    setStatus('Escuchando · drone ambient activo');
    logEvent('Ambient iniciado');

    // Interceptar micro-eventos atmosféricos para loguearlos
    patchAtmosphericTexture();
}

async function waitForContext() {
    return new Promise(resolve => {
        const check = () => {
            if (manager.audioContext && manager.audioContext.state === 'running') {
                resolve();
            } else {
                setTimeout(check, 50);
            }
        };
        check();
    });
}

// ------------------------------------
// Controles
// ------------------------------------
function enableControls() {
    document.querySelectorAll('button[disabled]').forEach(b => b.disabled = false);
}

document.getElementById('btnAmbientToggle').addEventListener('click', () => {
    const btn = document.getElementById('btnAmbientToggle');
    if (isAmbientOn) {
        manager.stopAmbientSound();
        isAmbientOn = false;
        btn.textContent = 'Iniciar ambient';
        document.getElementById('ambientDot').classList.remove('active');
        document.getElementById('ambientStatus').textContent = 'detenido';
        logEvent('Ambient detenido (fade 3s)');
        setStatus('Ambient detenido');
    } else {
        manager.startAmbientSound();
        isAmbientOn = true;
        btn.textContent = 'Detener ambient';
        document.getElementById('ambientDot').classList.add('active');
        document.getElementById('ambientStatus').textContent = 'activo';
        logEvent('Ambient reiniciado');
        setStatus('Ambient activo');
    }
});

document.getElementById('btnTransitionReveal').addEventListener('click', () => {
    manager.playTransition('reveal');
    logEvent('Transición: reveal');
});

document.getElementById('btnTransitionUp').addEventListener('click', () => {
    manager.playTransition('up');
    logEvent('Transición: up');
});

document.getElementById('btnTransitionDown').addEventListener('click', () => {
    manager.playTransition('down');
    logEvent('Transición: down');
});

document.getElementById('btnAtmosphere').addEventListener('click', () => {
    manager.playAtmosphericTexture();
    logEvent('Textura atmosférica');
});

document.getElementById('btnSuccess').addEventListener('click', () => {
    manager.playSuccess();
    logEvent('Success');
    setStatus('Success — bloom + comb');
});

document.getElementById('btnError').addEventListener('click', () => {
    manager.playError();
    logEvent('Error');
    setStatus('Error — descenso espectral');
});

// ------------------------------------
// Parchar playAtmosphericTexture para
// registrar los micro-eventos automáticos
// ------------------------------------
function patchAtmosphericTexture() {
    const original = manager.playAtmosphericTexture.bind(manager);
    manager.playAtmosphericTexture = () => {
        original();
        logEvent('Micro-evento atmosférico (auto)');
    };
}

// ------------------------------------
// Log de eventos
// ------------------------------------
function logEvent(msg) {
    const now = new Date();
    const time = `${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

    eventEntries.push(`${time}  ${msg}`);
    if (eventEntries.length > 3) eventEntries.shift();

    const log = document.getElementById('eventLog');
    log.innerHTML = eventEntries
        .map((e, i) => `<div class="entry ${i === eventEntries.length - 1 ? 'fresh' : ''}">${e}</div>`)
        .join('');
}

function setStatus(msg) {
    document.getElementById('status').textContent = msg;
}
