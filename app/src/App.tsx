import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { type Profile, type Project } from './data'
import { initialContent, content } from './lib/content'
import { Colophon, Contact } from './components/Contact'
import { Cursor } from './components/Cursor'
import { Experience } from './components/Experience'
import { Hero } from './components/Hero'
import { CURTAIN_FADE_MS, Curtain, Intro } from './components/Intro'
import { Lockup } from './components/Lockup'
import { Skills } from './components/Skills'
import { GooDefs } from './components/Symbiote'
import { Work } from './components/Work'
import { CasePage } from './components/CasePage'
import { DEFAULT_SETTINGS } from '../public/admin/settings.js'
import { EditBridgeContext, usePreviewBridge } from './lib/previewBridge'
import { SERVICES } from './lib/services'
import { SettingsContext } from './lib/settings'
import { SoundReplay } from './components/SoundReplay'
import { ScrollRibbon } from './components/ScrollRibbon'
import { startAnalytics } from './lib/analytics'
import { seenIntro, rememberIntro } from './lib/session'
import { routeSlug, useCaseNavigation } from './lib/navigation'

const LANDING_MS = 760
type Stage = 'intro' | 'landing' | 'live'
export default function App() {
  const [site,setSite] = useState(initialContent)
  const settings = { ...DEFAULT_SETTINGS, ...site.settings }
  useEffect(()=>{
    const values = {'--color-paper':settings.paper,'--color-paper-raised':settings.surface,'--color-ink':settings.ink,'--color-moss':settings.accent,'--color-sky':settings.dot,'--preview-radius':`${settings.cardRadius}px`}
    for(const [key,value] of Object.entries(values)) document.documentElement.style.setProperty(key,value)
    return ()=>{for(const key of Object.keys(values)) document.documentElement.style.removeProperty(key)}
  },[settings.paper,settings.surface,settings.ink,settings.accent,settings.dot,settings.cardRadius])
  const [profile,setProfile] = useState<Profile>(initialContent.profile)
  const [projects,setProjects] = useState<Project[]>(initialContent.projects.projects.filter(p=>p.status==='published'))
  const [fallback,setFallback] = useState(false)
  const route = useCaseNavigation()
  /* Живой мост включается только внутри iframe редактора: обычная
     страница и старое «Предпросмотр» в новой вкладке этот путь не
     проходят вовсе, см. previewBridge.ts */
  const bridge = usePreviewBridge()
  useEffect(() => {
    if (!bridge.document) return
    setSite(bridge.document)
    setProfile(bridge.document.profile)
    setProjects(bridge.document.projects.projects.filter(p=>p.status==='published'))
  }, [bridge.document])
  const [stage,setStage] = useState<Stage>(() => routeSlug() || seenIntro() || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'live' : 'intro')
  const [curtain,setCurtain] = useState(() => stage==='intro')
  useLayoutEffect(() => {
    if (!location.hash || location.hash === '#') window.scrollTo({top:0,behavior:'instant'})
  }, [])
  useEffect(()=>{
    /* Живой мост уже приносит документ сам; обычная загрузка контента
       здесь не нужна и опасна — если бы её промис разрешился ПОСЛЕ
       снимка от моста (в проде это сетевой запрос к GitHub), она
       откатила бы черновик к опубликованной версии прямо на глазах */
    if (bridge.active) return
    let active = true
    const stale = () => setFallback(true)
    window.addEventListener('content-fallback',stale)
    const stop = startAnalytics()
    void content().then(d=>{if(active){setSite(d);setProfile(d.profile);setProjects(d.projects.projects.filter(p=>p.status==='published'))}}).catch(stale)
    return ()=>{active=false;window.removeEventListener('content-fallback',stale);stop()}
  },[bridge.active])
  const finishIntro = useCallback(()=>{
    rememberIntro();setStage('landing')
    setTimeout(()=>setStage('live'),LANDING_MS)
    setTimeout(()=>setCurtain(false),CURTAIN_FADE_MS+220)
  },[])
  const landed = stage !== 'intro'
  const project = projects.find(p=>p.slug===route.slug)
  const next = project && projects.length > 1 ? projects[(projects.indexOf(project)+1)%projects.length] : undefined
  return <SettingsContext.Provider value={{settings,services:site.services ?? [...SERVICES]}}>
  <EditBridgeContext.Provider value={bridge}>
    {new URLSearchParams(location.search).has('editor-preview') && <div className="preview-notice">Предпросмотр · изменения ещё не опубликованы</div>}
    <GooDefs /><Cursor />
    {curtain && <Curtain leaving={landed} />}
    {stage==='intro' && <Intro onDone={finishIntro} />}
    <div className="portfolio-home" hidden={route.slug !== null}>
      <header inert={stage!=='live'} className="site-header">
        <a href="#" aria-label={`${profile.name} — на главную`} className="brand-link">
          <Lockup key={landed?'home':'placeholder'} animated={landed} className={`header-lockup ${landed?'':'invisible'}`} aria-hidden="true" />
        </a>
        <nav aria-label="Разделы страницы" className="header-nav"><a href="#work">Работы <span>↗</span></a>{settings.showExperience && <a href="#experience">Обо мне</a>}<a href={settings.resume} className="header-contact" target="_blank" rel="noopener noreferrer">Резюме <span>↗</span></a></nav>
      </header>
      <main inert={stage!=='live'}>
        <Hero start={stage==='live'} profile={profile} />
        <Work projects={projects} onOpen={route.open} />
        {settings.showExperience && <Experience track={profile.track} />}
        {settings.showServices && <Skills />}
        <Contact profile={profile} />
      </main>
      <ScrollRibbon active={settings.showRibbon && stage==='live' && route.slug === null} />
      {fallback && <p role="status" className="content-notice">Показана сохранённая версия портфолио: свежие данные сейчас недоступны.</p>}
      <Colophon city={profile.city} name={profile.name} />
      <SoundReplay live={stage==='live' && !route.slug} onReplay={()=>{window.scrollTo({top:0,behavior:'instant'});setCurtain(true);setStage('intro')}} />
    </div>
    {route.slug !== null && (project ? <CasePage key={project.slug} project={project} next={next} profile={profile} onOpen={route.open} onHome={route.home} /> : <main className="missing-case"><p className="eyebrow">Работа не найдена</p><h1>Похоже, этот лист<br />ещё не на выставке.</h1><button type="button" onClick={route.home}>← Ко всем работам</button></main>)}
  </EditBridgeContext.Provider>
  </SettingsContext.Provider>
}
