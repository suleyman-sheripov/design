import { useEffect, useRef, useState } from 'react'
import { BrandLogo } from './BrandLogo'
import { INTRO_END, frameAt } from '../lib/introSim'
import * as sound from '../lib/sound'
import { SpeakerIcon } from './ReplayIcons'

export function MotionPreview() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const [time, setTime] = useState(reduced ? INTRO_END : 0)
  const [playing, setPlaying] = useState(!reduced)
  const [dark, setDark] = useState(false)
  const position = useRef(time)
  const audible = useRef(false)
  const [run, setRun] = useState(0)
  const [soundBusy, setSoundBusy] = useState(false)
  const [soundMessage, setSoundMessage] = useState('')
  useEffect(() => {
    if (!playing) return
    let id = 0, previous: number | undefined
    let stopSound = () => {}
    const tick = (now: number) => {
      if (previous === undefined) { previous = now; if (audible.current) stopSound = sound.playIntro() }
      const next = Math.min(INTRO_END, position.current + (now - previous) / 1000)
      previous = now; position.current = next; setTime(next)
      if (next >= INTRO_END) setPlaying(false)
      else id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(id); stopSound() }
  }, [playing, run])
  return <main className={dark ? 'motion-preview is-dark' : 'motion-preview'}>
    <header><span>СУЛЕЙМАН ШЕРИПОВ</span><div className="motion-preview-actions"><button type="button" disabled={soundBusy} onClick={async () => {
      setSoundBusy(true)
      sound.disable()
      const allowed = await sound.enable()
      setSoundBusy(false); setSoundMessage(allowed ? '' : 'Звук недоступен в этом браузере.')
      audible.current = allowed; position.current = 0; setTime(0); setRun(value => value + 1); setPlaying(true)
    }} aria-label="Повторить со звуком">Звук <SpeakerIcon /></button><button type="button" aria-pressed={dark} onClick={() => setDark(!dark)}>{dark ? 'Светлый фон' : 'Тёмный фон'} ↗</button></div></header>
    <section className="motion-stage" aria-label="Анимация логотипа SHERIPOV">
      <BrandLogo frame={frameAt(time)} />
    </section>
    <footer>
      <button type="button" onClick={() => { audible.current = false; sound.disable(); if (time >= INTRO_END) { position.current = 0; setTime(0) }; setPlaying(!playing) }}>{playing ? 'Пауза' : time >= INTRO_END ? 'Повторить ↗' : 'Смотреть ↗'}</button>
      <input aria-label="Позиция анимации" type="range" min="0" max={INTRO_END} step="0.001" value={time} onChange={e => { audible.current = false; sound.disable(); setPlaying(false); position.current = Number(e.target.value); setTime(position.current) }} />
      <span className="motion-time" aria-hidden="true">{time.toFixed(2)} / {INTRO_END.toFixed(2)}</span>
    </footer>
    <span className="motion-sound-status" role="status">{soundMessage}</span>
  </main>
}
