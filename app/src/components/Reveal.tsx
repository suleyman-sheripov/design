import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'

/* Появление по частям. Первый экран собирается не разом, а один блок
   за другим: сперва садится замок в шапке, и только потом приходит
   всё остальное. Разом это читалось подменой картинки.

   У каждого появления есть страховка по таймеру. Причина та же, что
   у занавеса: в фоновой вкладке кадры не выдаются, анимация не
   стартует, и блок остаётся с нулевой прозрачностью навсегда. По
   истечении срока страховка задаёт видимость через CSS. Тип обёртки
   остаётся прежним, чтобы React не перемонтировал печать имени. */

const EASE = [0.16, 1, 0.3, 1] as const

const STEP = 0.11
const DUR = 0.66

const group = {
  hidden: {},
  show: { transition: { staggerChildren: STEP, delayChildren: 0.08 } },
}

const piece = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DUR, ease: EASE } },
}

/* Сколько ждать, прежде чем считать, что кадров не будет */
function useSafety(active: boolean, ms: number) {
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!active) return
    const id = setTimeout(() => setExpired(true), ms)
    return () => clearTimeout(id)
  }, [active, ms])

  return expired
}

export function Stagger({
  show,
  className,
  children,
}: {
  show: boolean
  className?: string
  children: ReactNode
}) {
  /* Запас на восемь блоков плюс само появление плюс секунда сверху */
  const expired = useSafety(show, (8 * STEP + DUR) * 1000 + 1000)
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={`${className ?? ''} ${show && (expired || reduced) ? 'reveal-safe' : ''}`}
      variants={group}
      initial={reduced ? false : 'hidden'}
      animate={show ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}

export function Piece({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <motion.div className={className} variants={piece}>
      {children}
    </motion.div>
  )
}

/* Разделы ниже сгиба приходят по мере прокрутки, а не по очереди с
   первым экраном: очередь там уже не читается. */
export function InView({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  /* Здесь срок длиннее: до раздела ещё нужно доскроллить, и рано
     снятая анимация просто лишила бы его появления */
  const expired = useSafety(true, 12000)
  const reduced = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 18 }}
      style={expired || reduced ? { opacity: 1, transform: 'none' } : undefined}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
