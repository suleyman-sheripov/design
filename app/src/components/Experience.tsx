import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { type Job } from '../data'
import { SecHead } from './SecHead'
import { Mark } from './Mark'
import { useSiteSettings } from '../lib/settings'

export function Experience({ track }: { track: Job[] }) {
  const { settings } = useSiteSettings()
  const jobs = useMemo(() => [...track].reverse(), [track])
  const root = useRef<HTMLDivElement>(null)
  const marker = useRef<HTMLSpanElement>(null)
  const path = useRef<SVGPathElement>(null)
  const [active, setActive] = useState(0)
  const [compact, setCompact] = useState(() => matchMedia('(max-width: 680px)').matches)
  const selectedAt = useRef<number | null>(null)
  const controls = useRef<(HTMLButtonElement | null)[]>([])
  const points = useMemo(() => jobs.map((_,i) => {
    const t = i / Math.max(1, jobs.length - 1)
    return compact ? {x:i % 2 ? 77 : 23, y:12 + t * 76} : {x:8 + t * 84, y:i % 2 ? 24 : 58}
  }), [compact, jobs])
  const curve = points.map((p,i) => {
    if (!i) return `M ${p.x} ${p.y}`
    const prev = points[i - 1]
    return compact
      ? `C ${prev.x} ${(prev.y + p.y)/2} ${p.x} ${(prev.y + p.y)/2} ${p.x} ${p.y}`
      : `C ${(prev.x + p.x)/2} ${prev.y} ${(prev.x + p.x)/2} ${p.y} ${p.x} ${p.y}`
  }).join(' ')

  useEffect(() => {
    const media = matchMedia('(max-width: 680px)')
    const change = () => setCompact(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const wrap = root.current
    const line = path.current
    if (!wrap || !line || !jobs.length) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let last = -1
    const length = line.getTotalLength()
    const update = () => {
      frame = 0
      if (reduced.matches) return
      const box = wrap.getBoundingClientRect()
      const progress = Math.max(0, Math.min(1, (innerHeight * .78 - box.top) / (box.height + innerHeight * .2)))
      const manual = selectedAt.current !== null && Math.abs(scrollY - selectedAt.current) < 90
      const keyboardFocus = wrap.contains(document.activeElement) && document.activeElement?.matches(':focus-visible')
      if (manual || keyboardFocus) return
      if (selectedAt.current !== null) { selectedAt.current = null; last = -1 }
      const index = Math.min(jobs.length - 1, Math.round(progress * (jobs.length - 1)))
      if (index !== last) {last = index; setActive(index)}
      const point = line.getPointAtLength(progress * length)
      marker.current?.style.setProperty('left', `${point.x}%`)
      marker.current?.style.setProperty('top', `${point.y}%`)
    }
    const request = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', request, {passive:true})
    window.addEventListener('resize', request)
    reduced.addEventListener('change', request)
    return () => {cancelAnimationFrame(frame); window.removeEventListener('scroll', request); window.removeEventListener('resize', request); reduced.removeEventListener('change', request)}
  }, [curve, jobs.length])

  const select = (index: number) => {
    setActive(index)
    selectedAt.current = scrollY
    const point = points[index]
    marker.current?.style.setProperty('left', `${point.x}%`)
    marker.current?.style.setProperty('top', `${point.y}%`)
  }
  if (!jobs.length) return null
  const current = jobs[Math.min(active, jobs.length - 1)]

  return <section id="experience" aria-labelledby="experienceTitle" className="experience-section">
    <div className="section-shell">
      <div className="journey-heading scroll-arrive"><SecHead id="experienceTitle" index="02" title={settings.experienceTitle} /><div className="journey-emblem"><p>Дизайн и преподавание</p><span className="journey-brand" aria-hidden="true"><Mark /><i /></span></div></div>
      <div className="journey-map" ref={root} style={{'--stop-count':jobs.length} as CSSProperties}>
        <svg className="journey-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path ref={path} d={curve} />
        </svg>
        <span ref={marker} className="journey-traveller" aria-hidden="true" style={{left:`${points[0].x}%`, top:`${points[0].y}%`}} />
        <div role="tablist" aria-label="Проекты и места работы" className="journey-stops">
          {jobs.map((job,i) => {
            const position = points[i]
            return <button key={job.client + job.period} ref={el => {controls.current[i] = el}} type="button" role="tab" id={`job-${i}`} aria-selected={i === active} aria-controls="job-detail" tabIndex={i === active ? 0 : -1} className={`journey-stop ${i === active ? 'is-active' : ''}`} style={{'--x':`${position.x}%`, '--y':`${position.y}%`} as CSSProperties} onClick={() => select(i)} onKeyDown={e => {
              if (e.ctrlKey || e.metaKey || e.altKey) return
              let next = i
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % jobs.length
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + jobs.length) % jobs.length
              else if (e.key === 'Home') next = 0
              else if (e.key === 'End') next = jobs.length - 1
              else return
              e.preventDefault(); select(next); controls.current[next]?.focus()
            }}><span className="journey-node" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><span className="journey-label"><strong>{job.client}</strong><small>{job.period}</small></span></button>
          })}
        </div>
      </div>
      <div className="journey-detail" id="job-detail" role="tabpanel" aria-labelledby={`job-${active}`} tabIndex={0}>
        <div key={current.client} className="journey-detail-inner"><div><span>{current.kind}</span><h3>{current.client}</h3></div><div><p className="journey-role">{current.role}</p><p>{current.note}</p></div><span className="journey-page">{String(active + 1).padStart(2, '0')} / {String(jobs.length).padStart(2, '0')}</span></div>
      </div>
    </div>
  </section>
}
