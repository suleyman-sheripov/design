import { useEffect, useRef, useState } from 'react'
import * as sound from '../lib/sound'

/* При первом входе нет ни обещания звука, ни барьера перед портфолио.
   Повтор доступен после знакомства: жест разрешает звук до первого кадра. */
export function SoundReplay({ live, onReplay }: { live: boolean; onReplay: () => void }) {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const replaying = useRef(false)
  const returnScroll = useRef(0)
  const trigger = useRef<HTMLButtonElement>(null)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (live && replaying.current) {
      replaying.current = false
      window.scrollTo({ top: returnScroll.current, behavior: 'instant' })
      trigger.current?.focus({ preventScroll: true })
    }
  }, [live])

  if (reduced) return null
  return <div className="mx-auto max-w-[var(--shell)] px-[var(--gutter)] pb-6 text-xs text-ink-muted">
    <button ref={trigger} disabled={!live || busy} type="button" className="min-h-11 cursor-pointer underline underline-offset-4 disabled:opacity-50"
      onClick={async () => {
        setBusy(true)
        const allowed = await sound.enable()
        setBusy(false)
        if (!allowed) { setMessage('Браузер не разрешил звук. Портфолио можно смотреть дальше.'); return }
        setEnabled(true); setMessage(''); returnScroll.current = window.scrollY; replaying.current = true; onReplay()
      }}>Заставка со звуком ↗</button>
    {enabled && <button type="button" className="ms-5 min-h-11 cursor-pointer" onClick={() => { sound.disable(); setEnabled(false) }}>Выключить звук</button>}
    <span role="status" className="ms-3">{message}</span>
  </div>
}
