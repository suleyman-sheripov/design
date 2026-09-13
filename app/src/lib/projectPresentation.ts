import type { CSSProperties, MouseEvent } from 'react'
import type { Project } from '../data'

export type OpenProject = (project: Project, source: HTMLElement) => void
export const caseHref = (slug: string) => `#/work/${encodeURIComponent(slug)}`
export const categoryLabel = (p: Project) => ({commercial:'Коммерческая работа',teaching:'Преподавание',study:'Учебный проект',personal:'Проект портфолио'})[p.category]
const papers: Record<string, [string,string]> = {beautylab:['#dce1cb','#333d31'],vasil:['#b24b30','#f9ecd7'],multivarka:['#d8dfe7','#263e58'],yotoys:['#e3cb9d','#4a3721'],checkout:['#c1d0c0','#293d32']}
export function projectStyle(project: Project): CSSProperties {
  const [bg,ink] = papers[project.slug] ?? ['#dcd4c5','#332e25']
  return {'--case-bg':project.background || bg,'--case-ink':project.foreground || ink} as CSSProperties
}
export function handleProjectClick(e: MouseEvent<HTMLAnchorElement>, p: Project, onOpen: OpenProject) {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  onOpen(p, e.currentTarget.querySelector<HTMLElement>('.project-art') ?? e.currentTarget)
}

