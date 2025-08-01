import { Clock } from '../src/Clock.js';
import { Sequencer } from '../src/Sequencer.js';

// --- Setup de contexto de audio ---
const audioCtx = new AudioContext();

// Crear el Clock (tempo = 90 BPM, subdivisión = semicorcheas)
const clock = new Clock(audioCtx, 45, 4);

// Secuenciador visual: fondo del <body>
const colorSeq = new Sequencer(
    ['#ff0033', '#33ccff', '#fff000', '#000000'],
    (val, time) => {
        setTimeout(() => {
            document.body.style.backgroundColor = val;
        }, (time - audioCtx.currentTime) * 1000);
    }
);

// Secuenciador visual: tamaño de un círculo SVG
const circle = document.getElementById("circle");

const sizeSeq = new Sequencer(
    [30, 60, 90, 60, 30, null, 80, 20],
    (val, time) => {
        setTimeout(() => {
            circle.setAttribute("r", val);
        }, (time - audioCtx.currentTime) * 1000);
    }
);

// Suscribir ambos secuenciadores al clock
clock.subscribe(time => {
    const colorVal = colorSeq.sequence[colorSeq.index % colorSeq.sequence.length];
    const sizeVal = sizeSeq.sequence[sizeSeq.index % sizeSeq.sequence.length];

    // Imprimir en consola
    console.log(`Tick @ ${time.toFixed(3)}s | Color: ${colorVal} | Tamaño círculo: ${sizeVal}`);

    colorSeq.trigger(time);
    sizeSeq.trigger(time);
});

// Activar el sistema con un clic
document.body.addEventListener("click", () => {
    audioCtx.resume().then(() => {
        clock.start();
        console.log("Clock started");
    });
});

document.getElementById("overlay").addEventListener("click", () => {
    audioCtx.resume().then(() => {
      clock.start();
      document.getElementById("overlay").style.display = "none";
      console.log("Clock started");
    });
  });
