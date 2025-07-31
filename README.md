# treslib

Granulación y grabación con WebAudioAPI, buscar y descargar archivos de freesound y detección de onsets. 

## Grain

Granulación tipo Warp1 en SuperCollider. 

Métodos:

- .set(buffer, pointer, freqScale, windowSize, overlaps, windowRandRatio)
- .getPlaybackPosition()
- .load(audioFile)
- .start()
- .stop()

## OnsetDetector 

Es posible detectar onsets o inicios de un evento sonoro. 

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