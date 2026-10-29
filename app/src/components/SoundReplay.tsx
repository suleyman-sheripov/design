import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import * as sound from '../lib/sound'
import { ReplayArrow, SpeakerIcon } from './ReplayIcons'

export function SoundReplay({ live, onReplay }: { live: boolean; onReplay: () => void }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const replaying = useRef(false)
  const returnScroll = useRef(0)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (live && replaying.current) {
      replaying.current = false
      window.scrollTo({ top: returnScroll.current, behavior: 'instant' })
      trigger.current?.focus({ preventScroll: true })
    }
  }, [live])
  const replay = async (withSound: boolean, button: HTMLButtonElement) => {
    trigger.current = button
    returnScroll.current = window.scrollY
    setBusy(true)
    sound.disable()
    const allowed = withSound ? await sound.enable() : false
    setBusy(false)
    setMessage(withSound && !allowed ? 'Звук недоступен — показываем заставку без него.' : '')
    replaying.current = true
    onReplay()
  }
  return <div className="intro-replay">
    {reduced && <span className="intro-motion-note">В системе включено уменьшение движения.</span>}
    <button disabled={!live || busy} type="button" onClick={event => void replay(false, event.currentTarget)}>Смотреть заставку <ReplayArrow /></button>
    <button disabled={!live || busy} type="button" onClick={event => void replay(true, event.currentTarget)} aria-label="Заставка со звуком">Со звуком <SpeakerIcon /></button>
    <span role="status">{message}</span>
  </div>
}
