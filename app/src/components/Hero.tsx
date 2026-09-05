import { motion } from 'motion/react'
import type { ReactNode } from 'react'

const photo = `${import.meta.env.BASE_URL}assets/photo.webp`
const photo2x = `${import.meta.env.BASE_URL}assets/photo@2x.webp`

/* Первый экран.

   Одна фраза, метка состояния, пояснение и действие. Больше на нём
   ничего нет: блок стоит слева чуть ниже середины окна, а остальное
   поле остаётся пустым. Пустота здесь работает — она и делает
   первый экран спокойным.

   Иерархия задана внутри набора: специальность держит охру,
   служебные слова уходят в приглушённый. Начертание облегчено до
   обычного: полужирный на этом кегле давил. */
export function Lede() {
  return (
    <h1 className="m-0 max-w-[24ch] font-display text-[clamp(1.1rem,2.1vw,1.55rem)] leading-[1.35] font-normal tracking-[-0.02em] text-balance">
      Привет, я{' '}
      {/* Снимок вместо знака: он же и есть цвет на этом экране, и он
          же Минск, который тут назван словами. Лицо сидит выше
          середины кадра, поэтому в маленьком квадрате кадрируем по
          нему, а не по центру. */}
      <span className="inline-flex size-[1.35em] overflow-hidden rounded-[0.26em] bg-moss align-middle">
        <img
          src={photo}
          srcSet={`${photo} 1x, ${photo2x} 2x`}
          alt="Сулейман Шерипов"
          width={320}
          height={320}
          className="size-full object-cover object-[50%_36%]"
        />
      </span>{' '}
      Сулейман, <span className="text-ink-muted">графический и</span>{' '}
      <span className="text-amber">UI/UX дизайнер</span>{' '}
      <span className="text-ink-muted">из Минска.</span>
    </h1>
  )
}

/* Метка состояния. Раз в двенадцать секунд напоминает о себе одним
   вдохом: точка разгорается, плашка чуть расширяется и возвращается.
   Реже — и её не заметят, чаще — начнёт мешать читать. */
export function OpenBadge() {
  return (
    <motion.p
      className="mt-6 inline-flex items-center gap-2 rounded-full border border-rule bg-paper-raised px-3 py-1.5 text-xs font-medium text-ink"
      animate={{ scale: [1, 1.045, 1] }}
      transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 11 }}
    >
      <motion.span
        className="size-1.5 rounded-full bg-moss"
        animate={{ opacity: [1, 0.35, 1], scale: [1, 1.7, 1] }}
        transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 11 }}
      />
      Открыт для проектов
    </motion.p>
  )
}

/* Пояснение стоит своей колонкой в меру, а не во всю ширину: длинная
   строка на таком кегле не читается. */
export function HeroLead() {
  return (
    <p className="mt-5 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
      <b className="font-medium text-moss-deep">Больше года на коммерческом фрилансе.</b>{' '}
      Веду проект целиком: от концепции и презентации решения до макета в печать или
      передачи разработчику.
    </p>
  )
}

export function HeroAct({ children }: { children: ReactNode }) {
  return <div className="mt-7">{children}</div>
}

/* Чем занимаюсь — строкой хештегов, а не отдельной плиткой. Плитка
   с логотипами программ говорила о том, в чём я работаю, а клиенту
   важно, что он получит. */
const TAGS = [
  'фирменныйстиль',
  'упаковкаподпечать',
  'логотипы',
  'сайтыиинтерфейсы',
  'uiкиты',
  'карточкидлямаркетплейсов',
  'афишиинаружка',
]

export function Tags() {
  return (
    <ul className="mt-10 flex max-w-[68ch] list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs text-ink-muted">
      {TAGS.map((tag, i) => (
        <li key={tag}>
          {/* Решётки идут через одну мхом и охрой: строка мелкая, и
              это единственный способ дать ей цвет, не крася сам
              текст и не теряя его читаемость */}
          <span className={i % 2 ? 'text-amber' : 'text-moss'}>#</span>
          {tag}
        </li>
      ))}
    </ul>
  )
}
