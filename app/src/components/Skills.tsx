import { useEffect, useRef } from 'react'
import { SecHead } from './SecHead'
import { useSiteSettings } from '../lib/settings'

export function Skills() {
  const { settings, services } = useSiteSettings()
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    const revealService = () => {
      const id = location.hash.slice(1).replace(/[^a-z0-9-]/g, '')
      const target = root.current?.querySelector<HTMLDetailsElement>(`details[id="${id}"]`)
      if (target) {
        target.open = true
        target.scrollIntoView({block:'start'})
      }
    }
    revealService()
    window.addEventListener('hashchange', revealService)
    return () => window.removeEventListener('hashchange', revealService)
  }, [])

  return <section ref={root} id="skills" aria-labelledby="skillsTitle" className="services-section">
    <div className="section-shell">
      <div className="services-heading scroll-arrive"><SecHead id="skillsTitle" index="03" title={settings.servicesTitle} /><p>{settings.servicesIntro}</p></div>
      <div className="service-catalog">
        {[
          {id:'brand', title:'Бренд и носители'},
          {id:'digital', title:'Цифровые продукты'},
          {id:'visual', title:'Визуальный контент'},
        ].map(group => <div className="service-group scroll-arrive" key={group.id}>
          <h3>{group.title}</h3>
          {services.filter(s => s.group === group.id).map(service => <details id={`service-${service.id}`} className="service-item" key={service.id}>
            <summary>{service.title}<span aria-hidden="true">+</span></summary>
            <p>{service.detail}</p>
          </details>)}
        </div>)}
      </div>
      <div className="service-tools scroll-arrive"><span>Инструменты</span><p>{settings.toolsLabel}</p></div>
    </div>
  </section>
}
