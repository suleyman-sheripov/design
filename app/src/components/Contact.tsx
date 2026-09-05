import type { Profile } from '../data'
import { SecHead } from './SecHead'

/* Контакты продублированы статикой в разметке и не зависят от JSON:
   единственное, что обязано работать, даже если данные не пришли,
   это способ написать. */
const FALLBACK = {
  email: 'suleyman.sheripov@icloud.com',
  phone: '+375 25 756 98 61',
  city: 'Минск',
  links: {
    behance: 'https://behance.net/suleymasheripov',
    dribbble: 'https://dribbble.com/kilus',
  },
}

const domain = (url: string) => url.replace(/^https?:\/\//, '')

export function Contact({ profile }: { profile: Profile | null }) {
  const c = profile ?? FALLBACK
  /* В наборе номер с пробелами, в ссылке без: иначе часть телефонов
     не поднимает звонилку */
  const tel = c.phone.replace(/[^\d+]/g, '')

  return (
    <section
      id="contact"
      aria-labelledby="contactTitle"
      className="py-[clamp(2.5rem,6vw,4.5rem)]"
    >
      <div className="mx-auto w-full max-w-[var(--shell)] px-[var(--gutter)]">
        <SecHead index="02" title="Связаться">
          Напишите, что за задача и к какому сроку. Посмотрю и честно скажу, берусь или
          нет.
        </SecHead>

        <a
          href={`mailto:${c.email}`}
          data-cursor="link"
          data-cursor-label="Написать"
          className="block font-display text-[clamp(1.05rem,3.6vw,2rem)] leading-[1.05] font-semibold tracking-[-0.045em] break-all no-underline"
        >
          {c.email}
        </a>
        <div className="mt-[clamp(1.25rem,3vw,2rem)] h-px bg-ink" />

        <ul className="mt-6 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-x-6 gap-y-4 p-0 text-sm">
          <Row label="Телефон">
            <a href={`tel:${tel}`}>{c.phone}</a>
          </Row>
          <Row label="Behance">
            <a href={c.links.behance} target="_blank" rel="noopener">
              {domain(c.links.behance)}
            </a>
          </Row>
          <Row label="Dribbble">
            <a href={c.links.dribbble} target="_blank" rel="noopener">
              {domain(c.links.dribbble)}
            </a>
          </Row>
          <Row label="Город">{c.city}</Row>
        </ul>
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-label font-semibold tracking-[0.18em] text-ink-muted uppercase">
        {label}
      </span>
      {children}
    </li>
  )
}

export function Colophon({ city }: { city: string }) {
  return (
    <footer className="border-t border-rule py-6 text-xs text-ink-muted">
      <div className="mx-auto flex w-full max-w-[var(--shell)] flex-wrap justify-between gap-3 px-[var(--gutter)]">
        <span>
          <b className="font-medium text-ink">Сулейман Шерипов</b>, {city}
        </span>
        <span>Свёрстан вручную, без конструктора</span>
      </div>
    </footer>
  )
}
