import { useEffect, useRef, useState } from 'react'
import { shotSrc, type Project } from '../data'
import { SecHead } from './SecHead'

/* Работы смотрят с тёмного, как слайды на просвет. Это единственная
   инверсия на сайте, и она разделяет «что я делаю» и «что уже
   сделано». */

function plural(n: number) {
  const tail = n % 10
  if (n > 4 && n < 21) return 'работ'
  if (tail === 1) return 'работа'
  if (tail > 1 && tail < 5) return 'работы'
  return 'работ'
}

/* Лента тянется мышью, а не только колесом: на широком экране это
   единственный способ пройти её без трекпада. */
function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0
    let startScroll = 0
    let dragging = false

    const down = (e: PointerEvent) => {
      /* Только основная кнопка и только мышь: на тач-экране
         прокрутка своя и перехватывать её нечем */
      if (e.button !== 0 || e.pointerType !== 'mouse') return
      dragging = true
      startX = e.clientX
      startScroll = el.scrollLeft
    }

    const move = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      /* Пять пикселей — порог, после которого это уже протяжка, а
         не клик по кейсу */
      if (Math.abs(dx) > 5) el.setPointerCapture(e.pointerId)
      el.scrollLeft = startScroll - dx
    }

    const up = () => {
      dragging = false
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    addEventListener('pointerup', up)

    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
    }
  }, [])

  return ref
}

export function Work({
  projects,
  failed,
  onOpen,
}: {
  projects: Project[] | null
  failed: boolean
  onOpen: (p: Project) => void
}) {
  const rail = useDragScroll<HTMLDivElement>()

  return (
    <section
      id="work"
      data-tone="night"
      aria-labelledby="workTitle"
      className="bg-night py-[clamp(2.5rem,6vw,4.5rem)] text-night-ink"
    >
      <div className="mx-auto w-full max-w-[var(--shell)] px-[var(--gutter)]">
        <SecHead
          index="01"
          title="Работы"
          count={projects ? `${projects.length} ${plural(projects.length)}` : undefined}
        />
        {!projects && (
          <p className="text-sm text-night-muted">
            {failed ? 'Не удалось загрузить работы.' : 'Загружаю работы…'}
          </p>
        )}
      </div>

      {projects && (
        <div
          ref={rail}
          data-cursor="drag"
          data-cursor-label="Тяни"
          /* scroll-padding, а не только padding: без него снап
             прижимает первую карточку к самому краю контейнера,
             и она перестаёт совпадать с заголовком раздела */
          className="mt-2 flex snap-x snap-mandatory gap-[clamp(0.8rem,1.6vw,1.4rem)] overflow-x-auto px-[var(--shell-pad)] pb-6 [scroll-behavior:auto] [scroll-padding-inline:var(--shell-pad)] [scrollbar-width:thin]"
        >
          {projects.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => onOpen(p)}
              className="group w-[min(78vw,var(--card))] shrink-0 cursor-pointer snap-start border-0 bg-transparent p-0 text-start text-inherit"
              style={
                {
                  '--card': p.ratio === 'tall' ? '340px' : '540px',
                } as React.CSSProperties
              }
            >
              <img
                src={shotSrc(p.cover)}
                alt=""
                loading={i < 2 ? 'eager' : 'lazy'}
                className="aspect-[16/10] w-full rounded-tile object-cover transition-transform duration-500 ease-out group-hover:scale-[1.015]"
              />
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-xs text-night-amber tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <span className="block font-display text-[clamp(1rem,1.7vw,1.25rem)] font-semibold tracking-[-0.03em]">
                    {p.title}
                  </span>
                  <span className="mt-1 block text-xs text-night-muted">
                    {p.kind} · {p.role}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

/* Разбор кейса. Нативный dialog: он сам закрывается по Escape,
   сам держит фокус внутри и сам ставится поверх всего, без
   собственного слоя и обработчиков. */
export function CaseSheet({
  project,
  onClose,
}: {
  project: Project | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (project && !el.open) el.showModal()
    if (!project && el.open) el.close()
  }, [project])

  /* Пока открыт разбор, страница под ним не едет */
  useEffect(() => {
    if (!project) return
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [project])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        /* Клик по подложке закрывает: цель события — сам dialog
           только когда попали мимо его содержимого */
        if (e.target === ref.current) onClose()
      }}
      className="m-auto max-h-[88vh] w-[min(92vw,880px)] rounded-tile border-0 bg-night p-0 text-night-ink backdrop:bg-black/60"
    >
      {project && (
        <div className="max-h-[88vh] overflow-y-auto p-[clamp(1.25rem,3vw,2.25rem)]">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="m-0 font-display text-[clamp(1.5rem,3.6vw,2.2rem)] font-semibold tracking-[-0.04em]">
                {project.title}
              </h3>
              <p className="mt-2 text-sm text-night-muted">
                {project.kind} · {project.role} · {project.year}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-cursor="link"
              className="shrink-0 cursor-pointer rounded-full border border-night-rule px-4 py-2 text-xs text-night-ink"
            >
              Закрыть
            </button>
          </div>

          <p className="mt-4 max-w-[62ch] text-sm text-night-muted">{project.note}</p>

          <div className="mt-6 flex flex-col gap-[clamp(0.6rem,1.4vw,1rem)]">
            {project.shots.map((shot) => (
              <img
                key={shot.file}
                src={shotSrc(shot.file)}
                alt={shot.alt}
                loading="lazy"
                className="w-full rounded-s"
              />
            ))}
          </div>
        </div>
      )}
    </dialog>
  )
}
