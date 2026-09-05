import type { ReactNode } from 'react'

type Props = {
  label: string
  fill?: 'paper' | 'moss'
  className?: string
  id?: string
  children: ReactNode
}

/* Плитка с вырезом под ярлык. Раньше её разметка копировалась в
   каждый блок и разъезжалась; теперь форма описана один раз. */
export function Tile({ label, fill = 'paper', className = '', id, children }: Props) {
  return (
    <article id={id} className={`tile ${className}`} data-fill={fill}>
      <div className="notch-row">
        <h2 className="notch-label">{label}</h2>
        <span className="notch-fill" aria-hidden="true" />
      </div>
      <div className="tile-body">{children}</div>
    </article>
  )
}
