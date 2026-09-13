import type { Profile } from '../data'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Typed } from './Typed'
import { ContactCloth, type ClothMotion } from './ContactCloth'

import { useSiteSettings } from '../lib/settings'

/* Контакты продублированы статикой в разметке и не зависят от JSON:
   единственное, что обязано работать, даже если данные не пришли,
   это способ написать. */
const FALLBACK = {
  email: 'suleyman.sheripov@icloud.com',
  phone: '+375 25 756 98 61',
  city: 'Минск',
  links: {
    behance: 'https://behance.net/suleymasheripov',
    dribbble: 'https://dribbble.com/kilus',
  },
}

export function Contact({ profile }: { profile: Profile | null }) {
  const { settings } = useSiteSettings()
  const invitation = settings.contactNote
  const invitationScript = useMemo(()=>[{ type:'write' as const, text:invitation }],[invitation])
  const c = profile ?? FALLBACK
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [typeInvitation, setTypeInvitation] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const section = useRef<HTMLElement>(null)
  const subtitle = useRef<HTMLParagraphElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLAnchorElement>(null)
  const cloth = useRef<ClothMotion>({ progress: 0, x: .5, y: .5, near: false })
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    const el=stage.current
    if(!el)return
    const observer=new IntersectionObserver(([entry])=>{el.dataset.awake=String(entry.isIntersecting)}, {threshold:.4})
    observer.observe(el)
    return()=>observer.disconnect()
  }, [])
  useEffect(() => {
    const el = subtitle.current
    if (!el) return
    let delay: ReturnType<typeof setTimeout> | undefined
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(delay)
      if (entry.isIntersecting && entry.intersectionRatio >= .95) {
        delay = setTimeout(() => { setTypeInvitation(true); observer.disconnect() }, 500)
      }
    }, { threshold: [0, .95], rootMargin: '0px 0px -15% 0px' })
    observer.observe(el)
    return () => { clearTimeout(delay); observer.disconnect() }
  }, [])
  useEffect(() => {
    const root = section.current, surface = stage.current
    if (!root || !surface) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const update = () => {
      frame = 0
      const travel = innerHeight * .85
      const stickyTop = Math.min(0, innerHeight - surface.offsetHeight)
      const progress = reduced.matches ? .5 : Math.max(0, Math.min(1, (stickyTop - root.getBoundingClientRect().top) / travel))
      root.style.setProperty('--contact-sticky-top', `${stickyTop}px`)
      root.style.setProperty('--contact-stage-height', `${surface.offsetHeight}px`)
      root.style.setProperty('--contact-travel', reduced.matches ? '0px' : `${travel}px`)
      cloth.current.progress = progress
      root.style.setProperty('--contact-progress', String(progress))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const resize = new ResizeObserver(schedule)
    resize.observe(surface)
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    reduced.addEventListener('change', schedule)
    update()
    return () => {
      cancelAnimationFrame(frame); resize.disconnect()
      removeEventListener('scroll', schedule); removeEventListener('resize', schedule)
      reduced.removeEventListener('change', schedule)
    }
  }, [])
  const release = () => {
    const el=action.current
    if(!el)return
    el.style.setProperty('--invite-x','0px');el.style.setProperty('--invite-y','0px')
    el.dataset.near='false'
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(c.email)
      setCopied(true); setCopyError(false)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2400)
    } catch { setCopyError(true) }
  }
  /* В наборе номер с пробелами, в ссылке без: иначе часть телефонов
     не поднимает звонилку */
  const tel = c.phone.replace(/[^\d+]/g, '')

  return (
    <section
      ref={section}
      id="contact"
      aria-labelledby="contactTitle"
      className="contact-finale"
    >
      <div ref={stage} className="contact-stage" onPointerLeave={release} onPointerMove={e => {
        const r = e.currentTarget.getBoundingClientRect()
        e.currentTarget.style.setProperty('--contact-x', `${e.clientX-r.left}px`)
        e.currentTarget.style.setProperty('--contact-y', `${e.clientY-r.top}px`)
        const el=action.current
        if(!el || e.pointerType!=='mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches)return
        const b=el.getBoundingClientRect(),dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2
        const near=Math.hypot(dx,dy)<240
        el.dataset.near=String(near)
        el.style.setProperty('--invite-x',`${near?Math.max(-9,Math.min(9,dx*.07)):0}px`)
        el.style.setProperty('--invite-y',`${near?Math.max(-7,Math.min(7,dy*.07)):0}px`)
      }}>
        <div className="contact-top"><span>04 / Связаться</span></div>
        <div className="contact-invitation">
          <h2 id="contactTitle"><span>{settings.contactLine1}</span><span>{settings.contactLine2}<span className="contact-period">.</span></span></h2>
          <p ref={subtitle} className="contact-typed">
            <span className="contact-type-space" aria-hidden="true">{invitation}</span>
            <span className="contact-type-ink" aria-hidden="true"><Typed script={invitationScript} start={typeInvitation} speed={38} /></span>
            <span className="sr-only">{invitation}</span>
          </p>
        </div>
        <div className="contact-playground" onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          cloth.current.x = (e.clientX - r.left) / r.width
          cloth.current.y = (e.clientY - r.top) / r.height
          cloth.current.near = e.pointerType === 'mouse'
        }} onPointerLeave={() => { cloth.current.near = false }}>
          <ContactCloth motion={cloth} />
          <a ref={action} className="contact-write" href={`mailto:${c.email}`} data-cursor="link" data-cursor-label="Написать" aria-label="Написать Сулейману о проекте">
            <span className="invite-surface"><span>{settings.contactButton}</span><span className="invite-arrow" aria-hidden="true">↗</span></span>
          </a>
        </div>
        <div className="contact-address">
        <div className="contact-primary">
        <a
          href={`mailto:${c.email}`}
          data-cursor="link"
          data-cursor-label="Написать"
          aria-label={`Написать на ${c.email}`}
          className="contact-email"
        >
          <span>{c.email.split('@')[0]}<wbr />@{c.email.split('@')[1]}</span>
        </a>
        </div>
        <div className="contact-thread" aria-hidden="true" />
        <button className="contact-copy" type="button" onClick={copy}>{copied ? 'Адрес скопирован ✓' : 'Скопировать почту'}<span aria-hidden="true">{copied ? '' : ' ⧉'}</span></button>
        <span className="sr-only" role="status">{copied ? 'Адрес почты скопирован' : copyError ? `Не удалось скопировать. Адрес: ${c.email}` : ''}</span>
        </div>
        <ul className="contact-links">
          <Row label="Телефон">
            <a className="inline-flex min-h-8 items-center" href={`tel:${tel}`}>{c.phone}</a>
          </Row>
          <Row label="Город"><span className="inline-flex min-h-8 items-center">{c.city}</span></Row>
          <Row label="Ещё работы" className="contact-social">
            <div className="flex flex-wrap gap-x-6">
              <a className="inline-flex min-h-8 items-center gap-2" href={c.links.behance} target="_blank" rel="noopener">Behance <span aria-hidden="true">↗</span></a>
              <a className="inline-flex min-h-8 items-center gap-2" href={c.links.dribbble} target="_blank" rel="noopener">Dribbble <span aria-hidden="true">↗</span></a>
            </div>
          </Row>
        </ul>
      </div>
    </section>
  )
}

function Row({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <li className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="contact-label">
        {label}
      </span>
      {children}
    </li>
  )
}

export function Colophon({ city, name = 'Сулейман Шерипов' }: { city: string; name?: string }) {
  return (
    <footer className="border-t border-rule py-6 text-xs text-ink-muted">
      <div className="mx-auto flex w-full max-w-[var(--shell)] flex-wrap justify-between gap-3 px-[var(--gutter)]">
        <span>
          <b className="font-medium text-ink">{name.toLocaleUpperCase('ru-RU')}</b>, {city}
        </span>
        <a className="admin-entry" href={`${import.meta.env.BASE_URL}admin/`}>Управление сайтом ↗</a>
      </div>
    </footer>
  )
}
