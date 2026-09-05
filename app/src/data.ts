/* Контент лежит в public/data/*.json, а не в разметке: админка
   правит эти файлы через GitHub API и не трогает код. Файлы
   подгружаются в рантайме, поэтому правка контента видна сразу
   и не требует пересборки. */

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
  slug: string
  title: string
  kind: string
  role: string
  year: string
  note: string
  cover: string
  ratio: 'wide' | 'tall' | string
  shots: Shot[]
}

/* Vite подставляет сюда base из конфига, поэтому один и тот же код
   работает и на подпути /design/, и в корне домена */
const asset = (path: string) => import.meta.env.BASE_URL + path

export const toolLogo = (logo: string) => asset(logo)

export const shotSrc = (file: string) => asset(`assets/work/${file}.webp`)

async function loadJson<T>(name: string): Promise<T> {
  const res = await fetch(asset(`data/${name}.json`))
  if (!res.ok) throw new Error(`${name}: ${res.status}`)
  return res.json() as Promise<T>
}

export const loadProfile = () => loadJson<Profile>('profile')

export const loadProjects = () =>
  loadJson<{ projects: Project[] }>('projects').then((d) => d.projects)

/* Род занятия различает точку в списке опыта. Всё, что не курсы и
   не учебное, считается работой на клиента: так новое место в JSON
   красится верно само, без правки кода. */
export type JobKind = 'client' | 'teaching' | 'study'

export function jobKind(kind: string): JobKind {
  if (kind === 'Учебный проект') return 'study'
  if (/курс/i.test(kind)) return 'teaching'
  return 'client'
}
