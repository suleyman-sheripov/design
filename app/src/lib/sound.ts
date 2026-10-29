import { renderLogoSound } from './logoSound'
let ctx: AudioContext | null = null
let muted = true
let generation = 0
let buffer: AudioBuffer | null = null
let stopPlaying = () => {}

export async function enable(): Promise<boolean> {
  const attempt = ++generation
  let guard: ReturnType<typeof setTimeout> | undefined
  try {
    ctx ??= new AudioContext()
    await Promise.race([ctx.resume(), new Promise<never>((_, reject) => { guard = setTimeout(() => reject(new Error('Звук недоступен')), 3000) })])
    if (attempt !== generation) return false
    muted = ctx.state !== 'running'
    if (!muted && !buffer) {
      const rendered = renderLogoSound(ctx.sampleRate)
      buffer = ctx.createBuffer(2, rendered.left.length, ctx.sampleRate)
      buffer.copyToChannel(rendered.left, 0); buffer.copyToChannel(rendered.right, 1)
    }
    return !muted
  } catch { muted = true; return false }
  finally { clearTimeout(guard) }
}
export function disable() { generation++; muted = true; stopPlaying() }
export function playIntro() {
  stopPlaying()
  if (muted || !ctx || ctx.state !== 'running' || !buffer) return () => {}
  const ac = ctx, source = ac.createBufferSource(), gain = ac.createGain()
  source.buffer = buffer
  source.connect(gain).connect(ac.destination)
  source.start()
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    gain.gain.cancelScheduledValues(ac.currentTime)
    gain.gain.setValueAtTime(gain.gain.value, ac.currentTime)
    gain.gain.linearRampToValueAtTime(0, ac.currentTime + .04)
    source.stop(ac.currentTime + .045)
  }
  source.onended = () => { source.disconnect(); gain.disconnect() }
  stopPlaying = stop
  return stop
}
export function isMuted() { return muted }
