import type { MouseEvent } from 'react'
import { shotSrc, type Project } from '../data'
import { useEditBridge } from '../lib/previewBridge'
import { caseHref, categoryLabel, handleProjectClick, projectStyle, type OpenProject } from '../lib/projectPresentation'
import { useSiteSettings } from '../lib/settings'

// Эта поверхность становится полноэкранной обложкой страницы кейса.
export function ProjectArt({ project, hero = false }: {project: Project; hero?: boolean}) {
  const { settings } = useSiteSettings()
  const bridge = useEditBridge()
  const cover = hero ? project.caseCover || project.cover : project.cover
  /* Картинка, загруженная в этой сессии редактора и ещё не
     опубликованная, подменяет обычный источник. Для любого другого
     имени файла assetUrl вернёт undefined, и ничего не меняется —
     вне живого моста эта строка не имеет эффекта. */
  const src = bridge.assetUrl(cover) ?? shotSrc(cover)
  return <div className={`project-art preview-${project.previewStyle || settings.previewStyle} ${project.ratio === 'tall' ? 'is-tall' : ''} ${hero ? 'is-case-hero' : ''}`} style={projectStyle(project)}>
    <div className="project-paper"><img data-fit={project.previewFit || 'contain'} style={{objectFit:project.previewFit || 'contain',objectPosition:project.previewPosition || 'center'}} src={src} alt={hero ? project.shots.find(s=>s.file===cover)?.alt ?? project.title : ''} loading={hero ? 'eager' : 'lazy'} draggable={false} /></div>
    {!hero && <span className="project-open" aria-hidden="true">Смотреть <span>↗</span></span>}
  </div>
}

export function Work({ projects, onOpen }: {projects: Project[]; onOpen: OpenProject}) {
  const { settings } = useSiteSettings()
  const bridge = useEditBridge()
  const selecting = bridge.active && bridge.mode === 'select'

  const onCardClick = (e: MouseEvent<HTMLAnchorElement>, p: Project) => {
    /* В режиме выбора клик открывает инспектор в админке, а не сам
       кейс: ссылка не должна одновременно уводить из редактора. Во
       втором режиме, «Проверить сайт», карточка ведёт себя как на
       обычном сайте — эта ветка вообще не выполняется. */
    if (!selecting) return handleProjectClick(e, p, onOpen)
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    /* id, если он уже проставлен админкой, переживает переименование
       slug в старой форме; для контента, ещё не пересохранённого через
       обновлённую админку, id нет — тогда используем slug, как раньше */
    bridge.select({ type: 'project', key: p.id ?? p.slug })
  }

  return <section id="work" className="work-exhibition" aria-labelledby="workTitle">
    <div className="exhibition-head scroll-arrive">
      <div><p className="eyebrow">01</p><h2 id="workTitle">{settings.workTitle}</h2></div>
      <span className="exhibition-count">{String(projects.length).padStart(2,'0')} проектов</span>
    </div>
    <div className="exhibition-grid">
      {projects.map((p,i) => <article className={`exhibit exhibit-${i%5}`} key={p.slug}>
        <a
          className={`exhibit-link ${selecting ? 'is-edit-target' : ''}`}
          href={caseHref(p.slug)}
          data-case={p.slug}
          data-edit-target={selecting ? `project:${p.id ?? p.slug}` : undefined}
          data-cursor={selecting ? undefined : 'link'}
          data-cursor-label={selecting ? undefined : 'Открыть'}
          onClick={e=>onCardClick(e,p)}
        >
          <ProjectArt project={p} />
          <div className="exhibit-caption"><div><h3>{p.title}</h3><p>{p.kind}</p></div><span>{categoryLabel(p)}<br />{p.year}</span><b aria-hidden="true">↗</b></div>
        </a>
      </article>)}
    </div>
    {!projects.length && <p className="exhibition-empty">Работы ещё не опубликованы. <a href="#contact">Обсудим вашу задачу?</a></p>}
  </section>
}
