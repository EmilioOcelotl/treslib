import { AudioBufferRecorder } from '../../src/index.js'
import { Grain } from '../../src/index.js'
import { FreeSoundSearch } from '../../src/index.js'
import { FreesoundAudioLoader } from '../../src/index.js'
import { url, apiKey } from './config.js';

const freesound = new FreeSoundSearch(apiKey)
const audioloader = new FreesoundAudioLoader(apiKey)

const canvas = document.getElementById('waveformCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const playButton = document.getElementById('playButton');

const texto1 = document.getElementById('texto1');
const buscar1 = document.getElementById('buscar1');

let rec;
let audioContext;
let analyser;
let microphone;

buscar1.addEventListener('click', async () => {
    console.log(texto1.value)

    async function realizarBusqueda() {
        const resultados = await freesound.buscar(texto1.query);
        console.log(resultados.resultados[0]);
        return resultados; 
        // luego una función que con los resultados busque un archivo en concreto y lo descargue
    }

    realizarBusqueda()
    .then(resultados => {
        let res = resultados.resultados[Math.floor(Math.random() * resultados.resultados.length)];
        let srchURL = 'https://freesound.org/apiv2/sounds/' + res.id; 
        console.log("liga:" + srchURL);  
        audioloader.loadAudio(srchURL)
        .then(buffer => {
            console.log(buffer)

        })   
    })
})

startButton.addEventListener('click', async () => {
    // Solicitar acceso al micrófono
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048; // Tamaño de la FFT

    microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = audioContext.createMediaStreamSource(microphone);
    source.connect(analyser);
    rec = new AudioBufferRecorder(audioContext, source, 5)
    rec.startRecording();

    drawWaveform();
});

stopButton.addEventListener('click', async () => {
    rec.stopRecording();
    console.log(rec.getRecordedBuffer())
})

playButton.addEventListener('click', async () => {

    audioSource = audioContext.createBufferSource();
    audioSource.buffer = rec.getRecordedBuffer();
    audioSource.connect(audioContext.destination); // Conectar al destino (altavoces)
    audioSource.start(0); // Comenzar a reproducir desde el inicio (0 segundos)
    console.log("hola")

})

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
