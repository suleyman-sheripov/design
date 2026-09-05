
import { useCallback, useEffect, useState } from 'react'
import { loadProfile, loadProjects, type Profile, type Project } from './data'
import { Colophon, Contact } from './components/Contact'
import { Cta } from './components/Cta'
import { HeroAct, Lede } from './components/Hero'
import { CURTAIN_FADE_MS, Curtain, Intro } from './components/Intro'
import { Kit } from './components/Kit'
import { Lockup } from './components/Lockup'
import { Tile } from './components/Tile'
import { Ticker } from './components/Ticker'
import { Track } from './components/Track'
import { CaseSheet, Work } from './components/Work'

const shell = 'mx-auto w-full max-w-[var(--shell)] px-[var(--gutter)]'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [openCase, setOpenCase] = useState<Project | null>(null)

  /* Интро играет один раз за сессию: перезагрузка страницы в той же
     вкладке не должна каждый раз задерживать на четыре секунды */
  const [introDone, setIntroDone] = useState(
    () =>
      sessionStorage.getItem('intro-seen') === '1' ||
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    loadProfile().then(setProfile, () => setFailed(true))
    loadProjects().then(setProjects, () => setFailed(true))
  }, [])

  /* Занавес переживает конец сцены на время затухания, поэтому у
     него своё состояние, а не отрицание introDone */
  const [curtain, setCurtain] = useState(() => !introDone)

  const finishIntro = useCallback(() => {
    sessionStorage.setItem('intro-seen', '1')
    setIntroDone(true)
    setTimeout(() => setCurtain(false), CURTAIN_FADE_MS + 200)
  }, [])

  return (
    <>
      {curtain && <Curtain leaving={introDone} />}
      {!introDone && <Intro onDone={finishIntro} />}

      <header className="pt-[clamp(1.1rem,2.4vw,1.75rem)]">
        <div className={`${shell} flex flex-wrap items-center justify-between gap-4`}>
          <span className="sr-only">Сулейман Шерипов, графический и UI/UX дизайнер</span>
          {/* Пока замок в занавесе, его место в шапке держит невидимая
              копия: без неё шапка подпрыгнула бы в момент посадки */}
          <Lockup
            key={introDone ? 'home' : 'placeholder'}
            animated={introDone}
            className={`text-[clamp(1.05rem,2.4vw,1.5rem)] ${introDone ? '' : 'invisible'}`}
            aria-hidden="true"
          />
          <nav aria-label="Разделы страницы" className="ms-auto flex gap-6 text-sm">
            <a href="#work" className="text-ink-muted no-underline hover:text-ink">
              Работы
            </a>
            <a href="#contact" className="text-ink-muted no-underline hover:text-ink">
              Связаться
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section className="pt-[clamp(1.5rem,3vw,2.5rem)] pb-[clamp(2rem,5vw,3.5rem)]">
          <div className={shell}>
            <Lede />

            <HeroAct>
              <Cta href="#contact">Обсудить задачу</Cta>
            </HeroAct>

            {/* Опыт вдвое весомее набора инструментов, поэтому и
                шире. Одинаковыми они были бы просто двумя карточками. */}
            <div className="mt-[clamp(1.6rem,3.5vw,2.5rem)] grid grid-cols-4 items-stretch gap-[clamp(0.7rem,1.3vw,1.1rem)] md:grid-cols-12">
              <Tile
                id="experience"
                label="Мой опыт"
                className="col-span-4 md:col-span-7"
              >
                {profile ? (
                  <Track track={profile.track} />
                ) : (
                  <Placeholder failed={failed} what="опыт" />
                )}
              </Tile>

              <Tile label="Чем работаю" fill="moss" className="col-span-4 md:col-span-5">
                {profile ? (
                  <Kit tools={profile.tools} />
                ) : (
                  <Placeholder failed={failed} what="инструменты" />
                )}
              </Tile>
            </div>

            <Ticker />
          </div>
        </section>

        <Work projects={projects} failed={failed} onOpen={setOpenCase} />
        <Contact profile={profile} />
      </main>

      <Colophon city={profile?.city ?? 'Минск'} />
      <CaseSheet project={openCase} onClose={() => setOpenCase(null)} />
    </>
  )
}

/* Плитки живут на JSON. Пока он идёт — говорим об этом, если не
   пришёл — говорим честно и оставляем способ связаться, а не
   показываем пустую плитку. */
function Placeholder({ failed, what }: { failed: boolean; what: string }) {
  return (
    <p className="text-sm opacity-70">
      {failed ? (
        <>
          Не удалось загрузить {what}. Напишите на{' '}
          <a href="mailto:suleyman.sheripov@icloud.com">suleyman.sheripov@icloud.com</a>,
          пришлю всё ссылкой.
        </>
      ) : (
        <>Загружаю…</>
      )}
    </p>
  )
}
