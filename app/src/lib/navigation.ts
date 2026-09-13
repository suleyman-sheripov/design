import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { track } from './analytics'
import type { Project } from '../data'
import { caseHref } from './projectPresentation'

export function routeSlug(hash = window.location.hash): string | null {
  if (!hash.startsWith('#/work/')) return null
  try { return decodeURIComponent(hash.slice(7)) } catch { return '__missing__' }
}

// Hash-адреса переживают прямое открытие и обновление на GitHub Pages.
// View Transitions переносит одну поверхность между двумя настоящими страницами.
export function useCaseNavigation() {
  const [slug, setSlug] = useState(routeSlug)
  const current = useRef(slug)
  const homeY = useRef(0)
  const lastCase = useRef<string | null>(null)
  const run = useRef(0)
  const transition = useRef<ViewTransition | null>(null)
  const go = useCallback((next: string | null, source?: HTMLElement, push = false) => {
    if (current.current === next) return
    const id = ++run.current
    transition.current?.skipTransition()
    document.querySelectorAll<HTMLElement>('[data-transition-art]').forEach(el => {el.style.viewTransitionName=''; delete el.dataset.transitionArt})
    const previous = current.current
    if (!previous) homeY.current = window.scrollY
    else lastCase.current = previous
    const mark = (el?: HTMLElement | null) => {
      if (!el) return
      el.style.viewTransitionName='case-art'; el.dataset.transitionArt='true'
      const paper = el.querySelector<HTMLElement>('.project-paper img')
      if(paper) {paper.style.viewTransitionName='case-image';paper.dataset.transitionArt='true'}
    }
    const cover = source ?? (previous ? document.querySelector<HTMLElement>('.case-cover .project-art') : next ? document.querySelector<HTMLElement>(`[data-case="${CSS.escape(next)}"] .project-art`) : null)
    mark(cover)
    const update = () => {
      if (id !== run.current) return
      if (push) history.pushState({portfolioCase:!!next}, '', next ? caseHref(next) : '#work')
      current.current = next
      flushSync(() => setSlug(next))
      const homeCard = !next && lastCase.current ? document.querySelector<HTMLElement>(`[data-case="${CSS.escape(lastCase.current)}"]`) : null
      window.scrollTo({top:next ? 0 : homeY.current || (homeCard ? homeCard.getBoundingClientRect().top + window.scrollY - 100 : 0),behavior:'instant'})
      mark(next ? document.querySelector<HTMLElement>('.case-cover .project-art') : homeCard?.querySelector<HTMLElement>('.project-art'))
    }
    const finish = () => {
      if (id !== run.current) return
      document.querySelectorAll<HTMLElement>('[data-transition-art]').forEach(el=>{el.style.viewTransitionName='';delete el.dataset.transitionArt})
      const focus = next ? document.getElementById('caseTitle') : lastCase.current ? document.querySelector<HTMLElement>(`[data-case="${CSS.escape(lastCase.current)}"]`) : null
      focus?.focus({preventScroll:true})
      delete document.documentElement.dataset.pageChanging
      transition.current = null
    }
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.dataset.pageChanging = 'true'
      const vt = document.startViewTransition(update)
      transition.current = vt
      void vt.ready.catch(() => {})
      // Страховка не даёт замершему конвейеру перекрыть страницу.
      const guard = window.setTimeout(()=>{vt.skipTransition();finish()},1800)
      void vt.finished.catch(()=>{}).finally(()=>{clearTimeout(guard);finish()})
    } else { update(); finish() }
  }, [])
  useEffect(() => {
    const restore = history.scrollRestoration
    history.scrollRestoration='manual'
    const onHistory = () => go(routeSlug())
    window.addEventListener('popstate',onHistory)
    window.addEventListener('hashchange',onHistory)
    return () => {history.scrollRestoration=restore;window.removeEventListener('popstate',onHistory);window.removeEventListener('hashchange',onHistory)}
  },[go])
  return { slug, open:(p: Project, source: HTMLElement) => {track('case-open',p.slug);go(p.slug,source,true)}, home:()=>go(null,undefined,true) }
}
