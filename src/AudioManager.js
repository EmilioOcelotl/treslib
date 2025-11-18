// web/audio/AudioManager.js
// AudioManager — Ambient / dark / spatial / slightly scary aesthetic
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.isInitialized = false;

    // Nodo maestro / bus
    this.masterGain = null;
    this.masterCompressor = null;
    this.masterPanner = null;
    this.reverbConvolver = null;

    // Ambient (drone) state
    this.ambient = null;
    this.isAmbientPlaying = false;

    // Processing (motor) state
    this.processingStartTime = 0;
    this.processingActive = false;
    this.processingTimer = null;

    // Settings (feel free to ajustar)
    this.settings = {
      master: {
        volume: 1,
        stereoWidth: 0.6
      },
      ambient: {
        volume: 0.51,
        baseFreq: 55.0,     // sub / low drone base
        detuneCents: [0, 6, -7], // multiple oscillators detuned in cents
        bandpassCenter: 200, // resonant band that gives 'body'
        bandpassQ: 6,
        lfoRate: 0.02,      // very slow breathing
        lfoAmountHz: 120,    // amount to move the bandpass center
        reverbTime: 4.5,    // long tail
        noiseLevel: 0.3,
        subtleRandomEvents: 0.75 // chance per minute of a small event
      },
      success: {
        volume: 0.78,
        duration: 8.0,
        bloomFreqs: [55, 220], // quinta / cuarto ambigua
        combDelayMs: 40,
        combFeedback: 0.35,
        reverbMix: 0.6
      },
      error: {
        volume: 0.26,
        duration: 1.6,
        descStart: 600,
        descEnd: 120,
        subGain: 0.08,
        metallicNoise: 0.18
      },
      processing: {
        volume: 0.54,
        basePulseFreq: 1.0,  // Hz initial pulse
        minPulse: 0.25,      // faster cap (s)
        maxPulse: 1.2,       // slower start (s)
        accelTime: 6.0       // seconds to accelerate
      },
      transition: {
        volume: 0.52,
        duration: 1.6,
        sweepLow: 20,
        sweepHigh: 200
      }
    };

    // init lazily (wait for user gesture)
    this.init();
  }

  async init() {
    if (this.isInitialized) return;

    // Intentar inicializar automáticamente
    try {
        this.initAudioContext();
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        console.log('AudioManager: AudioContext iniciado automáticamente');
    } catch (e) {
        console.warn('AudioManager: fallo auto-init, se requiere gesto del usuario', e);
    }
}

  initAudioContext() {
    if (this.audioContext) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.audioContext = ctx;
    this.isInitialized = true;

    // Master chain
    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.settings.master.volume, ctx.currentTime);

    this.masterCompressor = ctx.createDynamicsCompressor();
    // soft compression for glue
    this.masterCompressor.threshold.setValueAtTime(-24, ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(20, ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(2.5, ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0.003, ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.25, ctx.currentTime);

    this.masterPanner = ctx.createStereoPanner();
    this.masterPanner.pan.setValueAtTime(0, ctx.currentTime);

    // A global convolver reverb (we create an impulse)
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = this._createReverbImpulse(this.settings.ambient.reverbTime);

    // Connect master bus: masterGain -> compressor -> convolver (wet) + direct (dry) -> destination
    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterPanner);

    // We'll use a simple wet/dry mix by splitting to convolver and destination
    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.7, ctx.currentTime);
    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.3, ctx.currentTime);

    this.masterPanner.connect(dryGain);
    this.masterPanner.connect(this.reverbConvolver);
    this.reverbConvolver.connect(wetGain);

    // combine
    dryGain.connect(ctx.destination);
    wetGain.connect(ctx.destination);

    console.log('AudioContext inicializado con master bus y reverb global');

    // Start ambient automatically after initialization if desired
    this.startAmbientSound();
  }

  /* -----------------------------
     AMBIENT: drone resonante y respirante
     ----------------------------- */
  startAmbientSound() {
    if (!this.audioContext || this.isAmbientPlaying) return;
    const ctx = this.audioContext;
    const s = this.settings.ambient;
    const now = ctx.currentTime;

    // Multi-oscillator drone (sine + square-ish subtle)
    const oscillators = s.detuneCents.map((cents, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'sawtooth';
      const freq = s.baseFreq * Math.pow(2, cents / 1200);
      osc.frequency.setValueAtTime(freq, now);
      return osc;
    });

    // gentle sub oscillator for body (square lowpassed)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(s.baseFreq / 2, now);

    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.02, now);

    // Bandpass resonator to shape the drone body
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(s.bandpassCenter, now);
    band.Q.setValueAtTime(s.bandpassQ, now);

    // small additional lowpass to avoid harsh highs
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(2000, now);
    lowpass.Q.setValueAtTime(0.7, now);

    // LFO to modulate band frequency (respiration)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(s.lfoRate, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(s.lfoAmountHz, now); // moves center +/- amount

    // subtle random motion using periodic wave + noise gate
    const randomLfo = ctx.createOscillator();
    randomLfo.type = 'sine';
    randomLfo.frequency.setValueAtTime(0.006, now);
    const rndGain = ctx.createGain();
    rndGain.gain.setValueAtTime(10, now);

    // small stereo spread using Panner nodes and slow LFO
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(0, now);
    const panLFO = ctx.createOscillator();
    panLFO.type = 'sine';
    panLFO.frequency.setValueAtTime(0.02, now);
    const panGain = ctx.createGain();
    panGain.gain.setValueAtTime(this.settings.master.stereoWidth, now);

    // An ambient noise source (pinkish): white noise filtered
    const noise = this.createNoiseSource(4.0); // short buffer, will loop
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(s.noiseLevel, now);

    // master ambient gain
    const ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(s.volume, now);

    // connect LFOs
    lfo.connect(lfoGain);
    lfoGain.connect(band.frequency);

    randomLfo.connect(rndGain);
    rndGain.connect(band.frequency); // very slow random wobble

    panLFO.connect(panGain);
    panGain.connect(panner.pan);

    // connect oscillators -> band -> lowpass -> ambientGain -> masterGain
    oscillators.forEach(osc => {
      osc.connect(band);
      osc.start(now);
    });

    subOsc.connect(subGain);
    subGain.connect(band);
    subOsc.start(now);

    noise.connect(noiseGain);
    noiseGain.connect(band);

    band.connect(lowpass);
    lowpass.connect(ambientGain);
    ambientGain.connect(this.masterGain);

    // connect panner between masterGain and master compressor for stereo motion
    this.masterGain.disconnect(); // re-route to include panner
    this.masterGain.connect(this.masterPanner);
    // (masterPanner already wired in initAudioContext)

    // start LFOs and panner
    lfo.start(now);
    randomLfo.start(now + 0.1);
    panLFO.start(now);

    // Small periodic micro-events to create unease (randomized)
    const microEvent = () => {
      if (!this.isAmbientPlaying) return;
      const chance = Math.random();
      if (chance < s.subtleRandomEvents) {
        this.playAtmosphericTexture();
      }
      // schedule another check between 15-45s
      setTimeout(microEvent, 15000 + Math.random() * 30000);
    };
    setTimeout(microEvent, 10000);

    this.ambient = {
      oscillators,
      subOsc,
      band,
      lowpass,
      lfo,
      lfoGain,
      randomLfo,
      rndGain,
      panner,
      panLFO,
      panGain,
      noise,
      noiseGain,
      ambientGain
    };

    this.isAmbientPlaying = true;
    console.log('Ambient oscuro iniciado');
  }

  stopAmbientSound(fade = 3.0) {
    if (!this.ambient || !this.isAmbientPlaying) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // Fade out ambient gain
    this.ambient.ambientGain.gain.exponentialRampToValueAtTime(0.001, now + fade);

    // Stop all oscillators after fade
    setTimeout(() => {
      try {
        this.ambient.oscillators.forEach(o => o.stop());
        this.ambient.subOsc.stop();
        this.ambient.lfo.stop();
        this.ambient.randomLfo.stop();
        this.ambient.panLFO.stop();
        this.ambient.noise.stop();
      } catch (e) { /* ignore already-stopped */ }
      this.ambient = null;
      this.isAmbientPlaying = false;
      console.log('Ambient detenido');
    }, fade * 1000 + 50);
  }

  /* -----------------------------
     SUCCESS: bloom + comb (metalic) + reverb
     ----------------------------- */
  playSuccess() {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const s = this.settings.success;
    const now = ctx.currentTime;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(s.volume, now + 0.06);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + s.duration);

    // small comb (delay feedback) to get metallic shimmer
    const combDelay = ctx.createDelay();
    combDelay.delayTime.setValueAtTime(s.combDelayMs / 1000, now);
    const combFeedback = ctx.createGain();
    combFeedback.gain.setValueAtTime(s.combFeedback, now);
    combDelay.connect(combFeedback);
    combFeedback.connect(combDelay);

    // feed comb in parallel
    const combMix = ctx.createGain();
    combMix.gain.setValueAtTime(0.5, now);

    combDelay.connect(combMix);
    combMix.connect(mainGain);

    // bloom oscillators (slight FM-ish by modulating detune)
    s.bloomFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f * 0.6, now);
      osc.frequency.exponentialRampToValueAtTime(f, now + 0.35 + i * 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.6 / s.bloomFreqs.length, now + 0.08 + i * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + s.duration - i * 0.1);
      osc.connect(g);
      g.connect(mainGain);
      // also tap into comb
      g.connect(combDelay);
      osc.start(now);
      osc.stop(now + s.duration + 0.1);
    });

    // connect mainGain to master
    mainGain.connect(this.masterGain);

    console.log('Success — bloom reproducido');
  }

  /* -----------------------------
     ERROR: descenso espectral + sub + metallic noise
     ----------------------------- */
  playError() {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const s = this.settings.error;
    const now = ctx.currentTime;

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(s.volume, now);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + s.duration);

    // descending oscillator pair
    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.setValueAtTime(s.descStart, now);
    oscA.frequency.exponentialRampToValueAtTime(s.descEnd, now + s.duration * 0.9);

    const oscB = ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.setValueAtTime(s.descStart * 1.12, now);
    oscB.frequency.exponentialRampToValueAtTime(s.descEnd * 0.98, now + s.duration * 0.9);

    // sub rumbly
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(40, now);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(s.subGain, now);
    sub.connect(subG);
    subG.connect(mainGain);

    // Metallic noisy burst: filtered noise + quick pitch
    const noise = this.createNoiseSource(s.duration * 0.4);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(2500, now);
    noiseFilter.Q.setValueAtTime(6, now);
    const noiseG = ctx.createGain();
    noiseG.gain.setValueAtTime(s.metallicNoise, now);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseG);
    noiseG.connect(mainGain);

    // gentle ring on oscillators
    const oscAG = ctx.createGain();
    oscAG.gain.setValueAtTime(0.18, now);
    oscAG.gain.exponentialRampToValueAtTime(0.001, now + s.duration * 0.9);
    const oscBG = ctx.createGain();
    oscBG.gain.setValueAtTime(0.12, now);
    oscBG.gain.exponentialRampToValueAtTime(0.001, now + s.duration * 0.9);

    oscA.connect(oscAG);
    oscB.connect(oscBG);
    oscAG.connect(mainGain);
    oscBG.connect(mainGain);

    oscA.start(now);
    oscA.stop(now + s.duration);
    oscB.start(now);
    oscB.stop(now + s.duration);
    sub.start(now);
    sub.stop(now + s.duration);

    // connect mainGain to master
    mainGain.connect(this.masterGain);

    console.log('Error — descenso espectral reproducido');
  }

  /* -----------------------------
     PROCESSING: pulso que acelera (motor biológico)
     ----------------------------- */
  startProcessing() {
    if (!this.audioContext || this.processingActive) return;
    this.processingActive = true;
    this.processingStartTime = this.audioContext.currentTime;
    this._scheduleProcessingPulse();
    console.log('Processing iniciado (motor biológico)');
  }

  _scheduleProcessingPulse() {
    if (!this.processingActive) return;
    const ctx = this.audioContext;
    const s = this.settings.processing;
    const elapsed = ctx.currentTime - this.processingStartTime;
    const progress = Math.min(elapsed / s.accelTime, 1);

    // map progress to pulse interval (s) — start slower, accelerate
    const interval = s.maxPulse - (s.maxPulse - s.minPulse) * progress; // in seconds

    // create pulse
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now); // tone at each pulse
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(s.volume, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + Math.max(0.06, interval * 0.45));

    osc.connect(g);
    g.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + Math.max(0.06, interval * 0.5));

    // subtle noise transient with each pulse
    const noise = this.createNoiseSource(0.06);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.setValueAtTime(800, now);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.01, now);
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(this.masterGain);
    noise.start(now);
    // stop noise implicitly when buffer ends

    // schedule next pulse via setTimeout
    this.processingTimer = setTimeout(() => this._scheduleProcessingPulse(), interval * 1000);
  }

  stopProcessing() {
    if (!this.processingActive) return;
    this.processingActive = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    console.log('Processing detenido');
  }

  /* -----------------------------
     TRANSITION: vórtice sonoro
     ----------------------------- */
  playTransition(direction = 'reveal') {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const s = this.settings.transition;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(s.volume, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + s.duration);

    if (direction === 'up') {
      osc.frequency.setValueAtTime(s.sweepLow, now);
      osc.frequency.exponentialRampToValueAtTime(s.sweepHigh, now + s.duration);
    } else if (direction === 'down') {
      osc.frequency.setValueAtTime(s.sweepHigh, now);
      osc.frequency.exponentialRampToValueAtTime(s.sweepLow, now + s.duration);
    } else {
      // reveal: complex movement
      osc.frequency.setValueAtTime(s.sweepLow * 0.6, now);
      osc.frequency.exponentialRampToValueAtTime(s.sweepHigh * 1.3, now + s.duration * 0.7);
      osc.frequency.exponentialRampToValueAtTime(s.sweepLow, now + s.duration);
    }

    // dynamic filtering for tunnel effect
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(3, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + s.duration);

    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + s.duration + 0.05);

    console.log('Transición reproducida:', direction);
  }

  /* -----------------------------
     ATMOSPHERIC TEXTURE
     ----------------------------- */
  playAtmosphericTexture() {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const textures = [
      { type: 'bell', freq: 660, dur: 3.8, vol: 0.145 },
      { type: 'granularNoise', dur: 2.2, vol: 0.5 },
      { type: 'lowSweep', freq: 140, dur: 2.6, vol: 0.14 }
    ];

    const t = textures[Math.floor(Math.random() * textures.length)];

    if (t.type === 'bell') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.freq * (0.95 + Math.random() * 0.12), now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(t.vol, now + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, now + t.dur);
      // small high-band resonator
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(400, now);
      hp.Q.setValueAtTime(1, now);

      osc.connect(hp);
      hp.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + t.dur);
    } else if (t.type === 'granularNoise') {
      // quick bursts of filtered noise
      const bursts = 6 + Math.floor(Math.random() * 6);
      for (let i = 0; i < bursts; i++) {
        const start = now + i * (t.dur / bursts);
        const noise = this.createNoiseSource(0.18);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(900 + Math.random() * 1200, start);
        f.Q.setValueAtTime(3 + Math.random() * 5, start);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(t.vol * (0.4 + Math.random() * 0.8), start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.16 + Math.random() * 0.12);
        noise.connect(f);
        f.connect(g);
        g.connect(this.masterGain);
        noise.start(start);
      }
    } else { // lowSweep
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const endFreq = t.freq * (0.6 + Math.random() * 0.8);
      osc.frequency.setValueAtTime(t.freq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + t.dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(t.vol, now + 0.4);
      g.gain.exponentialRampToValueAtTime(0.001, now + t.dur);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + t.dur);
    }
  }

  /* -----------------------------
     Utilities: noise, reverb impulse
     ----------------------------- */
  createNoiseSource(duration = 1.0) {
    const ctx = this.audioContext;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // white noise then lowpass to emulate pink-ish
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.6;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = false;
    return src;
  }

  _createReverbImpulse(seconds = 3.5) {
    const ctx = this.audioContext;
    const rate = ctx.sampleRate;
    const length = rate * seconds;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const channel = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // exponential decay
        channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.0);
        // add a small modulation for slightly metallic tail
        channel[i] *= (0.8 + 0.2 * Math.sin(i / 1000 + ch));
      }
    }
    return impulse;
  }

  /* -----------------------------
     Cleanup
     ----------------------------- */
  cleanup() {
    this.stopProcessing();
    this.stopAmbientSound(1.2);
    if (this.audioContext) {
      // give a moment for fade out
      setTimeout(() => {
        try {
          this.audioContext.close();
        } catch (e) {}
        this.audioContext = null;
        this.isInitialized = false;
        console.log('AudioContext cerrado');
      }, 1400);
    }
  }
}

export default AudioManager;
