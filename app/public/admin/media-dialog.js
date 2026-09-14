/* UI общего медиадиалога: миниатюры уже известных файлов (медиатека)
   плюс загрузка нового. Ни о документе, ни о истории не знает —
   только вызывает onSelectExisting/onUploadFile, которые передаёт
   editor-live.js (там же обёрнуты команды из media-commands.js).

   session — отдельное поколение поверх documentEpoch: закрытие
   диалога (кнопкой, Escape, повторным open()) ДО того, как сжатие
   картинки завершилось, обязано аннулировать именно ЭТУ попытку
   загрузки, даже если документ и выбранный проект за это время не
   изменились вовсе — session как раз ловит этот случай, который
   documentEpoch не ловит. */
export function createMediaDialog({ mount, mediaLibrary, assetUrl }) {
  let session = 0;
  let currentTarget = null;
  let onSelectExisting = null;
  let onUploadFile = null;
  let busy = false;
  let restoreFocus = null;

  const dialogEl = document.createElement('dialog');
  dialogEl.className = 'media-dialog';

  const head = document.createElement('div');
  head.className = 'media-dialog-head';
  const heading = document.createElement('h3');
  heading.id = 'media-title-' + crypto.randomUUID();
  dialogEl.setAttribute('aria-labelledby', heading.id);
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-ghost';
  closeBtn.textContent = 'Отмена';
  closeBtn.addEventListener('click', abandon);
  head.append(heading, closeBtn);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'media-search';
  search.placeholder = 'Найти по имени файла';
  search.setAttribute('aria-label', 'Найти изображение по имени файла');
  search.addEventListener('input', renderGrid);

  const grid = document.createElement('div');
  grid.className = 'media-grid';

  const status = document.createElement('p');
  status.className = 'media-status';
  status.setAttribute('aria-live', 'polite');

  const dropZone = document.createElement('label');
  dropZone.className = 'media-drop';
  const dropText = document.createElement('span');
  dropText.textContent = 'Загрузить новое изображение или перетащить файл сюда';
  const dropInput = document.createElement('input');
  dropInput.type = 'file';
  dropInput.accept = 'image/png,image/jpeg,image/webp';
  dropInput.setAttribute('aria-label', 'Загрузить новое изображение');
  dropZone.append(dropText, dropInput);
  /* return startUpload(file), а не «выстрелил и забыл»: реальному
     событию change это безразлично (возврат обработчика никого не
     интересует), а вызывающему из теста dispatchEvent-эквиваленту
     это даёт возможность честно дождаться всей цепочки, а не гадать
     по числу микротасков. */
  dropInput.addEventListener('change', () => {
    const file = dropInput.files?.[0];
    dropInput.value = '';
    if (file) return startUpload(file);
  });
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('is-dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    if (busy) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) return startUpload(file);
  });

  dialogEl.append(head, search, grid, status, dropZone);
  mount.append(dialogEl);

  /* Escape закрывает нативный <dialog> через событие cancel — до
     close. Ровно момент, когда пользователь осознанно отказался от
     диалога, а не просто он закрылся сам по себе после выбора. */
  dialogEl.addEventListener('cancel', e => { e.preventDefault(); abandon(); });
  dialogEl.addEventListener('keydown', e => { if (e.key === 'Escape') e.stopPropagation(); });

  function abandon() {
    session++;
    dialogEl.close();
    restoreFocus?.();
  }

  /* Кнопки миниатюр держим в своём массиве, а не через querySelectorAll:
     их и так уже создаём сами в renderGrid(), а querySelectorAll — лишняя
     DOM-зависимость там, где хватает обычных ссылок на уже созданные
     элементы. */
  let gridButtons = [];

  function setBusy(value) {
    busy = value;
    dropInput.disabled = value;
    search.disabled = value;
    for (const btn of gridButtons) btn.disabled = value;
  }

  function renderGrid() {
    const query = search.value.trim().toLowerCase();
    const names = mediaLibrary().filter(name => !query || name.toLowerCase().includes(query));
    grid.replaceChildren();
    gridButtons = [];
    if (!names.length) {
      const empty = document.createElement('p');
      empty.className = 'media-empty';
      empty.textContent = query ? 'Ничего не найдено.' : 'Пока нет загруженных изображений — начни с загрузки ниже.';
      grid.append(empty);
      return;
    }
    gridButtons = names.map(name => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-item';
      btn.setAttribute('aria-label', 'Выбрать ' + name);
      const img = document.createElement('img');
      img.src = assetUrl(name);
      img.alt = '';
      img.loading = 'lazy';
      btn.append(img);
      btn.addEventListener('click', () => {
        session++; // выбор сделан — любая незавершённая загрузка из этой сессии больше не актуальна
        try {
          const result = onSelectExisting(currentTarget, name);
          if (result.status === 'applied' || result.status === 'unchanged') abandon();
          else showError(result.message || 'Изображение не выбрано. Открой окно заново.');
        } catch (error) { showError(error?.message || 'Не удалось обновить предпросмотр.'); }
      });
      return btn;
    });
    grid.append(...gridButtons);
  }

  function showError(message) {
    status.textContent = message;
    status.classList.add('media-status--error');
  }

  async function startUpload(file) {
    const sessionAtStart = session;
    setBusy(true);
    status.textContent = 'Готовлю изображение…';
    status.classList.remove('media-status--error');
    try {
      const result = await onUploadFile(currentTarget, file, { isCancelled: () => session !== sessionAtStart });
      if (session !== sessionAtStart) return;
      if (result.status === 'applied') abandon();
      else if (result.status === 'error') showError(result.message);
      else status.textContent = '';
    } catch (error) {
      if (session === sessionAtStart) showError(error?.message || 'Не удалось обновить предпросмотр.');
    } finally {
      if (session === sessionAtStart) setBusy(false);
    }
  }

  return {
    /* label — что именно меняем, чтобы пользователь видел цель:
       например, «Превью в подборке — Beauty Lab» */
    isOpen: () => dialogEl.open,
    open(target, label, handlers) {
      restoreFocus = handlers.restoreFocus;
      currentTarget = target;
      onSelectExisting = handlers.onSelectExisting;
      onUploadFile = handlers.onUploadFile;
      session++;
      setBusy(false);
      status.textContent = '';
      status.classList.remove('media-status--error');
      heading.textContent = label;
      search.value = '';
      renderGrid();
      dialogEl.showModal();
    },
  };
}

