import { useEffect, useRef, useState } from 'react'
import { inquiryMailto, inquiryText } from '../lib/inquiry'
import './ProjectInquiry.css'

export function ProjectInquiry({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!open) return
    const el = dialog.current!
    const trigger = document.activeElement as HTMLElement | null
    const html = document.documentElement, overflow = html.style.overflow
    html.style.overflow = 'hidden'
    el.showModal()
    el.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    return () => {
      el.close()
      html.style.overflow = overflow
      trigger?.focus({ preventScroll: true })
    }
  }, [open])
  const values = () => {
    const data = new FormData(form.current!)
    return { name: String(data.get('name') ?? ''), email: String(data.get('email') ?? ''), message: String(data.get('message') ?? '') }
  }
  return <dialog ref={dialog} className="project-inquiry" aria-labelledby="inquiry-title" onClose={onClose} onClick={event => {
    const r = event.currentTarget.getBoundingClientRect()
    if (event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) onClose()
  }}>
    <button className="inquiry-close" type="button" onClick={onClose} aria-label="Закрыть форму">×</button>
    <p className="inquiry-eyebrow">НОВЫЙ ПРОЕКТ</p>
    <h2 id="inquiry-title">Обсудим задачу<span>.</span></h2>
    <p className="inquiry-intro">Что нужно сделать? Пара строк — хорошее начало.</p>
    <form ref={form} onInput={event => { const field = event.target; if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.setCustomValidity('') }} onSubmit={event => {
      event.preventDefault()
      const data = values()
      for (const key of ['name', 'message'] as const) {
        if (!data[key].trim()) {
          const field = form.current!.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement
          field.setCustomValidity(key === 'name' ? 'Укажите имя.' : 'Расскажите немного о задаче.')
          field.reportValidity(); return
        }
      }
      window.open(inquiryMailto(email, data), '_blank', 'noopener,noreferrer')
      setMessage('Письмо подготовлено. Отправьте его в почтовом приложении. Если оно не открылось, скопируйте текст ниже.')
    }}>
      <div className="inquiry-fields">
        <label>Имя<input name="name" autoComplete="name" maxLength={100} required /></label>
        <label>Почта для ответа<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
      </div>
      <label>О проекте<textarea name="message" rows={5} maxLength={4000} required placeholder="Задача, сроки, ссылки — всё, что уже известно." /></label>
      <button className="inquiry-submit" type="submit">Открыть письмо <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 5h14v14M19 5 5 19" stroke="currentColor" strokeWidth="1.5" /></svg></button>
      <p className="inquiry-note">Откроется почтовое приложение с заполненным письмом на <a href={`mailto:${email}`}>{email}</a>.</p>
      <button className="inquiry-copy" type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(inquiryText(values())); setMessage('Текст скопирован. Можно вставить его в письмо или сообщение.') }
        catch { setMessage('Не удалось скопировать. Текст остаётся в форме — его можно выделить и скопировать вручную.') }
      }}>Скопировать текст</button>
      <p className="inquiry-status" role="status">{message}</p>
    </form>
  </dialog>
}
