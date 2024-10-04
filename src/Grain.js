const { map_range } = require('./utils.js');

export class Grain {
    constructor(aCtx, type = 'grain') {
        this.audioCtx = aCtx;
        this.futureTickTime = this.audioCtx.currentTime;
        this.tempo = 120;
        this.secondsPerBeat = 60 / this.tempo;
        this.counterTimeValue = this.secondsPerBeat / 4;
        this.isPlaying = false;
        this.timerID = undefined;

        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        this.gainNode.gain.value = 1;
        this.gain = 1;

        this.overlap = 0.1;  
        this.counter = 0;
        this.buffer = null;
        this.pointer = 0;
        this.freqScale = 1;
        this.windowSize = 0.1;
        this.overlaps = 0.1;
        this.windowRandRatio = 0.2; 

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
        if (!this.buffer) return;

        let algo = Math.random() * this.windowRandRatio;
        let env = this.createHannEnvelope(this.windowSize + algo);  // Envolvente Hann

        const source = this.audioCtx.createBufferSource();
        source.buffer = this.buffer;
        source.playbackRate.value = this.freqScale;

        const gainNode = this.audioCtx.createGain();
        gainNode.gain.setValueCurveAtTime(env, this.audioCtx.currentTime + time, this.windowSize + algo);
        gainNode.connect(this.gainNode);

        source.connect(gainNode);

        const startPointer = this.pointer + algo;
        const duration = this.windowSize + algo;

        source.start(this.audioCtx.currentTime + time, startPointer, duration);
    }

    createHannEnvelope(duration) {
        const samples = 512;  
        const envelope = new Float32Array(samples);
        for (let i = 0; i < samples; i++) {
            envelope[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples - 1)));
        }
        return envelope;
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
