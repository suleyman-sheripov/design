import type { ReactNode } from 'react'

/* Главный призыв. Заливка живёт на самой кнопке, а не на слое с
   фильтром: на ванильной версии слой строил только симбиот, а он
   не заводится на сенсорных экранах, и кнопка там оставалась
   кремовым текстом на кремовой бумаге. Симбиот здесь надстройка
   поверх работающей кнопки, а не условие её видимости. */
export function Cta({
  href,
  children,
  ref,
}: {
  href: string
  children: ReactNode
  ref?: React.Ref<HTMLAnchorElement>
}) {
  return (
    <a
      ref={ref}
      href={href}
      data-cursor="link"
      data-cursor-label="К контактам"
      className="relative isolate inline-flex shrink-0 items-center justify-center self-start rounded-full bg-ink px-[1.45rem] py-[0.78rem] text-sm font-semibold text-paper no-underline"
    >
      <span className="relative z-1">{children}</span>
    </a>
  )
}
