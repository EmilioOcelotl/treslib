// test/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Pattern2DGenerator from '../src/Pattern2DGenerator.js';
import GlitchedPyramidManager from '../src/GlitchedPyramidManager.js';


// Variables globales de la aplicación
let patternGenerator = null;
let pyramidManager = null;
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let clock = null;
let currentData = null;
let frameCount = 0;
let lastTime = performance.now();
let fps = 0;

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
    console.log('Inicializando Pirámide Glitch 3D...');
    
    // Obtener referencias a los elementos del DOM
    const snapshotInput = document.getElementById('snapshotInput');
    const applyCustomBtn = document.getElementById('applyCustomBtn');
    const view2D = document.getElementById('view2D');
    const canvas3D = document.getElementById('canvas3D');
    const status = document.getElementById('status');
    const paramDisplay = document.getElementById('paramDisplay');
    
    // Botones
    const btnSolid = document.getElementById('btnSolid');
    const btnWire = document.getElementById('btnWire');
    const btnFracture = document.getElementById('btnFracture');
    const resetViewBtn = document.getElementById('resetView');
    const toggleAnimationBtn = document.getElementById('toggleAnimation');
    const toggleGlitchBtn = document.getElementById('toggleGlitch');
    const statsElement = document.getElementById('stats');
    
    // Verificar que todos los elementos existen
    if (!snapshotInput || !view2D || !canvas3D) {
        console.error('No se encontraron elementos esenciales del DOM');
        return;
    }
    
    // Inicializar generador de patrones
    patternGenerator = new Pattern2DGenerator(64, 64);
    
    // Inicializar Three.js
    initThreeJS();
    
    // Configurar event listeners
    applyCustomBtn.addEventListener('click', () => handleSnapshotChange(snapshotInput.value));
    
    // Botones de snapshots de ejemplo
    document.querySelectorAll('.snapshot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const snapshotType = e.target.dataset.snapshot;
            snapshotInput.value = EXAMPLE_SNAPSHOTS[snapshotType];
            handleSnapshotChange(EXAMPLE_SNAPSHOTS[snapshotType]);
        });
    });
    
    // Botones de modo
    btnSolid.addEventListener('click', () => setDisplayMode('solid', btnSolid, btnWire, btnFracture));
    btnWire.addEventListener('click', () => setDisplayMode('wire', btnSolid, btnWire, btnFracture));
    btnFracture.addEventListener('click', () => setDisplayMode('fracture', btnSolid, btnWire, btnFracture));
    
    // Botones de control
    resetViewBtn.addEventListener('click', resetView);
    toggleAnimationBtn.addEventListener('click', () => toggleAnimation(toggleAnimationBtn));
    toggleGlitchBtn.addEventListener('click', () => toggleGlitch(toggleGlitchBtn));
    
    // Generar patrón inicial
    setTimeout(() => {
        handleSnapshotChange(snapshotInput.value);
    }, 500);
    
    // Actualizar FPS periódicamente
    setInterval(() => {
        updateStats(statsElement);
    }, 1000);
    
    // ====================
    // FUNCIONES DE LA APLICACIÓN
    // ====================
    
    function handleSnapshotChange(snapshot) {
        if (!snapshot) return;

        // 1. Derivar parámetros del snapshot
        const params = deriveParamsFromSnapshot(snapshot);

        // 2. Actualizar el pyramidManager con los nuevos parámetros
        pyramidManager.setParameters(params);

        // 3. Generar datos del patlrón 2D usando el snapshot como ID
        currentData = patternGenerator.generateFromID(snapshot);
        
        // 4. Renderizar vista 2D
        render2DView(currentData, view2D);
        
        // 5. Crear o actualizar pirámide 3D
        const pyramid = pyramidManager.createPyramid(currentData);
        if (scene && pyramid) {
            // Remover pirámide anterior
            const oldPyramid = scene.getObjectByName('glitchedPyramid');
            if (oldPyramid) {
                scene.remove(oldPyramid);
            }
            
            pyramid.name = 'glitchedPyramid';
            scene.add(pyramid);
        }

        // 6. Actualizar UI
        updateParamDisplay(params);
        updateStatus(`Snapshot aplicado. Geometría generada a partir del texto.`);
        
        console.log(`Pirámide generada para snapshot: "${snapshot.substring(0, 20)}..."`);
    }

    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    function deriveParamsFromSnapshot(snapshot) {
        const hash = simpleHash(snapshot);
        
        // Mapear el hash a rangos de parámetros.
        // Usamos divisiones y módulos para obtener diferentes valores del mismo hash.
        const params = {
            height: 2.0 + (hash % 1000 / 1000) * 4.0, // Rango [2.0, 6.0]
            fractureThreshold: 0.1 + (hash % 500 / 500) * 0.8, // Rango [0.1, 0.9]
            glitchAmount: 0.05 + (hash % 800 / 800) * 0.75, // Rango [0.05, 0.8]
            segments: 3 + (hash % 6), // Rango [3, 8]
        };
        
        return params;
    }

    function updateParamDisplay(params) {
        if (!paramDisplay) return;
        
        paramDisplay.innerHTML = `
            <div class="param-item">
                <div>Altura</div>
                <div class="param-value">${params.height?.toFixed(2) || '0.00'}</div>
            </div>
            <div class="param-item">
                <div>Fractura</div>
                <div class="param-value">${params.fractureThreshold?.toFixed(2) || '0.00'}</div>
            </div>
            <div class="param-item">
                <div>Glitch</div>
                <div class="param-value">${params.glitchAmount?.toFixed(2) || '0.00'}</div>
            </div>
            <div class="param-item">
                <div>Resolución</div>
                <div class="param-value">${params.segments || '0'}</div>
            </div>
        `;
    }
    
    function updateStatus(message) {
        if (status) status.textContent = message;
    }
    
    function render2DView(patternData, canvas) {
        if (!canvas || !patternData) return;
        patternGenerator.renderToCanvas(patternData.dithered, canvas, 4);
    }
    
    function setDisplayMode(mode, btnSolid, btnWire, btnFracture) {
        if (!pyramidManager) return;
        
        pyramidManager.setDisplayMode(mode);
        
        // Actualizar estado de botones
        btnSolid.classList.toggle('active', mode === 'solid');
        btnWire.classList.toggle('active', mode === 'wire');
        btnFracture.classList.toggle('active', mode === 'fracture');
    }
    
    function toggleAnimation(button) {
        if (!pyramidManager) return;
        
        const isAnimating = pyramidManager.toggleAnimation();
        button.textContent = `Animación: ${isAnimating ? 'ON' : 'OFF'}`;
    }
    
    function toggleGlitch(button) {
        if (!pyramidManager) return;
        
        const isActive = pyramidManager.toggleGlitch();
        button.textContent = `Glitch Activo: ${isActive ? 'ON' : 'OFF'}`;
    }
    
    function resetView() {
        if (controls) {
            controls.reset();
        }
    }
    
    function updateStats(statsElement) {
        if (!pyramidManager || !statsElement) return;
        
        const stats = pyramidManager.getStats();
        statsElement.textContent = 
            `Vértices: ${stats.vertices} | ` +
            `Caras: ${stats.faces} | ` +
            `FPS: ${fps}`;
    }
}

// ====================
// INICIALIZACIÓN THREE.JS
// ====================

function initThreeJS() {
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    
    // Crear cámara
    const canvas3D = document.getElementById('canvas3D');
    if (!canvas3D) return;
    
    camera = new THREE.PerspectiveCamera(
        60, 
        canvas3D.clientWidth / canvas3D.clientHeight, 
        0.1, 
        1000
    );
    camera.position.set(8, 5, 8);
    camera.lookAt(0, 1, 0);
    
    // Crear renderer
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas3D,
        antialias: true 
    });
    renderer.setSize(canvas3D.clientWidth, canvas3D.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Crear controles de órbita
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.minDistance = 3;
    controls.maxDistance = 30;
    
    // Configurar luces
    const ambientLight = new THREE.AmbientLight(0x222244);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0x55aaff, 0.8);
    directionalLight1.position.set(5, 10, 5);
    directionalLight1.castShadow = true;
    scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xff55aa, 0.3);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);
    
    // Añadir grid helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x00ffff, 0x222244);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);
    
    // Añadir neblina
    scene.fog = new THREE.FogExp2(0x050510, 0.02);
    
    // Inicializar manager de pirámide (los parámetros se establecerán dinámicamente)
    pyramidManager = new GlitchedPyramidManager(patternGenerator, {});
    
    // Iniciar reloj para animaciones
    clock = new THREE.Clock();
    
    // Iniciar loop de animación
    animate();
    
    // Manejar redimensionamiento
    window.addEventListener('resize', onWindowResize);
}

function animate() {
    requestAnimationFrame(animate);
    
    const deltaTime = clock.getDelta();
    
    // Actualizar pirámide
    if (pyramidManager) {
        pyramidManager.update(deltaTime);
    }
    
    // Actualizar controles
    if (controls) {
        controls.update();
    }
    
    // Actualizar FPS
    updateFPS();
    
    // Renderizar escena
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function updateFPS() {
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        frameCount = 0;
        lastTime = currentTime;
    }
}

function onWindowResize() {
    const canvas3D = document.getElementById('canvas3D');
    if (!canvas3D || !camera || !renderer) return;
    
    camera.aspect = canvas3D.clientWidth / canvas3D.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas3D.clientWidth, canvas3D.clientHeight);
}