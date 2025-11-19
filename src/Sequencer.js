/// --- Clase obsoleta, se queda para documentación 

class Sequencer {
  /**
   * @param {Array<number>} sequence - Valores a reproducir en cada paso
   * @param {number} tempo - Tempo en BPM
   * @param {"absolute" | "relative"} mode - Modo de operación
   * @param {number} smoothness - Nivel de suavizado (0 a 1)
   */
  constructor(sequence = [], tempo = 120, mode = "absolute", smoothness = 0.3) {
    this.sequence = sequence;
    this.tempo = tempo;
    this.mode = mode;
    this.smoothness = Math.min(Math.max(smoothness, 0), 1); // Asegurar 0-1
    this.isPlaying = false;
    this.currentStep = 0;
    this.currentValue = 0;
    this.targetValue = 0;
    this.animationFrameId = null;
    this.timeoutId = null;
    this.targetGrainParam = null;
    this.baseValue = 0;
    this.lastUpdateTime = 0;
    this.stepDuration = (60 / this.tempo) * 1000; // Duración por paso en ms
  }

  /**
   * Establece el parámetro objetivo en Grain
   * @param {Grain} grain - Instancia de Grain
   * @param {string} paramName - Nombre del parámetro a controlar
   */
  setTarget(grain, paramName) {
    if (!grain.parameters[paramName]) {
      throw new Error(`El parámetro ${paramName} no existe en Grain`);
    }
    this.targetGrainParam = grain.parameters[paramName];
    this.baseValue = this.targetGrainParam.currentValue;
  }

  setMode(mode) {
    if (mode === "absolute" || mode === "relative") {
      this.mode = mode;
    } else {
      throw new Error("El modo debe ser 'absolute' o 'relative'");
    }
  }

  setSequence(sequence) {
    this.sequence = sequence;
    if (this.isPlaying) {
      this.currentStep = this.currentStep % this.sequence.length;
    }
  }

  setTempo(tempo) {
    this.tempo = tempo;
    this.stepDuration = (60 / this.tempo) * 1000;
    if (this.isPlaying) {
      this.stop();
      this.start();
    }
  }

  setSmoothness(value) {
    this.smoothness = Math.min(Math.max(value, 0), 1);
  }

  /**
   * Inicia la secuencia con interpolación suave
   */
  start() {
    if (!this.sequence.length || !this.targetGrainParam || this.isPlaying) return;

    this.isPlaying = true;
    this.currentStep = 0;
    this.targetValue = this.sequence[0];
    this.currentValue = this.targetGrainParam.currentValue;
    this.lastUpdateTime = performance.now();

    // Función de interpolación usando requestAnimationFrame
    const interpolate = (timestamp) => {
      if (!this.isPlaying) return;

      // Calcular progreso del paso actual
      const elapsed = timestamp - this.lastUpdateTime;
      const progress = Math.min(elapsed / this.stepDuration, 1);

      // Interpolar entre valores actual y objetivo
      const interpolationFactor = this.smoothness * 0.1; // Ajustar velocidad
      this.currentValue += (this.targetValue - this.currentValue) * interpolationFactor;

      // Actualizar parámetro en Grain
      if (this.mode === "absolute") {
        this.targetGrainParam.targetValue = this.currentValue;
      } else {
        this.targetGrainParam.targetValue = this.baseValue + this.currentValue;
      }

      // Cambiar al siguiente paso si se completó el tiempo
      if (progress >= 1) {
        this.currentStep = (this.currentStep + 1) % this.sequence.length;
        this.targetValue = this.sequence[this.currentStep];
        this.lastUpdateTime = timestamp;
      }

      this.animationFrameId = requestAnimationFrame(interpolate);
    };

    this.animationFrameId = requestAnimationFrame(interpolate);
  }

  /**
   * Detiene la secuencia
   */
  stop() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Genera una secuencia aleatoria
   * @param {number} length - Longitud de la secuencia
   * @param {number} min - Valor mínimo
   * @param {number} max - Valor máximo
   */
  generateRandomSequence(length, min, max) {
    this.sequence = Array.from({ length }, () => min + Math.random() * (max - min));
    return this.sequence;
  }

  /**
   * Genera una secuencia lineal
   * @param {number} length - Longitud de la secuencia
   * @param {number} start - Valor inicial
   * @param {number} end - Valor final
   */
  generateLinearSequence(length, start, end) {
    const step = (end - start) / (length - 1);
    this.sequence = Array.from({ length }, (_, i) => start + step * i);
    return this.sequence;
  }
}

export { Sequencer };