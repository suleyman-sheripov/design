import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Lockup, ballHome, em } from './Lockup'

/* Интро.

   Шарик выкатывается слева и встаёт на своё место. Справа сверху
   падает ERIPOV, слева сверху — знак. Половины смыкаются вокруг
   шарика, и он медленно оседает в точку, которой всё это время и
   был. Дальше замок улетает в шапку.

   Хореография та же, что была одобрена на ванильной версии, но
   выражена кадрами, а не цепочкой WAAPI. Цепочка требовала следить
   за fill: forwards против both — при both анимация применяет свой
   первый кадр ещё до старта и перебивает более раннюю, из-за чего
   шарик стоял на финальном месте всю сцену. Здесь у каждой части
   один список кадров, и перебивать нечему. */

/* Насколько далеко половины стоят до смыкания, в долях кегля */
const FAR_LEFT = -2.6
const FAR_RIGHT = 2.4

/* Откуда выкатывается шарик: заведомо за левым краем экрана */
const BALL_START = -14

const EASE_ROLL = [0.15, 0.62, 0.36, 1] as const
const EASE_FALL = [0.55, 0.06, 0.68, 0.19] as const
const EASE_OUT = [0.16, 1, 0.3, 1] as const

const t = {
  roll: 1.2,
  fallAt: 1.34,
  markAt: 1.66,
  fall: 0.26,
  closeAt: 2.02,
  close: 0.62,
  settleAt: 2.72,
  settle: 0.62,
}

export const INTRO_MS = (t.settleAt + t.settle) * 1000

export function Intro({ onDone }: { onDone: () => void }) {
  /* Шрифт обязан приехать до старта: половины замка встают по его
     метрикам, и подмена шрифта посреди сцены сдвинула бы их */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    /* Восемь секунд — заведомо больше сцены, но всё ещё предел:
       застрявший шрифт не должен оставить посетителя перед пустым
       занавесом навсегда */
    const guard = setTimeout(() => alive && setReady(true), 8000)

    document.fonts.ready.then(() => {
      if (alive) setReady(true)
    })

    return () => {
      alive = false
      clearTimeout(guard)
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = setTimeout(onDone, INTRO_MS)
    return () => clearTimeout(id)
  }, [ready, onDone])

  /* Пока идёт занавес, страница под ним не прокручивается */
  useEffect(() => {
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [])

  /* Занавес и сцена разведены намеренно. Замок обязан исчезнуть из
     занавеса ровно в тот кадр, когда появляется в шапке: пока обе
     копии живы, у motion два элемента с одним layoutId и перелёт
     не строится. Поэтому сцена снимается мгновенно, а фон гаснет
     отдельно, уже за ней. */
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      {/* inline-flex и leading-none: обёртка обязана совпадать с
          коробкой замка, иначе шарик отсчитывается от строчного
          бокса, который выше на полуинтерлиньяж */}
      <span
        className="relative inline-flex leading-none text-[clamp(1.6rem,7.4vw,5rem)]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        {ready && (
          <>
            <Lockup animated parts={partAnim} />

            {/* Шарик живёт только в занавесе: в шапке на его месте
                уже стоит точка, и они одного размера и цвета */}
            <motion.span
              aria-hidden="true"
              className="absolute rounded-full bg-moss"
              style={{
                width: `${em.ball}em`,
                height: `${em.ball}em`,
                top: `${ballHome.top}em`,
                left: `${ballHome.left}em`,
              }}
              initial={{ x: `${BALL_START}em`, rotate: 0, scale: 1 }}
              animate={{
                x: ['-14em', '0em', '0em'],
                /* Оборот пропорционален пройденному пути: качение
                   должно читаться качением, а не скольжением */
                rotate: [0, (14 / (Math.PI * em.ball)) * 360, (14 / (Math.PI * em.ball)) * 360],
                scale: [1, 1, em.dot / em.ball],
              }}
              transition={{
                duration: t.settleAt + t.settle,
                times: [0, t.roll / (t.settleAt + t.settle), 1],
                ease: [EASE_ROLL, EASE_OUT],
              }}
            >
              {/* Блик: чтобы качение читалось, а не выглядело
                  скольжением */}
              <span
                className="absolute inset-0 m-auto rounded-full bg-moss-on opacity-50"
                style={{
                  width: '22%',
                  height: '22%',
                  transform: `translateX(${em.ball * 0.24}em)`,
                }}
              />
            </motion.span>
          </>
        )}
      </span>
    </div>
  )
}

/* Фон занавеса. Живёт отдельно от сцены, чтобы гаснуть уже после
   того, как замок улетел.

   Гаснет переходом CSS, а снимается таймером, а не по окончании
   анимации. Причина: в фоновой вкладке кадры не выдаются, анимация
   не доигрывает, и занавес оставался висеть поверх страницы
   навсегда. Таймер срабатывает и там. */
export const CURTAIN_FADE_MS = 500

export function Curtain({ leaving }: { leaving: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-40 bg-paper transition-opacity duration-500 ease-out ${
        leaving ? 'pointer-events-none opacity-0' : ''
      }`}
    />
  )
}

/* Половины ждут врозь и сходятся. Значения отдаются наружу, потому
   что кадры вешаются на части замка. */
export const partAnim = {
  mark: {
    initial: { x: `${FAR_LEFT}em`, y: '-4em', opacity: 0 },
    animate: { x: '0em', y: '0em', opacity: 1 },
    transition: {
      opacity: { duration: 0.01, delay: t.markAt },
      y: { duration: t.fall, delay: t.markAt, ease: EASE_FALL },
      x: { duration: t.close, delay: t.closeAt, ease: EASE_OUT },
    },
  },
  rest: {
    initial: { x: `${FAR_RIGHT}em`, y: '-4em', opacity: 0 },
    animate: { x: '0em', y: '0em', opacity: 1 },
    transition: {
      opacity: { duration: 0.01, delay: t.fallAt },
      y: { duration: t.fall, delay: t.fallAt, ease: EASE_FALL },
      x: { duration: t.close, delay: t.closeAt, ease: EASE_OUT },
    },
  },
  /* Точка проявляется в тот момент, когда шарик уже сжался до её
     размера: подмены не видно */
  dot: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.01, delay: t.settleAt + t.settle - 0.02 },
  },
}
