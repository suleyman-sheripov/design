import { useEffect, useRef, useState } from 'react'
import { jobKind, type Job } from '../data'
import * as sound from '../lib/sound'
import { SecHead } from './SecHead'

/* Опыт на всю ширину.

   Через полторы секунды после того, как раздел показался, слева
   из-за края экрана влетает тот же зелёный шар. Он проскакивает
   поперёк, и под каждым его отскоком встаёт строка: тык, тык, тык.
   Отскочив в последний раз, шар улетает за правый край.

   Точка входа и выхода считаются от ширины окна, а не задаются
   числом: на широком экране заданное число оставило бы шар
   в кадре. */

const dotColor = {
  client: 'bg-moss',
  teaching: 'bg-amber',
  study: 'bg-rule',
} as const

/* Пауза после появления раздела. Сразу — и посетитель не успевает
   понять, куда смотреть; позже — и он уже отвёл взгляд. */
const DELAY_MS = 1500

/* Высота подскока и время одного пролёта между строками */
const HOP_H = 86
const HOP_MS = 320

type Phase = 'idle' | 'run' | 'done'

export function Experience({ track }: { track: Job[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const rows = useRef<(HTMLLIElement | null)[]>([])

  const [phase, setPhase] = useState<Phase>('idle')
  const [shown, setShown] = useState(0)
  const [ball, setBall] = useState({ x: -200, y: 0, on: false })

  /* Ждём, пока раздел покажется, и только потом заводим паузу */
  useEffect(() => {
    const el = wrap.current
    if (!el) return

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(track.length)
      setPhase('done')
      return
    }

    let timer = 0

    /* Опрос таймером, а не событие прокрутки и не наблюдатель
       пересечения. Оба они работают через конвейер отрисовки, и там,
       где кадры придерживают, оба молчат — раздел так и оставался с
       невидимыми строками. Таймер идёт всегда. Пять опросов в
       секунду и только до срабатывания: это дешевле одного кадра. */
    const poll = window.setInterval(() => {
      const b = el.getBoundingClientRect()
      /* Верх раздела вошёл в кадр на три четверти его высоты.
         Считаем от окна, а не от самого раздела: доля собственной
         высоты невыполнима, когда раздел выше окна, и на невысоком
         экране он не завёлся бы никогда. */
      if (b.top >= innerHeight * 0.75 || b.bottom <= 0) return

      clearInterval(poll)
      timer = window.setTimeout(() => setPhase('run'), DELAY_MS)
    }, 200)

    /* Страховка: что бы ни случилось, строки обязаны появиться */
    const guard = window.setTimeout(() => setShown(track.length), DELAY_MS + 6000)

    return () => {
      clearInterval(poll)
      clearTimeout(timer)
      clearTimeout(guard)
    }
  }, [track.length])

  /* Пролёт. Шар идёт от строки к строке: в момент касания каждой
     появляется её содержимое. */
  useEffect(() => {
    if (phase !== 'run') return

    const el = wrap.current
    if (!el) return

    const box = el.getBoundingClientRect()
    const targets = rows.current
      .slice(0, track.length)
      .map((r) => {
        if (!r) return null
        const b = r.getBoundingClientRect()
        return { x: b.left - box.left + 26, y: b.top - box.top + b.height - 6 }
      })
      .filter(Boolean) as { x: number; y: number }[]

    if (!targets.length) return

    /* Влетает из-за левого края и улетает за правый: обе точки от
       фактической ширины, а не числом */
    const enter = -box.left - 80
    const exit = box.width + (innerWidth - box.right) + 120

    const stops = [
      { x: enter, y: targets[0].y - HOP_H, hit: -1 },
      ...targets.map((t, i) => ({ x: t.x, y: t.y, hit: i })),
      { x: exit, y: targets[targets.length - 1].y - HOP_H * 1.4, hit: -1 },
    ]

    setBall({ x: stops[0].x, y: stops[0].y, on: true })

    let i = 0
    let timer = 0

    const step = () => {
      i++
      if (i >= stops.length) {
        setBall((b) => ({ ...b, on: false }))
        setPhase('done')
        return
      }

      const s = stops[i]
      setBall({ x: s.x, y: s.y, on: true })

      if (s.hit >= 0) {
        setShown((n) => Math.max(n, s.hit + 1))
        sound.tick(0.7)
      }

      timer = window.setTimeout(step, HOP_MS)
    }

    timer = window.setTimeout(step, 60)
    return () => clearTimeout(timer)
  }, [phase, track.length])

  return (
    <section id="experience"
      /* data-phase оставлен намеренно: это единственный способ
         посмотреть, на каком шаге встал пролёт, и он уже дважды
         показал настоящую ошибку там, где кадров не видно */
      data-phase={phase}
      className="py-[clamp(2.5rem,6vw,4.5rem)]">
      <div className="mx-auto w-full max-w-[var(--shell)] px-[var(--gutter)]">
        <SecHead index="01" title="Опыт" />

        <div ref={wrap} className="relative">
          {/* Шар летит поверх строк и в поток не входит */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-1 size-[26px] rounded-full bg-moss"
            style={{
              left: 0,
              top: 0,
              transform: `translate3d(${ball.x - 13}px, ${ball.y - 26}px, 0)`,
              opacity: ball.on ? 1 : 0,
              /* Дуга: вверх резче, вниз мягче, как и падает мяч */
              transition: `transform ${HOP_MS}ms cubic-bezier(.42,0,.58,1), opacity 240ms linear`,
            }}
          />

          <ol className="m-0 list-none p-0">
            {track.map((job, i) => {
              const kind = jobKind(job.kind)
              const visible = i < shown

              return (
                <li
                  key={job.client + job.period}
                  ref={(el) => {
                    rows.current[i] = el
                  }}
                  className="grid grid-cols-[26px_minmax(0,1fr)] items-baseline gap-x-4 border-b border-rule py-[clamp(0.9rem,1.8vw,1.4rem)] last:border-b-0 md:grid-cols-[26px_minmax(0,22ch)_minmax(0,1fr)_auto]"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? 'none' : 'translateY(10px)',
                    transition: 'opacity 420ms ease-out, transform 420ms cubic-bezier(.16,1,.3,1)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={`size-[9px] translate-y-[0.3em] rounded-full ${dotColor[kind]}`}
                  />

                  <span className="font-display text-[clamp(1rem,1.7vw,1.35rem)] leading-tight font-semibold tracking-[-0.03em]">
                    {job.role}
                  </span>

                  <span className="col-start-2 text-sm text-ink-muted md:col-start-3">
                    <span className="text-ink">{job.client}</span>
                    <span className="mt-1 block max-w-[52ch] md:mt-0.5">{job.note}</span>
                  </span>

                  <span className="col-start-2 text-xs text-ink-muted tabular-nums md:col-start-4 md:text-end">
                    {job.period}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
