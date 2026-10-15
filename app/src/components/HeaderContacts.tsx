import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Profile } from '../data'
import './HeaderContacts.css'

type ContactKind = 'email' | 'behance' | 'dribbble' | 'linkedin'

function ContactIcon({ kind }: { kind: ContactKind }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
    {kind === 'email' && <path fillRule="evenodd" d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2 8 6 8-6v2l-8 6-8-6V6Z" />}
    {kind === 'behance' && <path fillRule="evenodd" d="M1 5h7c3.2 0 5 1.5 5 4 0 1.4-.7 2.4-1.8 3 1.7.5 2.6 1.8 2.6 3.5 0 2.9-2.1 4.5-5.4 4.5H1V5Zm3.4 3v3h3.2c1.2 0 1.9-.5 1.9-1.5S8.8 8 7.6 8H4.4Zm0 6v3h3.8c1.4 0 2.1-.5 2.1-1.5S9.6 14 8.2 14H4.4ZM16 4h6v2h-6V4Zm3 4c3.5 0 5 2.7 5 6.5h-7c.1 1.7.8 2.6 2.2 2.6.9 0 1.5-.4 1.8-1.1h2.8c-.5 2.5-2.2 4-4.7 4-3.5 0-5.5-2.4-5.5-6s2-6 5.4-6Zm-2 4.3h4.1c-.2-1.2-.8-1.8-2-1.8-1.1 0-1.8.6-2.1 1.8Z" />}
    {kind === 'dribbble' && <>
      <circle cx="12" cy="12" r="10" />
      <path d="M7 3.5c4.2 4.7 7.2 10.4 9 17M2.5 9c6 .5 12-1 16-5M4 18c3.5-6 10.4-8.5 17.6-5.3" fill="none" stroke="var(--contact-cutout, var(--color-paper))" strokeWidth="1.5" />
    </>}
    {kind === 'linkedin' && <>
      <path d="M4 2h16a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
      <path d="M6 10h3v9H6v-9Zm5 0h2.9v1.2c.5-.9 1.4-1.5 2.8-1.5 2.7 0 3.3 1.7 3.3 4V19h-3v-4.7c0-1.1-.1-2-1.5-2s-1.5 1.1-1.5 2V19h-3v-9Z" fill="var(--contact-cutout, var(--color-paper))" />
      <circle cx="7.5" cy="6.7" r="1.6" fill="var(--contact-cutout, var(--color-paper))" />
    </>}
  </svg>
}

export function HeaderContacts({ profile }: { profile: Profile }) {
  const id = useId()
  const reduced = useReducedMotion() ?? false
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const tray = useRef<HTMLDivElement>(null)
  const opened = useRef(false)
  const dismissed = useRef(false)
  const keyboard = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [{ open, turn }, setVisual] = useState({ open: false, turn: 0 })
  const contacts: { kind: ContactKind; label: string; href: string }[] = [
    { kind: 'email', label: 'Написать на почту', href: `mailto:${profile.email}` },
    { kind: 'behance', label: 'Behance', href: profile.links.behance },
    { kind: 'dribbble', label: 'Dribbble', href: profile.links.dribbble },
    { kind: 'linkedin', label: 'LinkedIn', href: profile.links.linkedin?.trim() || '' },
  ].filter(contact => contact.href) as { kind: ContactKind; label: string; href: string }[]

  const change = useCallback((next: boolean) => {
    clearTimeout(closeTimer.current)
    closeTimer.current = undefined
    if (opened.current === next) return
    opened.current = next
    setVisual(previous => ({ open: next, turn: previous.turn + (next ? 1080 : 720) }))
  }, [])

  const dismiss = useCallback(() => {
    dismissed.current = true
    change(false)
  }, [change])

  useEffect(() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)')
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !fine.matches) return
      const button = trigger.current?.getBoundingClientRect()
      if (!button?.width) { change(false); return }
      const distance = Math.hypot(event.clientX - button.x - button.width / 2, event.clientY - button.y - button.height / 2)
      if (dismissed.current) {
        if (distance > 100) dismissed.current = false
        return
      }
      if (keyboard.current && root.current?.contains(document.activeElement)) return
      const area = tray.current?.getBoundingClientRect()
      const inTray = opened.current && area && event.clientX >= area.left - 24 && event.clientX <= area.right + 24 && event.clientY >= area.top - 24 && event.clientY <= area.bottom + 24
      if (distance < (opened.current ? 100 : 68) || inTray) change(true)
      else if (opened.current && !closeTimer.current) closeTimer.current = setTimeout(() => change(false), 100)
    }
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) change(false)
    }
    const leave = (event: PointerEvent) => { if (event.pointerType === 'mouse' && !keyboard.current) change(false) }
    const scroll = () => change(false)
    addEventListener('pointermove', move, { passive: true })
    addEventListener('pointerdown', outside)
    addEventListener('scroll', scroll, { passive: true })
    addEventListener('resize', scroll)
    document.addEventListener('pointerleave', leave)
    return () => {
      clearTimeout(closeTimer.current)
      removeEventListener('pointermove', move)
      removeEventListener('pointerdown', outside)
      removeEventListener('scroll', scroll)
      removeEventListener('resize', scroll)
      document.removeEventListener('pointerleave', leave)
    }
  }, [change])

  return <div ref={root} className="contact-orbit" data-open={String(open)} style={{ '--contact-count': contacts.length } as CSSProperties}
    onPointerDownCapture={() => { keyboard.current = false }}
    onKeyDown={event => {
      keyboard.current = true
      if (event.key === 'Escape') { event.preventDefault(); dismiss(); trigger.current?.focus() }
      if (event.key === 'ArrowDown' && event.target === trigger.current) {
        event.preventDefault(); dismissed.current = false; change(true)
        requestAnimationFrame(() => tray.current?.querySelector<HTMLAnchorElement>('a')?.focus())
      }
    }}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) change(false) }}>
    <button ref={trigger} className="contact-orbit-trigger" type="button" aria-label={open ? 'Закрыть контакты' : 'Открыть контакты'} aria-expanded={open} aria-controls={id}
      onClick={() => { if (opened.current) dismiss(); else { dismissed.current = false; change(true) } }}>
      <motion.span className="contact-orbit-grid" initial={false}
        animate={{ rotate: reduced ? 0 : [null, turn + 30, turn], scale: reduced ? 1 : [null, .74, 1.13, 1], filter: reduced ? 'blur(0px)' : [null, 'blur(4px)', 'blur(0px)'] }}
        transition={{ duration: reduced ? 0 : open ? .78 : .6, ease: [.3, 0, .2, 1] }}>
        {(['email', 'behance', 'dribbble', 'linkedin'] as ContactKind[]).map(kind => <span key={kind}><ContactIcon kind={kind} /></span>)}
      </motion.span>
    </button>
    <div ref={tray} id={id} className="contact-orbit-items" aria-label="Контакты и профили" aria-hidden={!open} inert={!open}>
      {contacts.map((contact, index) => {
        const x = (index - contacts.length + 1) * 56
        const y = 64 + (index > 0 && index < contacts.length - 1 ? 10 : 0)
        return <motion.a key={contact.kind} className="contact-orbit-link" href={contact.href} aria-label={contact.label} title={contact.label}
          target={contact.kind === 'email' ? undefined : '_blank'} rel={contact.kind === 'email' ? undefined : 'noopener noreferrer'}
          tabIndex={open ? 0 : -1} style={{ '--contact-i': index } as CSSProperties} onClick={dismiss}
          initial={false}
          animate={open ? {
            x: reduced ? x : [null, x * .18, x * 1.08, x * .98, x],
            y: reduced ? y : [null, -18, y - 12, y + 5, y],
            rotate: reduced ? 0 : [null, -65, -400, 8, 0],
            scale: reduced ? 1 : [null, .6, 1.16, .97, 1], opacity: 1,
            filter: reduced ? 'blur(0px)' : [null, 'blur(5px)', 'blur(2px)', 'blur(0px)', 'blur(0px)'],
          } : { x: 0, y: 0, rotate: reduced ? 0 : [null, 55, 540], scale: .22, opacity: 0, filter: reduced ? 'blur(0px)' : [null, 'blur(3px)', 'blur(0px)'] }}
          transition={{ duration: reduced ? 0 : open ? .7 : .42, delay: reduced ? 0 : open ? .15 + index * .11 : (contacts.length - 1 - index) * .075, ease: [.22, .75, .2, 1] }}>
          <span className="contact-orbit-bounce"><ContactIcon kind={contact.kind} /></span>
        </motion.a>
      })}
    </div>
  </div>
}
