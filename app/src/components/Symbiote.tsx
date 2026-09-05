import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/* Кнопка-симбиот.

   Тело кнопки и капля — две отдельные фигуры внутри одного слоя с
   фильтром goo: размытие плюс резкий порог по альфе сплавляет их в
   одну тягучую массу. Подпись лежит выше слоя и в фильтр не
   попадает, иначе размылась бы вместе с фоном.

   Капля тянется к указателю во все стороны. В покое она живёт своей
   жизнью: выглядывает из кнопки, оглядывается и втягивается
   обратно. Если рука пошла к кнопке, пока голова снаружи, голова
   ныряет обратно мгновенно. */

const DROP_R = 29
const OUT_MAX = 52
const REACH = 190

/* Насколько глубоко ближний край капли обязан оставаться внутри
   кнопки. Ниже этого фильтр перестаёт склеивать фигуры, и капля
   отрывается — так и было, пока вылет считался от центра. */
const KEEP_IN = 0.62

type Mode = 'idle' | 'peek' | 'look' | 'dive' | 'reach'

/* Расстояние от центра прямоугольника до его края вдоль направления */
function edgeAlong(w: number, h: number, ux: number, uy: number) {
  const hx = w / 2
  const hy = h / 2
  const tx = ux === 0 ? Infinity : Math.abs(hx / ux)
  const ty = uy === 0 ? Infinity : Math.abs(hy / uy)
  return Math.min(tx, ty)
}

export function Symbiote({ target }: { target: React.RefObject<HTMLElement | null> }) {
  const [on, setOn] = useState(false)
  const [eyes, setEyes] = useState(false)

  const x = useSpring(0, { stiffness: 210, damping: 18, mass: 0.9 })
  const y = useSpring(0, { stiffness: 210, damping: 18, mass: 0.9 })
  const size = useSpring(0, { stiffness: 260, damping: 22, mass: 0.8 })

  /* Взгляд: зрачки ведут туда же, куда потянулась голова */
  const gazeX = useMotionValue(0)
  const gazeY = useMotionValue(0)

  const mode = useRef<Mode>('idle')
  const pointer = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setOn(true)

    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
    }
    addEventListener('pointermove', move, { passive: true })
    return () => removeEventListener('pointermove', move)
  }, [])

  useEffect(() => {
    if (!on) return

    let frame = 0
    let idleUntil = performance.now() + (9 + Math.random() * 11) * 1000
    let stateUntil = 0
    let angle = 0

    const tick = () => {
      frame = requestAnimationFrame(tick)

      const el = target.current
      if (!el) return

      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const px = pointer.current.x
      const py = pointer.current.y

      const dx = px - cx
      const dy = py - cy
      const d = Math.hypot(dx, dy)
      const now = performance.now()

      /* Указатель внутри кнопки — капля прячется: тянуться к руке,
         которая уже здесь, незачем */
      const inside =
        px >= r.left && px <= r.right && py >= r.top && py <= r.bottom

      if (inside) {
        mode.current = 'idle'
        idleUntil = now + 4000
        size.set(0)
        setEyes(false)
        return
      }

      if (d < REACH) {
        /* Рука рядом. Если голова была снаружи, она ныряет: резкий
           уход читается как испуг и оживляет кнопку сильнее, чем
           плавный переход */
        if (mode.current === 'peek' || mode.current === 'look') {
          mode.current = 'dive'
          stateUntil = now + 260
          size.set(0)
          setEyes(false)
        } else if (mode.current !== 'dive' || now > stateUntil) {
          mode.current = 'reach'
        }
      } else if (mode.current === 'reach' || mode.current === 'dive') {
        mode.current = 'idle'
        idleUntil = now + (9 + Math.random() * 11) * 1000
        size.set(0)
        setEyes(false)
      }

      if (mode.current === 'reach') {
        const ux = dx / (d || 1)
        const uy = dy / (d || 1)
        /* Ближе рука — больше капля и дальше вылет */
        const near = 1 - d / REACH
        size.set(0.35 + near * 0.65)

        const edge = edgeAlong(r.width, r.height, ux, uy)
        const dropR = DROP_R * Math.max(0.2, 0.35 + near * 0.65)
        const out = Math.min(d, OUT_MAX) * near
        /* Ближний край капли всегда остаётся внутри кнопки, поэтому
           фильтру всегда есть что склеивать */
        const reach = edge + Math.min(out, dropR * KEEP_IN)

        x.set(ux * reach)
        y.set(uy * reach)
        gazeX.set(ux)
        gazeY.set(uy)
        setEyes(near > 0.35)
        return
      }

      /* Покой. Голова выглядывает, оглядывается и втягивается. */
      if (mode.current === 'idle' && now > idleUntil) {
        mode.current = 'peek'
        stateUntil = now + 900
        angle = Math.random() * Math.PI * 2
        size.set(0.8)
        setEyes(true)
      }

      if (mode.current === 'peek' && now > stateUntil) {
        mode.current = 'look'
        stateUntil = now + 1800
      }

      if (mode.current === 'look' && now > stateUntil) {
        mode.current = 'idle'
        idleUntil = now + (9 + Math.random() * 11) * 1000
        size.set(0)
        setEyes(false)
      }

      if (mode.current === 'peek' || mode.current === 'look') {
        /* Оглядывается медленно, вокруг выбранного направления */
        const wobble = mode.current === 'look' ? Math.sin(now / 620) * 0.9 : 0
        const a = angle + wobble
        const ux = Math.cos(a)
        const uy = Math.sin(a)
        const edge = edgeAlong(r.width, r.height, ux, uy)
        const dropR = DROP_R * 0.8
        const reach = edge + dropR * KEEP_IN

        x.set(ux * reach)
        y.set(uy * reach)
        gazeX.set(ux)
        gazeY.set(uy)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [on, target, x, y, size, gazeX, gazeY])

  const scale = useTransform(size, (v) => v)
  const pupilX = useTransform(gazeX, (v) => v * 2.2)
  const pupilY = useTransform(gazeY, (v) => v * 2.2)

  if (!on) return null

  return (
    <>
      <span className="pointer-events-none absolute inset-0 z-0 [filter:url(#goo)]">
        <span className="absolute inset-0 rounded-full bg-ink" />
        <motion.span
          className="absolute top-1/2 left-1/2 rounded-full bg-ink"
          style={{
            x,
            y,
            scale,
            width: DROP_R * 2,
            height: DROP_R * 2,
            marginLeft: -DROP_R,
            marginTop: -DROP_R,
          }}
        />
      </span>

      {/* Глаза лежат выше слоя с фильтром: попади они под goo,
          размылись бы вместе с телом и стали пятном */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-1 flex gap-[7px]"
        style={{ x, y, marginLeft: -11, marginTop: -3, opacity: eyes ? 1 : 0 }}
      >
        {[0, 1].map((i) => (
          <span key={i} className="size-[7px] rounded-full bg-paper">
            <motion.span
              className="block size-[3px] rounded-full bg-ink"
              style={{ x: pupilX, y: pupilY, marginLeft: 2, marginTop: 2 }}
            />
          </span>
        ))}
      </motion.span>
    </>
  )
}

/* Фильтр живёт в скрытом SVG: он нужен как ссылка, а не как
   изображение. Размытие плюс резкий порог по альфе — то, что
   сплавляет две фигуры в одну массу. */
export function GooDefs() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute size-0">
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
  )
}
