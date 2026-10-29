import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from './BrandLogo'
import { INTRO_END, frameAt } from '../lib/introSim'

export function MotionPreview() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [time, setTime] = useState(reduced ? INTRO_END : 0)
  const [playing, setPlaying] = useState(!reduced)
  const [dark, setDark] = useState(false)
  const position = useRef(time)
  useEffect(() => {
    if (!playing) return
    let id = 0, previous: number | undefined
    const tick = (now: number) => {
      previous ??= now
      const next = Math.min(INTRO_END, position.current + (now - previous) / 1000)
      previous = now; position.current = next; setTime(next)
      if (next >= INTRO_END) setPlaying(false)
      else id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [playing])
  return <main className={dark ? 'motion-preview is-dark' : 'motion-preview'}>
    <header><span>СУЛЕЙМАН ШЕРИПОВ</span><button type="button" aria-pressed={dark} onClick={() => setDark(!dark)}>{dark ? 'Светлый фон' : 'Тёмный фон'} ↗</button></header>
    <section className="motion-stage" aria-label="Анимация логотипа SHERIPOV">
      <BrandLogo frame={frameAt(time)} />
    </section>
    <footer>
      <button type="button" onClick={() => { if (time >= INTRO_END) { position.current = 0; setTime(0) }; setPlaying(!playing) }}>{playing ? 'Пауза' : time >= INTRO_END ? 'Повторить ↗' : 'Смотреть ↗'}</button>
      <input aria-label="Позиция анимации" type="range" min="0" max={INTRO_END} step="0.001" value={time} onChange={e => { setPlaying(false); position.current = Number(e.target.value); setTime(position.current) }} />
      <span className="motion-time" aria-hidden="true">{time.toFixed(2)} / {INTRO_END.toFixed(2)}</span>
    </footer>
  </main>
}
