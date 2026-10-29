// Deterministic stereo synthesis: paper stroke, dry structural taps, a moving
// air sweep and a low, short resolved chord. No files or network requests.
export const SOUND_DURATION = 3.72
const TAU = Math.PI * 2
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t) }
export function renderLogoSound(sampleRate: number) {
  const length = Math.ceil(sampleRate * SOUND_DURATION)
  const left = new Float32Array(length), right = new Float32Array(length)
  let seed = 0x53484552, low = 0, air = 0, sweepPhase = 0
  for (let i = 0; i < length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5
    const noise = (seed >>> 0) / 2147483648 - 1
    const t = i / sampleRate
    low += .08 * (48000 / sampleRate) * (noise - low)
    const sweep = clamp((t - 1.61) / 1.33)
    const cutoff = 450 + 4200 * Math.sin(Math.PI * sweep) ** 2
    air += (1 - Math.exp(-TAU * cutoff / sampleRate)) * (noise - air)
    const brushTime = (t - .16) / .98
    const brushEnvelope = Math.sin(Math.PI * clamp(brushTime)) ** 1.4
    const brush = (noise - low) * brushEnvelope * .033 * (1 + .25 * Math.sin(TAU * 29 * t))
    let taps = 0
    for (const [start, frequency, gain] of [[.91, 185, .12], [1.04, 246, .09], [1.14, 165, .13]]) {
      const age = t - start
      if (age >= 0 && age < .22) taps += gain * Math.sin(TAU * frequency * age) * Math.exp(-age * 32) * smooth(age / .004) + low * .035 * Math.exp(-age * 70)
    }
    const sweepEnvelope = Math.sin(Math.PI * sweep) ** 2
    sweepPhase += TAU * (62 + 46 * smooth(sweep)) / sampleRate
    const rush = (air - low) * .34 * sweepEnvelope
    const body = Math.sin(sweepPhase) * .065 * sweepEnvelope
    const age = t - 2.94
    let resolve = 0, shimmer = 0
    if (age >= 0) {
      const attack = smooth(age / .009)
      const tail = 1 - smooth((age - .43) / .35)
      resolve = attack * tail * (.23 * Math.sin(TAU * 73.416 * age) * Math.exp(-age * 8)
        + .10 * Math.sin(TAU * 146.832 * age) * Math.exp(-age * 7)
        + .052 * Math.sin(TAU * 220 * age) * Math.exp(-age * 6)
        + .035 * Math.sin(TAU * 293.665 * age) * Math.exp(-age * 5))
      shimmer = attack * tail * .017 * Math.sin(TAU * 440 * age) * Math.exp(-age * 6)
      resolve += low * .09 * Math.exp(-age * 65) * attack
    }
    const pan = -.75 + 1.5 * smooth(sweep)
    const dry = brush + taps + body + resolve
    const end = 1 - smooth((t - 3.58) / .14)
    left[i] = Math.tanh((dry + rush * Math.sqrt((1 - pan) / 2) + shimmer) * 1.65) * .8 * end
    right[i] = Math.tanh((dry + rush * Math.sqrt((1 + pan) / 2) - shimmer * .3) * 1.65) * .8 * end
  }
  // A quiet stereo reflection adds space without blurring the transient timing.
  const delay = Math.round(sampleRate * .047)
  for (let i = length - 1; i >= delay; i--) {
    const fade = 1 - smooth((i / sampleRate - 3.48) / .24)
    left[i] += right[i - delay] * .11 * fade
    right[i] += left[i - delay] * .11 * fade
  }
  return { left, right, sampleRate }
}
