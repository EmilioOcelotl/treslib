import { OnsetDetector } from '../src/OnsetDetector.js';

const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 44100 // Forzar sample rate
  });let onsetDetector;
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

// En main.js, asegúrate de:
async function playAudioFile(filePath) {
    try {
      const response = await fetch(filePath);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
      // 1. Verifica que el buffer tenga datos
      if (!audioBuffer) throw new Error("AudioBuffer no se creó correctamente");
      
      // 2. Inicializa el detector después de cargar el audio
      onsetDetector = new OnsetDetector(audioCtx, audioBuffer);
      
      // 3. Agrega logs para debug
      console.log("AudioBuffer cargado:", audioBuffer);
      console.log("Detector inicializado:", onsetDetector);
      
      onsetDetector.start((flux) => {
        console.log(`Onset detectado! Flux: ${flux}`);
      });
  
    } catch (err) {
      console.error("Error detallado:", {
        error: err,
        message: err.message,
        stack: err.stack
      });
    }
  }