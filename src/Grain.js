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
        this.reversedBuffer = this.reverseBuffer(audioFile); // Guarda el buffer invertido
    }

    startGrain(time) {
        if (!this.buffer) {
            console.error("No hay buffer cargado.");
            return;
        }
    
        let algo = Math.random() * this.windowRandRatio;
        const hannEnvelope = this.createHannWindow(Math.floor(this.windowSize * this.audioCtx.sampleRate));
    
        const source = this.audioCtx.createBufferSource();
        source.connect(this.gainNode);
        
        let bufferToPlay = this.buffer;
        if (this.freqScale < 0) {
            bufferToPlay = this.reverseBuffer(this.buffer); // Invertir el buffer si la velocidad es negativa
        }
        
        source.buffer = bufferToPlay;
        source.playbackRate.value = Math.abs(this.freqScale); // Reproducción a la velocidad absoluta
    
        const grainGainNode = this.audioCtx.createGain();
        grainGainNode.connect(this.gainNode);
        grainGainNode.gain.setValueCurveAtTime(hannEnvelope, this.audioCtx.currentTime + time, this.windowSize + algo);
    
        source.connect(grainGainNode);
    
        const startPointer = this.pointer + algo;
        const duration = this.clamp(this.windowSize + algo, 0.01, this.buffer.duration);
        
        source.start(this.audioCtx.currentTime + time, startPointer, duration);
    }
    
    

    createHannWindow(size) {
        const window = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (size - 1)));
        }
        return window;
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

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    reverseBuffer(buffer) {
        const numberOfChannels = buffer.numberOfChannels;
        const reversedBuffer = this.audioCtx.createBuffer(
            numberOfChannels,
            buffer.length,
            buffer.sampleRate
        );
    
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const channelData = buffer.getChannelData(channel);
            const reversedData = reversedBuffer.getChannelData(channel);
            for (let i = 0, j = channelData.length - 1; i < channelData.length; i++, j--) {
                reversedData[i] = channelData[j];
            }
        }
    
        return reversedBuffer;
    }
    
}
