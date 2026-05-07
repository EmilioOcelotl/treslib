// StrudelSync.js — ciclo-alineación de patrones Strudel
//
// Gestiona el state machine de cambio de variantes: pending/current, timer alineado
// al límite de ciclo (60/CPM) y evaluación con CPM por variante configurable.
//
// Uso:
//   const sync = new StrudelSync(strudelRepl, getAudioContext, {
//     getCPM:     () => CPM,
//     patterns:   { DARK: `stack(...)`, MID: `stack(...)` },
//     patternCPM: { DARK: cpm => cpm / 2 },   // opcional, default: cpm => cpm
//     gain:       2,
//   })
//   sync.request('MID')        // cambia al próximo límite de ciclo
//   sync.reapply()             // re-evalúa variante actual (útil al cambiar CPM)
//   sync.stop()
//   sync.currentVariant        // getter
//   sync.pendingVariant        // getter

export class StrudelSync {
  constructor(repl, getAudioContext, options = {}) {
    this._repl       = repl
    this._getCtx     = getAudioContext
    this._getCPM     = options.getCPM     ?? (() => 120)
    this._patterns   = options.patterns   ?? {}
    this._patternCPM = options.patternCPM ?? {}
    this._gain       = options.gain       ?? 2

    this._currentVariant = null
    this._pendingVariant = null
    this._strudelStart   = null
    this._timer          = null
  }

  get currentVariant() { return this._currentVariant }
  get pendingVariant()  { return this._pendingVariant }

  // Solicita un cambio de variante alineado al próximo límite de ciclo.
  request(variant) {
    if (variant === (this._pendingVariant ?? this._currentVariant)) return
    this._pendingVariant = variant

    const ctx    = this._getCtx()
    const now    = ctx?.currentTime ?? 0
    const cycleS = 60 / this._getCPM()
    const delay  = this._strudelStart !== null
      ? Math.max(0, cycleS - ((now - this._strudelStart) % cycleS))
      : 0

    clearTimeout(this._timer)
    this._timer = setTimeout(() => this._apply(), delay * 1000)
  }

  // Re-evalúa la variante actual — usar al cambiar CPM en caliente.
  async reapply() {
    if (!this._currentVariant || !this._repl) return
    await this._eval(this._currentVariant)
  }

  stop() {
    clearTimeout(this._timer)
    this._repl?.stop()
    this._currentVariant = null
    this._pendingVariant = null
    this._strudelStart   = null
  }

  async _apply() {
    if (!this._pendingVariant || !this._repl) return
    this._currentVariant = this._pendingVariant
    this._pendingVariant = null
    const ctx = this._getCtx()
    this._strudelStart = ctx?.currentTime ?? 0
    await this._eval(this._currentVariant)
  }

  async _eval(variant) {
    const code  = this._patterns[variant]
    if (!code) return
    const cpm   = this._getCPM()
    const modFn = this._patternCPM[variant] ?? (c => c)
    await this._repl.evaluate(`(${code}).cpm(${modFn(cpm)}).gain(${this._gain})`)
  }
}
