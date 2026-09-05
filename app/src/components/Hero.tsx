import { Mark } from './Mark'

/* Представление в одну фразу. Знак работает буквой внутри строки,
   поэтому лицо не нужно, а имя всё равно звучит. Иерархия задана
   внутри набора: специальность держит охру, служебные слова уходят
   в приглушённый, остальное — чернила. Отдельного подзаголовка при
   таком наборе не требуется. */
export function Lede() {
  return (
    /* Мельче замка в шапке намеренно: логотип держит верх страницы,
       а фраза под ним читается, а не спорит с ним размером */
    <h1 className="m-0 max-w-[21ch] font-display text-[clamp(1.2rem,2.5vw,1.85rem)] leading-[1.12] font-semibold tracking-[-0.035em] text-balance">
      Привет, я{' '}
      <span
        aria-hidden="true"
        className="inline-flex size-[1.35em] items-center justify-center overflow-hidden rounded-[0.28em] bg-moss align-middle"
      >
        <Mark className="w-[60%] text-moss-on" />
      </span>{' '}
      Сулейман, <span className="text-ink-muted">графический и</span>{' '}
      <span className="text-amber">UI/UX дизайнер</span>{' '}
      <span className="text-ink-muted">из Минска.</span>{' '}
      {/* Метка состояния встаёт прямо в набор, как слово: висящая
          отдельно плашка читалась бы наклейкой */}
      <span className="inline-flex items-center gap-[0.45em] rounded-full border border-rule bg-paper-raised px-[0.8em] py-[0.4em] align-middle font-body text-xs font-medium tracking-normal text-ink whitespace-nowrap">
        <span className="size-[0.5em] rounded-full bg-moss" />
        Открыт для проектов
      </span>
    </h1>
  )
}

/* Действие и пояснение на одной строке: кнопка ведёт, текст
   отвечает на вопрос «а что дальше», не перебивая её. */
export function HeroAct({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[clamp(1.5rem,3vw,2.25rem)] flex flex-wrap items-center gap-[clamp(1.1rem,2.6vw,2.25rem)]">
      {children}
      <p className="max-w-[42ch] text-sm text-ink-muted">
        {/* Мох на главном утверждении: точка цвета в текстовой
            колонке, где иначе одни чернила */}
        <b className="font-medium text-moss-deep">Больше года на коммерческом фрилансе.</b>{' '}
        Веду проект целиком: от концепции и презентации решения до макета в печать или
        передачи разработчику.
      </p>
    </div>
  )
}
