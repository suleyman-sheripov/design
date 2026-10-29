import { motion, useReducedMotion } from 'motion/react'
import { BrandLogo } from './BrandLogo'

type Props = {
  animated?: boolean
  className?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}
export function Lockup({ animated = false, className = '', ...rest }: Props) {
  const reduced = useReducedMotion()
  const Element = animated ? motion.span : 'span'
  return <Element {...rest} {...(animated ? { layoutId: 'brand-lockup', crossfade: false, transition: { duration: reduced ? 0 : 0.72, ease: [0.76, 0, 0.24, 1] as const } } : {})} className={`brand-lockup ${className}`}>
    <BrandLogo />
  </Element>
}
