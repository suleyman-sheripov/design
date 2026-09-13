import { content, imageSource } from './lib/content'

export type Job = {
  client: string
  role: string
  kind: string
  period: string
  note: string
}

export type Tool = {
  name: string
  for: string
  logo: string
}

export type Profile = {
  name: string
  role: string
  city: string
  email: string
  phone: string
  links: { behance: string; dribbble: string }
  track: Job[]
  tools: Tool[]
}

export type Shot = { file: string; alt: string }

export type Project = {
  status: 'draft' | 'published'
  category: 'commercial' | 'teaching' | 'study' | 'personal'
  slug: string
  title: string
  kind: string
  role: string
  year: string
  note: string
  caseCover?: string
  previewStyle?: string
  previewFit?: 'contain' | 'cover'
  previewPosition?: string
  background?: string
  foreground?: string
  cover: string
  story?: { task?: string; solution?: string; details?: string }
  ratio: 'wide' | 'tall' | string
  shots: Shot[]
}

/* Vite подставляет сюда base из конфига, поэтому один и тот же код
   работает и на подпути /design/, и в корне домена */
const asset = (path: string) => import.meta.env.BASE_URL + path

export const toolLogo = (logo: string) => asset(logo)

export const shotSrc = imageSource
export const loadProfile = () => content().then(d => d.profile)
export const loadProjects = () => content().then(d => d.projects.projects.filter(p => p.status === 'published'))

/* Род занятия различает точку в списке опыта. Всё, что не курсы и
   не учебное, считается работой на клиента: так новое место в JSON
   красится верно само, без правки кода. */
export type JobKind = 'client' | 'teaching' | 'study'

export function jobKind(kind: string): JobKind {
  if (kind === 'Учебный проект') return 'study'
  if (/курс/i.test(kind)) return 'teaching'
  return 'client'
}
