import HydraTextureManager from '../../../src/HydraTextureManager.js';
import ClothMeshManager    from '../../../src/ClothMeshManager.js';
import * as THREE          from 'three';
import { OrbitControls }   from 'three/examples/jsm/controls/OrbitControls.js';

let textureManager, clothManager;
let renderer, scene, camera, controls;

document.getElementById('initOverlay').addEventListener('click', init);

// ------------------------------------
// Inicialización
// ------------------------------------
function init() {
    document.getElementById('initOverlay').classList.add('hidden');

    setupThree();
    setupModules();
    setupControls();
    animate();

    document.getElementById('status').textContent = 'Activo · orbita con ratón/touch';
}

function setupThree() {
    const container = document.getElementById('canvas-container');
    const W = container.clientWidth  || 640;
    const H = container.clientHeight || 360;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1000);
    camera.position.set(0, 0, 4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Iluminación
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight.position.set(0, 2, 2);
    scene.add(dirLight);
    scene.add(new THREE.AmbientLight(0x404040));
}

function setupModules() {
    const hydraCanvas = document.getElementById('hydra-canvas');

    textureManager = new HydraTextureManager(hydraCanvas);

    clothManager = new ClothMeshManager(textureManager, {
        width: 4,
        height: 2,
        segments: 150,
        colorInfluence: 0.25,
        smoothingRadius: 0.25,
        waveParams: {
            amplitude1: 0.3,
            frequency1: 4.0,
            amplitude2: 0.2,
            frequency2: 3.5,
        }
    });

    scene.add(clothManager.getMesh());
}

// ------------------------------------
// Controles de textura, material y sliders
// ------------------------------------
function setupControls() {
    // Texturas
    document.getElementById('textureButtons').addEventListener('click', e => {
        const btn = e.target.closest('button[data-tex]');
        if (!btn) return;
        const idx = parseInt(btn.dataset.tex);
        textureManager.setTexture(idx);
        document.querySelectorAll('#textureButtons button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    // Material
    document.getElementById('materialButtons').addEventListener('click', e => {
        const btn = e.target.closest('button[data-mat]');
        if (!btn) return;
        clothManager.setMaterial(btn.dataset.mat);
        document.querySelectorAll('#materialButtons button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });

    // Sliders — deformación
    const sliders = [
        { id: 'slColorInfluence', val: 'valColorInfluence', decimals: 2,
          apply: v => clothManager.setDeformationParams({ colorInfluence: v }) },
        { id: 'slAmplitude1',     val: 'valAmplitude1',     decimals: 2,
          apply: v => clothManager.setDeformationParams({ waveParams: { amplitude1: v } }) },
        { id: 'slFrequency1',     val: 'valFrequency1',     decimals: 1,
          apply: v => clothManager.setDeformationParams({ waveParams: { frequency1: v } }) },
        { id: 'slAmplitude2',     val: 'valAmplitude2',     decimals: 2,
          apply: v => clothManager.setDeformationParams({ waveParams: { amplitude2: v } }) },
        { id: 'slFrequency2',     val: 'valFrequency2',     decimals: 1,
          apply: v => clothManager.setDeformationParams({ waveParams: { frequency2: v } }) },
    ];

    sliders.forEach(({ id, val, decimals, apply }) => {
        const input = document.getElementById(id);
        const display = document.getElementById(val);
        input.addEventListener('input', () => {
            const v = parseFloat(input.value);
            display.textContent = v.toFixed(decimals);
            apply(v);
        });
    });
}

// ------------------------------------
// Loop de animación
// ------------------------------------
function animate() {
    requestAnimationFrame(animate);
    textureManager.update();
    clothManager.update(0.01);
    controls.update();
    renderer.render(scene, camera);
}
