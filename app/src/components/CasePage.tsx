import { Fragment, useEffect, useRef } from 'react'
import { shotSrc, type Profile, type Project } from '../data'
import { ProjectArt } from './Work'
import { CaseCopy } from './CaseCopy'
import { categoryLabel, caseHref, handleProjectClick, projectStyle, type OpenProject } from '../lib/projectPresentation'

export function CasePage({project, next, profile, onOpen, onHome}: {project: Project; next?: Project; profile: Profile; onOpen: OpenProject; onHome:()=>void}) {
  const page = useRef<HTMLElement>(null)
  useEffect(() => {
    const title = document.title
    document.title = `${project.title} — ${profile.name}`
    return () => {document.title = title}
  }, [project.title, profile.name])
  return <main ref={page} className="case-page" style={projectStyle(project)}>
    <nav className="case-navigation" aria-label="Навигация по кейсу"><a href="#work" onClick={e=>{e.preventDefault();onHome()}}>← Все работы</a><span>{profile.name.toLocaleUpperCase('ru-RU')}</span><a href={`mailto:${profile.email}`}>Есть задача? ↗</a></nav>
    <section className="case-cover" aria-labelledby="caseTitle">
      <ProjectArt project={project} hero />
      <div className="case-cover-caption"><div><p>{categoryLabel(project)}{project.year && ` / ${project.year}`}</p><h1 id="caseTitle" tabIndex={-1}>{project.title}</h1></div><a href="#case-details" onClick={e=>{e.preventDefault(); document.getElementById('case-details')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}} aria-label="Перейти к описанию работы">↓</a></div>
    </section>
    <section id="case-details" className="case-details" aria-labelledby="caseAbout">
      <div><p className="eyebrow">О проекте</p><h2 id="caseAbout">{project.kind}</h2>{project.note && <p className="case-description">{project.note}</p>}</div>
      <dl><div><dt>Моя роль</dt><dd>{project.role}</dd></div><div><dt>Формат</dt><dd>{categoryLabel(project)}</dd></div>{project.year && <div><dt>Год</dt><dd>{project.year}</dd></div>}</dl>
    </section>
    <div className="case-story">
      <CaseCopy project={project} section="task" />
      <CaseCopy project={project} section="solution" />
    </div>
    <section className={`case-gallery ${project.ratio==='tall'?'case-gallery-mobile':''}`} aria-label="Детали проекта">
      {project.shots.map((shot,i)=><Fragment key={shot.file}><figure><div className="case-shot"><img src={shotSrc(shot.file)} alt={shot.alt} loading="lazy" /></div><figcaption><span>{String(i+1).padStart(2,'0')}</span>{shot.alt}</figcaption></figure>{i === (project.ratio === 'tall' ? Math.min(1, project.shots.length - 1) : 0) && <CaseCopy project={project} section="details" />}</Fragment>)}
    </section>
    {next && <section className="case-next" aria-label="Следующая работа"><p className="eyebrow">Продолжим смотреть</p><a href={caseHref(next.slug)} onClick={e=>handleProjectClick(e,next,onOpen)}><div><span>Следующий проект ↗</span><h2>{next.title}</h2><p>{next.kind}</p></div><ProjectArt project={next} /></a></section>}
    <footer className="case-footer"><a href="#work" onClick={e=>{e.preventDefault();onHome()}}>← К выставке работ</a><a href={`mailto:${profile.email}`}>Обсудить похожую задачу ↗</a></footer>
  </main>
}
