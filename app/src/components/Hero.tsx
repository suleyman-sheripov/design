import { useMemo } from 'react'
import { Typed } from './Typed'
import { Cta } from './Cta'
import { LoomArt } from './LoomArt'
import { type Profile } from '../data'
import { useSiteSettings } from '../lib/settings'

export function Hero({ start, profile }: { start: boolean; profile: Profile }) {
  const { settings, services } = useSiteSettings()
  const words = profile.name.toLocaleUpperCase('ru-RU').split(' ')
  const script = useMemo(() => [{type:'write' as const, text:profile.role.toLocaleUpperCase('ru-RU')}], [profile.role])
  return <section className={`kinetic-hero ${start ? 'is-live' : ''}`} aria-labelledby="heroTitle">
    <div className="kinetic-surface">
      <div className="kinetic-composition">
        <p className="kinetic-role">
          <span className="sr-only">{profile.role}</span>
          <span className="role-type" aria-hidden="true"><Typed key={start ? 'live' : 'waiting'} script={script} start={start} speed={48} /></span>
        </p>
        <h1 id="heroTitle" className="kinetic-name" aria-label={profile.name}>
          <span className="name-first" aria-hidden="true">{words[0]}</span>
          <span className="name-last" aria-hidden="true">{words.slice(1).join(' ')}</span>
        </h1>
        <div className="kinetic-art"><LoomArt active={start} /></div>
        <div className="kinetic-actions">
          <a className="kinetic-work-link" href="#work">{settings.heroWork} <span aria-hidden="true">↘</span></a>
          <Cta href="#contact">{settings.heroContact}</Cta>
        </div>
      </div>
      <nav hidden={!settings.showServices} className="kinetic-disciplines" aria-label="Направления дизайна">
        {services.filter(s => s.hero).map(s => <a key={s.id} href={`#service-${s.id}`}>{s.title}</a>)}
      </nav>
    </div>
  </section>
}
