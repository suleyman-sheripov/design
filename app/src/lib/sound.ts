/* Звук интро.

   Тона синтезируются на месте, файлов нет: три коротких щелчка весят
   ноль байт и не тянут загрузку ради полутора секунд сцены.

   Важная оговорка. Браузеры запрещают звук до первого действия
   пользователя, а интро играет сразу на входе, когда никакого
   действия ещё не было. Поэтому здесь ничего не форсируется: если
   контекст не разрешён, звука просто нет, и сцена идёт как шла.
   Как только посетитель хоть раз щёлкнет или нажмёт клавишу,
   контекст оживает, и на повторных заходах в этой же вкладке звук
   будет. Ломать сцену ради звука неправильно, а обещать звук,
   которого может не быть, — тем более. */

let ctx: AudioContext | null = null
let muted = false

function context() {
  if (muted) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      muted = true
      return null
    }
  }
  /* Приостановленный контекст будить бесполезно без жеста, но попытка
     ничего не стоит: если жест уже был, он проснётся */
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return ctx.state === 'running' ? ctx : null
}

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
