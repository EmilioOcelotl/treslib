import { map_range } from './utils.js';

export class Grain {
    constructor(aCtx, type = 'grain') {
        this.audioCtx = aCtx;
        this.type = type;
        this.futureTickTime = this.audioCtx.currentTime;
        this.isPlaying = false;
        this.timerID = undefined;
        this.lastGrainTime = 0;
        this.currentPointer = 0;
        this.startTime = 0;
        this.relative = false;

        // Ganancia general
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        this.gainNode.gain.value = 1;

        // Analizador opcional
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;
        this.gainNode.connect(this.analyser);
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

        this.buffer = null;
        this.reversedBuffer = null;

        // Parámetros con interpolación tipo Lag
        this.parameters = {
            pointer: { currentValue: 0, targetValue: 0, lagTime: 0.05 },
            freqScale: { currentValue: 1, targetValue: 1, lagTime: 0.05 },
            windowSize: { currentValue: 0.1, targetValue: 0.1, lagTime: 0.05 },
            overlaps: { currentValue: 0.1, targetValue: 0.1, lagTime: 0.0 }, // Sin lag para overlaps
            windowRandRatio: { currentValue: 0.2, targetValue: 0.2, lagTime: 0.05 }
        };

        // Valores internos seguros
        this._pointerValue = 0;
        this._freqScaleValue = 1;
        this._windowSizeValue = 0.1;
        this._windowRandRatioValue = 0.2;
        this._overlapsValue = 0.1;

        this.currentFreqScale = 1;
    }

    load(audioFile) {
        this.buffer = audioFile;
        this.reversedBuffer = this.reverseBuffer(audioFile);
    }

    setParam(paramName, value, lagTime = 0.05) {
        if (!this.parameters[paramName]) return;
        this.parameters[paramName].targetValue = value;
        this.parameters[paramName].lagTime = lagTime;

        // Valores internos inmediatos para parámetros críticos
        if (paramName === 'overlaps') {
            this._overlapsValue = value;
        }
        if (paramName === 'windowSize') this._windowSizeValue = value;
        if (paramName === 'freqScale') this._freqScaleValue = value;
        if (paramName === 'pointer') this._pointerValue = value;
        if (paramName === 'windowRandRatio') this._windowRandRatioValue = value;
    }

    updateParams() {
        for (const key in this.parameters) {
            const param = this.parameters[key];
            if (param.lagTime > 0) {
                const delta = param.targetValue - param.currentValue;
                param.currentValue += delta * Math.min(1, this.audioCtx.sampleRate * param.lagTime * 0.001);
            } else {
                param.currentValue = param.targetValue; // actualizar directamente
            }
        }

        // Actualizar valores internos
        this._pointerValue = this.parameters.pointer.currentValue;
        this._freqScaleValue = this.parameters.freqScale.currentValue;
        this._windowSizeValue = this.parameters.windowSize.currentValue;
        this._windowRandRatioValue = this.parameters.windowRandRatio.currentValue;
        this._overlapsValue = this.parameters.overlaps.currentValue;
    }

    startGrain(time) {
        if (!this.buffer) return;

        const now = this.audioCtx.currentTime;

        // Verificar si es tiempo de iniciar un nuevo grano
        if (now - this.lastGrainTime < this._overlapsValue) return;

        const windowSize = this.clamp(this._windowSizeValue || 0.1, 0.01, this.buffer.duration);
        const windowRandRatio = isFinite(this._windowRandRatioValue) ? this._windowRandRatioValue : 0.2;
        let freqScale = isFinite(this._freqScaleValue) ? this._freqScaleValue : 1;
        const pointerValue = isFinite(this._pointerValue) ? this._pointerValue : 0;

        this.lastGrainTime = now;

        const fadeTime = windowSize * 0.1;

        // Desplazamiento aleatorio del puntero
        const maxShift = windowSize * windowRandRatio;
        const shift = (Math.random() - 0.5) * 2 * maxShift;

        // Modulación relativa de freqScale
        let freqShift = (Math.random() - 0.5) * 0.2 * windowRandRatio;
        if (this.relative) {
            freqScale = this.currentFreqScale || 1;
            freqScale += freqShift;
        } else {
            freqScale += freqShift;
        }
        freqScale = this.clamp(freqScale, 0.1, 4);
        this.currentFreqScale = freqScale;

        // Nodo de ganancia
        const grainGainNode = this.audioCtx.createGain();
        grainGainNode.gain.setValueAtTime(0, now + time);
        grainGainNode.gain.linearRampToValueAtTime(1, now + time + fadeTime);
        grainGainNode.gain.linearRampToValueAtTime(1, now + time + windowSize - fadeTime);
        grainGainNode.gain.linearRampToValueAtTime(0, now + time + windowSize);

        // Source
        const source = this.audioCtx.createBufferSource();
        source.buffer = freqScale < 0 ? this.reversedBuffer : this.buffer;
        source.playbackRate.value = Math.abs(freqScale); // Valor absoluto para evitar problemas

        source.connect(grainGainNode);
        grainGainNode.connect(this.gainNode);

        // Puntero de inicio
        const startPointerBase = this.relative
            ? this.currentPointer
            : map_range(pointerValue, 0, 1, 0, this.buffer.duration);

        const startPointer = (startPointerBase + shift + this.buffer.duration) % this.buffer.duration;

        source.start(now + time, startPointer, windowSize);

        // Actualizar puntero
        this.currentPointer = (startPointer + windowSize * (0.8 + Math.random() * 0.4)) % this.buffer.duration;
        if (this.currentPointer < 0) this.currentPointer += this.buffer.duration;

        source.onended = () => {
            source.disconnect();
            grainGainNode.disconnect();
        };
    }

    scheduler() {
        this.updateParams();
        if (this.futureTickTime < this.audioCtx.currentTime + 0.1) {
            this.schedule(this.futureTickTime - this.audioCtx.currentTime);
            this.playTick();
        }
        this.timerID = setTimeout(this.scheduler.bind(this), 0);
    }

    playTick() {
        // Usar un valor fijo basado en overlaps en lugar de acumular
        this.futureTickTime = this.audioCtx.currentTime + this._overlapsValue;
    }

    schedule(time) {
        this.startGrain(time);
    }

    start() {
        this.futureTickTime = this.audioCtx.currentTime;
        this.startTime = this.audioCtx.currentTime;
        this.currentPointer = this._pointerValue || 0;
        this.isPlaying = true;
        this.scheduler();
    }

    stop() {
        clearTimeout(this.timerID);
        this.isPlaying = false;
        this.futureTickTime = this.audioCtx.currentTime;
        this.lastGrainTime = 0;
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.audioCtx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.05);
    }

    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    getAvgFrequency() {
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray.reduce((sum, value) => sum + value, 0) / this.dataArray.length;
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