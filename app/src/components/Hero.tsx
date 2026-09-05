import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { Typed } from './Typed'

const photo = `${import.meta.env.BASE_URL}assets/photo.webp`
const photo2x = `${import.meta.env.BASE_URL}assets/photo@2x.webp`

/* Первый экран.

   Одна фраза и одно действие. Больше на нём ничего нет: блок стоит
   слева чуть ниже середины окна, справа печать. Пустота здесь
   работает — она и делает первый экран спокойным.

   Имя набирается на глазах и спотыкается на одной букве. Это
   единственное место, где страница ведёт себя как человек за
   клавиатурой, и оно же объясняет, почему заголовок появляется не
   сразу целиком. */

/* Сперва с ошибкой, потом исправление. Стираем ровно до неё, а не
   всё слово: так это и читается опечаткой, а не переделкой. */
const NAME_SCRIPT = [
  { type: 'write', text: 'Сулецман' },
  { type: 'wait', ms: 420 },
  { type: 'erase', count: 4 },
  { type: 'wait', ms: 160 },
  { type: 'write', text: 'йман,' },
] as const

export function Lede({ start }: { start: boolean }) {
  const [named, setNamed] = useState(false)

  return (
    <h1 className="m-0 max-w-[22ch] font-display text-[clamp(1.35rem,2.6vw,1.9rem)] leading-[1.34] font-normal tracking-[-0.02em] text-balance">
      Привет, я{' '}
      {/* Снимок вместо знака: он же и есть цвет на этом экране.
          Выровнен по базовой линии, а не по середине строки: низ
          кадра садится туда же, куда садятся буквы, и картинка
          перестаёт проваливаться из ряда. */}
      <span className="inline-flex size-[1.35em] translate-y-[0.14em] overflow-hidden rounded-[0.26em] bg-moss align-baseline">
        <img
          src={photo}
          srcSet={`${photo} 1x, ${photo2x} 2x`}
          alt="Сулейман Шерипов"
          width={320}
          height={320}
          className="size-full object-cover object-[50%_36%]"
        />
      </span>{' '}
      <Typed script={NAME_SCRIPT as unknown as never} start={start} onDone={() => setNamed(true)} />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: named ? 1 : 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
      >
        {' '}
        <span className="text-ink-muted">графический</span>{' '}
        <span className="text-clay">и</span>{' '}
        <span className="text-sky">UI</span>
        <span className="text-ink-muted">/</span>
        <span className="text-amber">UX</span> дизайнер.
      </motion.span>
    </h1>
  )
}

export function HeroAct({ children }: { children: ReactNode }) {
  return <div className="mt-8">{children}</div>
}

/* Печать. Справа первый экран оставался пустым, и в него просится не
   текст, а знак ремесла: круглая печать с перечнем того, что владелец
   делает. Она из его же предметной области, она несёт краску и она
   единственное, что на этом экране всё время движется. */
export function Stamp() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="w-[clamp(120px,17vw,220px)] text-moss"
    >
      <defs>
        <path id="heroStamp" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
      </defs>
      <g className="origin-center animate-[spin_46s_linear_infinite] motion-reduce:animate-none">
        <text className="text-[7.4px] font-semibold tracking-[0.1em] fill-current opacity-80">
          <textPath href="#heroStamp" startOffset="0">
            ФИРМЕННЫЙ СТИЛЬ · УПАКОВКА · ИНТЕРФЕЙСЫ ·{' '}
          </textPath>
        </text>
      </g>
      <circle cx="50" cy="50" r="4" className="fill-clay" />
    </svg>
  )
}
