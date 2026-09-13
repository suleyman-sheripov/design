import { motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { INTRO_END, frameAt, setStart } from '../lib/introSim'
import * as sound from '../lib/sound'
import { CAP_TOP, Lockup, em, type LockupMotions } from './Lockup'

export { INTRO_END }

/* Интро.

   Шарик выкатывается слева. Сверху падает ERIPOV и встаёт у него на
   пути — шарик ударяется и отлетает назад. На обратном ходу перед
   ним падает знак, шарик ударяется и об него. Дальше половины
   сходятся, шарик частит между ними затухающей дробью, пока места не
   остаётся, и оседает в точку.

   Хореография не расписана кадрами, а считается: физика живёт в
   lib/introSim и прогоняется от нуля с фиксированным шагом. Поэтому
   её можно проверить прогоном, а не разглядыванием, и она не зависит
   от частоты кадров экрана.

   Кадры пишутся в motion values, а не в состояние React: иначе
   компонент перерисовывался бы шестьдесят раз в секунду. */

/* Шарик едет по середине прописных */
const BALL_TOP = CAP_TOP + (em.markH - em.ball) / 2

export function Intro({ onDone }: { onDone: () => void }) {
  /* Шрифт обязан приехать до старта: половины встают по его метрикам */
  const [ready, setReady] = useState(false)
  const done = useRef(false)
  const stageRef = useRef<HTMLSpanElement>(null)

  const markX = useMotionValue(0)
  const markY = useMotionValue(0)
  const restX = useMotionValue(0)
  const restY = useMotionValue(0)
  const dotOpacity = useMotionValue(0)

  const ballX = useMotionValue(0)
  const ballY = useMotionValue(0)
  const ballScale = useMotionValue(1)
  const ballSpin = useMotionValue(0)
  const ballOpacity = useMotionValue(1)

  const motions: LockupMotions = useMemo(
    () => ({ markX, markY, restX, restY, dotOpacity }),
    [markX, markY, restX, restY, dotOpacity],
  )

  useEffect(() => {
    let alive = true
    /* Восемь секунд — заведомо больше сцены, но всё ещё предел:
       застрявший шрифт не должен оставить перед пустым занавесом */
    const guard = setTimeout(() => alive && setReady(true), 8000)

    document.fonts.ready.then(() => {
      if (alive) setReady(true)
    })

    return () => {
      alive = false
      clearTimeout(guard)
    }
  }, [])

  /* Пока идёт занавес, страница под ним не прокручивается */
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    if (!ready) return

    /* Шар обязан выкатиться из-за края экрана, а не появиться в
       кадре. Замок стоит по центру, поэтому расстояние до края
       окна меряется, а не задаётся числом. */
    const box = stageRef.current?.getBoundingClientRect()
    if (box) setStart(box.left, parseFloat(getComputedStyle(stageRef.current!).fontSize))

    /* Контекст звука готовим сейчас, в паузе перед выкатом: его
       создание синхронное и роняет кадр, а в паузе ничего не
       движется */
    sound.prime()

    /* Отсчёт начинается с ПЕРВОГО выданного кадра, а не с запуска
       эффекта. Между ними успевает пройти вёрстка и первая отрисовка,
       и этот кусок сцены просто пропадал: шар появлялся уже
       на середине пути. */
    let start = 0
    let frame = 0

    /* Предыдущее состояние нужно, чтобы поймать сами события: удар,
       касание строки, смыкание. По ним и идёт звук. */
    let prevHits = 0
    let restLanded = false
    let markLanded = false
    let settled = false

    /* Страховка на случай, когда кадры не выдаются вовсе: во вкладке
       в фоне rAF молчит, а интро обязано закончиться и там */
    const guard = setTimeout(
      () => {
        if (!done.current) {
          done.current = true
          onDone()
        }
      },
      INTRO_END * 1000 + 400,
    )

    const tick = (now: number) => {
      if (!start) start = now
      const t = (now - start) / 1000
      const s = frameAt(Math.min(t, INTRO_END))

      /* Звук вешается на события, а не на моменты времени: так он не
         разъедется с физикой, если её числа поменяются */
      if (s.hits > prevHits) {
        sound.tick(Math.min(1, (s.hits - prevHits) * 0.9))
        prevHits = s.hits
      }
      if (!restLanded && s.restY === 0) {
        restLanded = true
        sound.thud()
      }
      if (!markLanded && s.markY === 0) {
        markLanded = true
        sound.thud()
      }
      if (!settled && s.dotVisible) {
        settled = true
        sound.settle()
      }

      markX.set(s.markX)
      markY.set(s.markY)
      restX.set(s.restX)
      restY.set(s.restY)
      dotOpacity.set(s.dotVisible ? 1 : 0)

      ballX.set(s.ballCx)
      ballY.set(s.ballDrop)
      ballScale.set(s.ballScale)
      ballSpin.set(s.ballSpin)
      ballOpacity.set(s.ballVisible ? 1 : 0)

      if (t >= INTRO_END) {
        if (!done.current) {
          done.current = true
          onDone()
        }
        return
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(guard)
    }
  }, [
    ready,
    onDone,
    markX,
    markY,
    restX,
    restY,
    dotOpacity,
    ballX,
    ballY,
    ballScale,
    ballSpin,
    ballOpacity,
  ])

  /* Центр шарика приходит в координатах замка, а элементу нужен левый
     край: половину диаметра снимаем здесь */
  const ballLeft = useTransform(ballX, (v) => `${v - em.ball / 2}em`)
  const ballTop = useTransform(ballY, (v) => `${BALL_TOP + v}em`)
  const spin = useTransform(ballSpin, (v) => `${v}deg`)

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {/* inline-flex и leading-none: обёртка обязана совпадать с
          коробкой замка, иначе шарик отсчитывается от строчного
          бокса, который выше на полуинтерлиньяж */}
      <span
        ref={stageRef}
        className="relative inline-flex leading-none text-[clamp(1.5rem,6.8vw,4.6rem)]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <Lockup animated motions={motions} />

        {/* Масштаб и вращение разнесены по двум слоям, и это здесь
            главное. Уменьшение вниз требует точки отсчёта по низу, а
            качение — по центру. На одном элементе побеждает одна:
            шар начинал вращаться вокруг точки на своей нижней кромке
            и мотался, вместо того чтобы катиться. */}
        <motion.span
          aria-hidden="true"
          className="absolute"
          style={{
            width: `${em.ball}em`,
            height: `${em.ball}em`,
            left: ballLeft,
            top: ballTop,
            scale: ballScale,
            opacity: ballOpacity,
            transformOrigin: '50% 100%',
          }}
        >
          <motion.span
            className="intro-ball relative block size-full rounded-full bg-sky"
            style={{ rotate: spin }}
          >
            {/* Блик: без него качение читается скольжением */}
            <span
              className="absolute top-1/2 left-1/2 rounded-full bg-moss-on opacity-50"
              style={{ width: '22%', height: '22%', marginLeft: '2%', marginTop: '-11%' }}
            />
          </motion.span>
        </motion.span>
      </span>
    </div>
  )
}

/* Фон занавеса. Гаснет переходом CSS, а снимается таймером, а не по
   окончании анимации: в фоновой вкладке кадры не выдаются, анимация
   не доигрывает, и занавес оставался висеть поверх страницы. */
export const CURTAIN_FADE_MS = 620

export function Curtain({ leaving }: { leaving: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-40 bg-paper transition-opacity duration-[620ms] ease-out ${
        leaving ? 'pointer-events-none opacity-0' : ''
      }`}
    />
  )
}
