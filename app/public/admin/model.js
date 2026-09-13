/* Общая проверка для редактора, сайта и сборки. Никакого HTML из JSON. */
import { DEFAULT_SETTINGS } from './settings.js';
export const CONTENT_FILE = 'content/data/site.json';
export const SHOTS_DIR = 'content/work';
export const safeName = value => typeof value === 'string' && /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(value);
export const imageNames = data => [...new Set(data.projects.projects.flatMap(p => [p.cover,p.caseCover,...p.shots.map(s=>s.file)]).filter(Boolean))];

export function validateContent(data) {
  const fail = message => { throw new Error(message); };
  const str = (value, label, required = false) => {
    if (typeof value !== 'string' || value.length > 12000 || (required && !value.trim())) fail('Проверь поле «' + label + '».');
  };
  const list = (value, label) => { if (!Array.isArray(value) || value.length > 100) fail('Проверь список «' + label + '».'); };
  if (!data || !data.profile || !data.projects) fail('Неверный формат содержимого сайта.');
  const hex = value => /^#[0-9a-f]{6}$/i.test(value);
  if (data.settings !== undefined) {
    if (!data.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)) fail('Проверь настройки сайта.');
    for(const [key,value] of Object.entries(data.settings)) {
      if (!(key in DEFAULT_SETTINGS) || typeof value !== typeof DEFAULT_SETTINGS[key]) fail('Проверь настройку ' + key + '.');
      if (typeof value === 'string') str(value,key,true);
      if (['paper','surface','ink','accent','dot'].includes(key) && !hex(value)) fail('Цвет должен быть в формате #RRGGBB.');
      if (key==='cardRadius' && (!Number.isFinite(value) || value<0 || value>40)) fail('Скругление: от 0 до 40.');
      if (key==='previewStyle' && !['plain','edge','paper'].includes(value)) fail('Проверь оформление превью.');
      if (key==='resume') { try { if(new URL(value).protocol!=='https:') fail('Ссылка на резюме должна быть HTTPS.'); } catch {fail('Проверь ссылку на резюме.');} }
    }
  }
  if (data.services !== undefined) {
    list(data.services,'Услуги'); const ids=new Set();
    for(const s of data.services) {
      if(!s || !safeName(s.id) || ids.has(s.id)) fail('Ключи услуг должны быть уникальными.'); ids.add(s.id);
      str(s.title,'Название услуги',true); str(s.detail,'Описание услуги');
      if(!['brand','digital','visual'].includes(s.group) || typeof s.hero!=='boolean') fail('Проверь группу и тег услуги.');
    }
  }
  const p = data.profile;
  for (const key of ['name', 'role', 'city', 'email', 'phone']) str(p[key], key, true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || /[?&#]/.test(p.email)) fail('Проверь адрес почты.');
  for (const key of ['behance','dribbble']) {
    str(p.links?.[key], key, true);
    try { if (new URL(p.links[key]).protocol !== 'https:') fail('Ссылки должны начинаться с https://.'); }
    catch { fail('Проверь ссылку ' + key + '.'); }
  }
  list(p.track, 'Опыт'); list(p.tools, 'Инструменты');
  for (const job of p.track) for (const key of ['client','role','kind','period','note']) str(job[key], key, key === 'client');
  for (const tool of p.tools) {
    for (const key of ['name','for','logo']) str(tool[key], key);
    if (!/^assets\/tools\/[a-z0-9-]+\.(png|svg|webp)$/.test(tool.logo)) fail('Значок инструмента должен лежать в assets/tools/.');
  }
  list(data.projects.projects, 'Работы');
  const slugs = new Set();
  for (const project of data.projects.projects) {
    if (!safeName(project.slug) || slugs.has(project.slug)) fail('Ключи проектов должны быть уникальными: латиница, цифры, дефис.');
    slugs.add(project.slug);
    for (const key of ['title','kind','role','year','note','cover']) str(project[key], key, key === 'title');
    if (project.story !== undefined) {
      if (!project.story || typeof project.story !== 'object' || Array.isArray(project.story)) fail('Проверь описание кейса.');
      for (const key of ['task', 'solution', 'details']) if (project.story[key] !== undefined) str(project.story[key], 'Описание кейса: ' + key);
    }
    if (!['draft','published'].includes(project.status)) fail('Укажи статус проекта ' + project.title + '.');
    if (!['commercial','teaching','study','personal'].includes(project.category)) fail('Укажи тип проекта ' + project.title + '.');
    if (!['wide','tall'].includes(project.ratio)) fail('Проверь пропорцию обложки.');
    list(project.shots, 'Снимки');
    const files = new Set();
    for (const shot of project.shots) {
      if (!safeName(shot.file) || files.has(shot.file)) fail('Имена снимков должны быть безопасными и не повторяться в кейсе.');
      files.add(shot.file);
      str(shot.alt, 'Описание снимка', project.status === 'published');
    }
    if (project.status === 'published' && (!project.shots.length || !project.cover)) fail('Перед публикацией добавь снимки, подписи и выбери обложку: ' + project.title + '.');
    for(const key of ['cover','caseCover']) if(project[key] && !safeName(project[key])) fail('Проверь имя обложки.');
    for(const key of ['background','foreground']) if(project[key] && !hex(project[key])) fail('Проверь цвет проекта.');
    if(project.previewStyle && !['plain','edge','paper'].includes(project.previewStyle)) fail('Проверь оформление проекта.');
    if(project.previewFit && !['contain','cover'].includes(project.previewFit)) fail('Проверь размещение превью.');
    if(project.previewPosition && !['center','top','bottom','left','right'].includes(project.previewPosition)) fail('Проверь положение превью.');
  }
  return data;
}
