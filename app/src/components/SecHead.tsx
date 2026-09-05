import type { ReactNode } from 'react'

/* Шапка раздела. Номер красится охрой: номера идут сквозь всю
   страницу и несут вторую краску сверху донизу. В тёмной зоне охра
   подменяется светлой — тёмная даёт там 3.5:1 и не читается. */
export function SecHead({
  index,
  title,
  count,
  children,
}: {
  index: string
  title: string
  count?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mb-[clamp(1.25rem,3vw,2rem)] flex flex-wrap items-baseline gap-[0.85rem]">
      <span className="text-xs tracking-[0.06em] text-amber tabular-nums in-[[data-tone=night]]:text-night-amber">
        {index}
      </span>
      <h2 className="m-0 font-display text-[clamp(1.2rem,2.2vw,1.65rem)] font-semibold tracking-[-0.035em] uppercase">
        {title}
      </h2>
      {count && (
        <span className="ms-auto text-xs text-ink-muted tabular-nums in-[[data-tone=night]]:text-night-muted">
          {count}
        </span>
      )}
      {children && (
        <p className="max-w-[52ch] basis-full text-sm text-ink-muted in-[[data-tone=night]]:text-night-muted">
          {children}
        </p>
      )}
    </div>
  )
}
