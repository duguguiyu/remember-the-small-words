let soundEnabled = true

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled
}

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

function isSoundEnabled(): boolean {
  return soundEnabled
}

export async function playCorrectSound() {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = 'sine'
  osc.frequency.setValueAtTime(523, ctx.currentTime)
  osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1)
  osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2)

  gain.gain.setValueAtTime(0.3, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.4)
}

export async function playWrongSound() {
  if (!isSoundEnabled()) return
  const ctx = getCtx()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.type = 'square'
  osc.frequency.setValueAtTime(200, ctx.currentTime)
  osc.frequency.setValueAtTime(150, ctx.currentTime + 0.15)

  gain.gain.setValueAtTime(0.2, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.3)
}
