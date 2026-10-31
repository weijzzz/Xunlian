// 提示音 + 震动。浏览器要求先有一次点击才能出声，所以在第一次点按时解锁。
let ctx: AudioContext | null = null

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* 不支持就算了 */
  }
}

// 全局：第一次点按屏幕时解锁音频
export function installAudioUnlock() {
  const handler = () => unlockAudio()
  window.addEventListener('pointerdown', handler, { passive: true })
}

function tone(at: number, freq: number, dur: number, gain = 0.6) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(gain, at + 0.01)
  g.gain.setValueAtTime(gain, at + dur - 0.03)
  g.gain.linearRampToValueAtTime(0, at + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + dur + 0.02)
}

export function canSound(): boolean {
  return typeof AudioContext !== 'undefined'
}

export function canVibrate(): boolean {
  return typeof navigator.vibrate === 'function'
}

// 休息结束：三声高音
export function beepRestOver() {
  unlockAudio()
  if (!ctx) return
  const t = ctx.currentTime + 0.05
  tone(t, 880, 0.18)
  tone(t + 0.3, 880, 0.18)
  tone(t + 0.6, 1320, 0.35)
}

// 倒计时最后几秒的短提示
export function tick() {
  unlockAudio()
  if (!ctx) return
  tone(ctx.currentTime + 0.02, 660, 0.08, 0.35)
}

export function vibrateRestOver() {
  if (canVibrate()) navigator.vibrate([400, 150, 400, 150, 400])
}

export function restOverAlert() {
  beepRestOver()
  vibrateRestOver()
}
