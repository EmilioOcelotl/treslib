class Sequencer {
  /**
   * @param {Array<number>} sequence - Valores a reproducir en cada paso.
   * @param {number} tempo - Tempo en BPM.
   * @param {"absolute" | "relative"} mode - Cómo aplicar los valores (absoluto o relativo).
   */
  constructor(sequence = [], tempo = 120, mode = "absolute") {
      this.sequence = sequence;
      this.tempo = tempo;
      this.mode = mode;
      this.isPlaying = false;
      this.currentStep = 0;
      this.intervalId = null;
      this.targetGrainParam = null;
      this.baseValue = null; // Almacena el valor base para modo relativo
  }

  /**
   * Apunta a un parámetro de la clase Grain.
   * @param {Grain} grain - instancia de Grain
   * @param {string} paramName - "pointer", "freqScale", "windowSize", "overlaps", "windowRandRatio"
   */
  setTarget(grain, paramName) {
      if (!grain.parameters[paramName]) {
          throw new Error(`El parámetro ${paramName} no existe en Grain`);
      }
      this.targetGrainParam = grain.parameters[paramName];
      this.baseValue = grain.parameters[paramName].currentValue; // Guardar valor inicial
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
      this.currentStep = 0; // Resetear al cambiar secuencia
  }

  setTempo(tempo) {
      this.tempo = tempo;
      if (this.isPlaying) {
          this.stop();
          this.start();
      }
  }

  start() {
      if (!this.sequence.length || !this.targetGrainParam) return;
      
      if (this.isPlaying) {
          this.stop();
      }
      
      this.isPlaying = true;
      this.currentStep = 0;
      const stepDuration = (60 / this.tempo) * 1000; // ms

      this.intervalId = setInterval(() => {
          const value = this.sequence[this.currentStep % this.sequence.length];
          const currentTarget = this.targetGrainParam.targetValue;

          if (this.mode === "absolute") {
              this.targetGrainParam.targetValue = value;
          } else if (this.mode === "relative") {
              // Modo relativo ahora usa el valor base + variación controlada
              const variation = value * 0.1; // Reducir el impacto de la variación
              this.targetGrainParam.targetValue = this.clamp(
                  this.baseValue + variation,
                  this.getMinValue(),
                  this.getMaxValue()
              );
          }

          this.currentStep++;
      }, stepDuration);
  }

  stop() {
      this.isPlaying = false;
      clearInterval(this.intervalId);
      this.intervalId = null;
      // No resetear currentStep para mantener posición al volver a start
  }

  // Métodos auxiliares
  clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
  }

  getMinValue() {
      // Límites inferiores según el parámetro
      if (!this.targetGrainParam) return 0;
      
      const paramName = Object.keys(this.targetGrainParam)[0];
      switch(paramName) {
          case 'freqScale': return 0.1;
          case 'windowSize': return 0.01;
          case 'overlaps': return 0.01;
          case 'windowRandRatio': return 0;
          case 'pointer': return 0;
          default: return 0;
      }
  }

  getMaxValue() {
      // Límites superiores según el parámetro
      if (!this.targetGrainParam) return 1;
      
      const paramName = Object.keys(this.targetGrainParam)[0];
      switch(paramName) {
          case 'freqScale': return 4;
          case 'windowSize': return 2; // Máximo 2 segundos
          case 'overlaps': return 2; // Máximo 2 segundos
          case 'windowRandRatio': return 1;
          case 'pointer': return 1;
          default: return 1;
      }
  }
}

export { Sequencer };