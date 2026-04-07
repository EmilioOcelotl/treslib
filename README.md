# treslib

treslib es una librería escrita en JavaScript para creación audiovisual generativa que integra síntesis granular, visuales en tiempo real y procesamiento de audio en un entorno unificado. Proporciona herramientas para generar texturas visuales con Hydra, transformarlas en geometrías 3D animadas, capturar snapshots comprimidos de visuales, y sincronizarlas con motores de sonido granular y detección de eventos musicales.

## GrainEngine

Motor de síntesis granular inspirado en Warp1 de SuperCollider. Gestiona múltiples granos de audio simultáneamente con control independiente de densidad y pitch: `overlaps` determina cuántos granos suenan en paralelo, mientras que `rate` controla exclusivamente la velocidad de reproducción de cada grano. Implementa scheduling de audio con look-ahead sobre el reloj del hardware (`AudioContext`), pooling de nodos de ganancia para eficiencia, e interpolación suave de parámetros.

Ejemplo de uso: 

```
import { GrainEngine } from 'treslib';

// Configurar motor granular
const audioCtx = new AudioContext();
const engine = new GrainEngine(audioCtx, audioBuffer, {
    pointer: 0.2,
    rate: 1.5,
    overlaps: 8,
    windowSize: 0.08,
    randomPosition: 0.1
});

// Conectar a salida
engine.connect(audioCtx.destination);

// Control en tiempo real
engine.start();
engine.setPointer(0.5); // Navegar por el buffer
engine.setRate(0.8); // Bajar pitch de los granos
engine.setParamAtTime("randomPitch", 0.15); // Añadir variación tonal
```

## GrainSequencer 

Secuenciador de parámetros especializado para controlar múltiples instancias de GrainEngine en tiempo. Permite crear patrones de parámetros granulares como posición, pitch y amplitud, sincronizados con un tempo musical. Soporta modos absoluto y relativo para cambios paramétricos.

Ejemplo: 

```
import { GrainSequencer, GrainEngine } from 'treslib';

const audioCtx = new AudioContext();
const sequencer = new GrainSequencer(audioCtx, 120, 4); // 120 BPM, 4 steps por beat

// Crear motor granular
const granular = new GrainEngine(audioCtx, audioBuffer);

// Secuenciar parámetros del granular
sequencer.addPointerSequence(
  [0.1, 0.3, 0.7, 0.9, 0.5, 0.2, 0.8, 0.4], 
  granular
);

sequencer.addRateSequence(
  [1.0, 1.2, 0.8, 1.5, 2.0, 1.0, 0.5, 1.8],
  granular
);

sequencer.addAmpSequence(
  [0.3, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6, 0.4],
  granular
);

/// Opcional: callback para visualización
sequencer.onStepChange = (step, values) => {
  console.log(`Step ${step}:`, values);
};

// Iniciar secuenciador y motor
granular.start();
sequencer.start();
```

## HydraTextureManager

Gestor de texturas generativas que conecta Hydra (síntesis visual en WebGL) con Three.js. Genera texturas animadas en tiempo real usando código de shaders y las convierte en texturas de Three.js para materiales 3D.

Ejemplo: 

```
import HydraTextureManager from 'treslib';

// Configurar canvas para Hydra
const hydraCanvas = document.createElement('canvas');
hydraCanvas.width = 512;
hydraCanvas.height = 512;

// Crear gestor de texturas
const textureManager = new HydraTextureManager(hydraCanvas, {
  maxTextures: 8, // Límite de texturas
  textureNames: ['VORTEX', 'WAVES', 'NOISE', 'GEOMETRY'] // Nombres personalizados
});

// Usar en Three.js
const geometry = new THREE.PlaneGeometry(10, 10);
const material = new THREE.MeshBasicMaterial({ 
  map: textureManager.getThreeJSTexture() 
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Cambiar texturas dinámicamente
textureManager.setTexture(0); // Textura azul-cian oscilante
textureManager.setTexture(1); // Textura verde-púrpura
textureManager.setTexture(2); // Textura naranja-roja

// Añadir nueva textura personalizada
textureManager.addTexture(() => {
  shape(5, 0.5)
    .repeat(3, 2)
    .rotate(0.1)
    .color(1, 0.2, 0.8)
    .out();
}, 'CUSTOM_SHAPES');

// Actualizar en bucle de animación
function animate() {
  textureManager.update();
  requestAnimationFrame(animate);
}
animate();
```

## ClothMeshManager

Gestor de mallas deformables que transforma texturas Hydra en geometrías 3D animadas. Crea superficies tipo "tela" que se deforman en tiempo real basándose en los colores y patrones de las texturas generativas, combinando análisis de imagen con funciones de onda para efectos orgánicos.

Ejemplo: 

```
import ClothMeshManager from 'treslib';

// Crear gestor de tela con texturas Hydra
const clothManager = new ClothMeshManager(hydraTextureManager, {
  width: 6,           // Ancho de la malla
  height: 3,          // Alto de la malla  
  segments: 150,      // Resolución de la geometría
  colorInfluence: 0.3, // Cuánto afectan los colores a la deformación
  smoothingRadius: 0.2 // Suavizado del análisis de imagen
});

// Obtener la malla para Three.js
const clothMesh = clothManager.getMesh();
scene.add(clothMesh);

// Cambiar materiales dinámicamente
clothManager.setMaterial('standard'); // Material con textura Hydra
clothManager.setMaterial('sobel');    // Material con efecto de bordes

// Controlar parámetros de deformación
clothManager.setDeformationParams({
  colorInfluence: 0.5,    // Más influencia del color
  smoothingRadius: 0.3,   // Más suavizado
  waveParams: {
    amplitude1: 0.5,      // Ondas más intensas
    frequency1: 3.0       // Frecuencia diferente
  }
});

// Actualizar en el bucle de animación
function animate() {
  clothManager.update(0.016); // Pasar delta time
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
```

### Integración HydraTextureManager + ClothMeshManager

Combinación para crear visuales 3D generativos donde las texturas animadas deforman geometrías en tiempo real.

Ejemplo: 

```
import HydraTextureManager from 'treslib';
import ClothMeshManager from 'treslib';

// 1. Configurar canvas para Hydra
const hydraCanvas = document.createElement('canvas');
hydraCanvas.width = 512;
hydraCanvas.height = 512;
document.body.appendChild(hydraCanvas);

// 2. Crear gestor de texturas Hydra
const textureManager = new HydraTextureManager(hydraCanvas, {
  maxTextures: 6,
  textureNames: ['VORTEX', 'WAVES', 'GEOMETRY', 'NOISE', 'OSCILLATOR', 'VORONOI']
});

// 3. Crear gestor de malla deformable
const clothManager = new ClothMeshManager(textureManager, {
  width: 8,
  height: 4,
  segments: 200,
  colorInfluence: 0.4,
  smoothingRadius: 0.25
});

// 4. Añadir a escena Three.js
const clothMesh = clothManager.getMesh();
scene.add(clothMesh);

// 5. Control conjunto
let textureIndex = 0;
setInterval(() => {
  // Cambiar textura cada 3 segundos
  textureManager.setTexture(textureIndex);
  textureIndex = (textureIndex + 1) % textureManager.getTextureCount();
  
  console.log(`Textura activa: ${textureManager.getTextureName()}`);
}, 3000);

// 6. Bucle de animación
function animate() {
  textureManager.update();        // Actualizar textura Hydra
  clothManager.update(0.016);     // Actualizar deformaciones 3D
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
```
## SnapshotCompressor

Compresor de imágenes especializado para capturar y comprimir frames de visuales generativos en formato de 2 bits por píxel (4 niveles de gris). Incluye dithering ordenado para mantener detalles y extracción de paletas de colores estilo RISO. Ideal para guardar snapshots de arte generativo en poco espacio.

Ejemplo: 

```
import SnapshotCompressor from 'treslib';

// Crear compresor con resolución personalizada
const compressor = new SnapshotCompressor(64, 64); // 64x64 píxeles

// Capturar y comprimir frame de Hydra
const hydraCanvas = document.querySelector('canvas');
const compressedHex = compressor.captureHydraFrame(hydraCanvas);
console.log('Snapshot comprimido:', compressedHex); // Ej: "A3F2C45B..."

// Extraer paleta de colores estilo RISO
const risoPalette = compressor.extractRisoPalette(hydraCanvas);
console.log('Paleta RISO:', risoPalette);
/// Ej: [{r: 255, g: 0, b: 64}, {r: 0, g: 192, b: 255}, ...]

// Descomprimir para visualización
const compressedBytes = compressor.hexToBytes(compressedHex);
const decompressedPixels = compressor.decompress2bpp(compressedBytes);
const imageData = compressor.ditheredToImageData(decompressedPixels);

// Mostrar en canvas
const displayCanvas = document.createElement('canvas');
const ctx = displayCanvas.getContext('2d');
ctx.putImageData(imageData, 0, 0);
document.body.appendChild(displayCanvas);

// Guardar en localStorage
localStorage.setItem('lastSnapshot', compressedHex);
```
## OnsetDetector

Detector de onsets (ataques sonoros) basado en el algoritmo psicoacústico de Nick Collins utilizado en MIREX. Implementa 40 bandas ERB (Equivalent Rectangular Bandwidth) y modelado de loudness espectral para una detección musicalmente relevante de transientes en señales de audio. Soporta dos modos: reproducción de buffer con detección simultánea, o análisis de fuente externa (micrófono, MediaStreamSource) sin reproducción.

```
import { OnsetDetector } from 'treslib';

const audioCtx = new AudioContext();

// Modo 1: buffer de audio (reproduce y detecta)
const detector = new OnsetDetector(audioCtx, audioBuffer, 0.015);

detector.start((flux) => {
  console.log(`Onset detectado! Intensidad: ${flux.toFixed(3)}`);
  granularEngine.setPointer(Math.random());
});

// Modo 2: micrófono (solo detección, sin reproducción)
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const micSource = audioCtx.createMediaStreamSource(stream);
    const detector = new OnsetDetector(audioCtx, null, 0.015);
    detector.connectSource(micSource);
    detector.start((flux) => {
      console.log(`Onset en vivo: ${flux.toFixed(3)}`);
    }, false); // false = no conectar a la salida de audio
  });

// Detener
detector.stop();
```

## AudioBufferRecorder

Grabador de audio en búfer circular que captura entrada de micrófono en tiempo real y mantiene los últimos segundos de audio disponibles para procesamiento inmediato. Ideal para efectos granulares, análisis en tiempo real y captura de audio reactiva.

```
import { AudioBufferRecorder } from 'treslib';

// Configurar desde micrófono
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    const audioCtx = new AudioContext();
    const micSource = audioCtx.createMediaStreamSource(stream);
    
    // Crear grabador con búfer de 8 segundos
    const recorder = new AudioBufferRecorder(audioCtx, micSource, 8);
    
    // Iniciar grabación continua
    recorder.startRecording();
    
    // Usar el búfer para análisis o procesamiento
    setInterval(() => {
      const currentBuffer = recorder.getRecordedBuffer();
      
      // Análisis de audio en tiempo real
      const onsetDetector = new OnsetDetector(audioCtx, currentBuffer);
      onsetDetector.start((flux) => {
        console.log('Onset detectado en audio en vivo:', flux);
      });
      
      // O para síntesis granular
      const granular = new GrainEngine(audioCtx, currentBuffer);
      granular.start();
      
    }, 1000); // Verificar cada segundo
    
    // En una interacción, capturar el audio reciente
    document.addEventListener('click', () => {
      const recentAudio = recorder.getRecordedBuffer();
      // Procesar los últimos 8 segundos de audio
      saveBufferForPlayback(recentAudio);
    });
    
    // Cambiar duración dinámicamente
    recorder.setBufferDuration(15); // Ahora guarda 15 segundos
  });
```

## FreeSoundSearcher

Cliente para buscar sonidos en la base de datos de Freesound.org mediante su API REST. Permite explorar y acceder a miles de samples de audio con filtros por relevancia y paginación.

Ejemplo: 

```
import { FreeSoundSearcher } from 'treslib';

// Inicializar con API key de Freesound
const searcher = new FreeSoundSearcher('tu-api-key-de-freesound');

// Búsqueda básica
const resultados = await searcher.buscar('ambient pad', 1, 20);
console.log(`${resultados.total} sonidos encontrados:`);
resultados.resultados.forEach(sound => {
  console.log(`- ${sound.name} (${sound.username})`);
});

// Navegación por páginas
const pagina2 = await searcher.buscar('glitch', 2, 15);

// Integración con cargador de audio
resultados.resultados.forEach(async (sound) => {
  const loader = new FreeSoundAudioLoader(searcher.apiKey);
  const audioBuffer = await loader.cargar(sound.id);
  // Usar con GrainEngine u otros procesadores
});
```
## FreeSoundAudioLoader

Cargador especializado para descargar y decodificar samples de audio desde Freesound.org directamente a AudioBuffers listos para usar en Web Audio API. Maneja autenticación API, formato de previsualización y decodificación automática.

Ejemplo: 

```
import { FreeSoundAudioLoader, FreeSoundSearcher } from 'treslib';

// Configurar cargador con API key
const loader = new FreeSoundAudioLoader('tu-api-key-de-freesound');

// Buscar y cargar samples automáticamente
const searcher = new FreeSoundSearcher('tu-api-key-de-freesound');
const resultados = await searcher.buscar('granular texture', 1, 5);

// Cargar el primer resultado
const primerSonido = resultados.resultados[0];
const audioBuffer = await loader.loadAudio(primerSonido.id);

// Usar inmediatamente con GrainEngine
const granular = new GrainEngine(audioCtx, audioBuffer);
granular.start();

// O cargar múltiples samples para banco de sonidos
const buffers = [];
for (const sound of resultados.resultados.slice(0, 3)) {
    try {
        const buffer = await loader.loadAudio(sound.id);
        buffers.push(buffer);
        console.log(`✅ ${sound.name} cargado`);
    } catch (error) {
        console.log(`❌ Error cargando ${sound.name}:`, error);
    }
}

// Crear secuenciador con samples cargados
buffers.forEach((buffer, index) => {
    const engine = new GrainEngine(audioCtx, buffer);
    // Configurar parámetros únicos por sample...
});
```

## Referencias

- Collins, N. (2005). "A Comparison of Sound Onset Detection Algorithms with Emphasis on Psychoacoustically Motivated Detection Functions". Proceedings of the AES 118th Convention. Barcelona, España.

- https://doc.sccode.org/Classes/Warp1.html