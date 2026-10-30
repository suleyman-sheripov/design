// A tonal electronic signature: evolving phase modulation, a spatial sequence
// and a suspended chord. Pure oscillators; no foley, noise or recorded samples.
export const SOUND_DURATION = 3.72
const TAU = Math.PI * 2
const clamp = (x: number) => Math.max(0, Math.min(1, x))
const smooth = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t) }
const sequence = [
  [2.00, 293.665, -.78], [2.17, 440, -.46], [2.23, 587.33, -.18],
  [2.35, 659.255, .15], [2.51, 880, .46], [2.65, 1174.66, .78],
]
export function renderLogoSound(sampleRate: number) {
  const length = Math.ceil(sampleRate * SOUND_DURATION)
  const left = new Float32Array(length), right = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    let l = 0, r = 0
    const place = (value: number, pan: number) => {
      l += value * Math.sqrt((1 - pan) / 2)
      r += value * Math.sqrt((1 + pan) / 2)
    }
    // A soft, harmonically shifting contour accompanies the drawn S.
    const age = t - .16
    if (age >= 0 && age < 1.4) {
      const env = smooth(age / .14) * (1 - smooth((age - .65) / .75))
      const phase = TAU * 146.832 * age
      const index = 1.8 * Math.sin(Math.PI * clamp(age / 1.4)) ** 2
      place(.095 * env * Math.sin(phase + index * Math.sin(phase * 2)), -.18)
      place(.035 * env * Math.sin(phase * .5), 0)
    }
    // H locks in as a pair of rounded digital tones, without a percussive hit.
    for (const [start, frequency] of [[.91, 220], [1.14, 293.665]]) {
      const a = t - start
      if (a >= 0 && a < .5) {
        const env = smooth(a / .025) * Math.exp(-a * 9) * (1 - smooth((a - .35) / .15))
        place(.075 * env * Math.sin(TAU * frequency * a + .65 * Math.exp(-a * 8) * Math.sin(TAU * frequency * 2 * a)), -.1)
      }
    }
    // Six distinct notes follow the six silhouettes. A quiet octave reflection
    // gives depth while leaving each entry readable, even on phone speakers.
    for (const [start, frequency, pan] of sequence) {
      for (let echo = 0; echo < 2; echo++) {
        const a = t - start - echo * .115
        if (a < 0 || a > .56) continue
        const env = smooth(a / .018) * Math.exp(-a * 8) * (1 - smooth((a - .38) / .18))
        const phase = TAU * frequency * a
        const tone = Math.sin(phase + 1.2 * Math.exp(-a * 12) * Math.sin(phase * 2))
        place(.12 * env * tone * (echo ? .2 : 1), echo ? -pan * .6 : pan)
      }
    }
    const travel = clamp((t - 1.61) / 1.33)
    const swell = Math.sin(Math.PI * travel) ** 2
    // A widening phase-modulated carrier bridges the pause before the sequence.
    const carrier = TAU * (110 * t + 18 * travel * travel)
    place(.055 * swell * Math.sin(carrier + .9 * Math.sin(carrier * 2)), -.75 + 1.5 * smooth(travel))
    place(.055 * swell * Math.sin(TAU * (73.416 * t + 1.8 * travel * travel)), 0)
    // Open D / A / E voicing: electronic, restrained, not a simulated impact.
    const endAge = t - 2.94
    if (endAge >= 0) {
      const env = smooth(endAge / .025) * Math.exp(-endAge * 5) * (1 - smooth((endAge - .42) / .36))
      for (const [frequency, gain, pan] of [[73.416, .19, 0], [146.832, .09, -.2], [220, .065, .25], [329.628, .04, -.45], [587.33, .024, .5]]) {
        place(gain * env * Math.sin(TAU * frequency * endAge + .3 * Math.exp(-endAge * 9) * Math.sin(TAU * frequency * 2 * endAge)), pan)
      }
    }
    const fade = 1 - smooth((t - 3.58) / .14)
    left[i] = Math.tanh(l * 1.65) * .8 * fade
    right[i] = Math.tanh(r * 1.65) * .8 * fade
  }
  return { left, right, sampleRate }
}
