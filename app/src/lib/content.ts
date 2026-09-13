import { validateContent } from '../../public/admin/model.js'
import type { Profile, Project } from '../data'
import type { SiteSettings, Service } from './settings'
import snapshot from '../../../content/data/site.json'

type Content = { settings?:Partial<SiteSettings>; services?:Service[]; profile: Profile; projects: { projects: Project[] } }
export type Config = { content: { owner: string; repo: string; branch: string }; analytics: { goatcounter: string } }
let configPromise: Promise<Config> | undefined
let contentPromise: Promise<Content> | undefined
let mediaBase: string | undefined
const bundledImages = import.meta.glob<string>('../../../content/work/*.webp', { eager: true, query: '?url', import: 'default' })
// JSON и изображения входят в сборку: первый показ не зависит от второго HTTP-запроса.
let preview: {data:Content; images:Record<string,string>; mediaBase?:string} | undefined
if (new URLSearchParams(location.search).get('editor-preview') === '1') {
  try { const stored=JSON.parse(sessionStorage.getItem('portfolio-preview') || 'null'); if(stored) {validateContent(stored.data); preview=stored; if(typeof stored.mediaBase==='string' && /^https:\/\/raw\.githubusercontent\.com\/[\w.-]+\/[\w.-]+\/[^/]+\/content\/work\/$/.test(stored.mediaBase)) mediaBase=stored.mediaBase;} } catch { /* Invalid drafts never replace the snapshot. */ }
}
export const initialContent = validateContent<Content>(preview?.data ?? snapshot)

async function json(url: string) {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Контент: ${res.status}`)
  return res.json()
}
export function config(): Promise<Config> {
  return configPromise ??= json(`${import.meta.env.BASE_URL}site-config.json`)
}
export const imageSource = (file: string) => preview?.images?.[file]?.startsWith('blob:') ? preview.images[file] : mediaBase ? `${mediaBase}${file}.webp` : bundledImages[`../../../content/work/${file}.webp`]
export function content(): Promise<Content> {
  return contentPromise ??= (async () => {
    if (preview) return initialContent
    if (import.meta.env.PROD) {
      try {
        const { content: c } = await config()
        if (!/^[\w.-]+$/.test(c.owner) || !/^[\w.-]+$/.test(c.repo) || !c.branch) throw new Error('Настройки контента')
        const base = `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${encodeURIComponent(c.branch)}/content/`
        const data = validateContent<Content>(await json(`${base}data/site.json`))
        mediaBase = `${base}work/`
        return data
      } catch {
        window.dispatchEvent(new Event('content-fallback'))
      }
    }
    return initialContent
  })()
}
