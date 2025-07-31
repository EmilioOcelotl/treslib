class OnsetDetector {
    constructor(audioContext, buffer) {
        this.audioCtx = audioContext;
        this.buffer = buffer;
        this.analyser = audioContext.createAnalyser();
        this.analyser.fftSize = 1024; // Reduce si hay lag
        this.scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
        this.threshold = 0.3; // Ajusta según necesidad
        this.lastSpectrum = new Uint8Array(this.analyser.frequencyBinCount); // ← Inicializado
        this.onsetCallback = null;
        this.maxFlux = 0.0001;
    }

    start(callback) {
        this.onsetCallback = callback;
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.buffer;

        source.connect(this.analyser);
        this.analyser.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioCtx.destination);

        this.scriptProcessor.onaudioprocess = () => {
            const spectrum = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(spectrum); // ← Datos en 0-255

            const flux = this._calculateSpectralFlux(spectrum, this.lastSpectrum);
            if (flux > this.threshold && this.onsetCallback) {
                this.onsetCallback(flux);
            }

            this.lastSpectrum = spectrum.slice(); // Guarda copia
        };

        source.start();
    }

    _calculateSpectralFlux(currentSpectrum, previousSpectrum) {
        let flux = 0;
        for (let i = 0; i < currentSpectrum.length; i++) {
            const diff = currentSpectrum[i] - previousSpectrum[i];
            if (diff > 0) flux += diff * diff;
        }
        flux = Math.sqrt(flux);

        // Actualiza el máximo histórico
        if (flux > this.maxFlux) this.maxFlux = flux;

        // Normaliza: flux / maxFlux (rango 0-1)
        const normalizedFlux = flux / this.maxFlux;
        return normalizedFlux;
    }
}


export { OnsetDetector };