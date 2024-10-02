// hola 

const canvas = document.getElementById('waveformCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');

let audioContext;
let analyser;
let microphone;

startButton.addEventListener('click', async () => {
    // Solicitar acceso al micrófono
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048; // Tamaño de la FFT

    microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(microphone);
    source.connect(analyser);

    drawWaveform();
});

function drawWaveform() {
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        analyser.getByteTimeDomainData(dataArray);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)'; // Fondo transparente
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.lineWidth = 0.45;
        ctx.strokeStyle = '#ffffff'; // Color de la forma de onda

        ctx.beginPath();
        
        const sliceWidth = (canvas.width * 1.0) / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // Normalizar el valor
            const y = v * canvas.height / 2; // Convertir a coordenadas de canvas

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }
        
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        requestAnimationFrame(draw);
    }

    draw();
}
