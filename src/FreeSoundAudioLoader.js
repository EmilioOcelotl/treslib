export class FreeSoundAudioLoader {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    async loadAudio(srchURL) {
        return new Promise((resolve, reject) => {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', srchURL + '?format=json&token=' + this.apiKey, true);
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    var jsonResponse = JSON.parse(xhr.responseText);
                    var audioPath = jsonResponse.previews['preview-lq-ogg'];
                    this.downloadAudio(audioPath, resolve, reject);
                } else {
                    reject(`Error: ${xhr.statusText}`);
                }
            };
            xhr.onerror = () => {
                reject('Error de red o CORS');
            };
            xhr.send();
        });
    }

    downloadAudio(audioPath, resolve, reject) {
        const request = new XMLHttpRequest();
        request.open('GET', audioPath, true);
        request.responseType = 'arraybuffer';
        request.onload = () => {
            let audioData = request.response;
            this.audioCtx.decodeAudioData(audioData, (buffer) => {
                resolve(buffer); // Devolver el buffer para usarlo en un reproductor.
            }, (e) => {
                reject("Error with decoding audio data: " + e.error);
            });
        };
        request.onerror = () => {
            reject('Error de red o CORS');
        };
        request.send();
    }
}
