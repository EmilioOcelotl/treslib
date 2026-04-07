export class AudioBufferRecorder {
    constructor(audioContext, micSource, bufferDuration = 5, connectToOutput = false) {
        this.audioContext = audioContext;
        this.micSource = micSource;
        this.bufferDuration = bufferDuration;
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.recording = false;
        this.currentPosition = 0;
        this.bufferSize = 0;
        this.buffer = null;

        this.micSource.connect(this.scriptProcessor);
        if (connectToOutput) {
            this.scriptProcessor.connect(this.audioContext.destination);
        }
        this.scriptProcessor.onaudioprocess = this._processAudio.bind(this);
    }

    startRecording() {
        this.bufferSize = this.audioContext.sampleRate * this.bufferDuration;
        this.buffer = this.audioContext.createBuffer(1, this.bufferSize, this.audioContext.sampleRate);
        this.currentPosition = 0;
        this.recording = true;
    }

    stopRecording() {
        this.recording = false;
    }

    // Cambia la duración del buffer. Tiene efecto en el próximo startRecording().
    setBufferDuration(newDuration) {
        this.bufferDuration = newDuration;
    }

    _processAudio(event) {
        if (!this.recording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const outputData = this.buffer.getChannelData(0);

        for (let i = 0; i < inputData.length; i++) {
            outputData[this.currentPosition] = inputData[i];
            this.currentPosition = (this.currentPosition + 1) % this.bufferSize;
        }
    }

    getRecordedBuffer() {
        return this.buffer;
    }

    clearBuffer() {
        if (!this.bufferSize) return;
        this.currentPosition = 0;
        this.buffer = this.audioContext.createBuffer(1, this.bufferSize, this.audioContext.sampleRate);
    }
}