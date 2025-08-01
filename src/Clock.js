class Clock {
    constructor(audioCtx, bpm = 120, subdivision = 4) {
      this.audioCtx = audioCtx;
      this.bpm = bpm;
      this.subdivision = subdivision; // ej. negra = 1, corchea = 2, semicorchea = 4
      this.futureTickTime = this.audioCtx.currentTime;
      this.timerID = null;
      this.subscribers = [];
      this.isRunning = false;
    }
  
    get interval() {
      return (60 / this.bpm) / this.subdivision;
    }
  
    subscribe(callback) {
      this.subscribers.push(callback);
    }
  
    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.futureTickTime = this.audioCtx.currentTime;
      this.scheduler();
    }
  
    stop() {
      clearTimeout(this.timerID);
      this.isRunning = false;
    }
  
    scheduler = () => {
      if (this.futureTickTime < this.audioCtx.currentTime + 0.1) {
        // Notificar a todos los secuenciadores
        this.subscribers.forEach(cb => cb(this.futureTickTime));
        this.futureTickTime += this.interval;
      }
      this.timerID = setTimeout(this.scheduler, 0);
    };
  }

  export { Clock };

  