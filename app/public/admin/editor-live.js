/* Живой редактор: iframe настоящего сайта в режиме ?editor-preview=1
   плюс инспектор выбранной карточки проекта.

   Родитель этого модуля — admin.js. Никакого импорта в обратную
   сторону нет: всё, что нужно из admin.js (текущий data, общая
   история, конструктор поля, сжатие картинки), приходит параметром в
   initLiveEditor(), а не через import. Так граф модулей остаётся
   деревом, а не циклом.

   Группировка ввода в одну запись Undo (пауза, уход фокуса, защита
   от IME) здесь больше не своя — её делает history.js через field(),
   которую передаёт admin.js. Раньше у этого модуля был собственный
   pendingCommit/commitTimer специально для поля заголовка, а старая
   форма вообще не уведомляла живой предпросмотр — теперь оба поля
   работают через один и тот же механизм.

   Протокол сообщений — общий модуль bridge-protocol.js, читаемый и
   отсюда, и из app/src/lib/previewBridge.ts на стороне сайта. */

import {
  CHANNEL,
  isValidApplied,
  isValidModeMessage,
  isValidSelection,
  readEnvelope,
} from './bridge-protocol.js';
import { createMediaCommands } from './media-commands.js';
import { createMediaDialog } from './media-dialog.js';

const PREVIEW_URL = '../?editor-preview=1';

export function initLiveEditor({
  mount, model, field, shrink, uploads, assetUrl, touch, commit, render,
  buildPreviewPayload, setStatus, getEpoch, setImageJobsPending, mediaLibrary,
}) {
  const channelId = crypto.randomUUID();
  let data = null;
  let selectedSlug = null;
  /* Ссылки на поля текущего инспектора — используются в
     refreshInspectorValues() ниже, объявлены здесь, а не рядом с ней:
     renderInspectorEmpty() читает их уже на старте функции. */
  let titleInputEl = null;
  let coverImgEl = null;
  let coverReplaceEl = null;
  let caseCoverImgEl = null;
  let caseCoverReplaceEl = null;
  let caseCoverUseFallbackEl = null;
  let mode = 'select';
  let revision = 0;

  /* Доставка изображений подтверждается ребёнком (applied), а не
     предполагается в момент отправки: id → 'sent' (точно получено)
     либо номер ревизии снимка, с которым Blob ушёл и подтверждение
     ещё не пришло. Без этого 100 нажатий клавиши после одной
     загрузки картинки сто раз пересылали бы тот же Blob.

     Раньше это были три отдельных Set/Map (sentAssetIds,
     pendingAssetIds, pendingByRevision), синхронизируемых вручную —
     и именно в их рассинхронизации был баг, найденный ревью: id
     выходил из употребления и терял отметки «отправлен»/«ждёт», но
     оставался в pendingByRevision, поэтому запоздавший applied для
     старой ревизии безусловно возвращал его в sentAssetIds — даже
     если к этому моменту id успел не использоваться и понадобиться
     заново под ДРУГОЙ отправкой. Один Map на id избавляет от этого
     класса ошибок структурно: применить(revision) может подтвердить
     ТОЛЬКО то, что прямо сейчас числится ожидающим именно эту
     ревизию — что удалено из карты (вышло из употребления) или уже
     переотправлено под более новой ревизией, устаревшее подтверждение
     не трогает. */
  let assetDelivery = new Map();

  const root = document.createElement('div');
  root.className = 'live-editor';

  const toolbar = document.createElement('div');
  toolbar.className = 'live-toolbar';
  const selectBtn = modeButton('Выбрать элемент', 'select');
  const inspectBtn = modeButton('Проверить сайт', 'inspect');
  toolbar.append(selectBtn, inspectBtn);

  const stage = document.createElement('div');
  stage.className = 'live-stage';
  const iframe = document.createElement('iframe');
  iframe.className = 'live-frame';
  iframe.title = 'Живой предпросмотр сайта';
  const inspector = document.createElement('aside');
  inspector.className = 'live-inspector';
  stage.append(iframe, inspector);

  root.append(toolbar, stage);
  mount.append(root);

  /* Команды не знают о DOM/диалоге; диалог не знает о документе/истории —
     склеивает их onSelectExisting/onUploadFile ниже. Гонки внутри
     uploadForTarget защищены так же, как раньше был защищён единственный
     replaceCover (documentEpoch + per-target operation id); session
     диалога — дополнительная, третья причина отбросить устаревший
     результат, см. media-dialog.js. */
  const mediaCommands = createMediaCommands({
    findProject, uploads, safeName: model.safeName, shrink, getEpoch, setImageJobsPending, commit, touch,
  });
  const mediaDialog = createMediaDialog({ mount: root, mediaLibrary, assetUrl });

  function onSelectExisting(target, assetId) {
    const result = mediaCommands.selectExistingAsset(target, assetId);
    if (result.status === 'applied') render();
    return result;
  }
  async function onUploadFile(target, file, opts) {
    const ok = await mediaCommands.uploadForTarget(target, file, opts);
    if (ok.status === 'applied') render();
    return ok;
  }
  function onUseCoverAsCase(target) {
    if (mediaCommands.clearAsset(target).status !== 'applied') return;
    /* render() перестраивает весь инспектор — нажатая кнопка (которая
       тут же станет disabled) отсоединяется от DOM. caseCoverReplaceEl
       к этому моменту уже переприсвоен на АКТУАЛЬНУЮ кнопку «Заменить»
       (renderInspectorFor делает это синхронно внутри render()), так
       что фокус клавиатуры не проваливается в пустоту. */
    render();
    caseCoverReplaceEl?.focus();
  }

  renderInspectorEmpty();
  addEventListener('message', onMessage);
  addEventListener('keydown', onEscape);

  /* Первый кадр iframe стартует с тем же снимком черновика, что и
     кнопка «Предпросмотр» в новой вкладке — так на экране сразу
     черновик, а не опубликованная версия. Ошибку показываем тем же
     статусом, что и остальной редактор, и просто не грузим iframe. */
  try {
    sessionStorage.setItem('portfolio-preview', JSON.stringify(buildPreviewPayload()));
    iframe.src = PREVIEW_URL;
  } catch (err) {
    setStatus(err.message, true);
  }

  function onMessage(e) {
    if (e.source !== iframe.contentWindow) return;
    if (e.origin !== location.origin) return;
    const raw = readEnvelope(e.data);
    if (!raw) return;

    if (raw.kind === 'ready') { sendInit(); return; }
    /* Все сообщения после ready обязаны нести наш channelId: иначе
       перезагрузившийся ранее iframe мог бы прислать что-то от
       предыдущего подключения */
    if (raw.channelId !== channelId) return;

    if (raw.kind === 'selection') { if (isValidSelection(raw)) onSelect(raw.target); return; }
    /* applied — единственное сообщение от ребёнка, форма которого не
       проверялась: revision там раньше читался напрямую, без
       isValidRevision. Практический риск был невелик (нечисловой
       revision просто ни с чем не совпадёт внутри onApplied), но
       остальные четыре вида сообщений проверяются ДО изменения
       состояния — applied ничем не должен быть исключением. */
    if (raw.kind === 'applied') { if (isValidApplied(raw)) onApplied(raw); return; }
    /* mode шлём мы сами и не читаем назад — isValidModeMessage
       используется на приёмнике (previewBridge.ts), здесь просто
       не падаем на неизвестном kind */
  }

  function sendInit() {
    if (!data) return;
    revision++;
    /* Новое подключение — прежние отметки «ребёнок это уже получил»
       больше ничего не значат для НОВОГО ребёнка */
    assetDelivery = new Map();
    iframe.contentWindow.postMessage({ channel: CHANNEL, kind: 'init', channelId, revision, mode, document: data }, location.origin);
    pushSnapshot();
  }

  function onApplied(raw) {
    const rev = raw.revision;
    /* Подтверждает только то, что прямо сейчас числится ожидающим
       ИМЕННО эту ревизию. Id, вышедший из употребления (удалён из
       карты в pushSnapshot) или переотправленный позже под новой
       ревизией, этим запоздавшим applied не трогается. */
    for (const [id, status] of assetDelivery) if (status === rev) assetDelivery.set(id, 'sent');
  }

  function pushSnapshot() {
    if (!data || !iframe.contentWindow) return;
    revision++;

    const used = liveAssetsInUse();
    /* Id, переставший использоваться (например, Undo вернул старую
       обложку), теряет ВСЮ историю доставки: если он понадобится
       снова, ребёнок получит Blob заново, как в первый раз, а не по
       сломанной ссылке на то, что сам же у себя освободил. */
    for (const id of [...assetDelivery.keys()]) if (!used.has(id)) assetDelivery.delete(id);

    const toSend = {};
    for (const [id, image] of used) {
      if (assetDelivery.has(id)) continue; // уже доставлен или ждёт подтверждения
      toSend[id] = image.blob;
    }
    const sentThisTime = Object.keys(toSend);
    for (const id of sentThisTime) assetDelivery.set(id, revision);

    iframe.contentWindow.postMessage({
      channel: CHANNEL, kind: 'snapshot', channelId, revision, mode, document: data,
      assets: sentThisTime.length ? toSend : undefined,
    }, location.origin);
  }

  function liveAssetsInUse() {
    const used = new Set(model.imageNames(data));
    const out = new Map();
    for (const [name, image] of uploads) if (used.has(name) && image.blob) out.set(name, image);
    return out;
  }

  function findProject(targetKey) {
    return data?.projects.projects.find(p => (p.id ?? p.slug) === targetKey);
  }

  /* refreshInspectorValues() — точечное обновление полей текущего
     инспектора (titleInputEl/coverImgEl объявлены выше). Без этого
     правка того же проекта через старую форму (тоже мутирует ЭТОТ ЖЕ
     project.title, но не проходит через render()) оставляла бы здесь
     старый текст — а следующая же буква, напечатанная в инспекторе,
     тихо затёрла бы ту чужую правку значением, отсчитанным от
     устаревшего отображения. */
  function refreshInspectorValues() {
    if (!selectedSlug || inspector.contains(document.activeElement)) return;
    const project = findProject(selectedSlug);
    if (!project) return;
    if (titleInputEl && titleInputEl.value !== (project.title ?? '')) titleInputEl.value = project.title ?? '';
    if (coverImgEl) {
      const src = assetUrl(project.cover);
      if (coverImgEl.src !== src) coverImgEl.src = src;
    }
    if (caseCoverImgEl) {
      const src = assetUrl(project.caseCover || project.cover);
      if (caseCoverImgEl.src !== src) caseCoverImgEl.src = src;
    }
    if (caseCoverUseFallbackEl) caseCoverUseFallbackEl.disabled = !project.caseCover;
  }

  function onSelect(target) {
    if (!target || target.type !== 'project') return;
    /* Смена выбора обязана зафиксировать незавершённую правку прежней
       карточки как отдельный шаг истории, а не потерять её молча */
    commit();
    selectedSlug = target.key;
    renderInspectorFor(selectedSlug);
  }

  function onEscape(e) {
    if (e.key !== 'Escape' || !selectedSlug || mediaDialog.isOpen()) return;
    commit();
    selectedSlug = null;
    renderInspectorEmpty();
  }

  function modeButton(label, value) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-ghost live-mode-btn';
    b.textContent = label;
    b.setAttribute('aria-pressed', String(mode === value));
    b.addEventListener('click', () => setMode(value));
    return b;
  }

  function setMode(next) {
    if (mode === next) return;
    commit();
    mode = next;
    selectBtn.setAttribute('aria-pressed', String(mode === 'select'));
    inspectBtn.setAttribute('aria-pressed', String(mode === 'inspect'));
    if (iframe.contentWindow && isValidModeMessage({ channelId, mode })) {
      iframe.contentWindow.postMessage({ channel: CHANNEL, kind: 'mode', channelId, mode }, location.origin);
    }
    if (mode === 'inspect') { selectedSlug = null; renderInspectorEmpty(); }
    else renderInspectorEmpty();
  }

  function renderInspectorEmpty() {
    inspector.replaceChildren();
    titleInputEl = null;
    coverImgEl = null;
    coverReplaceEl = null;
    caseCoverImgEl = null;
    caseCoverReplaceEl = null;
    caseCoverUseFallbackEl = null;
    const hint = document.createElement('p');
    hint.className = 'live-inspector-hint';
    hint.textContent = mode === 'select'
      ? 'Выберите карточку проекта в предпросмотре слева — здесь появятся её настройки.'
      : 'Режим проверки: ссылки работают как на обычном сайте. Переключитесь на «Выбрать элемент», чтобы редактировать.';
    inspector.append(hint);
  }

  function renderInspectorFor(targetKey) {
    const project = findProject(targetKey);
    if (!project) { renderInspectorEmpty(); return; }

    inspector.replaceChildren();

    const head = document.createElement('div');
    head.className = 'live-inspector-head';
    const thumb = document.createElement('img');
    thumb.alt = '';
    thumb.src = assetUrl(project.cover);
    const heading = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'project-name';
    name.textContent = project.title || 'Без названия';
    const status = document.createElement('span');
    status.className = 'project-status';
    status.textContent = project.status === 'published' ? 'На сайте' : 'Черновик';
    heading.append(name, status);
    head.append(thumb, heading);

    /* Группировка по паузе/уходу фокуса и защита от IME — внутри
       field(), общие с любым полем старой формы. Эта функция только
       мутирует данные; когда именно это станет записью в истории —
       не её забота. */
    const titleField = field('Заголовок карточки', project.title, value => {
      /* targetKey, а не project: к моменту следующего keystroke
         текущий проект достаём заново, а не полагаемся на объект,
         захваченный в замыкании при открытии инспектора */
      const current = findProject(targetKey);
      if (current) current.title = value;
    }, { wide: true, debounceMs: 550 });
    titleInputEl = titleField.querySelector('input,textarea');

    const coverField = document.createElement('div');
    coverField.className = 'field field--wide live-cover-field';
    const coverLabel = document.createElement('span');
    coverLabel.className = 'field-label';
    coverLabel.textContent = 'Превью в подборке';
    const coverImg = document.createElement('img');
    coverImg.alt = '';
    coverImg.src = assetUrl(project.cover);
    coverImgEl = coverImg;
    const coverReplace = document.createElement('button');
    coverReplace.type = 'button';
    coverReplace.className = 'btn-ghost';
    coverReplace.textContent = 'Заменить';
    coverReplaceEl = coverReplace;
    coverReplace.addEventListener('click', () => {
      const current = findProject(targetKey);
      mediaDialog.open(
        { projectId: targetKey, slot: 'cover' },
        'Превью в подборке — ' + (current?.title || 'без названия'),
        { onSelectExisting, onUploadFile, restoreFocus: () => coverReplaceEl?.focus() },
      );
    });
    const coverHint = document.createElement('span');
    coverHint.className = 'field-hint';
    coverHint.textContent = 'Галерея не меняется. Обложка кейса — если для неё выбрана своя картинка; иначе кейс покажет это же превью.';
    coverField.append(coverLabel, coverImg, coverReplace, coverHint);

    const caseCoverField = document.createElement('div');
    caseCoverField.className = 'field field--wide live-cover-field';
    const caseCoverLabel = document.createElement('span');
    caseCoverLabel.className = 'field-label';
    caseCoverLabel.textContent = 'Обложка кейса';
    const caseCoverImg = document.createElement('img');
    caseCoverImg.alt = '';
    caseCoverImg.src = assetUrl(project.caseCover || project.cover);
    caseCoverImgEl = caseCoverImg;
    const caseCoverActions = document.createElement('div');
    caseCoverActions.className = 'live-cover-actions';
    const caseCoverReplace = document.createElement('button');
    caseCoverReplace.type = 'button';
    caseCoverReplace.className = 'btn-ghost';
    caseCoverReplace.textContent = 'Заменить';
    caseCoverReplaceEl = caseCoverReplace;
    caseCoverReplace.addEventListener('click', () => {
      const current = findProject(targetKey);
      mediaDialog.open(
        { projectId: targetKey, slot: 'caseCover' },
        'Обложка кейса — ' + (current?.title || 'без названия'),
        { onSelectExisting, onUploadFile, restoreFocus: () => caseCoverReplaceEl?.focus() },
      );
    });
    const caseCoverUseFallback = document.createElement('button');
    caseCoverUseFallback.type = 'button';
    caseCoverUseFallback.className = 'btn-ghost';
    caseCoverUseFallback.textContent = 'Использовать превью';
    caseCoverUseFallback.disabled = !project.caseCover;
    caseCoverUseFallbackEl = caseCoverUseFallback;
    caseCoverUseFallback.addEventListener('click', () => onUseCoverAsCase({ projectId: targetKey, slot: 'caseCover' }));
    caseCoverActions.append(caseCoverReplace, caseCoverUseFallback);
    const caseCoverHint = document.createElement('span');
    caseCoverHint.className = 'field-hint';
    caseCoverHint.textContent = 'Пока отдельная картинка не выбрана, кейс открывается тем же превью, что и подборка. Смена превью в этом случае меняет и обложку кейса.';
    caseCoverField.append(caseCoverLabel, caseCoverImg, caseCoverActions, caseCoverHint);

    inspector.append(head, titleField, coverField, caseCoverField);
  }

  return {
    /* Вызывается из render() каждый раз, когда data меняется откуда
       угодно — из этого же инспектора, из старой длинной формы или
       из Undo/Redo. Один источник истины, один путь синхронизации. */
    sync(nextData) {
      data = nextData;
      if (selectedSlug && !inspector.contains(document.activeElement)) renderInspectorFor(selectedSlug);
      pushSnapshot();
    },
    /* Лёгкий путь: только протолкнуть новый снимок, без перестройки
       инспектора. Для правок, где структура формы не меняется —
       обычное поле старой формы, select, или поле этого инспектора. */
    notify(nextData) {
      data = nextData;
      refreshInspectorValues();
      pushSnapshot();
    },
  };
}

