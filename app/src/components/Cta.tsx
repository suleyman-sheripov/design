import { useRef, type ReactNode } from 'react'
import { useFinePointer } from '../lib/pointer'
import { Symbiote } from './Symbiote'

/* Главный призыв.

   Заливку кнопка отдаёт слою с фильтром только тогда, когда этот
   слой действительно построен. На ванильной версии transparent
   стоял безусловно, а слой строил симбиот — который не заводится на
   сенсорных экранах. Кнопка там оставалась кремовым текстом на
   кремовой бумаге, и это никто не видел, потому что смотрели с
   мыши. Здесь оба решения приходят из одного ответа. */
export function Cta({ href, children }: { href: string; children: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null)
  const fine = useFinePointer()

  return (
    <a
      ref={ref}
      href={href}
      data-cursor="link"
      data-cursor-label="К контактам"
      className={`relative isolate inline-flex shrink-0 items-center justify-center self-start rounded-full px-[1.45rem] py-[0.78rem] text-sm font-semibold text-paper no-underline ${
        fine ? '' : 'bg-ink'
      }`}
    >
      {fine && <Symbiote target={ref} />}
      <span className="relative z-1">{children}</span>
    </a>
  )
}
