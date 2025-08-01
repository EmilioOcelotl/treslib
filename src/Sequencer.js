class Sequencer {
    constructor(sequence = [], callback = (val, time) => {}) {
      this.sequence = sequence;
      this.callback = callback;
      this.index = 0;
    }
  
    trigger(time) {
      const val = this.sequence[this.index % this.sequence.length];
      if (val !== null && val !== 0) {
        this.callback(val, time);
      }
      this.index++;
    }
  
    setSequence(newSeq) {
      this.sequence = newSeq;
      this.index = 0; // opcional: reiniciar desde el inicio
    }
  }

  export { Sequencer };

  