import { useEffect, useRef, type RefObject } from 'react'

export type ClothMotion = { progress: number; x: number; y: number; near: boolean }

// Тот же материал, что в LoomArt: одно полотно и продольные волокна.
// Здесь оно существует самостоятельно, а не продолжает маршрут ленты работ.
export function ContactCloth({ motion }: { motion: RefObject<ClothMotion> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = canvas.current, ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, last = 0, time = 0, visible = false
    let width = 1, height = 1, progress = motion.current.progress, pull = 0
    const draw = (stamp: number) => {
      frame = 0
      const dt = last ? Math.min((stamp - last) / 1000, .05) : .016
      last = stamp
      if (!reduced.matches) time += dt
      progress += (motion.current.progress - progress) * (1 - Math.exp(-dt * 12))
      pull += ((motion.current.near && !reduced.matches ? 1 : 0) - pull) * (1 - Math.exp(-dt * 5))
      const p = reduced.matches ? .5 : progress
      const amplitude = Math.min(height * .2, 52) * (.5 + Math.sin(p * Math.PI) * .5)
      const phase = p * Math.PI * 2.5 + Math.sin(time * .45) * .15
      const points = Array.from({ length: 181 }, (_, i) => {
        const t = i / 180, x = width * t
        const proximity = Math.exp(-((t - motion.current.x) ** 2) * 22)
        const y = height / 2 + Math.sin(t * Math.PI * 3 - phase) * amplitude * Math.sin(t * Math.PI)
          + (motion.current.y - .5) * height * .24 * proximity * pull
        const twist = t * Math.PI * 3 - phase
        const breadth = Math.min(height * .19, 45) * (.4 + .6 * Math.sin(t * Math.PI))
          * (.28 + .72 * Math.abs(Math.cos(twist * .6)))
        return { x, y, breadth, twist }
      })
      ctx.clearRect(0, 0, width, height)
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1]
        const light = .5 + .5 * Math.sin(a.twist)
        const shade = (shift: number) => `rgb(${Math.round(85 + light * 51 + shift)},${Math.round(107 + light * 46 + shift)},${Math.round(75 + light * 42 + shift)})`
        const gradient = ctx.createLinearGradient(a.x, a.y - a.breadth, a.x, a.y + a.breadth)
        gradient.addColorStop(0, shade(15)); gradient.addColorStop(.3, shade(4)); gradient.addColorStop(1, shade(-12))
        ctx.beginPath()
        ctx.moveTo(a.x, a.y - a.breadth); ctx.lineTo(b.x, b.y - b.breadth)
        ctx.lineTo(b.x, b.y + b.breadth); ctx.lineTo(a.x, a.y + a.breadth); ctx.closePath()
        ctx.fillStyle = gradient; ctx.strokeStyle = gradient; ctx.lineWidth = 1
        ctx.fill(); ctx.stroke()
      }
      for (let n = 0; n <= 8; n++) {
        ctx.beginPath()
        points.forEach((point, i) => {
          const y = point.y + point.breadth * (n / 4 - 1)
          if (i === 0) ctx.moveTo(point.x, y); else ctx.lineTo(point.x, y)
        })
        ctx.strokeStyle = n === 0 ? '#eff0d759' : '#e4e7cb24'
        ctx.lineWidth = n === 0 ? 1 : .6; ctx.stroke()
      }
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(draw)
    }
    const restart = () => { cancelAnimationFrame(frame); last = 0; frame = requestAnimationFrame(draw) }
    const resize = new ResizeObserver(() => {
      width = el.clientWidth; height = el.clientHeight
      const dpr = Math.min(devicePixelRatio || 1, 2)
      el.width = Math.round(width * dpr); el.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); restart()
    })
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; restart() })
    resize.observe(el); observer.observe(el)
    reduced.addEventListener('change', restart)
    document.addEventListener('visibilitychange', restart)
    return () => {
      cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect()
      reduced.removeEventListener('change', restart)
      document.removeEventListener('visibilitychange', restart)
    }
  }, [motion])
  return <canvas ref={canvas} className="contact-cloth" aria-hidden="true" />
}
