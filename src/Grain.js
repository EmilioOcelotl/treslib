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
        this.lastGrainTime = 0;
        this.currentPointer = 0;
        this.startTime = 0;

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
        this.currentPointer = this.pointer;
        this.freqScale = freqScale;
        this.windowSize = windowSize;
        this.overlaps = overlaps;
        this.windowRandRatio = windowRandRatio;
    }

    getPlaybackPosition() {
        if (!this.isPlaying || !this.buffer) return 0;
        
        const elapsed = (this.audioCtx.currentTime - this.startTime) * Math.abs(this.freqScale);
        const normalizedPosition = ((this.currentPointer + elapsed) % this.buffer.duration) / this.buffer.duration;
        return normalizedPosition;
    }

    load(audioFile) {
        this.buffer = audioFile;
        this.reversedBuffer = this.reverseBuffer(audioFile);
    }

    startGrain(time) {
        if (!this.buffer) {
            console.error("No hay buffer cargado.");
            return;
        }
    
        // Evitar solapamiento de granos que causa clicks
        const now = this.audioCtx.currentTime;
        if (now - this.lastGrainTime < this.windowSize * 0.5) {
            return;
        }
        this.lastGrainTime = now;
    
        const algo = Math.random() * this.windowRandRatio;
        const hannEnvelope = this.createHannWindow(Math.floor(this.windowSize * this.audioCtx.sampleRate));
    
        const source = this.audioCtx.createBufferSource();
        const grainGainNode = this.audioCtx.createGain();
        
        // Configurar fade in/out más suave
        const fadeTime = this.windowSize * 0.1;
        grainGainNode.gain.setValueAtTime(0, now + time);
        grainGainNode.gain.linearRampToValueAtTime(1, now + time + fadeTime);
        grainGainNode.gain.linearRampToValueAtTime(1, now + time + this.windowSize - fadeTime);
        grainGainNode.gain.linearRampToValueAtTime(0, now + time + this.windowSize);
    
        let bufferToPlay = this.freqScale < 0 ? this.reversedBuffer : this.buffer;
        source.buffer = bufferToPlay;
        source.playbackRate.value = Math.abs(this.freqScale);
    
        source.connect(grainGainNode);
        grainGainNode.connect(this.gainNode);
    
        const startPointer = this.currentPointer + algo;
        const duration = this.clamp(this.windowSize + algo, 0.01, this.buffer.duration);
        
        source.start(now + time, startPointer, duration);
        
        // Actualizar el puntero para el próximo grano
        this.currentPointer = (startPointer + (duration * this.freqScale)) % this.buffer.duration;
        if (this.currentPointer < 0) this.currentPointer += this.buffer.duration;
        
        source.onended = () => {
            source.disconnect();
            grainGainNode.disconnect();
        };
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
        this.startTime = this.audioCtx.currentTime;
        this.currentPointer = this.pointer;
        this.isPlaying = true;
        this.scheduler();
    }

    stop() {
        clearTimeout(this.timerID);
        this.isPlaying = false;
        // Fade out para evitar clicks al detener
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.05);
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