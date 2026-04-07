// GrainSequencer.js - Versión mejorada para nuevo GrainEngine

export class GrainSequencer {
  constructor(audioCtx, bpm = 120, stepsPerBeat = 4) {
      this.audioCtx = audioCtx;

      // Tempo y resolución
      this.bpm = bpm;
      this.stepsPerBeat = stepsPerBeat;

      // Tiempo por step
      this.secondsPerBeat = 60 / this.bpm;
      this.stepDuration = this.secondsPerBeat / this.stepsPerBeat;

      // Estado
      this.isRunning = false;
      this.currentStep = 0;
      this.lastStepTime = 0;
      this.schedulerId = null;
      this.lookAhead = 0.1;

      // Colección de secuencias
      this.sequences = []; 
      
      // Callback opcional para cada step (útil para UI)
      this.onStepChange = null;
  }

  // -----------------------------------------
  // Control de tempo y resolución
  // -----------------------------------------
  setTempo(bpm) {
      this.bpm = bpm;
      this.secondsPerBeat = 60 / this.bpm;
      this.stepDuration = this.secondsPerBeat / this.stepsPerBeat;
  }

  setStepsPerBeat(steps) {
      this.stepsPerBeat = steps;
      this.stepDuration = this.secondsPerBeat / this.stepsPerBeat;
  }

  // -----------------------------------------
  // Añadir secuencia MEJORADO
  // -----------------------------------------
  /**
   * @param {string} paramName - nombre del parámetro del GrainEngine
   * @param {Array<number>} values - secuencia (steps)
   * @param {GrainEngine} grainEngineInstance
   * @param {"absolute"|"relative"} mode
   * @param {Object} options - opciones adicionales
   */
  addSequence(paramName, values, grainEngineInstance, mode = "absolute", options = {}) {
      const sequence = {
          paramName,
          values,
          engine: grainEngineInstance,
          mode,
          length: values.length,
          // Opciones adicionales
          clamp: options.clamp || false,
          min: options.min !== undefined ? options.min : 0,
          max: options.max !== undefined ? options.max : 1
      };
      
      this.sequences.push(sequence);
      return sequence; // Para posible manipulación posterior
  }

  // -----------------------------------------
  // Secuencias especializadas para nuevos parámetros
  // -----------------------------------------
  addPointerSequence(values, grainEngineInstance, mode = "absolute") {
      return this.addSequence("pointer", values, grainEngineInstance, mode, {
          clamp: true,
          min: 0,
          max: 1
      });
  }

  addRateSequence(values, grainEngineInstance, mode = "absolute") {
      return this.addSequence("rate", values, grainEngineInstance, mode, {
          clamp: true,
          min: 0.1
      });
  }

  addAmpSequence(values, grainEngineInstance, mode = "absolute") {
      return this.addSequence("amp", values, grainEngineInstance, mode);
  }

  // -----------------------------------------
  // Remover secuencia
  // -----------------------------------------
  removeSequence(paramName, engineInstance = null) {
      this.sequences = this.sequences.filter(seq => {
          const matchesParam = seq.paramName === paramName;
          const matchesEngine = engineInstance ? seq.engine === engineInstance : true;
          return !(matchesParam && matchesEngine);
      });
  }

  // -----------------------------------------
  // Obtener secuencia actual
  // -----------------------------------------
  getCurrentStepValues() {
      const result = {};
      for (const seq of this.sequences) {
          const stepIndex = this.currentStep % seq.length;
          result[seq.paramName] = seq.values[stepIndex];
      }
      return result;
  }

  // -----------------------------------------
  // Iniciar el secuenciador MEJORADO
  // -----------------------------------------
  start() {
      if (this.isRunning) return;

      this.isRunning = true;
      this.currentStep = 0;
      this.lastStepTime = this.audioCtx.currentTime;

      const scheduleLoop = () => {
          if (!this.isRunning) return;

          const now = this.audioCtx.currentTime;

          while (this.lastStepTime < now + this.lookAhead) {
              this.triggerStep(this.lastStepTime);
              this.lastStepTime += this.stepDuration;
              this.currentStep++;
          }

          this.schedulerId = setTimeout(scheduleLoop, 25);
      };

      this.schedulerId = setTimeout(scheduleLoop, 25);
  }

  // -----------------------------------------
  // Detener MEJORADO
  // -----------------------------------------
  stop() {
      this.isRunning = false;
      if (this.schedulerId) {
          clearTimeout(this.schedulerId);
          this.schedulerId = null;
      }
  }

  // -----------------------------------------
  // Reset
  // -----------------------------------------
  reset() {
      this.currentStep = 0;
      this.lastStepTime = this.audioCtx.currentTime;
  }

  // -----------------------------------------
  // Ejecutar un step MEJORADO
  // -----------------------------------------
  triggerStep(stepTime) {
      const stepValues = {};

      for (const seq of this.sequences) {
          const { paramName, values, engine, mode, length, clamp, min, max } = seq;

          if (!engine || !engine.parameters[paramName]) {
              console.warn(`Secuencia ignorada: engine no válido o parámetro ${paramName} no existe`);
              continue;
          }

          const stepIndex = this.currentStep % length;
          const value = values[stepIndex];

          // Calcular valor final según modo
          let finalValue;
          if (mode === "relative") {
              const currentBase = engine.parameters[paramName].target;
              finalValue = currentBase + value;
          } else {
              finalValue = value;
          }

          // Aplicar clamping si está especificado
          if (clamp) {
              finalValue = Math.max(min, Math.min(max, finalValue));
          }

          // Enviar al engine
          engine.setParamAtTime(paramName, finalValue, stepTime);
          
          // Guardar para callback
          stepValues[paramName] = finalValue;
      }

      // Ejecutar callback si existe
      if (this.onStepChange) {
          this.onStepChange(this.currentStep, stepValues);
      }
  }

  // -----------------------------------------
  // Información del estado
  // -----------------------------------------
  getState() {
      return {
          isRunning: this.isRunning,
          currentStep: this.currentStep,
          bpm: this.bpm,
          stepsPerBeat: this.stepsPerBeat,
          stepDuration: this.stepDuration,
          sequenceCount: this.sequences.length
      };
  }

  // -----------------------------------------
  // Limpieza
  // -----------------------------------------
  dispose() {
      this.stop();
      this.sequences = [];
  }
}