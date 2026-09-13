import { useEffect, useRef } from 'react'
import { Mark } from './Mark'

// Нити проходят за неизменённым авторским знаком и собираются в полотно.
export function LoomArt({ active }: {active:boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef({x:500,y:160,on:false,impulse:0})
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0, previous = 0, time = 0
    let width = 1000, height = 320, visible = true
    let strength = 0, px = 500, py = 160
    const resize = () => {
      width = element.clientWidth || 1000
      height = element.clientHeight || 320
      element.parentElement?.style.setProperty('--loom-width', `${Math.min(width, height * 1000 / 320)}px`)
      const dpr = Math.min(devicePixelRatio || 1, 2)
      element.width = Math.round(width * dpr)
      element.height = Math.round(height * dpr)
      ctx.setTransform(dpr,0,0,dpr,0,0)
    }
    const draw = (stamp:number) => {
      frame = 0
      const dt = previous ? Math.min((stamp - previous)/1000,.05) : .016
      previous = stamp
      if (visible && !document.hidden) {
        const moving = active && !reduced.matches
        if (moving) time += dt
        const ease = 1-Math.exp(-dt*4)
        strength += ((moving && pointer.current.on ? 1 : 0)-strength)*ease
        px += (pointer.current.x-px)*ease
        py += (pointer.current.y-py)*ease
        pointer.current.impulse *= Math.exp(-dt*2)
        const scale = Math.min(width/1000,height/320)
        ctx.clearRect(0,0,width,height)
        ctx.save()
        ctx.translate((width-1000*scale)/2,(height-320*scale)/2)
        ctx.scale(scale,scale)
        const tug = (x:number,y:number) => {
          const distance = (x-px)*(x-px)+(y-py)*(y-py)
          return (py-y)*Math.exp(-distance/55000)*strength*.4
        }
        // Полотно продолжает направления нитей, затем свободно изгибается.
        const samples = Array.from({length:121},(_,i) => {
          const t=i/120, x=557+t*375
          const wave=Math.sin(t*Math.PI*2-time*.35)*Math.sin(t*Math.PI)
          const y=160+wave*52 + tug(x,160)*t
          const breadth=(28+13*Math.sin(t*Math.PI))*(1-.55*t*t)
          return {x,y,breadth}
        })
        for(let i=0;i<120;i++) {
          const a=samples[i], b=samples[i+1]
          const light=.5+.5*Math.sin(i/120*Math.PI*2-time*.35)
          ctx.beginPath()
          ctx.moveTo(a.x,a.y-a.breadth);ctx.lineTo(b.x,b.y-b.breadth)
          ctx.lineTo(b.x,b.y+b.breadth);ctx.lineTo(a.x,a.y+a.breadth);ctx.closePath()
          ctx.fillStyle=`rgb(${Math.round(55+light*45)},${Math.round(76+light*42)},${Math.round(54+light*40)})`
          ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=1.5
          ctx.fill();ctx.stroke()
        }
        // Девять линий дают ритм без плотной сетки и дополнительных подписей.
        for(let n=0;n<9;n++) {
          const offset=n-4
          ctx.beginPath()
          for(let i=0;i<=100;i++) {
            const t=i/100, x=65+t*500
            const spread=offset*(17-10*t)
            const wave=Math.sin(t*Math.PI*2+time*.55+n*.32)*(10+pointer.current.impulse*10)*Math.sin(t*Math.PI)
            const y=160+spread+wave+tug(x,160+spread)*Math.sin(t*Math.PI)
            if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y)
          }
          ctx.strokeStyle=n===2?'#9e4429':'#687963'
          ctx.globalAlpha=n===2?.8:.6
          ctx.lineWidth=(n===2?1.4:1)/scale
          ctx.stroke()
        }
        ctx.globalAlpha=1
        // Тонкие продольные волокна на готовой ленте.
        for(let n=1;n<8;n++) {
          ctx.beginPath()
          samples.forEach((p,i) => {
            const y=p.y+p.breadth*(n/4-1)
            if(!i)ctx.moveTo(p.x,y);else ctx.lineTo(p.x,y)
          })
          ctx.strokeStyle='#f0eade';ctx.globalAlpha=.13;ctx.lineWidth=.65/scale;ctx.stroke()
        }
        ctx.restore()
      }
      if(active && !reduced.matches && visible && !document.hidden) frame=requestAnimationFrame(draw)
    }
    const restart=()=>{cancelAnimationFrame(frame);previous=0;frame=requestAnimationFrame(draw)}
    const observer=new ResizeObserver(()=>{resize();restart()})
    observer.observe(element)
    const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;restart()},{rootMargin:'100px'})
    intersection.observe(element)
    reduced.addEventListener('change',restart)
    document.addEventListener('visibilitychange',restart)
    resize();restart()
    return()=>{cancelAnimationFrame(frame);observer.disconnect();intersection.disconnect();reduced.removeEventListener('change',restart);document.removeEventListener('visibilitychange',restart)}
  },[active])
  return <div className="loom-art" onPointerMove={e=>{
    const r=e.currentTarget.getBoundingClientRect()
    const scale=Math.min(r.width/1000,r.height/320)
    pointer.current={...pointer.current,x:(e.clientX-r.left-(r.width-1000*scale)/2)/scale,y:(e.clientY-r.top-(r.height-320*scale)/2)/scale,on:true}
  }} onPointerLeave={()=>{pointer.current.on=false}} onPointerDown={()=>{pointer.current.impulse=1}} onPointerUp={e=>{if(e.pointerType!=='mouse')pointer.current.on=false}} onPointerCancel={()=>{pointer.current.on=false}}>
    <svg className="loom-paint" width="0" height="0" aria-hidden="true"><defs>
      <linearGradient id="loom-mark-gradient" x1="0%" y1="0%" x2="65%" y2="100%">
        <stop offset="0%" stopColor="#829475" /><stop offset="48%" stopColor="#6d8162" /><stop offset="100%" stopColor="#50664a" />
      </linearGradient>
    </defs></svg>
    <canvas ref={canvas} aria-hidden="true" />
    <div className="loom-sign" aria-hidden="true"><Mark className="loom-mark" /><span className="loom-dot" /></div>
  </div>
}
