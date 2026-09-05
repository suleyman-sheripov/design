const SERVICES = [
  'Фирменный стиль',
  'Упаковка под печать',
  'Логотипы',
  'Сайты и интерфейсы',
  'UI-киты',
  'Карточки для маркетплейсов',
  'Афиши и наружка',
]

/* Услуги перечислением: списком из семи пунктов они выглядели
   куце, а строкой читаются как ассортимент. Точки-разделители
   идут через одну мхом и охрой — лента едет непрерывно, и
   чередование даёт ей пульс, которого у одноцветного ряда нет. */
function Run({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul
      aria-hidden={hidden || undefined}
      className="m-0 flex shrink-0 list-none items-center p-0"
    >
      {SERVICES.map((name, i) => (
        <li
          key={name}
          className="flex items-center gap-[clamp(1.5rem,3vw,2.75rem)] pe-[clamp(1.5rem,3vw,2.75rem)] font-display text-[clamp(0.88rem,1.2vw,1.05rem)] font-semibold tracking-[-0.025em] whitespace-nowrap"
        >
          {name}
          <span
            aria-hidden="true"
            className={`size-[0.4em] shrink-0 rounded-full ${i % 2 ? 'bg-amber' : 'bg-moss'}`}
          />
        </li>
      ))}
    </ul>
  )
}

export function Ticker() {
  return (
    <div className="group relative mt-[clamp(1.5rem,3vw,2.5rem)] overflow-hidden border-y border-rule py-[clamp(0.85rem,1.6vw,1.15rem)] select-none">
      <div className="flex w-max animate-[ticker_34s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
        <Run />
        {/* Второй проход помечен aria-hidden: диктор не должен
            читать один и тот же список дважды */}
        <Run hidden />
      </div>
    </div>
  )
}
