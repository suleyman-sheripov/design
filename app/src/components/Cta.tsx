import { useRef, type ReactNode } from 'react'
import { useFinePointer } from '../lib/pointer'
import { Symbiote } from './Symbiote'

// Базовая заливка видна и до запуска фильтра, и на сенсорном экране.
export function Cta({ href, children }: { href: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const fine = useFinePointer()

  return (
    <a
      ref={ref}
      href={href}
      data-cursor="link"
      data-cursor-label="К контактам"
      /* Мох вместо чернил: на почти пустом экране кнопка — самое
         крупное пятно, и оно же теперь несёт основную краску.
         6.6:1 кремового по мху, проходит AA. */
      className="living-cta relative isolate inline-flex shrink-0 items-center justify-center self-start rounded-full bg-moss px-[1.45rem] py-[0.78rem] text-sm font-semibold text-moss-on no-underline"
    >
      {fine && <Symbiote target={ref} />}
      <span className="relative z-1">{children}</span>
    </a>
  )
}
