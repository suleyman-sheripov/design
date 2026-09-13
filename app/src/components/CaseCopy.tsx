import type { Project } from '../data'

const sections = {
  task: {
    title: 'Задача',
    placeholder: 'Здесь будет короткий рассказ о том, с чего начался проект: для кого он создан, какую задачу предстояло решить и что было важно учесть. Достаточно нескольких предложений, чтобы читатель понял контекст и мог внимательнее рассмотреть работу.',
  },
  solution: {
    title: 'Решение',
    placeholder: 'В этой части можно рассказать об основной идее и о том, как она повлияла на дизайн. Почему выбрана именно такая композиция, как работают типографика и цвет, что помогает человеку ориентироваться и замечать главное.\n\nВторой абзац — для одного конкретного решения, которое хочется выделить. Например, необычной детали, важного экрана или приёма, который связывает разные части проекта.',
  },
  details: {
    title: 'Детали проекта',
    placeholder: 'Здесь можно подробнее разобрать то, что видно на макетах: взаимодействие элементов, логику интерфейса или особенности визуального языка. Такой текст помогает увидеть за готовой картинкой ход дизайнерской мысли.\n\nВ конце можно добавить, что вошло в итоговую работу, какие материалы были подготовлены и что вы считаете самым интересным в этом проекте.',
  },
}

export function CaseCopy({ project, section }: { project: Project; section: keyof typeof sections }) {
  const { title, placeholder } = sections[section]
  const text = project.story?.[section]?.trim()
  return <section className="case-copy" aria-labelledby={`case-copy-${section}`}>
    <div className="case-copy-label">
      <h2 id={`case-copy-${section}`}>{title}</h2>
      {!text && <span className="case-copy-sample">Текст для примера</span>}
    </div>
    <div className="case-copy-prose">
      {(text || placeholder).split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}
    </div>
  </section>
}
