import { OnsetDetector } from '../src/OnsetDetector.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let onsetDetector;
let audioSource; // Guardaremos la fuente de audio para poder detenerla

document.getElementById('audioFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const playBtn = document.getElementById('playBtn');
  playBtn.disabled = false;

  playBtn.onclick = () => {
    if (audioSource) audioSource.stop(); // Detener reproducción anterior
    playAudioFile(URL.createObjectURL(file));
  };
});

async function playAudioFile(filePath) {
  try {
    const response = await fetch(filePath);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    // 1. Crear la fuente de audio y conectarla a los altavoces
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(audioCtx.destination); // ¡Conecta a los altavoces!

    // 2. Inicializar el detector y pasarle la fuente
    onsetDetector = new OnsetDetector(audioCtx, audioBuffer);
    onsetDetector.start((flux) => {
      console.log(`Onset detectado! Flux: ${flux.toFixed(2)}`);
      // Ejemplo: Cambiar el color de fondo al detectar un onset
      document.body.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 80%)`;
    });

    // 3. Reproducir el audio
    audioSource.start();
    audioSource.onended = () => {
      console.log("Audio terminado");
      onsetDetector.stop(); // Opcional: Detener el detector
    };

  } catch (err) {
    console.error("Error al cargar el audio:", err);
  }
}