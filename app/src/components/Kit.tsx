import { toolLogo, type Tool } from '../data'

/* Круглая печать. Вращается CSS-анимацией, а не пружиной: движение
   постоянное и ровное, ему незачем идти через рантайм анимаций. */
function Stamp() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className="mb-auto w-[clamp(48px,5.4vw,64px)] shrink-0 self-end"
    >
      <defs>
        <path id="stampRing" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" />
      </defs>
      <g className="origin-center animate-[spin_34s_linear_infinite] motion-reduce:animate-none">
        <text className="text-[7.8px] font-semibold tracking-[0.08em] fill-current opacity-75">
          <textPath href="#stampRing" startOffset="0">
            ФИРМЕННЫЙ СТИЛЬ · УПАКОВКА · ИНТЕРФЕЙСЫ ·{' '}
          </textPath>
        </text>
      </g>
      <circle cx="50" cy="50" r="4.5" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

export function Kit({ tools }: { tools: Tool[] }) {
  return (
    <>
      <Stamp />
      <ul className="m-0 flex list-none flex-col gap-[0.65rem] p-0">
        {tools.map((tool) => (
          <li key={tool.name} className="flex items-center gap-[0.7rem]">
            <img
              src={toolLogo(tool.logo)}
              alt=""
              width={22}
              height={22}
              className="size-[22px] shrink-0 rounded-[5px]"
            />
            <div>
              <span className="block font-display text-sm font-semibold tracking-[-0.025em]">
                {tool.name}
              </span>
              {/* 0.85, а не 0.72: на мху приглушённый кремовый на
                  12 кегле давал 4.3:1 и не дотягивал до AA */}
              <span className="mt-[0.1rem] block text-xs opacity-85">{tool.for}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
