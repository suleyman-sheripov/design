import { motion, useTransform, type MotionValue } from 'motion/react'
import { Mark } from './Mark'

/* Замок «Ш.ERIPOV».

   Вся геометрия выражена в em от кегля строки, поэтому её считает
   браузер. Cap height у Unbounded 600 — величина постоянная, 0.75em,
   замерена один раз через TextMetrics (actualBoundingBoxAscent для
   «H» при кегле 100 равен 75). */
export const CAP = 0.75

const MARK_ASPECT = 483 / 300
const GAP_MARK_DOT = 0.2
const GAP_DOT_TEXT = 0.16
const DOT = 0.3
export const BALL = 0.64

export const em = {
  markW: CAP * MARK_ASPECT,
  markH: CAP,
  dot: CAP * DOT,
  ball: CAP * BALL,
  gapMarkDot: CAP * GAP_MARK_DOT,
  gapDotText: CAP * GAP_DOT_TEXT,
}

/* Верх прописных относительно верха коробки замка. При line-height 1
   строчная коробка равна 1em, а содержимое шрифта — 1.25em (ascent 1,
   descent 0.25), значит полуинтерлиньяж равен -0.125em, базовая линия
   стоит на 0.875em от верха коробки, а верх прописных — на
   0.875 - 0.75 = 0.125em. Проверено замером: при кегле 24 знак
   начинается на 3 px ниже коробки строки. */
export const CAP_TOP = 0.125

/* Базовая линия от верха коробки */
export const BASELINE = 0.875

export type LockupMotions = {
  markX: MotionValue<number>
  markY: MotionValue<number>
  restX: MotionValue<number>
  restY: MotionValue<number>
  dotOpacity: MotionValue<number>
}

type Props = {
  /* Перелёт из занавеса в шапку motion делает сам по layoutId */
  animated?: boolean
  /* Хореография интро. Живёт на ВЛОЖЕННОМ элементе, а не на том, что
     несёт layoutId: motion забирает трансформу внешнего элемента под
     свой перелёт и перебивает чужие x и y. Из-за этого половины на
     прошлой версии не падали и не сходились, а просто возникали уже
     собранными. */
  motions?: LockupMotions
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}

export function Lockup({ animated = false, motions, className = '', ...rest }: Props) {
  const Part = animated ? motion.span : 'span'
  const id = (name: string) => (animated ? { layoutId: `lockup-${name}` } : {})

  return (
    <span
      {...rest}
      className={`inline-flex items-baseline font-display leading-none font-semibold tracking-[-0.04em] ${className}`}
    >
      {/* inline-block: базовая линия у него — нижняя кромка, поэтому
          низ знака садится ровно на базовую линию строки */}
      <Part
        {...id('mark')}
        className="relative inline-block shrink-0"
        style={{ width: `${em.markW}em`, height: `${em.markH}em` }}
      >
        <Choreo x={motions?.markX} y={motions?.markY} className="block h-full w-full">
          <Mark className="h-full w-full" />
        </Choreo>
      </Part>

      <Part
        {...id('dot')}
        className="inline-block shrink-0"
        style={{
          width: `${em.dot}em`,
          height: `${em.dot}em`,
          marginInline: `${em.gapMarkDot}em ${em.gapDotText}em`,
        }}
      >
        <motion.span
          className="block size-full rounded-full bg-moss"
          style={motions ? { opacity: motions.dotOpacity } : undefined}
        />
      </Part>

      <Part {...id('rest')} className="inline-block whitespace-nowrap">
        <Choreo x={motions?.restX} y={motions?.restY} className="inline-block">
          ERIPOV
        </Choreo>
      </Part>
    </span>
  )
}

/* Сдвиг в em: величины приходят числами, здесь получают единицу.
   Замок без хореографии рисуется другим компонентом, а не этим же с
   пустыми значениями: так число вызовов хуков не зависит от входных
   данных. */
function Choreo({
  x,
  y,
  className,
  children,
}: {
  x?: MotionValue<number>
  y?: MotionValue<number>
  className?: string
  children: React.ReactNode
}) {
  if (!x || !y) return <span className={className}>{children}</span>
  return (
    <Moving x={x} y={y} className={className}>
      {children}
    </Moving>
  )
}

function Moving({
  x,
  y,
  className,
  children,
}: {
  x: MotionValue<number>
  y: MotionValue<number>
  className?: string
  children: React.ReactNode
}) {
  const ex = useTransform(x, (v) => `${v}em`)
  const ey = useTransform(y, (v) => `${v}em`)

  return (
    <motion.span className={className} style={{ x: ex, y: ey }}>
      {children}
    </motion.span>
  )
}
