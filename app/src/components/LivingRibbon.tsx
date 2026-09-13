import { useEffect, useRef } from 'react'

type Point = {x:number; y:number; z:number}
const COUNT = 180

// Проекция замкнутой ленты. Курсор меняет её наклон и локально вытягивает поверхность.
export function LivingRibbon({ active }: {active:boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({x:0,y:0,on:false,impulse:0})

  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let width = 900
    let height = 310
    let time = 0
    let previous = 0
    let visible = true
    let tiltX = 0
    let tiltY = 0
    let pull = 0
    let px = 0
    let py = 0

    const resize = () => {
      const rect = element.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      const dpr = Math.min(devicePixelRatio || 1, 2)
      element.width = Math.round(width * dpr)
      element.height = Math.round(height * dpr)
      ctx.setTransform(dpr,0,0,dpr,0,0)
    }
    const draw = (stamp:number) => {
      frame = 0
      const dt = previous ? Math.min((stamp - previous) / 1000, .05) : .016
      previous = stamp
      if (visible && !document.hidden) {
        const moving = active && !reduced.matches
        if (moving) time += dt
        const ease = 1 - Math.exp(-dt * 4)
        tiltX += ((moving && pointer.current.on ? pointer.current.y * .3 : 0) - tiltX) * ease
        tiltY += ((moving && pointer.current.on ? pointer.current.x * .38 : 0) - tiltY) * ease
        pull += ((moving && pointer.current.on ? 1 : 0) - pull) * ease
        px += (pointer.current.x - px) * ease
        py += (pointer.current.y - py) * ease
        pointer.current.impulse *= Math.exp(-dt * 2.5)
        ctx.clearRect(0,0,width,height)
        const scale = Math.min(width / 820, height / 290)
        const yaw = -.22 + Math.sin(time * .21) * .09 + tiltY
        const pitch = -.42 + Math.sin(time * .17) * .07 + tiltX
        const roll = -.09 + Math.sin(time * .13) * .025
        const points:Point[] = []
        const widths:number[] = []
        for (let i = 0; i <= COUNT; i++) {
          const t = i / COUNT * Math.PI * 2
          let x = 285 * Math.sin(t) + 65 * Math.sin(2 * t)
          const y = 74 * Math.sin(2 * t) + 30 * Math.sin(3 * t + .5)
          const z = 92 * Math.cos(t) + 25 * Math.sin(3 * t)
          x *= 1 + Math.sin(time * .45) * .018 + pointer.current.impulse * .07
          const x1 = x * Math.cos(yaw) + z * Math.sin(yaw)
          const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw)
          const y1 = y * Math.cos(pitch) - z1 * Math.sin(pitch)
          const depth = y * Math.sin(pitch) + z1 * Math.cos(pitch)
          let sx = x1 * Math.cos(roll) - y1 * Math.sin(roll)
          let sy = x1 * Math.sin(roll) + y1 * Math.cos(roll)
          const dx = px * 400 - sx
          const dy = py * 145 - sy
          const influence = Math.exp(-(dx * dx + dy * dy) / 42000) * pull
          sx += dx * influence * .18
          sy += dy * influence * .26
          points.push({x:width/2 + sx*scale, y:height/2 + sy*scale, z:depth})
          widths.push((10 + 27 * (.5 + .5 * Math.cos(t * 3 + time * .18))) * scale)
        }
        const edges = points.map((p,i) => {
          const before = points[(i + COUNT - 1) % COUNT]
          const after = points[(i + 1) % COUNT]
          const dx = after.x - before.x
          const dy = after.y - before.y
          const length = Math.hypot(dx,dy) || 1
          const nx = -dy / length * widths[i]
          const ny = dx / length * widths[i]
          return {a:{x:p.x + nx,y:p.y + ny},b:{x:p.x - nx,y:p.y - ny}}
        })
        const order = Array.from({length:COUNT},(_,i)=>i).sort((a,b)=>(points[a].z + points[a+1].z) - (points[b].z + points[b+1].z))
        for (const i of order) {
          const edge = edges[i]
          const next = edges[i+1]
          const light = Math.max(0, Math.min(1, (points[i].z + 130)/260))
          const clay = i > 108 && i < 122
          const base = clay ? [116,47,28] : [38,57,39]
          const high = clay ? [191,111,77] : [125,145,117]
          const color = `rgb(${base.map((v,c)=>Math.round(v + (high[c]-v)*light)).join(',')})`
          ctx.beginPath()
          ctx.moveTo(edge.a.x,edge.a.y)
          ctx.lineTo(next.a.x,next.a.y)
          ctx.lineTo(next.b.x,next.b.y)
          ctx.lineTo(edge.b.x,edge.b.y)
          ctx.closePath()
          ctx.fillStyle = color
          ctx.strokeStyle = color
          ctx.lineWidth = 1.5
          ctx.lineJoin = 'round'
          ctx.fill()
          ctx.stroke()
        }
      }
      if (!reduced.matches && active && visible && !document.hidden) frame = requestAnimationFrame(draw)
    }
    const restart = () => {cancelAnimationFrame(frame); previous = 0; frame = requestAnimationFrame(draw)}
    const observer = new ResizeObserver(() => {resize(); restart()})
    observer.observe(element)
    const intersection = new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; restart()}, {rootMargin:'100px'})
    intersection.observe(element)
    reduced.addEventListener('change', restart)
    document.addEventListener('visibilitychange', restart)
    resize(); restart()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect(); intersection.disconnect()
      reduced.removeEventListener('change', restart)
      document.removeEventListener('visibilitychange', restart)
    }
  }, [active])

  return <canvas ref={canvas} className="living-ribbon" aria-hidden="true" onPointerMove={e => {
    const rect = e.currentTarget.getBoundingClientRect()
    pointer.current.x = (e.clientX - rect.left) / rect.width * 2 - 1
    pointer.current.y = (e.clientY - rect.top) / rect.height * 2 - 1
    pointer.current.on = true
  }} onPointerLeave={() => {pointer.current.on = false}} onPointerDown={() => {pointer.current.impulse = 1}} onPointerUp={e => {if(e.pointerType !== 'mouse') pointer.current.on = false}} />
}
