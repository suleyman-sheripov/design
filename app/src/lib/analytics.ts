import { config } from './content'

declare global {
  interface Window { goatcounter?: { count?: (event: { path: string; title?: string; event?: boolean }) => void } }
}

export function track(name: string, detail = '') {
  window.goatcounter?.count?.({ path: `event/${name}${detail ? '/' + detail : ''}`, title: name, event: true })
}

export function startAnalytics() {
  let disposed = false
  let script: HTMLScriptElement | undefined
  const click = (e: MouseEvent) => {
    const a = (e.target as Element)?.closest?.('a')
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (href === '#contact') track('contact-intent')
    else if (href.startsWith('mailto:')) track('contact-email')
    else if (href.startsWith('tel:')) track('contact-phone')
    else if (a.hostname !== location.hostname && a.protocol === 'https:') track('outbound', a.hostname)
  }
  if (import.meta.env.PROD && !['localhost','127.0.0.1'].includes(location.hostname) && navigator.doNotTrack !== '1') {
    void config().then(c => {
      const endpoint = c.analytics.goatcounter
      if (disposed || !/^https:\/\/[a-z0-9-]+\.goatcounter\.com\/count$/.test(endpoint)) return
      script = document.createElement('script')
      script.async = true
      script.src = 'https://gc.zgo.at/count.js'
      script.dataset.goatcounter = endpoint
      script.referrerPolicy = 'strict-origin-when-cross-origin'
      document.head.append(script)
      document.addEventListener('click', click)
    }).catch(() => { /* Недоступный счётчик не мешает портфолио. */ })
  }
  return () => { disposed = true; script?.remove(); document.removeEventListener('click', click) }
}
