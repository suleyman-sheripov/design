/* Живой редактор: iframe настоящего сайта в режиме ?editor-preview=1
   плюс инспектор выбранной карточки проекта.

   Родитель этого модуля — admin.js. Никакого импорта в обратную
   сторону нет: всё, что нужно из admin.js (текущий data, история
   Undo, конструктор поля, сжатие картинки), приходит параметром в
   initLiveEditor(), а не через import. Так граф модулей остаётся
   деревом, а не циклом.

   Протокол сообщений и его проверки происхождения зеркалят
   app/src/lib/previewBridge.ts — это ДВА разных графа модулей
   (public/ не собирается Vite, app/src собирается), общий файл
   между ними завести нельзя без отдельного шага сборки, поэтому
   протокол продублирован. CHANNEL — единственная строка, которая
   обязана совпадать в обоих местах. */

const CHANNEL = 'portfolio-editor-bridge/1';
const PREVIEW_URL = '../?editor-preview=1';
/* Пауза, после которой пачка нажатий клавиш становится одной записью
   Undo. Раньше — как будто её никто не печатал; чаще — Undo снова
   откатывает по одной букве, ровно то, что нужно было не допустить. */
const COMMIT_DELAY_MS = 550;

export function initLiveEditor({ mount, model, field, shrink, uploads, assetUrl, touch, setDirty, render, buildPreviewPayload, setStatus }) {
  const channelId = crypto.randomUUID();
  let data = null;
  let selectedSlug = null;
  let mode = 'select';
  let revision = 0;
  let composing = false;
  let commitTimer = 0;
  let pendingCommit = false;

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

  renderInspectorEmpty();
  addEventListener('message', onMessage);
  addEventListener('keydown', onEscape);

  /* Первый кадр iframe стартует с тем же снимком черновика, что и
     кнопка «Предпросмотр» в новой вкладке — так на экране сразу
     черновик, а не опубликованная версия, и это не вторая копия
     логики, а тот же buildPreviewPayload(). Ошибку (например, ещё не
     готовый к публикации черновик) показываем тем же статусом, что и
     остальной редактор, и просто не грузим iframe в этом случае. */
  try {
    sessionStorage.setItem('portfolio-preview', JSON.stringify(buildPreviewPayload()));
    iframe.src = PREVIEW_URL;
  } catch (err) {
    setStatus(err.message, true);
  }

  function onMessage(e) {
    if (e.source !== iframe.contentWindow) return;
    if (e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.channel !== CHANNEL) return;
    if (msg.kind === 'ready') { sendInit(); return; }
    /* Все сообщения после ready обязаны нести наш channelId: иначе
       перезагрузившийся ранее iframe мог бы прислать что-то от
       предыдущего подключения */
    if (msg.channelId !== channelId) return;
    if (msg.kind === 'selection') onSelect(msg.target);
  }

  function sendInit() {
    if (!data) return;
    revision++;
    iframe.contentWindow.postMessage({ channel: CHANNEL, kind: 'init', channelId, revision, mode, document: data }, location.origin);
    /* init по протоколу не несёт картинки; если что-то уже загружено
       в этой сессии до перезагрузки iframe (например, после смены
       ширины окна), снимок следом сразу восполняет их */
    pushSnapshot();
  }

  function pushSnapshot() {
    if (!data || !iframe.contentWindow) return;
    revision++;
    iframe.contentWindow.postMessage({ channel: CHANNEL, kind: 'snapshot', channelId, revision, mode, document: data, assets: liveAssets() }, location.origin);
  }

  function liveAssets() {
    const used = new Set(model.imageNames(data));
    const out = {};
    for (const [name, image] of uploads) if (used.has(name) && image.blob) out[name] = image.blob;
    return Object.keys(out).length ? out : undefined;
  }

  function onSelect(target) {
    if (!target || target.type !== 'project') return;
    /* Смена выбора обязана сохранить незавершённую правку прежней
       карточки, а не потерять её молча */
    flush();
    selectedSlug = target.key;
    renderInspectorFor(selectedSlug);
  }

  function onEscape(e) {
    if (e.key !== 'Escape' || !selectedSlug) return;
    flush();
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
    flush();
    mode = next;
    selectBtn.setAttribute('aria-pressed', String(mode === 'select'));
    inspectBtn.setAttribute('aria-pressed', String(mode === 'inspect'));
    if (iframe.contentWindow) iframe.contentWindow.postMessage({ channel: CHANNEL, kind: 'mode', channelId, mode }, location.origin);
    if (mode === 'inspect') { selectedSlug = null; renderInspectorEmpty(); }
    else renderInspectorEmpty();
  }

  function renderInspectorEmpty() {
    inspector.replaceChildren();
    const hint = document.createElement('p');
    hint.className = 'live-inspector-hint';
    hint.textContent = mode === 'select'
      ? 'Выберите карточку проекта в предпросмотре слева — здесь появятся её настройки.'
      : 'Режим проверки: ссылки работают как на обычном сайте. Переключитесь на «Выбрать элемент», чтобы редактировать.';
    inspector.append(hint);
  }

  function renderInspectorFor(slug) {
    const project = data?.projects.projects.find(p => p.slug === slug);
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

    const titleField = field('Заголовок карточки', project.title, value => {
      project.title = value;
      pushLiveEdit();
    }, { wide: true, commit: 'manual' });
    const titleInput = titleField.querySelector('input,textarea');
    titleInput.addEventListener('blur', flush);
    titleInput.addEventListener('compositionstart', () => { composing = true; });
    titleInput.addEventListener('compositionend', () => { composing = false; scheduleCommit(); });

    const coverField = document.createElement('div');
    coverField.className = 'field field--wide live-cover-field';
    const coverLabel = document.createElement('span');
    coverLabel.className = 'field-label';
    coverLabel.textContent = 'Превью в подборке';
    const coverImg = document.createElement('img');
    coverImg.alt = '';
    coverImg.src = assetUrl(project.cover);
    const coverInput = document.createElement('input');
    coverInput.type = 'file';
    coverInput.accept = 'image/png,image/jpeg,image/webp';
    coverInput.setAttribute('aria-label', 'Заменить превью в подборке');
    coverInput.addEventListener('change', () => replaceCover(project, coverInput.files, coverImg));
    const coverHint = document.createElement('span');
    coverHint.className = 'field-hint';
    coverHint.textContent = 'Обложка кейса и галерея не меняются: у превью в подборке своя картинка.';
    coverField.append(coverLabel, coverImg, coverInput, coverHint);

    inspector.append(head, titleField, coverField);
  }

  async function replaceCover(project, files, imgEl) {
    const file = files?.[0];
    if (!file) return;
    try {
      const image = await shrink(file);
      const uploadName = project.slug + '-' + crypto.randomUUID();
      uploads.set(uploadName, image);
      project.cover = uploadName;
      imgEl.src = image.url;
      /* Замена файла — одно законченное действие, в отличие от
         печати: коммитим сразу, без паузы */
      touch();
      render();
    } catch (err) {
      setStatus(err.message, true);
    }
  }

  function pushLiveEdit() {
    if (!pendingCommit) setDirty(true);
    pendingCommit = true;
    pushSnapshot();
    if (composing) return;
    scheduleCommit();
  }

  function scheduleCommit() {
    clearTimeout(commitTimer);
    commitTimer = setTimeout(flush, COMMIT_DELAY_MS);
  }

  /* Фиксирует накопленную правку одной записью Undo. Вызывается по
     паузе в печати, по уходу фокуса, при смене выбора и перед любым
     действием тулбара (Сохранить/Отменить/Перечитать/Выйти) — иначе
     последняя буква могла бы потеряться или попасть в историю уже
     после того действия, к которому не относится. */
  function flush() {
    clearTimeout(commitTimer);
    if (!pendingCommit) return;
    pendingCommit = false;
    touch();
    render();
  }

  return {
    /* Вызывается из render() каждый раз, когда data меняется откуда
       угодно — из этого же инспектора, из старой длинной формы или
       из Undo. Один источник истины, один путь синхронизации. */
    sync(nextData) {
      data = nextData;
      if (selectedSlug && !inspector.contains(document.activeElement)) renderInspectorFor(selectedSlug);
      pushSnapshot();
    },
    flush,
  };
}
