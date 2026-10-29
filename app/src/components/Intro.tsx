import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandLogo } from './BrandLogo'
import { INTRO_END, frameAt } from '../lib/introSim'
import * as sound from '../lib/sound'

export { INTRO_END }
export function Intro({ onDone, manual = false }: { onDone: () => void; manual?: boolean }) {
  const [drawing, setDrawing] = useState(() => frameAt(0))
  const ended = useRef(false)
  const complete = useCallback(() => {
    if (ended.current) return
    ended.current = true
    onDone()
  }, [onDone])
  useEffect(() => {
    ended.current = false
    const html = document.documentElement
    const previous = html.style.overflow
    html.style.overflow = 'hidden'
    let frame = 0, start: number | undefined
    let stopSound = () => {}
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const preferenceChanged = () => { if (reduced.matches && !manual) complete() }
    reduced.addEventListener('change', preferenceChanged)
    // Background tabs must not leave the portfolio behind an inert curtain.
    const guard = setTimeout(complete, INTRO_END * 1000 + 500)
    const tick = (now: number) => {
      if (ended.current) return
      if (start === undefined) { start = now; stopSound = sound.playIntro() }
      const t = (now - start) / 1000
      setDrawing(frameAt(t))
      if (t >= INTRO_END || (reduced.matches && !manual)) complete()
      else frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      stopSound()
      clearTimeout(guard)
      reduced.removeEventListener('change', preferenceChanged)
      html.style.overflow = previous
    }
  }, [complete, manual])

  return <div className="brand-intro" role="status" aria-label="СУЛЕЙМАН ШЕРИПОВ — заставка">
    <motion.span layoutId="brand-lockup" className="brand-intro-lockup" transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}>
      <span className="brand-intro-canvas"><BrandLogo frame={drawing} /></span>
    </motion.span>
    <button type="button" className="intro-skip" onClick={complete}>Пропустить <span aria-hidden="true">↗</span></button>
  </div>
}
export const CURTAIN_FADE_MS = 1100
export function Curtain({ leaving }: { leaving: boolean }) {
  return <div aria-hidden="true" className={`brand-curtain ${leaving ? 'is-leaving' : ''}`} />
}
