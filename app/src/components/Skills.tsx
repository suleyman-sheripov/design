import { SecHead } from './SecHead'

/* Что делаю. Раздел собирает то, что раньше висело на первом экране
   и мешало ему быть пустым: пояснение о работе и перечень услуг.

   Перечень набран хештегами не для красоты: это те же слова, по
   которым такого дизайнера ищут, и поисковику они здесь видны как
   обычный текст. */

/* Краски раздаются по смыслу, а не по кругу: печатное — глина,
   цифровое — небо, фирменное — мох, остальное — охра. Четыре акцента
   держатся вместе только пока у каждого своя работа. */
const TAGS: { tag: string; tone: string }[] = [
  { tag: 'фирменныйстиль', tone: 'text-moss' },
  { tag: 'логотипы', tone: 'text-moss' },
  { tag: 'упаковкаподпечать', tone: 'text-clay' },
  { tag: 'афишиинаружка', tone: 'text-clay' },
  { tag: 'сайтыиинтерфейсы', tone: 'text-sky' },
  { tag: 'uiкиты', tone: 'text-sky' },
  { tag: 'прототипы', tone: 'text-sky' },
  { tag: 'карточкидлямаркетплейсов', tone: 'text-amber' },
  { tag: 'презентации', tone: 'text-amber' },
]

export function Skills() {
  return (
    <section id="skills" className="py-[clamp(2.5rem,6vw,4.5rem)]">
      <div className="mx-auto w-full max-w-[var(--shell)] px-[var(--gutter)]">
        <SecHead index="03" title="Что делаю" />

        <p className="max-w-[54ch] text-[clamp(0.95rem,1.5vw,1.1rem)] leading-relaxed">
          <b className="font-medium text-moss-deep">
            Больше года на коммерческом фрилансе.
          </b>{' '}
          <span className="text-ink-muted">
            Веду проект целиком: от концепции и презентации решения до макета в печать
            или передачи разработчику.
          </span>
        </p>

        <ul className="mt-8 flex max-w-[68ch] list-none flex-wrap gap-x-5 gap-y-3 p-0 text-sm text-ink-muted">
          {TAGS.map(({ tag, tone }) => (
            <li key={tag}>
              <span className={tone}>#</span>
              {tag}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
