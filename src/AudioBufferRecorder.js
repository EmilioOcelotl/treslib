export class AudioBufferRecorder {
    constructor(audioContext, micSource, bufferDuration = 5) {
        this.audioContext = audioContext;
        this.micSource = micSource;
        this.bufferDuration = bufferDuration;
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.recording = false;
        this.currentPosition = 0;

        this.buffer = null;

        this.micSource.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
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

    setBufferDuration(newDuration) {
        this.bufferDuration = newDuration;
    }

    _processAudio(event) {
        if (!this.recording) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const outputData = this.buffer.getChannelData(0);

        for (let i = 0; i < inputData.length; i++) {
            if (this.currentPosition < this.bufferSize) {
                outputData[this.currentPosition++] = inputData[i];
            } else {
                // Si el buffer se llena, sobrescribimos
                this.currentPosition = 0;
            }
        }
    }

    getRecordedBuffer() {
        return this.buffer;
    }

    clearBuffer() {
        this.currentPosition = 0;
        this.buffer = this.audioContext.createBuffer(1, this.bufferSize, this.audioContext.sampleRate);
    }
}