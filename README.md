# treslib

Esta librería proporciona un conjunto de clases diseñadas para controlar el tiempo y la manipulación de audio en proyectos creativos con JavaScript, especialmente en entornos que utilizan Web Audio API. Ideal para arte generativo, música algorítmica, instalaciones interactivas y análisis sonoro.

## Grain

Clase que permite ejecutar síntesis granular en el navegador utilizando Web Audio API. Reproduce pequeños fragmentos (granos) de un AudioBuffer, permitiendo manipulación en tiempo, escala, posición, reversa, solapamiento y ventanas. La clase tiene como referente Warp1 de SuperCollider. 

```
new Grain(audioContext)
```
### Métodos

- set(buffer, pointer, freqScale, windowSize, overlaps, windowRandRatio) Configura los parámetros de síntesis granular.

```
grain.set(audioBuffer, 0.5, 1, 0.1, 0.05, 0.2);
```

- load(audioBuffer) Carga el buffer de audio y prepara una versión invertida para reproducción en reversa.

```
grain.load(myAudioBuffer);
```
- start() Inicia el motor de síntesis granular, generando granos en bucle.

```
grain.start();
```

- stop() Detiene la reproducción de granos y aplica un pequeño fundido para evitar clicks.

```
grain.stop();
```

- startGrain(time) Crea y programa un grano individual en el audioCtx.currentTime + time.

```
grain.startGrain(0.1);
``` 

- getPlaybackPosition() Devuelve la posición actual normalizada (0–1) del buffer según el pointer y freqScale.

```
const pos = grain.getPlaybackPosition();
```

- getAvgFrequency() Retorna un valor promedio del espectro de frecuencias, útil para visualizaciones o análisis.

```
const avg = grain.getAvgFrequency();
```

- reverseBuffer(buffer) Devuelve una versión invertida del buffer original, canal por canal.

### Ejemplo

```
import { Grain } from './Grain.js';
import { map_range } from './utils.js';

const ctx = new AudioContext();
const grain = new Grain(ctx);

// Cargar buffer, luego configurar
grain.load(audioBuffer);
grain.set(audioBuffer, 0.25, 1.2, 0.08, 0.05, 0.15);

grain.start();
```

## OnsetDetector 

Adaptación del algoritmo de Nick Collins para detección de onsets en audio, utilizando 40 bandas ERB y modelado de loudness espectral. Implementado en JavaScript para su uso en navegadores con Web Audio API.

```
new OnsetDetector(audioContext, audioBuffer, threshold = 0.01)
```

### Métodos


- start(callback) Inicia el análisis de onsets en el buffer de audio. Llama al callback cada vez que se detecta un onset, pasando la intensidad del evento detectado.

```
detector.start((flux) => {
  console.log("Onset detectado con intensidad:", flux);
});
```

- stop() Detiene el análisis de audio y la reproducción del buffer.

```
detector.stop();
```

## Clock

Clase que implementa un reloj maestro basado en AudioContext, útil para sincronizar múltiples eventos sonoros o visuales con alta precisión temporal.


```
const clock = new Clock(audioContext, bpm = 120, subdivision = 4);
```
### Métodos

- start() Inicia el reloj. Empieza a emitir ticks según el tempo y la subdivisión.

- stop() Detiene el reloj y cancela la programación de ticks futuros.

- subscribe(callback) Suscribe una función que se ejecutará en cada tick.

## Sequencer

Clase que representa una secuencia de valores. Cada vez que recibe un tick, ejecuta un valor de la secuencia usando una función callback.

```
const sequencer = new Sequencer(sequence = [], callback = (val, time) => {});
```
### Métodos

- trigger(time) Ejecuta el paso actual de la secuencia (si corresponde) en el tiempo especificado, y avanza al siguiente índice.

```
sequencer.trigger(audioCtx.currentTime + 0.05);
```

- setSequence(newSequence) Reemplaza la secuencia actual con una nueva.

```
sequencer.setSequence([1, 0, 0.5, null, 1]);
```

### Ejemplo Clock + Sequencer

```
import { Clock } from './Clock.js';
import { Sequencer } from './Sequencer.js';

const audioCtx = new AudioContext();
const clock = new Clock(audioCtx, 90, 4);

const seq = new Sequencer(
  [1, 0, 0.5, 0],
  (val, time) => {
    console.log("Evento:", val, "en", time);
  }
);

clock.subscribe(time => {
  seq.trigger(time);
});

clock.start();
```

## AudioBufferRecorder

Para grabar la entrada de sonido desde el navegador.

## FreeSoundSearcher

Para hacer búsquedas en freesound y obtener información

## FreeSoundLoader

Para cargar aleatoriamente muestras de un archivo buscado en freesound

## GLoop (no mantenido)

Para secuenciar valores de Grain en el tiempo.

## Player (no mantenido)

Para programar la reproducción de una muestra de sonido con valores temporales cercanos a la música. 

## Referencias

- Collins, N. (2005). "A Comparison of Sound Onset Detection Algorithms with Emphasis on Psychoacoustically Motivated Detection Functions". Proceedings of the AES 118th Convention. Barcelona, España.

- https://doc.sccode.org/Classes/Warp1.html