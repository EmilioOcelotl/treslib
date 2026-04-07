// GrainEngine.js - Versión corregida del pool de recursos

export class GrainEngine {
  constructor(audioCtx, audioBuffer, params = {}) {
      this.audioCtx = audioCtx;
      this.buffer = audioBuffer;

      // Nodo de salida principal con control maestro de amplitud
      this.output = this.audioCtx.createGain();
      this.masterAmp = this.audioCtx.createGain();
      this.masterAmp.connect(this.output);
      this.masterAmp.gain.value = params.masterAmp !== undefined ? params.masterAmp : 1.0;

      // Pools para mejor rendimiento - SOLO para nodos de ganancia
      this.gainPool = [];
      this.activeGrains = new Set();

      // Parámetros granulares MEJORADOS
      this.parameters = {
          // Parámetro pointer MEJORADO para control externo
          pointer:       { 
              current: params.pointer ?? 0,       
              target: params.pointer ?? 0,       
              time: 0,
              min: 0,
              max: 1
          },
          
          // Parámetros warp1 esenciales
          rate:          { current: params.rate ?? 1,        target: params.rate ?? 1,        time: 0 },
          overlaps:      { current: params.overlaps ?? 8,    target: params.overlaps ?? 8,    time: 0 },
          
          // Parámetros existentes
          freqScale:     { current: params.freqScale ?? 1,   target: params.freqScale ?? 1,   time: 0 },
          windowSize:    { current: params.windowSize ?? 0.1, target: params.windowSize ?? 0.1, time: 0 },
          overlap:       { current: params.overlap ?? 0.05,  target: params.overlap ?? 0.05,  time: 0 },
          amp:           { current: params.amp ?? 1.0,       target: params.amp ?? 1.0,       time: 0 },

          // Jitter
          randomPosition: { current: params.randomPosition ?? 0, target: params.randomPosition ?? 0, time: 0 },
          randomPitch:    { current: params.randomPitch ?? 0,    target: params.randomPitch ?? 0,    time: 0 }
      };

      // Constantes
      this.maxPositionOffset = 0.02;
      this.lookAhead = 0.1;
      this.smoothingTime = 0.05;
      
      // Scheduler state
      this.lastGrainTime = 0;
      this.isRunning = false;
      this.schedulerId = null;

      // Callback para cambios de pointer (opcional, para UI)
      this.onPointerChange = null;
  }

  // --------------------------
  // Conexión
  // --------------------------
  connect(dest) {
      this.output.connect(dest);
  }

  // --------------------------
  // CONTROL MAESTRO DE AMPLITUD
  // --------------------------
  setMasterAmp(value, time = this.audioCtx.currentTime) {
      if (time === this.audioCtx.currentTime) {
          this.masterAmp.gain.value = value;
      } else {
          this.masterAmp.gain.setValueAtTime(value, time);
      }
  }

  getMasterAmp() {
      return this.masterAmp.gain.value;
  }

  // --------------------------
  // CONTROL DE POINTER MEJORADO
  // --------------------------
  setPointer(value, time = this.audioCtx.currentTime) {
      // Clampear entre 0 y 1
      const clampedValue = Math.max(0, Math.min(1, value));
      
      this.setParamAtTime("pointer", clampedValue, time);
      
      // Notificar cambio si hay callback
      if (this.onPointerChange) {
          this.onPointerChange(clampedValue);
      }
  }

  getPointer() {
      return this.parameters.pointer.target;
  }

  // --------------------------
  // NUEVOS PARÁMETROS WARP1
  // --------------------------
  setRate(value, time = this.audioCtx.currentTime) {
      this.setParamAtTime("rate", value, time);
  }

  setOverlaps(value, time = this.audioCtx.currentTime) {
      this.setParamAtTime("overlaps", Math.max(1, value), time); // Mínimo 1 overlap
  }

  // --------------------------
  // Parámetros existentes
  // --------------------------
  setParamAtTime(paramName, value, time = this.audioCtx.currentTime) {
      if (!this.parameters[paramName]) {
          console.warn(`Parámetro no encontrado: ${paramName}`);
          return;
      }

      this.parameters[paramName].target = value;
      this.parameters[paramName].time = time;
  }

  setWindowSizeAtTime(value, time = this.audioCtx.currentTime) {
      this.setParamAtTime("windowSize", value, time);
  }

  setOverlapAtTime(value, time = this.audioCtx.currentTime) {
      this.setParamAtTime("overlap", value, time);
  }

  setAmp(value, time = this.audioCtx.currentTime) {
      this.setParamAtTime("amp", value, time);
  }

  // --------------------------
  // Obtener valores actuales
  // --------------------------
  getParam(paramName) {
      return this.parameters[paramName]?.target ?? 0;
  }

  // --------------------------
  // Interpolación
  // --------------------------
  interpolateParam(param, now) {
      const p = this.parameters[param];
      if (!p) return 0;

      const dt = Math.max(now - p.time, 0);
      const smoothing = this.smoothingTime;

      if (dt >= smoothing) {
          p.current = p.target;
      } else {
          const t = dt / smoothing;
          p.current = p.current + (p.target - p.current) * t;
      }

      return p.current;
  }

  // --------------------------
  // Scheduler MEJORADO con rate y overlaps
  // --------------------------
  start() {
      if (this.isRunning) return;

      this.isRunning = true;
      this.lastGrainTime = this.audioCtx.currentTime;

      const scheduleLoop = () => {
          if (!this.isRunning) return;

          const now = this.audioCtx.currentTime;
          
          // Densidad controlada solo por overlaps y windowSize (rate solo afecta pitch, como en Warp1)
          const overlaps = this.interpolateParam("overlaps", now);
          const windowSize = this.interpolateParam("windowSize", now);

          const grainInterval = windowSize / overlaps;
          
          // Programar granos en el look-ahead window
          while (this.lastGrainTime < now + this.lookAhead) {
              this.scheduleGrain(this.lastGrainTime);
              this.lastGrainTime += grainInterval;
          }

          this.schedulerId = setTimeout(scheduleLoop, 25);
      };

      this.schedulerId = setTimeout(scheduleLoop, 25);
  }

  stop() {
      this.isRunning = false;
      if (this.schedulerId) {
          clearTimeout(this.schedulerId);
          this.schedulerId = null;
      }
      
      // Detener todos los granos activos
      this.stopAllGrains();
  }

  // --------------------------
  // Grain scheduling MEJORADO
  // --------------------------
  scheduleGrain(time) {
      const now = this.audioCtx.currentTime;

      // Interpolación de todos los parámetros
      const pointer = this.interpolateParam("pointer", now);
      const rate = this.interpolateParam("rate", now);
      const freqScale = this.interpolateParam("freqScale", now);
      const windowSize = this.interpolateParam("windowSize", now);
      const amp = this.interpolateParam("amp", now);
      const randomPosition = this.interpolateParam("randomPosition", now);
      const randomPitch = this.interpolateParam("randomPitch", now);

      // Posición base + jitter
      let grainPosition = pointer;
      if (randomPosition > 0) {
          const jitterAmount = (Math.random() * 2 - 1) * randomPosition * this.maxPositionOffset;
          grainPosition += jitterAmount;
      }
      grainPosition = Math.min(1, Math.max(0, grainPosition));

      // Tiempo de inicio en el buffer
      const startOffset = grainPosition * this.buffer.duration;

      // Pitch con jitter
      let playbackRate = freqScale * rate; // Combinar freqScale y rate
      if (randomPitch > 0) {
          const pitchJitter = (Math.random() * 2 - 1) * randomPitch * 0.5;
          playbackRate *= (1 + pitchJitter);
      }

      // Crear y programar grano
      this.createGrain(time, startOffset, windowSize, playbackRate, amp);
  }

  // --------------------------
  // Creación de grano CORREGIDA - SIN POOL PARA SOURCES
  // --------------------------
  createGrain(startTime, bufferOffset, duration, playbackRate, amp) {
      // Crear NUEVO source node cada vez (no reutilizar)
      const source = this.audioCtx.createBufferSource();
      source.buffer = this.buffer; // Asignar buffer una sola vez
      
      // Reutilizar solo gain nodes
      const gainNode = this.getGainFromPool();

      source.playbackRate.value = playbackRate;
      
      // Conectar: source → gainNode → masterAmp → output
      source.connect(gainNode);
      gainNode.connect(this.masterAmp);

      // Aplicar envolvente y amplitud
      this.applyGrainEnvelope(gainNode, startTime, duration, amp);

      // Programar inicio y fin
      source.start(startTime, bufferOffset, duration);
      
      // No necesitamos source.stop() si usamos duration en start()

      // Registrar grano activo
      const grainId = `${startTime}-${Math.random()}`;
      this.activeGrains.add(grainId);

      // Cleanup automático
      source.onended = () => {
          source.disconnect();
          gainNode.disconnect();
          this.returnGainToPool(gainNode);
          this.activeGrains.delete(grainId);
      };
  }

  // --------------------------
  // Pool de recursos - SOLO para gain nodes
  // --------------------------
  getGainFromPool() {
      if (this.gainPool.length > 0) {
          return this.gainPool.pop();
      }
      return this.audioCtx.createGain();
  }

  returnGainToPool(gainNode) {
      gainNode.gain.cancelScheduledValues(0);
      this.gainPool.push(gainNode);
  }

  // --------------------------
  // Detener granos activos
  // --------------------------
  stopAllGrains() {
      // Los granos se detendrán automáticamente cuando llegue su tiempo
      this.activeGrains.clear();
  }

  // --------------------------
  // Envolvente del grano
  // --------------------------
  applyGrainEnvelope(gainNode, startTime, duration, amp) {
      const attack = duration * 0.5;
      const release = duration * 0.5;

      gainNode.gain.cancelScheduledValues(0);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(amp, startTime + attack);
      gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  }

  // --------------------------
  // Limpieza
  // --------------------------
  dispose() {
      this.stop();
      this.stopAllGrains();
      this.masterAmp.disconnect();
      this.output.disconnect();
      
      // Limpiar pool
      this.gainPool = [];
  }
}