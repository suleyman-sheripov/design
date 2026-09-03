/* Админка. Сайт статический и лежит на GitHub Pages, своего сервера
   нет, поэтому правки идут напрямую в репозиторий через GitHub API
   под личным токеном владельца.

   Токен живёт в localStorage этого браузера и уходит только на
   api.github.com. Промежуточного сервиса, через который он мог бы
   утечь, в схеме нет вообще — это и есть причина выбрать такой путь,
   а не «свою» авторизацию.

   Правится содержимое, не вёрстка: два JSON, которые читает сайт. */

const TOKEN_KEY = 'admin-token';
const REPO_KEY = 'admin-repo';

const FILES = {
  profile: 'data/profile.json',
  projects: 'data/projects.json',
};

/* Куда складывать загруженные снимки. Имя файла собирается из slug
   кейса, поэтому картинки не перемешиваются между проектами. */
const SHOTS_DIR = 'assets/work';
const SHOT_MAX = 1600;

const DEFAULTS = { owner: 'suleyman-sheripov', repo: 'design', branch: 'main' };

const el = id => document.getElementById(id);

const ui = {
  gate: el('gate'),
  gateForm: el('gateForm'),
  gateError: el('gateError'),
  editor: el('editor'),
  loadState: el('loadState'),
  saveState: el('saveState'),
  barActions: el('barActions'),
  barRepo: el('barRepo'),
  profileFields: el('profileFields'),
  trackRows: el('trackRows'),
  toolsRows: el('toolsRows'),
  projectRows: el('projectRows'),
};

let auth = null;
let data = null;      // { profile, projects }
let sha = {};         // sha загруженных файлов, нужен GitHub для записи
let saved = {};       // как файлы выглядели при загрузке
let dirty = false;

start();

function start() {
  const repo = readJson(REPO_KEY) || DEFAULTS;
  el('owner').value = repo.owner;
  el('repo').value = repo.repo;
  el('branch').value = repo.branch;

  ui.gateForm.addEventListener('submit', onSignIn);
  el('signOut').addEventListener('click', signOut);
  el('reload').addEventListener('click', () => {
    if (dirty && !confirm('Правки не сохранены. Перечитать файлы и потерять их?')) return;
    reload();
  });
  el('save').addEventListener('click', save);

  for (const btn of document.querySelectorAll('[data-add]')) {
    btn.addEventListener('click', () => add(btn.dataset.add));
  }

  addEventListener('beforeunload', e => {
    if (dirty) e.preventDefault();
  });

  const token = readRaw(TOKEN_KEY);
  if (token) {
    auth = { ...repo, token };
    enter();
  }
}

/* ── Вход ──────────────────────────────────────────────── */

async function onSignIn(e) {
  e.preventDefault();
  ui.gateError.textContent = '';

  auth = {
    owner: el('owner').value.trim(),
    repo: el('repo').value.trim(),
    branch: el('branch').value.trim() || 'main',
    token: el('token').value.trim(),
  };

  try {
    await load();
  } catch (err) {
    auth = null;
    ui.gateError.textContent = err.message;
    return;
  }

  writeRaw(TOKEN_KEY, auth.token);
  writeJson(REPO_KEY, { owner: auth.owner, repo: auth.repo, branch: auth.branch });
  el('token').value = '';
  show();
}

function enter() {
  show();
  reload();
}

function reload() {
  load().catch(err => say(ui.loadState, err.message, 'note note--bad'));
}

function show() {
  ui.gate.hidden = true;
  ui.editor.hidden = false;
  ui.barActions.hidden = false;
  ui.barRepo.hidden = false;
  ui.barRepo.textContent = auth.owner + '/' + auth.repo + ' · ' + auth.branch;
}

function signOut() {
  if (dirty && !confirm('Есть несохранённые правки. Всё равно выйти?')) return;
  drop(TOKEN_KEY);
  location.reload();
}

/* ── Чтение и запись ───────────────────────────────────── */

async function load() {
  say(ui.loadState, 'Читаю файлы из репозитория…', 'note');

  const [profile, projects] = await Promise.all([
    getFile(FILES.profile),
    getFile(FILES.projects),
  ]);

  sha = { profile: profile.sha, projects: projects.sha };
  data = { profile: profile.json, projects: projects.json };
  saved = { profile: serialize(data.profile), projects: serialize(data.projects) };

  render();
  setDirty(false);
  say(ui.loadState, '', 'note');
}

async function save() {
  if (!data) return;

  const jobs = [];
  for (const key of ['profile', 'projects']) {
    const body = serialize(data[key]);
    if (body !== saved[key]) jobs.push([key, body]);
  }

  if (!jobs.length) {
    say(ui.saveState, 'Менять нечего', 'bar-state');
    return;
  }

  say(ui.saveState, 'Сохраняю…', 'bar-state');

  try {
    for (const [key, body] of jobs) {
      const res = await putFile(FILES[key], body, sha[key], 'Правка ' + FILES[key] + ' из админки');
      sha[key] = res.content.sha;
      saved[key] = body;
    }
    setDirty(false);
    say(ui.saveState, 'Сохранено. Сайт обновится, когда GitHub Pages пересоберёт страницу, обычно за минуту.', 'bar-state');
  } catch (err) {
    say(ui.saveState, err.message, 'bar-state bar-state--bad');
  }
}

async function getFile(path) {
  const res = await api('/contents/' + path + '?ref=' + encodeURIComponent(auth.branch));
  return { sha: res.sha, json: JSON.parse(fromBase64(res.content)) };
}

function putFile(path, text, prevSha, message) {
  return api('/contents/' + path, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: toBase64(text),
      branch: auth.branch,
      ...(prevSha ? { sha: prevSha } : {}),
    }),
  });
}

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch('https://api.github.com/repos/' + auth.owner + '/' + auth.repo + path, {
      ...options,
      headers: {
        Authorization: 'Bearer ' + auth.token,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Не достучался до GitHub. Проверь связь и попробуй ещё раз.');
  }

  if (!res.ok) throw new Error(explain(res.status));
  return res.json();
}

/* Коды GitHub переведены в то, что с ними делать: голое «403»
   пользователю админки ничего не говорит. */
function explain(status) {
  if (status === 401) return 'Токен не принят. Проверь, что он не истёк и скопирован целиком.';
  if (status === 403) return 'Доступ закрыт: у токена нет права Contents: Read and write на этот репозиторий.';
  if (status === 404) return 'Не нашёл файл или репозиторий. Проверь владельца, название и ветку.';
  if (status === 409 || status === 422) return 'Файл успели изменить в другом месте. Нажми «Перечитать» и внеси правки заново.';
  if (status >= 500) return 'GitHub отвечает ошибкой. Подожди минуту и сохрани ещё раз.';
  return 'GitHub ответил ошибкой ' + status + '.';
}

/* ── Отрисовка ─────────────────────────────────────────── */

const PROFILE_FIELDS = [
  ['name', 'Имя'],
  ['role', 'Кем работаешь'],
  ['focus', 'Специализация'],
  ['city', 'Город'],
  ['email', 'Почта'],
  ['phone', 'Телефон'],
  ['links.behance', 'Behance'],
  ['links.dribbble', 'Dribbble'],
];

function render() {
  ui.profileFields.replaceChildren(
    ...PROFILE_FIELDS.map(([path, label]) =>
      field(label, pick(data.profile, path), value => put(data.profile, path, value))),
  );

  renderList(ui.trackRows, el('trackEmpty'), data.profile.track ||= [], trackRow);
  renderList(ui.toolsRows, el('toolsEmpty'), data.profile.tools ||= [], toolRow);
  renderList(ui.projectRows, el('projectsEmpty'), data.projects.projects ||= [], projectRow);
}

function renderList(host, empty, list, build) {
  empty.hidden = list.length > 0;
  host.replaceChildren(...list.map((item, i) => build(item, i, list)));
}

function trackRow(item, i, list) {
  return row(item.client || 'Без названия', i, list, [
    field('Клиент', item.client, v => (item.client = v)),
    field('Роль', item.role, v => (item.role = v)),
    field('Тип', item.kind, v => (item.kind = v), { hint: 'Слово «Учебный проект» даёт строке меньший кегль на сайте' }),
    field('Срок', item.period, v => (item.period = v)),
    field('Что делал', item.note, v => (item.note = v), { tag: 'textarea', wide: true }),
  ]);
}

function toolRow(item, i, list) {
  return row(item.name || 'Инструмент', i, list, [
    field('Название', item.name, v => (item.name = v)),
    field('Для чего', item.for, v => (item.for = v)),
    field('Файл значка', item.logo, v => (item.logo = v), { hint: 'Путь от корня сайта, например assets/tools/figma.png' }),
  ]);
}

function projectRow(item, i, list) {
  const shots = (item.shots ||= []);

  const cover = select('Обложка', shots.map(s => s.file), item.cover, v => (item.cover = v));
  const ratio = select('Пропорция', ['wide', 'tall'], item.ratio || 'wide', v => (item.ratio = v),
    { labels: { wide: 'Горизонтальная', tall: 'Вертикальная' } });

  const gallery = document.createElement('div');
  gallery.className = 'shots';
  drawShots();

  return row(item.title || 'Кейс', i, list, [
    field('Название', item.title, v => (item.title = v)),
    field('Ключ', item.slug, v => (item.slug = v), { hint: 'Латиницей: из него собираются имена файлов' }),
    field('Что это', item.kind, v => (item.kind = v)),
    field('Роль', item.role, v => (item.role = v)),
    field('Год', item.year, v => (item.year = v)),
    ratio,
    cover,
    field('Описание', item.note, v => (item.note = v), {
      tag: 'textarea',
      wide: true,
      hint: 'Пустое описание на сайте просто не показывается. Лучше пусто, чем вода.',
    }),
    gallery,
  ]);

  function drawShots() {
    const add = document.createElement('label');
    add.className = 'shot-add';
    add.innerHTML = '<span>Добавить снимок</span>';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.addEventListener('change', () => upload(input.files));
    add.append(input);

    gallery.replaceChildren(
      ...shots.map((shot, k) => shotCard(shot, k)),
      add,
    );
  }

  function shotCard(shot, k) {
    const card = document.createElement('div');
    card.className = 'shot';

    const img = document.createElement('img');
    img.src = '../' + SHOTS_DIR + '/' + shot.file + '.webp';
    img.alt = '';
    img.loading = 'lazy';

    const alt = field('Что на снимке', shot.alt, v => (shot.alt = v), { compact: true });

    const kill = document.createElement('button');
    kill.type = 'button';
    kill.className = 'btn-ghost btn-ghost--danger';
    kill.textContent = 'Убрать';
    kill.addEventListener('click', () => {
      shots.splice(k, 1);
      if (item.cover === shot.file) item.cover = shots[0]?.file || '';
      touch();
      render();
    });

    card.append(img, alt, kill);
    return card;
  }

  async function upload(files) {
    if (!files?.length) return;
    say(ui.saveState, 'Готовлю снимки…', 'bar-state');

    try {
      for (const file of files) {
        const webp = await shrink(file);
        const name = (item.slug || 'case') + '-' + Date.now().toString(36);
        await putBinary(SHOTS_DIR + '/' + name + '.webp', webp);
        shots.push({ file: name, alt: '' });
        if (!item.cover) item.cover = name;
      }
      touch();
      render();
      say(ui.saveState, 'Снимки загружены. Подписи к ним пустые: заполни и сохрани.', 'bar-state');
    } catch (err) {
      say(ui.saveState, err.message, 'bar-state bar-state--bad');
    }
  }
}

/* ── Кирпичи разметки ──────────────────────────────────── */

function row(title, i, list, parts) {
  const box = document.createElement('fieldset');
  box.className = 'row';

  const legend = document.createElement('legend');
  legend.className = 'row-head';
  legend.append(text('row-idx', String(i + 1).padStart(2, '0')), text('row-title', title));
  box.append(legend);

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...parts);
  box.append(grid);

  const tools = document.createElement('div');
  tools.className = 'row-tools';
  tools.append(
    move('Выше', -1, i, list),
    move('Ниже', 1, i, list),
    remove(i, list, title),
  );
  box.append(tools);

  return box;
}

function move(label, step, i, list) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-ghost';
  btn.textContent = label;
  btn.disabled = i + step < 0 || i + step >= list.length;
  btn.addEventListener('click', () => {
    const [item] = list.splice(i, 1);
    list.splice(i + step, 0, item);
    touch();
    render();
  });
  return btn;
}

function remove(i, list, title) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-ghost btn-ghost--danger';
  btn.textContent = 'Удалить';
  btn.addEventListener('click', () => {
    if (!confirm('Удалить «' + title + '»? Отменить это можно будет только через историю репозитория.')) return;
    list.splice(i, 1);
    touch();
    render();
  });
  return btn;
}

function field(label, value, onInput, opts = {}) {
  const wrap = document.createElement('label');
  wrap.className = 'field' + (opts.wide ? ' field--wide' : '') + (opts.compact ? ' field--compact' : '');

  const input = document.createElement(opts.tag === 'textarea' ? 'textarea' : 'input');
  if (opts.tag === 'textarea') input.rows = 3;
  input.value = value ?? '';
  input.spellcheck = opts.tag === 'textarea';
  input.addEventListener('input', () => { onInput(input.value); touch(); });

  wrap.append(text('field-label', label), input);
  if (opts.hint) wrap.append(text('field-hint', opts.hint));
  return wrap;
}

function select(label, values, current, onChange, opts = {}) {
  const wrap = document.createElement('label');
  wrap.className = 'field';

  const box = document.createElement('select');
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = opts.labels?.[value] || value;
    option.selected = value === current;
    box.append(option);
  }

  /* Пустой список — не ошибка: у нового кейса ещё нет снимков */
  if (!values.length) {
    box.disabled = true;
    const option = document.createElement('option');
    option.textContent = 'снимков пока нет';
    box.append(option);
  }

  box.addEventListener('change', () => { onChange(box.value); touch(); });
  wrap.append(text('field-label', label), box);
  return wrap;
}

function text(className, value) {
  const node = document.createElement('span');
  node.className = className;
  node.textContent = value;
  return node;
}

/* ── Добавление ────────────────────────────────────────── */

function add(kind) {
  if (!data) return;

  if (kind === 'track') {
    (data.profile.track ||= []).unshift({ client: '', role: '', kind: '', period: '', note: '' });
  } else if (kind === 'tools') {
    (data.profile.tools ||= []).push({ name: '', for: '', logo: '' });
  } else if (kind === 'projects') {
    (data.projects.projects ||= []).unshift({
      slug: '', title: '', kind: '', role: '', year: '', note: '',
      cover: '', ratio: 'wide', shots: [],
    });
  }

  touch();
  render();
}

/* ── Состояние ─────────────────────────────────────────── */

function touch() { setDirty(true); }

function setDirty(value) {
  dirty = value;
  el('save').disabled = !value;
  if (value) say(ui.saveState, 'Есть несохранённые правки', 'bar-state bar-state--warn');
  /* Гасим только собственное предупреждение: сообщение об удачном
     сохранении или об ошибке должно остаться на экране */
  else if (ui.saveState.classList.contains('bar-state--warn')) say(ui.saveState, '', 'bar-state');
}

function say(node, message, className) {
  node.textContent = message;
  node.className = className;
  node.hidden = !message;
}

/* ── Картинки ──────────────────────────────────────────── */

/* Уменьшаем в браузере до загрузки: исходники из Figma весят
   мегабайты, и в репозитории им делать нечего. */
async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SHOT_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error('Не смог пережать картинку. Попробуй другой файл.');
  return new Uint8Array(await blob.arrayBuffer());
}

async function putBinary(path, bytes) {
  /* Файл может уже лежать под этим именем: без sha GitHub откажет */
  let prev = null;
  try {
    prev = await api('/contents/' + path + '?ref=' + encodeURIComponent(auth.branch));
  } catch { /* нет файла — значит создаём новый */ }

  return api('/contents/' + path, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Снимок ' + path + ' из админки',
      content: bytesToBase64(bytes),
      branch: auth.branch,
      ...(prev?.sha ? { sha: prev.sha } : {}),
    }),
  });
}

/* ── Мелочи ────────────────────────────────────────────── */

function serialize(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

function pick(object, path) {
  return path.split('.').reduce((node, key) => node?.[key], object);
}

function put(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const node = keys.reduce((acc, key) => (acc[key] ||= {}), object);
  node[last] = value;
}

function toBase64(string) {
  return bytesToBase64(new TextEncoder().encode(string));
}

function fromBase64(base64) {
  const clean = base64.replace(/\s/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/* По кускам, а не одним spread: на картинке в мегабайт
   String.fromCharCode(...bytes) кладёт стек аргументов */
function bytesToBase64(bytes) {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/* Приватный режим роняет localStorage прямо на чтении */
function readRaw(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeRaw(key, value) {
  try { localStorage.setItem(key, value); } catch { /* не критично */ }
}

function drop(key) {
  try { localStorage.removeItem(key); } catch { /* не критично */ }
}

function readJson(key) {
  const raw = readRaw(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeJson(key, value) {
  writeRaw(key, JSON.stringify(value));
}
