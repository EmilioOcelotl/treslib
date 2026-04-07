// SnapToGrains.js
export class SnapToGrains {
    constructor(audioContext, grainEngine, options = {}) {
        this.audioContext = audioContext;
        this.grainEngine = grainEngine;

        // Estado interno
        this.currentSnapshot = null;
        this.isActive = false;
        this.autoPointerInterval = null;
        this.currentPointer = 0;
        this.targetPointer = 0;
        this.pointerTransitionStart = 0;
        this.pointerTransitionDuration = 0;

        // Parámetros de control
        this.smoothingTime = options.smoothingTime ?? 1.0;
        this.maxRandomPitch = options.maxRandomPitch ?? 0.3;
        this.maxRandomPosition = options.maxRandomPosition ?? 0.01;
        this.pointerTransitionTime = options.pointerTransitionTime ?? 3.0;
        this.transitionCurve = options.transitionCurve ?? 'easeInOut';

        // Análisis de píxeles reales (opcional)
        this.compressor = options.compressor ?? null;

        // Variación aleatoria por paso (±jitter como fracción, ej. 0.06 = ±6%)
        this.jitter = options.jitter ?? 0;

        // Secuencia
        this.pointerSequence = [];
        this.currentSequenceIndex = 0;

        // Callback opcional para UI
        this.onSnapshotApplied = null;
        this.onPointerChange = null;
    }

    // --------------------------
    // Aplicar un snapshot con secuencia automática
    // --------------------------
    applySnapshot(snapshotHex) {
        const analysis = this.analyzeSnapshot(snapshotHex);
        if (!analysis) return;

        this.currentSnapshot = analysis;

        // 1. Generar parámetros base
        const audioParams = this.mapSnapshotToAudioParams(analysis);
        
        // 2. Generar secuencia de pointers basada en el análisis
        this.generatePointerSequence(analysis);
        
        // 3. Aplicar parámetros base
        this.applyToGrainEngine(audioParams);
        
        // 4. Iniciar recorrido automático de pointers con transiciones suaves
        this.startSmoothPointerSequence();

        if (this.onSnapshotApplied) this.onSnapshotApplied(audioParams);
    }

    // --------------------------
    // Generar secuencia de pointers dinámica
    // --------------------------
    generatePointerSequence(analysis) {
        const sequenceLength = 6; // Menos puntos para transiciones más largas
        this.pointerSequence = [];
        
        const brightness = analysis.brightness;
        const complexity = analysis.complexity;
        const contrast = analysis.contrast;

        // Base pattern basado en características del snapshot
        let basePattern = [];
        
        if (complexity > 0.7) {
            basePattern = this.generateComplexPattern(sequenceLength, brightness);
        } else if (contrast > 0.6) {
            basePattern = this.generateContrastPattern(sequenceLength, brightness);
        } else {
            basePattern = this.generateSmoothPattern(sequenceLength, brightness);
        }

        // Suavizar y añadir pequeña variación aleatoria por paso
        const smoothed = this.smoothSequence(basePattern);
        const j = this.jitter * 0.5;
        this.pointerSequence = smoothed.map(
            v => this.clamp(v + (Math.random() * 2 - 1) * j, 0.05, 0.95)
        );
    }

    // Suavizar la secuencia para evitar saltos bruscos
    smoothSequence(sequence) {
        if (sequence.length <= 2) return sequence;
        
        const smoothed = [];
        for (let i = 0; i < sequence.length; i++) {
            let sum = sequence[i];
            let count = 1;
            
            // Promediar con vecinos cercanos
            if (i > 0) { sum += sequence[i-1]; count++; }
            if (i < sequence.length - 1) { sum += sequence[i+1]; count++; }
            
            smoothed.push(sum / count);
        }
        return smoothed;
    }

    generateComplexPattern(length, brightness) {
        const pattern = [];
        for (let i = 0; i < length; i++) {
            const progress = i / (length - 1);
            // Patrón más suave incluso para complejidad
            const wave1 = Math.sin(progress * Math.PI * 1.5) * 0.2;
            const wave2 = Math.cos(progress * Math.PI * 0.8) * 0.15;
            const base = brightness * 0.6 + progress * 0.3;
            
            pattern.push(this.clamp(base + wave1 + wave2, 0.1, 0.9));
        }
        return pattern;
    }

    generateSmoothPattern(length, brightness) {
        const pattern = [];
        for (let i = 0; i < length; i++) {
            const progress = i / (length - 1);
            // Patrón muy suave basado en onda senoidal
            const wave = Math.sin(progress * Math.PI * 2) * 0.15;
            pattern.push(this.clamp(brightness * 0.5 + wave + progress * 0.4, 0.1, 0.9));
        }
        return pattern;
    }

    generateContrastPattern(length, brightness) {
        const pattern = [];
        for (let i = 0; i < length; i++) {
            const progress = i / (length - 1);
            // Contrastes más suaves
            const variation = Math.sin(progress * Math.PI * 3) * 0.25;
            pattern.push(this.clamp(brightness + variation, 0.1, 0.9));
        }
        return pattern;
    }

    // --------------------------
    // Recorrido automático con transiciones suaves
    // --------------------------
    startSmoothPointerSequence() {
        this.stopAutoPointer();
        
        if (this.pointerSequence.length === 0) return;

        this.currentSequenceIndex = 0;
        this.currentPointer = this.pointerSequence[0];
        this.targetPointer = this.pointerSequence[0];
        
        // Iniciar el loop de animación suave
        this.animatePointerTransition();
    }

    animatePointerTransition() {
        if (!this.isActive || this.pointerSequence.length === 0) return;

        const now = this.audioContext.currentTime;
        
        // Si hemos llegado al target, avanzar al siguiente punto
        if (Math.abs(this.currentPointer - this.targetPointer) < 0.001) {
            this.currentSequenceIndex = (this.currentSequenceIndex + 1) % this.pointerSequence.length;
            this.targetPointer = this.pointerSequence[this.currentSequenceIndex];
            this.pointerTransitionStart = now;
            this.pointerTransitionDuration = this.pointerTransitionTime;
        }

        // Calcular progreso de la transición actual
        const elapsed = now - this.pointerTransitionStart;
        const progress = Math.min(elapsed / this.pointerTransitionDuration, 1);
        
        // Aplicar curva de easing para transición suave
        const easedProgress = this.applyEasing(progress, this.transitionCurve);
        
        // Interpolar suavemente entre current y target
        this.currentPointer = this.currentPointer + 
                            (this.targetPointer - this.currentPointer) * 
                            Math.min(easedProgress * 0.1, 0.05); // Cambio muy gradual

        // Aplicar el pointer actualizado
        this.grainEngine.setPointer(this.currentPointer, now);

        // Llamar callback para UI
        if (this.onPointerChange) {
            this.onPointerChange(this.currentPointer);
        }

        // Continuar la animación
        if (this.isActive) {
            requestAnimationFrame(() => this.animatePointerTransition());
        }
    }

    applyEasing(progress, curve) {
        switch (curve) {
            case 'easeInOut':
                return progress < 0.5 
                    ? 2 * progress * progress 
                    : -1 + (4 - 2 * progress) * progress;
            case 'exponential':
                return progress * progress;
            case 'linear':
            default:
                return progress;
        }
    }

    stopAutoPointer() {
        this.currentSequenceIndex = 0;
        this.currentPointer = 0;
        this.targetPointer = 0;
    }

    // --------------------------
    // Análisis del snapshot
    // --------------------------
    analyzeSnapshot(snapshotHex) {
        if (!snapshotHex || snapshotHex.length === 0) return null;

        if (this.compressor) {
            const bytes = this.compressor.hexToBytes(snapshotHex);
            const pixels = this.compressor.decompress2bpp(bytes);
            return this.analyzePixelData(pixels);
        }

        // Fallback: hash de los primeros 20 caracteres
        const hashSum = this.calculateHashSum(snapshotHex);
        return {
            brightness: this.normalizeHash(hashSum * 1.3, 0.1, 0.9),
            contrast: this.normalizeHash(hashSum * 0.7, 0.2, 0.8),
            complexity: this.normalizeHash(hashSum * 1.1, 0.1, 0.7),
            colorDistribution: this.normalizeHash(hashSum * 0.9, 0.1, 0.6)
        };
    }

    // Análisis real sobre el array de píxeles descomprimido (valores 0–3)
    analyzePixelData(pixels) {
        const total = pixels.length;
        if (total === 0) return null;

        // brightness: media normalizada a 0–1 (rango de píxel es 0–3)
        let sum = 0;
        for (let i = 0; i < total; i++) sum += pixels[i];
        const mean = sum / total;
        const brightness = mean / 3;

        // contrast: desviación estándar normalizada (max stddev teórico ≈ 1.5)
        let variance = 0;
        for (let i = 0; i < total; i++) variance += (pixels[i] - mean) ** 2;
        const contrast = this.clamp(Math.sqrt(variance / total) / 1.5, 0, 1);

        // complexity: entropía de Shannon / 2 (máximo = 2 bits para 4 niveles)
        const hist = [0, 0, 0, 0];
        for (let i = 0; i < total; i++) hist[pixels[i]]++;
        let entropy = 0;
        for (let i = 0; i < 4; i++) {
            if (hist[i] > 0) {
                const p = hist[i] / total;
                entropy -= p * Math.log2(p);
            }
        }
        const complexity = entropy / 2;

        // colorDistribution: media de la mitad superior normalizada
        const half = Math.floor(total / 2);
        let topSum = 0;
        for (let i = 0; i < half; i++) topSum += pixels[i];
        const colorDistribution = (topSum / half) / 3;

        return { brightness, contrast, complexity, colorDistribution };
    }

    calculateHashSum(hexString) {
        let sum = 0;
        for (let i = 0; i < Math.min(hexString.length, 20); i++) {
            sum += hexString.charCodeAt(i);
        }
        return (sum % 1000) / 1000;
    }

    normalizeHash(value, min, max) {
        return min + (value * (max - min));
    }

    // --------------------------
    // Mapear análisis a parámetros
    // --------------------------
// SnapToGrains.js - Solo cambia este método
mapSnapshotToAudioParams(analysis) {
    const params = {};

    const brightness = this.validateNumber(analysis.brightness, 0.5);
    const contrast = this.validateNumber(analysis.contrast, 0.5);
    const complexity = this.validateNumber(analysis.complexity, 0.5);
    const colorDistribution = this.validateNumber(analysis.colorDistribution, 0.5);

    // PARÁMETROS CON MÁS VOLUMEN
    params.rate = this.clamp(0.3 + brightness * 1.7, 0.3, 2.0);
    params.amp = this.clamp(0.6 + contrast * 1.2, 0.6, 1.8); // ⬅️ MÁS AMPLITUD
    params.overlaps = Math.floor(this.clamp(4 + complexity * 10, 4, 14)); // ⬅️ MÁS GRANOS
    params.randomPitch = this.clamp(colorDistribution * this.maxRandomPitch, 0, this.maxRandomPitch);
    params.randomPosition = this.clamp(complexity * this.maxRandomPosition, 0, this.maxRandomPosition);

    // BOOST para snapshots oscuros (que suelen tener menos volumen)
    if (brightness < 0.3) {
        params.amp *= 1.5; // ⬅️ 50% más de volumen para oscuros
        params.overlaps += 2; // ⬅️ Más densidad
    }

    // Boost adicional para máxima amplitud
    params.amp = Math.min(params.amp, 2.0); // Permitir hasta 2.0 de amplitud

    return params;
}

    // --------------------------
    // Aplicar parámetros al GrainEngine
    // --------------------------
    applyToGrainEngine(params) {
        const now = this.audioContext.currentTime;
        const fadeTime = this.smoothingTime;

        // Variación aleatoria pequeña por paso (pitch y volumen)
        const j = this.jitter;
        const vary = () => j > 0 ? 1 + (Math.random() * 2 - 1) * j : 1;

        this.grainEngine.setRate(this.clamp(params.rate * vary(), 0.1, 3.0), now + fadeTime);
        this.grainEngine.setAmp(this.clamp(params.amp * vary(), 0.1, 2.5), now + fadeTime);
        this.grainEngine.setOverlaps(params.overlaps, now);
        this.grainEngine.setParamAtTime("randomPitch", params.randomPitch, now + fadeTime);
        this.grainEngine.setParamAtTime("randomPosition", params.randomPosition, now + fadeTime);
    }

    // --------------------------
    // Validación y utilidades
    // --------------------------
    validateNumber(value, defaultValue = 0) {
        if (value === null || value === undefined || !isFinite(value)) return defaultValue;
        return value;
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, this.validateNumber(value, min)));
    }

    // --------------------------
    // Control de estado
    // --------------------------
    start() {
        this.isActive = true;
        if (this.grainEngine) this.grainEngine.start();
        this.startSmoothPointerSequence();
    }

    stop() {
        this.isActive = false;
        if (this.grainEngine) this.grainEngine.stop();
        this.stopAutoPointer();
    }

    getCurrentSnapshot() {
        return this.currentSnapshot;
    }

    getCurrentPointerSequence() {
        return this.pointerSequence;
    }

    getCurrentPointer() {
        return this.currentPointer;
    }

    // Limpieza
    dispose() {
        this.stop();
        this.stopAutoPointer();
    }
}