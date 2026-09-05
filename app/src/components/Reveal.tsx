import { motion } from 'motion/react'
import type { ReactNode } from 'react'

/* Появление по частям. Первый экран собирается не разом, а один блок
   за другим: сперва садится замок в шапке, и только потом приходит
   всё остальное. Разом всё это выглядело как подмена картинки. */

const EASE = [0.16, 1, 0.3, 1] as const

const group = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.11, delayChildren: 0.08 },
  },
}

const piece = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.66, ease: EASE },
  },
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
  return (
    <motion.div
      className={className}
      variants={group}
      initial="hidden"
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
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
