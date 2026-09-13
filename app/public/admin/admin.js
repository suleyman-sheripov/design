import { GitHub } from './github.js';
import { SHOTS_DIR, safeName, validateContent, imageNames } from './model.js';

import { DEFAULT_SETTINGS, SETTING_LABELS } from './settings.js';
/* Доступ к записи определяет GitHub. Токен существует только в памяти. */
const TOKEN_KEY = 'portfolio-github-token';
const el = id => document.getElementById(id);
const ui = Object.fromEntries(['gate','gateForm','gateError','editor','loadState','saveState','barActions','barRepo','profileFields','trackRows','toolsRows','projectRows'].map(id => [id, el(id)]));
let github, head, data, saved, knownFiles;
let dirty = false, busy = false, local = false, config;
let lastState='', history=[], defaultServices=[];
const uploads = new Map();
const expandedProjects = new Set(['donerio']);

start();
async function start() {
  el('save').addEventListener('click', save);
  try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('admin-token'); } catch { /* Legacy token cleanup. */ }
  el('preview').addEventListener('click', () => {
    try { validateContent(data); sessionStorage.setItem('portfolio-preview',JSON.stringify({data,images:Object.fromEntries([...uploads].map(([n,v])=>[n,v.url])),mediaBase:local?'':github.raw(SHOTS_DIR+'/')})); window.open('../?editor-preview=1','_blank'); }
    catch(err) {say(ui.saveState,err.message,'bar-state bar-state--bad')}
  });
  el('undo').addEventListener('click',()=>{if(!history.length)return;data=JSON.parse(history.pop());lastState=serialize(data);render();setDirty(lastState!==saved);el('undo').disabled=!history.length;});
  el('importDraft').addEventListener('change',async e=>{
    const file=e.target.files[0];if(!file || busy)return;
    try {if(file.size>2*1024*1024)throw Error('JSON больше 2 МБ.');const next=validateContent(JSON.parse(await file.text()));if(!confirm('Заменить текущий черновик содержимым файла?'))return;data=next;touch();render();}
    catch(err){say(ui.saveState,err.message,'bar-state bar-state--bad')} finally {e.target.value=''}
  });
  if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
    el('localDraft').hidden=false;
    el('localDraft').addEventListener('click',async()=>{setBusy(true);try {local=true;await load();ui.gate.hidden=true;ui.editor.hidden=false;ui.barActions.hidden=false;ui.barRepo.hidden=false;ui.barRepo.textContent='Локальный черновик · без публикации';el('save').textContent='Скачать JSON';el('historyLink').hidden=true;}catch(err){ui.gateError.textContent=err.message;local=false}finally{setBusy(false)}});
  }
  el('signOut').addEventListener('click', () => {
    if (dirty && !confirm('Выйти и потерять несохранённые правки?')) return;
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem('admin-token'); } catch { /* Хранилище может быть закрыто. */ }
    clearUploads(); github = null; data = null;
    location.reload();
  });
  el('reload').addEventListener('click', async () => {
    if (dirty && !confirm('Перечитать и потерять несохранённые правки? Сначала можно скачать копию.')) return;
    setBusy(true);
    try { await load(); } catch (err) { say(ui.saveState, err.message, 'bar-state bar-state--bad'); }
    finally { setBusy(false); }
  });
  el('backup').addEventListener('click', exportBackup);
  for (const btn of document.querySelectorAll('[data-add]')) btn.addEventListener('click', () => add(btn.dataset.add));
  addEventListener('beforeunload', e => { if (dirty || busy) { e.preventDefault(); e.returnValue = ''; } });
  try {
    const response = await fetch('../site-config.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Не удалось прочитать настройки сайта.');
    config = await response.json();
    const bundled=await fetch('../content/data/site.json');
    if(bundled.ok) defaultServices=(await bundled.json()).services || [];
    for (const key of ['owner','repo','branch']) {el(key).value = config.content[key];el(key).readOnly=true;}
    el('createToken').href='https://github.com/settings/personal-access-tokens/new?name=Portfolio&target_name='+encodeURIComponent(config.content.owner)+'&contents=write';
    el('historyLink').href='https://github.com/'+config.content.owner+'/'+config.content.repo+'/commits/'+encodeURIComponent(config.content.branch)+'/content';

  } catch (err) { ui.gateError.textContent = err.message; }
  ui.gateForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    ui.gateError.textContent = '';
    setBusy(true);
    try {
      if(!config?.content)throw Error('Настройки сайта ещё не загружены.');
      const auth = {...config.content,token:el('token').value.trim()};
      local=false;
      github = new GitHub(auth);
      await github.authorize();
      await load();
      el('token').value = '';
      ui.gate.hidden = true; ui.editor.hidden = false; ui.barActions.hidden = false; ui.barRepo.hidden = false;
      ui.barRepo.textContent = auth.owner + '/' + auth.repo + ' · ' + auth.branch;
    } catch (err) { github = null; ui.gateError.textContent = err.message; }
    finally { setBusy(false); }
  });
}
async function load() {
  const loaded = local ? await (async()=>{const r=await fetch('../content/data/site.json',{cache:'no-store'});if(!r.ok)throw Error('Локальные данные недоступны.');const data=validateContent(await r.json());return {data,head:'local',files:new Set(imageNames(data).map(n=>SHOTS_DIR+'/'+n+'.webp'))}})() : await github.load();
  head = loaded.head; data = loaded.data; knownFiles = loaded.files;
  data.services ||= structuredClone(defaultServices);
  saved = serialize(data); lastState=saved; history=[];el('undo').disabled=true; clearUploads(); render(); setDirty(false);
  say(ui.loadState, '', 'note');
}
async function save() {
  if (!data || busy) return;
  setBusy(true);
  say(ui.saveState, 'Сохраняю содержимое и снимки…', 'bar-state');
  try {
    validateContent(data);
    for (const name of imageNames(data)) {
      if (!uploads.has(name) && !knownFiles.has(`${SHOTS_DIR}/${name}.webp`)) throw new Error('Не найден снимок ' + name + '. Загрузите его или выберите другой.');
    }
    if(local) {exportBackup();say(ui.saveState,'Копия скачана. Это локальный черновик; сайт и GitHub не изменены.','bar-state');return;}
    const next = serialize(data);
    if (next === saved && !uploads.size) { setDirty(false); return; }
    head = await github.save(data, uploads, head);
    for (const name of uploads.keys()) knownFiles.add(`${SHOTS_DIR}/${name}.webp`);
    saved = next; lastState=next; history=[];el('undo').disabled=true; clearUploads(); setDirty(false); render();
    say(ui.saveState, 'Сохранено одним коммитом. Обнови сайт через несколько минут: GitHub кеширует файлы. Сборка не требуется.', 'bar-state');
  } catch (err) { say(ui.saveState, err.message, 'bar-state bar-state--bad'); }
  finally { setBusy(false); }
}
function setBusy(value) {
  busy = value;
  ui.editor.inert = value;
  ui.gateForm.inert = value;
  for (const id of ['save','reload','signOut','backup']) el(id).disabled = value || (id === 'save' && !dirty);
  el('preview').disabled=value;
  el('undo').disabled=value || !history.length;
  el('localDraft').disabled=value;
}
function exportBackup() {
  download('site-unsaved.json', new Blob([serialize(data)], {type:'application/json'}));
  for (const [name,value] of uploads) download(name+'.webp',new Blob([value.bytes],{type:'image/webp'}));
}
function clearUploads() { for (const value of uploads.values()) URL.revokeObjectURL(value.url); uploads.clear(); }
function download(name, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const PROFILE_FIELDS = [
  ['name', 'Имя'],
  ['role', 'Кем работаешь'],
  ['city', 'Город'],
  ['email', 'Почта'],
  ['phone', 'Телефон'],
  ['links.behance', 'Behance'],
  ['links.dribbble', 'Dribbble'],
];

function render() {
  const settings = data.settings ||= {};
  el('settingsFields').replaceChildren(...Object.entries(DEFAULT_SETTINGS).map(([key,fallback])=>{
    const value=settings[key] ?? fallback, label=SETTING_LABELS[key];
    if(typeof fallback==='boolean')return select(label,['yes','no'],value?'yes':'no',v=>settings[key]=v==='yes',{labels:{yes:'Да',no:'Нет'}});
    if(key==='previewStyle')return select(label,['plain','edge','paper'],value,v=>settings[key]=v,{labels:{plain:'Отдельное изображение',edge:'Изображение во всю карточку',paper:'Лист с лёгкой тенью'}});
    return field(label,value,v=>settings[key]=typeof fallback==='number'?Number(v):v,{type:typeof fallback==='number'?'number':['paper','surface','ink','accent','dot'].includes(key)?'color':'text',wide:['contactNote','servicesIntro','resume'].includes(key)});
  }));
  renderList(el('serviceRows'),el('servicesEmpty'),data.services ||= structuredClone(defaultServices),(s,i,list)=>row(s.title||'Услуга',i,list,[field('Название',s.title,v=>s.title=v),field('Ключ',s.id,v=>s.id=v,{hint:'Латиница и дефис, уникальный адрес тега'}),select('Группа',['brand','digital','visual'],s.group,v=>s.group=v,{labels:{brand:'Бренд и носители',digital:'Цифровые продукты',visual:'Визуальный контент'}}),select('Тег в Hero',['yes','no'],s.hero?'yes':'no',v=>s.hero=v==='yes',{labels:{yes:'Показывать',no:'Скрыть'}}),field('Описание',s.detail,v=>s.detail=v,{tag:'textarea',wide:true})]));
  ui.profileFields.replaceChildren(
    ...PROFILE_FIELDS.map(([path, label]) =>
      field(label, pick(data.profile, path), value => put(data.profile, path, value))),
  );

  renderList(ui.trackRows, el('trackEmpty'), data.profile.track ||= [], trackRow);
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
    field('Тип', item.kind, v => (item.kind = v), { hint: 'Учебный проект, фриланс или курсы — указывай фактический тип опыта' }),
    field('Срок', item.period, v => (item.period = v)),
    field('Что делал', item.note, v => (item.note = v), { tag: 'textarea', wide: true }),
  ]);
}

function projectRow(item, i, list) {
  const shots = (item.shots ||= []);

  const cover = assetField('Превью в подборке', 'cover');
  const caseCover = assetField('Первое изображение внутри кейса', 'caseCover');
  const ratio = select('Пропорция', ['wide', 'tall'], item.ratio || 'wide', v => (item.ratio = v),
    { labels: { wide: 'Горизонтальная', tall: 'Вертикальная' } });

  const gallery = document.createElement('div');
  gallery.className = 'shots';
  drawShots();

  const entry = row(item.title || 'Кейс', i, list, [
    field('Название', item.title, v => (item.title = v)),
    field('Ключ', item.slug, v => (item.slug = v), { hint: 'Латиницей: из него собираются имена файлов' }),
    field('Что это', item.kind, v => (item.kind = v)),
    field('Роль', item.role, v => (item.role = v)),
    field('Год', item.year, v => (item.year = v)),
    ratio,
    select('Публикация', ['draft', 'published'], item.status, v => (item.status = v), {labels:{draft:'Черновик — скрыт на сайте',published:'Опубликован'}}),
    select('Тип работы', ['commercial','teaching','study','personal'], item.category, v => (item.category = v), {labels:{commercial:'Коммерческая',teaching:'Преподавание',study:'Учебная',personal:'Без отметки'}}),
    cover, caseCover,
    select('Оформление',['','plain','edge','paper'],item.previewStyle||'',v=>item.previewStyle=v,{labels:{'':'Как на всём сайте',plain:'Отдельное изображение',edge:'Во всю карточку',paper:'Лист с тенью'}}),
    select('Размещение картинки',['contain','cover'],item.previewFit||'contain',v=>item.previewFit=v,{labels:{contain:'Целиком',cover:'Заполнить с обрезкой'}}),
    select('Фокус при обрезке',['center','top','bottom','left','right'],item.previewPosition||'center',v=>item.previewPosition=v,{labels:{center:'Центр',top:'Верх',bottom:'Низ',left:'Слева',right:'Справа'}}),
    field('Фон карточки',item.background||'',v=>item.background=v,{hint:'#RRGGBB; пусто — авторский цвет'}),
    field('Текст карточки',item.foreground||'',v=>item.foreground=v,{hint:'#RRGGBB; пусто — авторский цвет'}),
    field('Коротко о проекте', item.note, v => (item.note = v), {
      tag: 'textarea',
      wide: true,
      hint: 'Краткое вступление рядом с ролью, форматом и годом.',
    }),
    ...[['task', 'Задача'], ['solution', 'Решение'], ['details', 'Детали проекта']].map(([key, label]) =>
      field(label, item.story?.[key] || '', v => ((item.story ||= {})[key] = v), {
        tag: 'textarea', wide: true,
        hint: 'Абзацы разделяйте пустой строкой. Пока поле пустое, в кейсе виден текст для примера; после заполнения он заменится вашим.',
      })),
    gallery,
  ]);
  const fold = document.createElement('details');
  fold.className = 'project-fold';
  fold.open = expandedProjects.has(item.slug) || !item.slug;
  const summary = document.createElement('summary');
  summary.append(text('project-name', item.title || 'Новый кейс'), text('project-status', item.status === 'published' ? 'На сайте' : 'Черновик'));
  fold.addEventListener('toggle', () => fold.open ? expandedProjects.add(item.slug) : expandedProjects.delete(item.slug));
  entry.append(button('Дублировать как черновик',()=>{const clone=structuredClone(item);clone.slug=item.slug+'-copy-'+crypto.randomUUID().slice(0,6);clone.title+=' — копия';clone.status='draft';list.splice(i+1,0,clone);expandedProjects.add(clone.slug);touch();render()}));
  fold.append(summary, entry);
  return fold;

  function assetField(label,key) {
    const box=document.createElement('div');box.className='field field--wide cover-editor';
    const image=document.createElement('img');image.alt='';image.src=assetUrl(item[key] || item.cover);
    const choices=[...new Set([item.cover,item.caseCover,...shots.map(s=>s.file)].filter(Boolean))];
    box.append(text('field-label',label),image,select('Выбрать изображение',['',...choices],item[key]||'',v=>{item[key]=v;image.src=assetUrl(v||item.cover)},{labels:{'':key==='caseCover'?'Использовать превью':'Выбрать'}}));
    const input=document.createElement('input');input.type='file';input.accept='image/png,image/jpeg,image/webp';input.setAttribute('aria-label','Загрузить: '+label);input.addEventListener('change',()=>upload(input.files,key));box.append(input);
    return box;
  }
  function drawShots() {
    const add = document.createElement('label');
    add.className = 'shot-add';
    add.innerHTML = '<span>Добавить снимок</span>';

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
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
    img.src = assetUrl(shot.file);
    img.alt = '';
    img.loading = 'lazy';

    const alt = field('Что на снимке', shot.alt, v => (shot.alt = v), { compact: true });

    const kill = document.createElement('button');
    kill.type = 'button';
    kill.className = 'btn-ghost btn-ghost--danger';
    kill.textContent = 'Убрать';
    kill.addEventListener('click', () => {
      shots.splice(k, 1);
      // Независимые обложки сохраняются при удалении снимка из галереи.
      touch();
      render();
    });

    const replacement=document.createElement('input');replacement.type='file';replacement.accept='image/png,image/jpeg,image/webp';replacement.setAttribute('aria-label','Заменить снимок '+(k+1));replacement.addEventListener('change',()=>upload(replacement.files,'shot',k));
    card.append(img, alt, move('Раньше',-1,k,shots),move('Позже',1,k,shots),replacement,kill);
    return card;
  }

  async function upload(files, target='gallery', index=0) {
    if (!files?.length || busy) return;
    if (!safeName(item.slug)) { say(ui.saveState, 'Сначала укажи ключ проекта латиницей.', 'bar-state bar-state--bad'); return; }
    if (files.length > 12) { say(ui.saveState, 'Добавляй не больше 12 снимков за раз.', 'bar-state bar-state--bad'); return; }
    setBusy(true);
    say(ui.saveState, 'Готовлю снимки…', 'bar-state');
    try {
      for (const file of files) {
        const image = await shrink(file);
        const total = [...uploads.values()].reduce((sum, value) => sum + value.bytes.length, 0);
        if (total + image.bytes.length > 20 * 1024 * 1024) throw new Error('В одном сохранении можно загрузить до 20 МБ. Сохрани текущие снимки.');
        const name = item.slug + '-' + crypto.randomUUID();
        uploads.set(name, image);
        if(target==='gallery')shots.push({ file: name, alt: '' });
        else if(target==='shot')shots[index]={...shots[index],file:name};
        else item[target]=name;
        if (!item.cover) item.cover = name;
        touch();
      }
      say(ui.saveState, 'Снимки пока в браузере. Заполни подписи и нажми «Сохранить».', 'bar-state');
    } catch (err) { say(ui.saveState, err.message, 'bar-state bar-state--bad'); }
    finally { render(); setBusy(false); }
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
    if (!confirm('Удалить «' + title + '» из черновика? До сохранения доступна отмена, после — история GitHub.')) return;
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
  if(opts.tag!=='textarea') input.type=opts.type || 'text';
  if(opts.type==='number'){input.min='0';input.max='40';}
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

  if(kind==='services') { (data.services ||= []).push({id:'service-'+crypto.randomUUID().slice(0,8),title:'Новая услуга',group:'visual',hero:false,detail:''});
  } else if (kind === 'track') {
    (data.profile.track ||= []).unshift({ client: '', role: '', kind: '', period: '', note: '' });
  } else if (kind === 'tools') {
    (data.profile.tools ||= []).push({ name: '', for: '', logo: '' });
  } else if (kind === 'projects') {
    (data.projects.projects ||= []).unshift({
      slug: '', title: '', kind: '', role: '', year: '', note: '',
      cover: '', ratio: 'wide', shots: [], status: 'draft', category: 'personal',
    });
  }

  touch();
  render();
}

/* ── Состояние ─────────────────────────────────────────── */

function touch() { if(lastState){history.push(lastState);if(history.length>60)history.shift()} lastState=serialize(data);el('undo').disabled=!history.length;setDirty(true); }
function assetUrl(name){return name ? uploads.get(name)?.url || (local ? '../content/work/'+name+'.webp' : github.raw(SHOTS_DIR+'/'+name+'.webp',head)) : ''; }
function button(label,action){const b=document.createElement('button');b.type='button';b.className='btn-ghost';b.textContent=label;b.addEventListener('click',action);return b;}

function setDirty(value) {
  dirty = value;
  el('save').disabled = !value || busy;
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


async function shrink(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Подойдут PNG, JPEG и WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Исходник больше 20 МБ. Экспортируй отдельные экраны.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Слишком большой холст. Раздели длинный макет на экраны.');
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!blob || blob.type !== 'image/webp') throw new Error('Браузер не умеет экспортировать WebP. Открой редактор в актуальном Chrome, Edge, Firefox или Safari.');
    return {bytes: new Uint8Array(await blob.arrayBuffer()), url:URL.createObjectURL(blob)};
  } finally { bitmap.close(); }
}
function serialize(value) { return JSON.stringify(value, null, 2) + '\n'; }
function pick(object, path) { return path.split('.').reduce((node, key) => node?.[key], object); }
function put(object, path, value) {
  const keys = path.split('.'), last = keys.pop();
  keys.reduce((acc, key) => (acc[key] ||= {}), object)[last] = value;
}
