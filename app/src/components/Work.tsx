import { shotSrc, type Project } from '../data'
import { caseHref, categoryLabel, handleProjectClick, projectStyle, type OpenProject } from '../lib/projectPresentation'
import { useSiteSettings } from '../lib/settings'

// Эта поверхность становится полноэкранной обложкой страницы кейса.
export function ProjectArt({ project, hero = false }: {project: Project; hero?: boolean}) {
  const { settings } = useSiteSettings()
  const cover = hero ? project.caseCover || project.cover : project.cover
  return <div className={`project-art preview-${project.previewStyle || settings.previewStyle} ${project.ratio === 'tall' ? 'is-tall' : ''} ${hero ? 'is-case-hero' : ''}`} style={projectStyle(project)}>
    <div className="project-paper"><img data-fit={project.previewFit || 'contain'} style={{objectFit:project.previewFit || 'contain',objectPosition:project.previewPosition || 'center'}} src={shotSrc(cover)} alt={hero ? project.shots.find(s=>s.file===cover)?.alt ?? project.title : ''} loading={hero ? 'eager' : 'lazy'} draggable={false} /></div>
    {!hero && <span className="project-open" aria-hidden="true">Смотреть <span>↗</span></span>}
  </div>
}

export function Work({ projects, onOpen }: {projects: Project[]; onOpen: OpenProject}) {
  const { settings } = useSiteSettings()
  return <section id="work" className="work-exhibition" aria-labelledby="workTitle">
    <div className="exhibition-head scroll-arrive">
      <div><p className="eyebrow">01</p><h2 id="workTitle">{settings.workTitle}</h2></div>
      <span className="exhibition-count">{String(projects.length).padStart(2,'0')} проектов</span>
    </div>
    <div className="exhibition-grid">
      {projects.map((p,i) => <article className={`exhibit exhibit-${i%5}`} key={p.slug}>
        <a className="exhibit-link" href={caseHref(p.slug)} data-case={p.slug} data-cursor="link" data-cursor-label="Открыть" onClick={e=>handleProjectClick(e,p,onOpen)}>
          <ProjectArt project={p} />
          <div className="exhibit-caption"><div><h3>{p.title}</h3><p>{p.kind}</p></div><span>{categoryLabel(p)}<br />{p.year}</span><b aria-hidden="true">↗</b></div>
        </a>
      </article>)}
    </div>
    {!projects.length && <p className="exhibition-empty">Работы ещё не опубликованы. <a href="#contact">Обсудим вашу задачу?</a></p>}
  </section>
}
