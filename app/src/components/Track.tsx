import { useEffect, useRef, useState } from 'react'
import { jobKind, type Job } from '../data'

/* Цвет точки различает род занятия: работа на клиента, обучение
   других и собственная учёба. Это разные вещи, а в списке они
   стоят вперемешку. */
const dotColor = {
  client: 'bg-moss',
  teaching: 'bg-amber',
  study: 'bg-rule',
} as const

/* Мест бывает больше, чем помещается в плитку, и это должно быть
   видно без подписи «прокрутите». Низ растворяется маской, но
   только когда под краем правда что-то есть: растворять последнюю
   строку, под которой пусто, значит обещать продолжение, которого
   не существует. */
function useIsCut<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [cut, setCut] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => setCut(el.scrollHeight > el.clientHeight + 1)
    check()

    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, cut }
}

export function Track({ track }: { track: Job[] }) {
  const { ref, cut } = useIsCut<HTMLOListElement>()

  return (
    <ol
      ref={ref}
      tabIndex={0}
      aria-label="Места работы"
      className="min-h-0 flex-1 list-none overflow-y-auto p-0 pt-0.5 [scrollbar-width:none]"
      style={
        cut
          ? { maskImage: 'linear-gradient(to top, transparent 0, #000 2.6rem)' }
          : undefined
      }
    >
      {track.map((job, i) => {
        const kind = jobKind(job.kind)
        const last = i === track.length - 1

        return (
          <li
            key={job.client + job.period}
            className="relative grid grid-cols-[7px_minmax(0,1fr)_auto] items-baseline gap-x-[0.8rem] py-[0.55rem]"
          >
            {/* Нить идёт по центру колонки точек и обрывается на
                последней: вести её в пустоту незачем */}
            <span
              aria-hidden="true"
              className={`absolute left-[3px] top-0 w-px bg-rule ${last ? 'bottom-1/2' : 'bottom-0'}`}
            />
            {/* Обводка цветом плитки прорезает нить, иначе точка
                сидит на ней пятном */}
            <span
              aria-hidden="true"
              className={`relative z-1 size-[7px] translate-y-[0.35em] rounded-full shadow-[0_0_0_3px_var(--tile-bg)] ${dotColor[kind]}`}
            />

            <div>
              <span
                className={`block font-display text-[clamp(0.9rem,1.1vw,1rem)] leading-[1.15] font-semibold tracking-[-0.03em] ${
                  kind === 'study' ? 'text-ink-muted' : ''
                }`}
              >
                {job.role}
              </span>
              <span className="mt-1 block text-xs text-ink-muted">{job.client}</span>
            </div>

            <span className="text-xs text-ink-muted tabular-nums whitespace-nowrap">
              {job.period}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
