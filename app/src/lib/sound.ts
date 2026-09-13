/* Первый вход тихий. Звук разрешается только явным повтором заставки. */
let ctx: AudioContext | null = null
let muted = true
let generation = 0

export function prime() { /* Без согласия не поднимаем звуковой поток. */ }

export async function enable(): Promise<boolean> {
  const attempt = ++generation
  try {
    ctx ??= new AudioContext()
    await Promise.race([ctx.resume(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Звук недоступен')), 3000))])
    if (attempt !== generation) return false
    muted = ctx.state !== 'running'
    return !muted
  } catch { muted = true; return false }
}
export function disable() { generation++; muted = true }
function context() { return !muted && ctx?.state === 'running' ? ctx : null }

/* Короткий тон с быстрым затуханием. Форма важнее высоты: щелчок
   должен читаться ударом, а не нотой. */
function blip(freq: number, gain: number, ms: number, type: OscillatorType) {
  const ac = context()
  if (!ac) return

  const osc = ac.createOscillator()
  const amp = ac.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, ac.currentTime)
  /* Небольшой съезд вниз: удар о твёрдое всегда чуть падает по тону */
  osc.frequency.exponentialRampToValueAtTime(freq * 0.72, ac.currentTime + ms / 1000)

  amp.gain.setValueAtTime(0, ac.currentTime)
  amp.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.004)
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + ms / 1000)

  osc.connect(amp).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + ms / 1000 + 0.02)
}

/* Удар шарика о половину. Тише и выше, чем падение слова: он лёгкий. */
export function tick(strength = 1) {
  blip(420 + 120 * strength, 0.05 * strength, 90, 'triangle')
}

/* Половина коснулась строки: ниже и мягче, это вес, а не щелчок */
export function thud() {
  blip(150, 0.09, 220, 'sine')
}

/* Половины сомкнулись и точка встала на место */
export function settle() {
  blip(660, 0.045, 320, 'sine')
}

export function isMuted() {
  return muted
}
