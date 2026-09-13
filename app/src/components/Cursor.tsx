import { useMotionValue, useSpring, animate } from 'motion/react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/* Курсор: кольцо с точкой внутри. Кольцо догоняет руку с заметным
   отставанием, точка ведёт и отстаёт меньше — между ними возникает
   натяжение, по которому и читается скорость.

   Рядом с интерактивным элементом точка тянется к его центру, а
   кольцо остаётся на указателе: получается, что курсор до элемента
   дотягивается раньше руки.

   Пружины взяты из motion, а не написаны руками: на ванильной
   версии для этого жил отдельный физический модуль. */

/* Дальше этого притяжения нет: иначе точка дёргается к каждому
   элементу на экране */
const REACH = 120
const PULL_MAX = 13

const TARGETS = 'a, button, [data-cursor], input, textarea, select, summary'

/* Над этими поверхностями курсор перекрашивается в светлый */
const DARK = '[data-tone="night"], .cta, [data-fill="moss"]'

export function Cursor() {
  const [on, setOn] = useState(false)
  const [dark, setDark] = useState(false)
  const [near, setNear] = useState(false)

  const ringX = useSpring(0, { stiffness: 190, damping: 20, mass: 0.6 })
  const ringY = useSpring(0, { stiffness: 190, damping: 20, mass: 0.6 })
  const tipX = useSpring(0, { stiffness: 430, damping: 26, mass: 0.4 })
  const tipY = useSpring(0, { stiffness: 430, damping: 26, mass: 0.4 })

  const scale = useMotionValue(1)
  const raf = useRef(0)

  useEffect(() => {
    /* Только там, где есть настоящий указатель: на тач-экране
       подменять нечего, а системный курсор прятать нельзя */
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return

    setOn(true)
    document.documentElement.classList.add('has-cursor')

    const move = (e: PointerEvent) => {
      ringX.set(e.clientX)
      ringY.set(e.clientY)

      const el = (e.target as Element | null)?.closest?.(TARGETS) ?? null
      setDark(!!(e.target as Element | null)?.closest?.(DARK))
      setNear(!!el)

      /* Точка тянется к центру элемента, но не дальше PULL_MAX:
         полное притяжение к центру читалось бы как прилипание */
      let tx = e.clientX
      let ty = e.clientY

      if (el) {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const d = Math.hypot(dx, dy)

        if (d > 0.5 && d < REACH) {
          /* Ближе к элементу тянет сильнее, дальше — слабее */
          const pull = Math.min(PULL_MAX, d) * (1 - d / REACH)
          tx += (dx / d) * pull
          ty += (dy / d) * pull
        }
      }

      tipX.set(tx)
      tipY.set(ty)
    }

    const leave = () => setOn(false)
    const enter = () => setOn(true)
    const down = () => animate(scale, 0.82, { duration: 0.12 })
    const up = () => animate(scale, 1, { duration: 0.28 })

    addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    document.addEventListener('pointerenter', enter)
    addEventListener('pointerdown', down)
    addEventListener('pointerup', up)

    return () => {
      removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      document.removeEventListener('pointerenter', enter)
      removeEventListener('pointerdown', down)
      removeEventListener('pointerup', up)
      cancelAnimationFrame(raf.current)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [ringX, ringY, tipX, tipY, scale])

  if (!on) return null

  const tone = dark ? 'var(--color-paper)' : 'var(--color-ink)'

  return (
    <>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[100] rounded-full border"
        style={{
          x: ringX,
          y: ringY,
          scale,
          width: 30,
          height: 30,
          marginLeft: -15,
          marginTop: -15,
          borderColor: tone,
          opacity: near ? 0.9 : 0.45,
        }}
      />
      <motion.span
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[100] rounded-full"
        style={{
          x: tipX,
          y: tipY,
          width: 5,
          height: 5,
          marginLeft: -2.5,
          marginTop: -2.5,
          background: tone,
        }}
      />
    </>
  )
}
