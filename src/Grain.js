const { map_range } = require('./utils.js');

export class Grain {

    constructor(aCtx, pointer = 0, freqScale = 0.5, windowSize = 0.1, overlaps = 0.1, windowRandRatio = 0, type = 'grain') {
        this.audioCtx = aCtx;
        this.futureTickTime = this.audioCtx.currentTime;
        this.tempo = 120;
        this.secondsPerBeat = 60 / this.tempo;
        this.counterTimeValue = this.secondsPerBeat / 4;
        this.isPlaying = false;
        this.timerID = undefined;

        // Configuración de ganancia
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        this.gainNode.gain.value = 1;
        this.gain = 0.125;

        this.overlap = 1;
        this.counter = 0;
        this.buffer = null; // Inicialmente el buffer está vacío
        this.pointer = pointer; // Punto de inicio
        this.freqScale = freqScale;
        this.windowSize = windowSize;
        this.overlaps = overlaps;
        this.windowRandRatio = windowRandRatio;
    }

    set(buffer, pointer, freqScale, windowSize, overlaps, windowRandRatio) {
        this.buffer = buffer;
        this.pointer = map_range(pointer, 0, 1, 0, this.buffer.duration);
        this.freqScale = freqScale;
        this.windowSize = windowSize;
        this.overlaps = overlaps;
        this.windowRandRatio = windowRandRatio;
    }

    load(audioFile) {
        this.buffer = audioFile;
    }

    startGrain(time) {
        let algo = Math.random() * this.windowRandRatio;
        this.gainNode.gain.linearRampToValueAtTime(this.gain * 0.5, Math.abs(time + (this.windowSize + algo) / 8));

        const source = this.audioCtx.createBufferSource();
        source.connect(this.gainNode);
        source.buffer = this.buffer;
        source.playbackRate.value = this.freqScale;
        source.detune.value = algo * 1000;

        const startPointer = this.pointer + algo;
        const duration = this.windowSize + algo;
        source.start(this.audioCtx.currentTime + time, startPointer, duration);
    }

    scheduler() {
        if (this.futureTickTime < this.audioCtx.currentTime + 0.1) {
            this.schedule(this.futureTickTime - this.audioCtx.currentTime);
            this.playTick();
        }
        this.timerID = setTimeout(this.scheduler.bind(this), 0);
    }

    playTick() {
        this.secondsPerBeat = this.overlaps;
        this.counterTimeValue = this.secondsPerBeat;
        this.futureTickTime += this.counterTimeValue;
    }

    schedule(time) {
        this.startGrain(time);
    }

    start() {
        this.counter = 0;
        this.futureTickTime = this.audioCtx.currentTime;
        this.scheduler();
    }

    stop() {
        clearTimeout(this.timerID);
    }
}
