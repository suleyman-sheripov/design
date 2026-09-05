import { useEffect, useRef, useState } from 'react'

/* Печать с опечаткой.

   Имя набирается, спотыкается на одной букве, стирается до ошибки и
   допечатывается верно. Это единственное место на сайте, где текст
   ведёт себя как живой человек за клавиатурой, поэтому и ритм рваный:
   ровная посимвольная печать выглядит машинописью, а не набором.

   Курсор мигает только пока идёт печать: оставленный после неё, он
   заставляет ждать продолжения, которого не будет. */

type Step =
  | { type: 'write'; text: string }
  | { type: 'erase'; count: number }
  | { type: 'wait'; ms: number }

/* Разброс задержек: одинаковый интервал между буквами и есть та самая
   машинопись */
const jitter = (base: number) => base * (0.62 + Math.random() * 0.8)

export function Typed({
  script,
  start,
  speed = 62,
  onDone,
  className,
}: {
  script: Step[]
  start: boolean
  speed?: number
  onDone?: () => void
  className?: string
}) {
  const [shown, setShown] = useState('')
  const [typing, setTyping] = useState(false)
  const finished = useRef(false)

  useEffect(() => {
    if (!start || finished.current) return

    let alive = true
    let timer = 0
    let text = ''
    let step = 0
    let left = 0

    setTyping(true)

    const next = () => {
      if (!alive) return

      if (step >= script.length) {
        setTyping(false)
        finished.current = true
        onDone?.()
        return
      }

      const cur = script[step]

      if (cur.type === 'wait') {
        step++
        timer = window.setTimeout(next, cur.ms)
        return
      }

      if (cur.type === 'write') {
        if (left >= cur.text.length) {
          step++
          left = 0
          next()
          return
        }
        text += cur.text[left]
        left++
        setShown(text)
        timer = window.setTimeout(next, jitter(speed))
        return
      }

      if (left >= cur.count) {
        step++
        left = 0
        next()
        return
      }
      text = text.slice(0, -1)
      left++
      setShown(text)
      /* Стирание быстрее набора: исправляются всегда резче, чем пишут */
      timer = window.setTimeout(next, jitter(speed * 0.55))
    }

    next()

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [start, script, speed, onDone])

  return (
    <span className={className}>
      {shown}
      {typing && (
        <span
          aria-hidden="true"
          className="ms-[0.06em] inline-block w-[0.06em] animate-[caret_1s_steps(2)_infinite] self-stretch bg-current align-[-0.08em]"
          style={{ height: '0.78em' }}
        />
      )}
    </span>
  )
}
