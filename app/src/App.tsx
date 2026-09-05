import { useCallback, useEffect, useState } from 'react'
import { loadProfile, loadProjects, type Profile, type Project } from './data'
import { Colophon, Contact } from './components/Contact'
import { Cta } from './components/Cta'
import { Cursor } from './components/Cursor'
import { Experience } from './components/Experience'
import { HeroAct, Lede, Stamp } from './components/Hero'
import { CURTAIN_FADE_MS, Curtain, Intro } from './components/Intro'
import { Lockup } from './components/Lockup'
import { Piece, Stagger } from './components/Reveal'
import { Skills } from './components/Skills'
import { GooDefs } from './components/Symbiote'
import { CaseSheet, Work } from './components/Work'

const shell = 'mx-auto w-full max-w-[var(--shell)] px-[var(--gutter)]'

/* Сколько замок летит из занавеса в шапку. Первый экран ждёт этого
   времени: он обязан собираться после того, как логотип встал на
   место, а не одновременно с перелётом. Одновременно это читалось
   как подмена картинки, а не как сборка. */
const LANDING_MS = 760

type Stage = 'intro' | 'landing' | 'live'

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [openCase, setOpenCase] = useState<Project | null>(null)

  /* Интро играет один раз за сессию: перезагрузка в той же вкладке не
     должна каждый раз задерживать на пять секунд */
  const [stage, setStage] = useState<Stage>(() =>
    sessionStorage.getItem('intro-seen') === '1' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'live'
      : 'intro',
  )

  /* Занавес переживает конец сцены на время затухания, поэтому у него
     своё состояние, а не отрицание стадии */
  const [curtain, setCurtain] = useState(() => stage === 'intro')

  useEffect(() => {
    loadProfile().then(setProfile, () => setFailed(true))
    loadProjects().then(setProjects, () => setFailed(true))
  }, [])

  const finishIntro = useCallback(() => {
    sessionStorage.setItem('intro-seen', '1')
    setStage('landing')
    setTimeout(() => setStage('live'), LANDING_MS)
    setTimeout(() => setCurtain(false), CURTAIN_FADE_MS + 220)
  }, [])

  const landed = stage !== 'intro'

  return (
    <>
      <GooDefs />
      <Cursor />
      {curtain && <Curtain leaving={landed} />}
      {stage === 'intro' && <Intro onDone={finishIntro} />}

      <header className="pt-[clamp(1.1rem,2.4vw,1.75rem)]">
        <div className={`${shell} flex flex-wrap items-center justify-between gap-4`}>
          <span className="sr-only">Сулейман Шерипов, графический и UI/UX дизайнер</span>
          {/* Пока замок в занавесе, его место держит невидимая копия:
              без неё шапка подпрыгнула бы в момент посадки */}
          <Lockup
            key={landed ? 'home' : 'placeholder'}
            animated={landed}
            className={`text-[clamp(1.5rem,3.2vw,2.35rem)] ${landed ? '' : 'invisible'}`}
            aria-hidden="true"
          />
          <nav
            aria-label="Разделы страницы"
            className={`ms-auto flex gap-6 text-sm transition-opacity duration-500 ${
              stage === 'live' ? 'opacity-100' : 'opacity-0'
            }`}
          >
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
        {/* Первый экран во всю высоту и почти пустой. Блок стоит
            слева и чуть ниже середины: ровно по центру он выглядел
            вывеской, а не началом разговора. Печать держит правую
            половину, чтобы пустота читалась замыслом, а не недоделкой. */}
        <section className="flex min-h-[100svh] items-center pb-[8vh]">
          <div className={`${shell} mt-[7vh] flex items-end justify-between gap-8`}>
            <Stagger show={stage === 'live'}>
              <Piece>
                <Lede start={stage === 'live'} />
              </Piece>
              <Piece>
                <HeroAct>
                  <Cta href="#contact">Обсудить задачу</Cta>
                </HeroAct>
              </Piece>
            </Stagger>

            <div
              className={`hidden shrink-0 transition-opacity duration-700 md:block ${
                stage === 'live' ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Stamp />
            </div>
          </div>
        </section>

        {profile ? (
          <Experience track={profile.track} />
        ) : (
          <section className="py-16">
            <div className={shell}>
              <Placeholder failed={failed} what="опыт" />
            </div>
          </section>
        )}

        <Work projects={projects} failed={failed} onOpen={setOpenCase} />
        <Skills />
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
