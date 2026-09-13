import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  CHANNEL,
  isValidInit,
  isValidModeMessage,
  isValidSnapshot,
  readEnvelope,
} from '../../public/admin/bridge-protocol.js'
import { imageNames } from '../../public/admin/model.js'
import type { Profile, Project } from '../data'
import type { Service, SiteSettings } from './settings'

/* Живой мост между админкой (родитель) и сайтом внутри iframe (потомок).

   Протокол — общий модуль bridge-protocol.js, а не две копии одной
   формы сообщений: тот же приём, каким уже делится model.js между
   admin.js и content.ts.

   Мост работает только когда сайт открыт ИМЕННО как вложенный iframe с
   ?editor-preview=1: window.parent !== window. Старый способ
   «Предпросмотр» открывает сайт в НОВОЙ ВКЛАДКЕ через window.open —
   там window.parent === window всегда, мост не активируется, и этот
   путь продолжает работать ровно как раньше, через одноразовый
   снимок из sessionStorage в content.ts. */

export type BridgeContent = {
  settings?: Partial<SiteSettings>
  services?: Service[]
  profile: Profile
  projects: { projects: Project[] }
}

export type EditTarget = { type: 'project'; key: string }
export type BridgeMode = 'select' | 'inspect'

export type EditBridge = {
  active: boolean
  mode: BridgeMode
  document: BridgeContent | null
  /* Возвращает object URL для картинки, загруженной в эту сессию
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
      const raw = readEnvelope(e.data) as Record<string, unknown> | null
      if (!raw) return

      if (raw.kind === 'init') {
        if (!isValidInit(raw)) return
        /* Ревизия — сквозной счётчик родителя, растёт при каждом
           подключении и каждом снимке. Устаревший/повторный init
           внутри уже принятого соединения не может откатить более
           свежий snapshot, потому что несёт меньшую ревизию — та же
           проверка, что и для snapshot ниже, без отдельного правила. */
        const nextRevision = raw.revision as number
        if (nextRevision <= revision.current) return
        channelId.current = raw.channelId as string
        revision.current = nextRevision
        /* Новое подключение — прежние URL относились к прошлому
           соединению; сами Blob родитель пришлёт заново со снимком */
        for (const url of liveAssets.values()) URL.revokeObjectURL(url)
        liveAssets.clear()
        setState({ document: raw.document as BridgeContent, mode: raw.mode as BridgeMode })
        return
      }

      /* Все сообщения после init обязаны нести тот же channelId:
         так запоздавшее сообщение от предыдущего подключения (после
         перезагрузки iframe) не подмешается к новому */
      if (raw.channelId !== channelId.current) return

      if (raw.kind === 'mode') {
        if (!isValidModeMessage(raw)) return
        setState(s => ({ ...s, mode: raw.mode as BridgeMode }))
        return
      }

      if (raw.kind === 'snapshot') {
        if (!isValidSnapshot(raw)) return
        const nextRevision = raw.revision as number
        /* Более старая или повторная ревизия игнорируется: без этого
           сообщение, застрявшее в очереди, могло бы откатить более
           свежую правку */
        if (nextRevision <= revision.current) return
        revision.current = nextRevision

        const document = raw.document as BridgeContent
        const incoming = raw.assets as Record<string, Blob> | undefined
        if (incoming) {
          for (const [id, blob] of Object.entries(incoming)) {
            const prev = liveAssets.get(id)
            if (prev) URL.revokeObjectURL(prev)
            liveAssets.set(id, URL.createObjectURL(blob))
          }
        }
        /* Гигиена: id, на который больше не ссылается ни один проект
           в пришедшем документе, освобождается. Если он понадобится
           снова (например, Undo вернул старую обложку, а Redo —
           опять новую), родитель узнаёт об этом по своей же копии
           «что уже отправлено» и пришлёт Blob заново — см.
           editor-live.js: pushSnapshot убирает такие id из
           sentAssetIds/pendingAssetIds в тот же момент. */
        const stillUsed = new Set(imageNames(document))
        for (const [id, url] of liveAssets) {
          if (!stillUsed.has(id)) {
            URL.revokeObjectURL(url)
            liveAssets.delete(id)
          }
        }

        setState({ document, mode: raw.mode as BridgeMode })
        /* channelId и revision уже прошли проверку выше по коду —
           здесь просто подтверждаем родителю, какую именно ревизию
           приняли, чтобы он знал, какие Blob точно дошли */
        window.parent.postMessage(
          { channel: CHANNEL, kind: 'applied', channelId: raw.channelId, revision: nextRevision },
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
    window.parent.postMessage(
      { channel: CHANNEL, kind: 'selection', channelId: channelId.current, target },
      location.origin,
    )
  }, [])

  const assetUrl = useCallback((id: string) => assets.current.get(id), [])

  if (!active) return NOOP_BRIDGE
  return { active: true, mode: state.mode, document: state.document, assetUrl, select }
}

export const EditBridgeContext = createContext<EditBridge>(NOOP_BRIDGE)
export const useEditBridge = () => useContext(EditBridgeContext)
