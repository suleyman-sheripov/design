import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Profile, Project } from '../data'
import type { Service, SiteSettings } from './settings'

/* Живой мост между админкой (родитель) и сайтом внутри iframe (потомок).

   Работает только когда сайт открыт ИМЕННО как вложенный iframe с
   ?editor-preview=1: window.parent !== window. Старый способ
   «Предпросмотр» открывает сайт в НОВОЙ ВКЛАДКЕ через window.open —
   там window.parent === window всегда, мост не активируется, и этот
   путь продолжает работать ровно как раньше, через одноразовый
   снимок из sessionStorage в content.ts. Два механизма не пересекаются
   по конструкции, а не по соглашению. */

export type BridgeContent = {
  settings?: Partial<SiteSettings>
  services?: Service[]
  profile: Profile
  projects: { projects: Project[] }
}

/* Пока один тип цели — карточка проекта. Список целей расширяется
   по мере переноса остальных областей сайта под выбор. */
export type EditTarget = { type: 'project'; key: string }
export type BridgeMode = 'select' | 'inspect'

/* Метка версии протокола в каждом сообщении: отличает наши сообщения
   от постороннего postMessage-шума (Vite HMR, расширения браузера) до
   того, как читать поля. */
const CHANNEL = 'portfolio-editor-bridge/1'

type InMsg =
  | { channel: typeof CHANNEL; kind: 'init'; channelId: string; revision: number; mode: BridgeMode; document: BridgeContent }
  | {
      channel: typeof CHANNEL
      kind: 'snapshot'
      channelId: string
      revision: number
      mode: BridgeMode
      document: BridgeContent
      assets?: Record<string, Blob>
    }
  | { channel: typeof CHANNEL; kind: 'mode'; channelId: string; mode: BridgeMode }

/* Полной validateContent здесь нарочно нет: она требует готовый к
   публикации документ (обложки, подписи), а во время печати заголовок
   на миг может быть пустым. Это разные проверки: форма во время
   ввода терпит промежуточные состояния, публикация — нет. */
function looksLikeDraft(value: unknown): value is BridgeContent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const projects = v.projects as Record<string, unknown> | undefined
  return !!v.profile && !!projects && Array.isArray(projects.projects)
}

export type EditBridge = {
  active: boolean
  mode: BridgeMode
  document: BridgeContent | null
  /* Возвращает object URL для картинки, загруженной в ЭТУ сессию
     редактирования и ещё не опубликованной. Для обычного имени файла
     возвращает undefined — вызывающий код в этом случае берёт
     обычный источник, поведение вне живой сессии не меняется. */
  assetUrl: (id: string) => string | undefined
  select: (target: EditTarget) => void
}

const NOOP_BRIDGE: EditBridge = {
  active: false,
  mode: 'select',
  document: null,
  assetUrl: () => undefined,
  select: () => {},
}

export function usePreviewBridge(): EditBridge {
  const embedded = typeof window !== 'undefined' && window.parent !== window
  const active = embedded && new URLSearchParams(location.search).get('editor-preview') === '1'

  const [state, setState] = useState<{ document: BridgeContent | null; mode: BridgeMode }>({
    document: null,
    mode: 'select',
  })

  /* channelId и revision управляют корректностью приёма сообщений,
     а не отрисовкой: держим их вне React-состояния */
  const channelId = useRef<string | null>(null)
  const revision = useRef(-1)
  const assets = useRef(new Map<string, string>())

  useEffect(() => {
    if (!active) return

    /* Сам Map за время эффекта не пересоздаётся — только его
       содержимое; локальная переменная нужна лишь затем, чтобы
       обработчик очистки не читал .current линтуемым образом */
    const liveAssets = assets.current

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return
      if (e.origin !== location.origin) return
      const data = e.data as InMsg | undefined
      if (!data || data.channel !== CHANNEL) return

      if (data.kind === 'init') {
        channelId.current = data.channelId
        revision.current = data.revision
        if (!looksLikeDraft(data.document)) return
        setState({ document: data.document, mode: data.mode })
        return
      }

      /* Все сообщения после init обязаны нести тот же channelId:
         так запоздавшее сообщение от предыдущего подключения (после
         перезагрузки iframe) не подмешается к новому */
      if (data.channelId !== channelId.current) return

      if (data.kind === 'mode') {
        setState(s => ({ ...s, mode: data.mode }))
        return
      }

      if (data.kind === 'snapshot') {
        /* Более старая или повторная ревизия игнорируется: без этого
           сообщение, застрявшее в очереди, могло бы откатить более
           свежую правку */
        if (data.revision <= revision.current) return
        if (!looksLikeDraft(data.document)) return
        revision.current = data.revision

        if (data.assets) {
          for (const [id, blob] of Object.entries(data.assets)) {
            const prev = assets.current.get(id)
            if (prev) URL.revokeObjectURL(prev)
            assets.current.set(id, URL.createObjectURL(blob))
          }
        }

        setState({ document: data.document, mode: data.mode })
        window.parent.postMessage(
          { channel: CHANNEL, kind: 'applied', channelId: data.channelId, revision: data.revision },
          location.origin,
        )
      }
    }

    addEventListener('message', onMessage)
    /* ready может уйти раньше, чем родитель повесит свой обработчик —
       это не гонка: родитель отправляет init в ответ на ready, а не
       наоборот, поэтому порядок подписки родителя не важен */
    window.parent.postMessage({ channel: CHANNEL, kind: 'ready' }, location.origin)

    return () => {
      removeEventListener('message', onMessage)
      for (const url of liveAssets.values()) URL.revokeObjectURL(url)
      liveAssets.clear()
    }
  }, [active])

  const select = useCallback((target: EditTarget) => {
    if (!channelId.current) return
    window.parent.postMessage({ channel: CHANNEL, kind: 'selection', channelId: channelId.current, target }, location.origin)
  }, [])

  const assetUrl = useCallback((id: string) => assets.current.get(id), [])

  if (!active) return NOOP_BRIDGE
  return { active: true, mode: state.mode, document: state.document, assetUrl, select }
}

export const EditBridgeContext = createContext<EditBridge>(NOOP_BRIDGE)
export const useEditBridge = () => useContext(EditBridgeContext)
