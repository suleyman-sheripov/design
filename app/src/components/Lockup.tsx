import { motion } from 'motion/react'
import { Mark } from './Mark'

/* Замок «Ш.ERIPOV».

   Вся геометрия выражена в em от кегля строки, поэтому её считает
   браузер. На ванильной версии те же величины выводились в рантайме
   из метрик шрифта через canvas, и это стоило трёх багов подряд:
   гонка с загрузкой шрифта переставляла знак посреди анимации,
   пересчёт на resize затирал трансформу интро, а точка отсчёта
   масштаба не совпадала с высотой коробки, и знак обрезался.

   Считать было незачем: cap height у Unbounded 600 — величина
   постоянная, 0.75em. Замерена один раз через TextMetrics
   (actualBoundingBoxAscent для «H» при кегле 100 = 75). */
export const CAP = 0.75

/* Доли высоты прописных, как в исходной раскладке */
const MARK_ASPECT = 483 / 300
const GAP_MARK_DOT = 0.2
const GAP_DOT_TEXT = 0.16
const DOT = 0.3
export const BALL = 0.64

/* Переведено в em строки: em = CAP * доля */
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

/* Шарик едет по середине прописных и садится в точку. Обе величины
   отмеряются от знака: это единственный элемент, чья коробка равна
   ровно высоте прописных, поэтому привязка к нему не врёт. */
export const ballHome = {
  top: CAP_TOP + (em.markH - em.ball) / 2,
  left: em.markW + em.gapMarkDot + (em.dot - em.ball) / 2,
}

/* Кадры для отдельных частей. Их задаёт интро и передаёт сюда, а не
   импортирует замок из интро: иначе шапка зависела бы от занавеса,
   который к моменту её показа уже снят. */
type PartAnim = Record<string, unknown>

type Props = {
  /* Части замка анимируются интро по отдельности, поэтому им нужны
     сквозные имена: по ним motion перевозит замок из занавеса
     в шапку сам, без ручного пересчёта координат */
  animated?: boolean
  parts?: { mark: PartAnim; dot: PartAnim; rest: PartAnim }
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}

export function Lockup({ animated = false, parts, className = '', ...rest }: Props) {
  const Part = animated ? motion.span : 'span'
  const props = (name: string, anim?: PartAnim) =>
    animated ? { layoutId: `lockup-${name}`, ...anim } : {}

  return (
    <span
      {...rest}
      className={`inline-flex items-baseline font-display leading-none font-semibold tracking-[-0.04em] ${className}`}
    >
      {/* inline-block: базовая линия у него — нижняя кромка, поэтому
          низ знака садится ровно на базовую линию строки */}
      <Part
        {...props('mark', parts?.mark)}
        className="relative inline-block shrink-0"
        style={{ width: `${em.markW}em`, height: `${em.markH}em` }}
      >
        <Mark className="h-full w-full" />
      </Part>

      <Part
        {...props('dot', parts?.dot)}
        className="inline-block shrink-0 rounded-full bg-moss"
        style={{
          width: `${em.dot}em`,
          height: `${em.dot}em`,
          marginInline: `${em.gapMarkDot}em ${em.gapDotText}em`,
        }}
      />

      <Part {...props('rest', parts?.rest)} className="inline-block whitespace-nowrap">
        ERIPOV
      </Part>
    </span>
  )
}
