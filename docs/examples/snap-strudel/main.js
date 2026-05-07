// snap-strudel — Granulación + percusión Strudel desde snapshots 2bpp

import SnapshotCompressor from '../../../src/SnapshotCompressor.js'
import { GrainEngine }    from '../../../src/GrainEngine.js'
import { SnapToGrains }   from '../../../src/SnapToGrains.js'
import { StrudelSync }    from '../../../src/StrudelSync.js'
import { webaudioRepl, initAudio, samples, getAudioContext, evalScope, corePrelude, miniPrelude } from './strudel.bundle.js'

// ─── Constantes ──────────────────────────────────────────────────────────────

const CELLS   = 8
let CPM = 35                   // ~140 BPM en 4/4 — sincronizado con el slider BPM

const J = 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/jungle/'
const JUNGLE = {
  bd:   [J + 'jungle4kick1.wav',   J + 'jungle4kick2.wav'],
  sd:   [J + 'jungle4snare1.wav',  J + 'jungle4snare2.wav'],
  hh:   [J + 'jungle4closedhh.wav'],
  oh:   [J + 'jungle4openhh.wav'],
  cr:   [J + 'jungle4crash.wav'],
  rd:   [J + 'jungle4ride.wav'],
  perc: [J + 'jungle4perc1.wav',   J + 'jungle4perc2.wav'],
  hit:  [J + 'jungle4hit1.wav',    J + 'jungle4hit2.wav',  J + 'jungle4hit3.wav'],
}

// ─── Estado global ────────────────────────────────────────────────────────────

const compressor = new SnapshotCompressor(60, 60)
const snapshots  = new Array(CELLS).fill(null)

// Grain (AudioContext propio, cargado por el usuario)
let audioCtx     = null
let grainEngine  = null
let snapToGrains = null

// Secuenciador
let isPlaying     = false
let currentStep   = 0
let stepInterval  = null
let bpm           = 35

// Modo de recorrido
let isRandomMode  = false
let randomOrder   = Array.from({ length: CELLS }, (_, i) => i)
let randomPointer = 0

// Strudel
let strudelRepl   = null
let strudelInited = false
let strudelSync   = null   // gestiona ciclo-alineación de variantes

// ─── Presets visuales ────────────────────────────────────────────────────────
// Mismos 8 presets que snap-sequencer — variedad de brightness y complexity

const PRESET_FNS = [
  // 0 — Degradado radial (brillo al centro)
  (ctx, w, h) => {
    const g = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2)
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#000')
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
  },
  // 1 — Sólido muy oscuro → DARK_SPARSE (2bpp nivel 0, brightness≈0, complexity≈0)
  (ctx, w, h) => {
    ctx.fillStyle = '#0e0e0e'; ctx.fillRect(0, 0, w, h)
  },
  // 2 — Gris medio sólido → MID (brightness≈0.42, complexity≈0.40)
  (ctx, w, h) => {
    ctx.fillStyle = '#707070'; ctx.fillRect(0, 0, w, h)
  },
  // 3 — Ruido por píxel (alta complexity)
  (ctx, w, h) => {
    const id = ctx.createImageData(w, h)
    for (let i = 0; i < id.data.length; i += 4) {
      const v = Math.floor(Math.random() * 256)
      id.data[i] = id.data[i+1] = id.data[i+2] = v; id.data[i+3] = 255
    }
    ctx.putImageData(id, 0, 0)
  },
  // 4 — Sólido gris muy oscuro → DARK_SPARSE (2bpp nivel 0, brightness≈0, complexity≈0)
  (ctx, w, h) => {
    ctx.fillStyle = '#181818'; ctx.fillRect(0, 0, w, h)
  },
  // 5 — Sólido gris oscuro → DARK_SPARSE (2bpp nivel 0, brightness≈0, complexity≈0)
  (ctx, w, h) => {
    ctx.fillStyle = '#252525'; ctx.fillRect(0, 0, w, h)
  },
  // 6 — Círculos grandes dispersos
  (ctx, w, h) => {
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
    [[0,0],[1,0],[0,1],[1,1]].forEach(([c, r], i) => {
      const cx = (c + 0.5) * (w / 2), cy = (r + 0.5) * (h / 2)
      ctx.beginPath(); ctx.arc(cx, cy, w / 4 * 0.75, 0, Math.PI * 2)
      ctx.fillStyle = `hsl(0,0%,${35 + i * 15}%)`; ctx.fill()
    })
  },
  // 7 — Ruido en bloques 8×8
  (ctx, w, h) => {
    const bw = w / 8, bh = h / 8
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const v = Math.floor(Math.random() * 256)
      ctx.fillStyle = `rgb(${v},${v},${v})`
      ctx.fillRect(c * bw, r * bh, bw, bh)
    }
  },
]

// ─── Mosaico ──────────────────────────────────────────────────────────────────

function initMosaic() {
  const container = document.getElementById('mosaic')
  for (let i = 0; i < CELLS; i++) {
    const offCanvas = document.createElement('canvas')
    offCanvas.width = offCanvas.height = 300
    PRESET_FNS[i](offCanvas.getContext('2d'), 300, 300)
    snapshots[i] = compressor.captureHydraFrame(offCanvas)

    const cell = document.createElement('div')
    cell.className = 'cell'
    cell.dataset.index = i

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 60
    compressor.renderToCanvas(snapshots[i], canvas)

    const label = document.createElement('div')
    label.className = 'cell-label'
    label.textContent = i + 1

    cell.appendChild(canvas)
    cell.appendChild(label)
    container.appendChild(cell)
  }
}

// ─── Patrones de percusión ────────────────────────────────────────────────────
// Tres variantes en función de brightness y complexity.
// Cada variante tiene alternancia interna con < > para no repetir exacto.
// Los índices drumtraks: 0=Cabasa 1=Claps 2=Cowbell 3=Crash 4=HatClosed
//   5=HatOpen 6=Kick 7=Ride 8=Rimshot 9=Snare 10=Tambourine 11=Tom1 12=Tom2

const PATTERN = {
  // Mitad de velocidad — kick escaso, snare mínimo, hh suave
  DARK_SPARSE: `stack(
    s(mini("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~")),
    s(mini("~ ~ ~ ~ sd:1 ~ ~ ~ ~ ~ ~ ~ ~ ~ sd:1 ~")),
    s(mini("hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~")).gain(0.15)
  )`,
  // Velocidad normal — base amen + perc
  MID: `stack(
    s(mini("bd ~ bd ~ ~ ~ ~ ~ ~ ~ bd bd ~ ~ ~ ~")),
    s(mini("~ ~ ~ ~ sd:1 ~ ~ ~ ~ ~ sd:1 ~ ~ ~ sd:1 ~")),
    s(mini("hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~")).gain(0.15),
    s(mini("~ ~ ~ ~ ~ ~ ~ ~ perc ~ ~ ~ ~ ~ perc ~")).gain(0.35)
  )`,
  // 16 pasos densos — mismo grid que MID, primer ciclo suave, luego dos variantes
  BRIGHT_DENSE: `stack(
    s(mini("<[bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [bd ~ bd ~ bd ~ ~ bd bd ~ ~ bd ~ bd ~ ~] [bd ~ bd bd ~ ~ bd ~ bd ~ ~ bd bd ~ ~ bd]>")),
    s(mini("<[~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ ~ sd:1 ~ ~ ~ ~ ~ sd:1 ~ ~ sd:1 ~ ~] [~ ~ ~ ~ sd:1 ~ sd:1 ~ ~ ~ sd:1 ~ ~ ~ sd:1 sd:1]>")),
    s(mini("hh*16")).gain(0.10),
    s(mini("~ oh ~ ~ ~ ~ oh ~ ~ oh ~ ~ ~ oh ~ ~")).gain(0.22),
    s(mini("<[~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [~ perc ~ ~ perc ~ ~ ~ perc ~ ~ perc ~ ~ ~ ~] [perc ~ ~ perc ~ perc ~ ~ ~ perc ~ ~ perc ~ perc ~]>")).gain(0.30),
    s(mini("~ ~ ~ hit ~ ~ ~ ~ ~ hit ~ ~ ~ ~ hit ~")).mask(mini("<0 1 1>/3")).gain(0.5)
  )`,
}

function selectVariant(brightness, complexity) {
  if (brightness < 0.35 && complexity < 0.4) return 'DARK_SPARSE'
  if (brightness > 0.65 || complexity > 0.6)  return 'BRIGHT_DENSE'
  return 'MID'
}

// ─── Strudel ──────────────────────────────────────────────────────────────────

async function initStrudel() {
  if (strudelInited) return
  try {
    await initAudio()
    await evalScope(corePrelude, miniPrelude)
    await samples(JUNGLE)
    strudelRepl  = webaudioRepl()
    strudelSync  = new StrudelSync(strudelRepl, getAudioContext, {
      getCPM:     () => CPM,
      patterns:   PATTERN,
      patternCPM: { DARK_SPARSE: cpm => cpm / 2 },
      gain:       2,
    })
    strudelInited = true
    console.log('[strudel] listo')
  } catch (err) {
    console.error('[strudel] error al inicializar:', err)
  }
}

// ─── Indicador visual de variante ────────────────────────────────────────────

const VARIANT_CLASSES = { DARK_SPARSE: 'dark', MID: 'mid', BRIGHT_DENSE: 'dense' }

function updatePercIndicator() {
  const el = document.getElementById('percIndicator')
  if (!el) return
  el.className = 'perc-indicator'
  const cur = strudelSync?.currentVariant ?? null
  const pen = strudelSync?.pendingVariant  ?? null
  if (!cur && !pen) {
    el.textContent = 'PERC —'
    return
  }
  const v = pen || cur
  el.classList.add(VARIANT_CLASSES[v] ?? '')
  if (pen) el.classList.add('pending')
  el.textContent = `PERC ${v.replace('_', ' ')}`
}

// ─── Carga de audio (grain) ───────────────────────────────────────────────────

document.getElementById('loadBtn').addEventListener('click', async () => {
  const file = document.getElementById('audioFile').files[0]
  if (!file) { setStatus('Selecciona un archivo primero'); return }
  try {
    setStatus('Cargando...')
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') await audioCtx.resume()

    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

    grainEngine = new GrainEngine(audioCtx, audioBuffer, {
      pointer: 0, rate: 1, overlaps: 4, windowSize: 0.1, masterAmp: 0.7,
    })
    grainEngine.connect(audioCtx.destination)

    snapToGrains = new SnapToGrains(audioCtx, grainEngine, {
      compressor,
      smoothingTime: 0.3,
      jitter: 0.06,
      pointerTransitionTime: stepDuration() * 0.85,
    })

    document.getElementById('playBtn').disabled = false
    setStatus(`"${file.name}" — ${audioBuffer.duration.toFixed(2)}s`)
  } catch (err) {
    setStatus('Error al cargar: ' + err.message)
  }
})

// ─── Play / Stop ──────────────────────────────────────────────────────────────

document.getElementById('playBtn').addEventListener('click', () => {
  if (!grainEngine || !snapToGrains) return
  isPlaying ? stopSequencer() : startSequencer()
})

function shuffleOrder() {
  for (let i = CELLS - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[randomOrder[i], randomOrder[j]] = [randomOrder[j], randomOrder[i]]
  }
}

async function startSequencer() {
  isPlaying     = true
  randomPointer = 0
  if (isRandomMode) { shuffleOrder(); currentStep = randomOrder[0] }
  else              { currentStep = 0 }

  if (audioCtx.state === 'suspended') audioCtx.resume()
  snapToGrains.start()

  // Inicializar Strudel en el primer gesto del usuario
  await initStrudel()

  tick()
  stepInterval = setInterval(tick, stepDuration() * 1000)

  document.getElementById('playBtn').textContent = 'Detener'
  document.getElementById('playBtn').classList.add('active')
}

function stopSequencer() {
  isPlaying = false
  clearInterval(stepInterval)
  stepInterval = null
  snapToGrains.stop()
  strudelSync?.stop()
  updatePercIndicator()
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'))
  document.getElementById('playBtn').textContent = 'Iniciar'
  document.getElementById('playBtn').classList.remove('active')
  setStatus('Detenido')
}

function tick() {
  // Resaltar celda activa
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('active'))
  document.querySelector(`.cell[data-index="${currentStep}"]`).classList.add('active')

  // Aplicar snapshot al grain engine
  snapToGrains.applySnapshot(snapshots[currentStep])

  // Solicitar variante de percusión según análisis del snapshot actual
  const snap = snapToGrains.getCurrentSnapshot()
  if (snap && strudelInited) {
    strudelSync.request(selectVariant(snap.brightness, snap.complexity))
    updatePercIndicator()
    setStatus(
      `Paso ${currentStep + 1}/${CELLS} · ` +
      `brillo ${snap.brightness.toFixed(2)} · ` +
      `complejidad ${snap.complexity.toFixed(2)} · ` +
      `variante: ${strudelSync.pendingVariant ? strudelSync.pendingVariant + '→' : ''}${strudelSync.currentVariant ?? '—'}`
    )
  } else if (snap) {
    setStatus(
      `Paso ${currentStep + 1}/${CELLS} · ` +
      `brillo ${snap.brightness.toFixed(2)} · ` +
      `complejidad ${snap.complexity.toFixed(2)}`
    )
  }

  if (isRandomMode) {
    randomPointer = (randomPointer + 1) % CELLS
    if (randomPointer === 0) shuffleOrder()
    currentStep = randomOrder[randomPointer]
  } else {
    currentStep = (currentStep + 1) % CELLS
  }
}

// ─── BPM ──────────────────────────────────────────────────────────────────────

document.getElementById('bpm').addEventListener('input', function () {
  bpm = parseInt(this.value)
  CPM = bpm
  document.getElementById('bpmVal').textContent = bpm

  if (snapToGrains) snapToGrains.pointerTransitionTime = stepDuration() * 0.85

  if (isPlaying) {
    clearInterval(stepInterval)
    stepInterval = setInterval(tick, stepDuration() * 1000)
    if (strudelInited) strudelSync.reapply()
  }
})

document.getElementById('modeBtn').addEventListener('click', function () {
  isRandomMode = !isRandomMode
  if (isRandomMode) { shuffleOrder(); randomPointer = 0 }
  this.textContent = isRandomMode ? 'Orden: aleatorio' : 'Orden: secuencial'
  this.classList.toggle('active', isRandomMode)
})

function stepDuration() {
  return 60 / bpm
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function setStatus(msg) {
  document.getElementById('status').textContent = msg
}

// ─── Arranque ────────────────────────────────────────────────────────────────

initMosaic()
