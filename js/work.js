/* Работы. Лента едет нативной прокруткой — так бесплатно достаются
   тачскрин, трекпад, полоса прокрутки и клавиатура. Физика добавлена
   сверху: карточки заваливаются по ходу броска, потому что лист
   бумаги, который толкнули, не едет строго параллельно соседнему.

   Разбор кейса открывается в нативном <dialog>: Escape, ловушка
   фокуса и возврат фокуса на кнопку уже написаны в браузере. */

import { Spring, onTick, springCss } from './physics.js';

const SRC = 'data/projects.json';
const imgSrc = file => 'assets/work/' + file + '.webp';

export async function initWork(root = document) {
  const rail = root.getElementById('workRail');
  const track = root.getElementById('workTrack');
  const status = root.getElementById('workStatus');
  const count = root.getElementById('workCount');
  if (!rail || !track) return;

  let projects = [];
  try {
    const res = await fetch(SRC);
    if (!res.ok) throw new Error(String(res.status));
    ({ projects = [] } = await res.json());
  } catch {
    say(status, 'Работы не загрузились. Обновите страницу или напишите на почту, пришлю ссылкой.');
    return;
  }

  if (!projects.length) {
    say(status, 'Свежие работы ещё не выложены. Напишите на почту, покажу текущие.');
    return;
  }

  status.hidden = true;
  track.replaceChildren(...projects.map(card));
  if (count) count.textContent = projects.length + ' ' + plural(projects.length);

  const sheet = initSheet(root, projects);
  track.addEventListener('click', e => {
    const btn = e.target.closest('.case-open');
    if (btn) sheet.open(Number(btn.dataset.index));
  });

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    lean(rail, track);
    dragScroll(rail);
  }

  function card(p, i) {
    const li = document.createElement('li');
    li.className = 'case case--' + (p.ratio || 'wide');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'case-open';
    btn.dataset.index = String(i);
    btn.dataset.cursor = 'view';
    btn.dataset.cursorLabel = 'Разобрать';
    btn.setAttribute('aria-haspopup', 'dialog');

    const shot = document.createElement('span');
    shot.className = 'case-shot';
    shot.append(img(p.cover, p.title + ': ' + p.kind, i < 2 ? 'eager' : 'lazy'));

    const meta = document.createElement('span');
    meta.className = 'case-meta';
    meta.append(
      span('case-idx', String(i + 1).padStart(2, '0')),
      span('case-title', p.title),
      span('case-kind', [p.kind, p.role].filter(Boolean).join(' · ')),
    );

    btn.append(shot, meta);
    li.append(btn);
    return li;
  }
}

/* ── Разбор кейса ──────────────────────────────────────── */

function initSheet(root, projects) {
  const dlg = root.getElementById('caseSheet');
  const body = root.getElementById('caseBody');
  const closeBtn = root.getElementById('caseClose');

  const spring = springCss({ stiffness: 190, damping: 21 });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  closeBtn.addEventListener('click', () => dlg.close());

  /* Клик мимо карточки закрывает: площадь самого <dialog> — это
     и есть подложка, содержимое лежит внутри .sheet-body */
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => document.documentElement.classList.remove('is-locked'));

  return { open };

  function open(index) {
    const p = projects[index];
    if (!p) return;

    body.replaceChildren(head(p), ...p.shots.map(figure));
    body.scrollTop = 0;
    document.documentElement.classList.add('is-locked');
    dlg.showModal();

    if (reduce) return;
    dlg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'linear' });
    body.animate(
      [{ transform: 'translateY(48px) scale(.97)' }, { transform: 'none' }],
      { duration: spring.duration, easing: spring.easing },
    );
  }

  function head(p) {
    const wrap = document.createElement('header');
    wrap.className = 'sheet-head';

    const h = document.createElement('h3');
    h.id = 'caseTitle';
    h.textContent = p.title;

    wrap.append(h, span('sheet-kind', [p.kind, p.role, p.year].filter(Boolean).join(' · ')));

    /* Описание заполняется в админке. Пустого абзаца на странице
       не появляется: лучше без слов, чем сочинённые. */
    if (p.note) wrap.append(span('sheet-note', p.note));
    return wrap;
  }

  function figure(shot) {
    const fig = document.createElement('figure');
    fig.className = 'sheet-shot';
    fig.append(img(shot.file, shot.alt, 'lazy'));
    return fig;
  }
}

/* ── Физика ленты ──────────────────────────────────────── */

/* Наклон по скорости. Карточка, которую толкнули, заваливается
   назад: иначе прокрутка читается как перемотка картинки,
   а не как движение предметов на столе. */
function lean(rail, track) {
  const v = new Spring(0, { stiffness: 120, damping: 20 });
  let prev = rail.scrollLeft;
  let raw = 0;

  rail.addEventListener('scroll', () => {
    raw = rail.scrollLeft - prev;
    prev = rail.scrollLeft;
  }, { passive: true });

  let last = '';
  onTick(dt => {
    v.target = raw;
    v.step(dt);
    raw *= 0.72;

    /* В покое пружина стоит на нуле: не трогаем стиль вовсе,
       иначе браузер пересчитывает трансформы всех карточек
       шестьдесят раз в секунду при неподвижной ленте */
    const next = v.value.toFixed(3);
    if (next === last) return;
    last = next;
    track.style.setProperty('--lean', next);
  });
}

/* Протаскивание мышью. Тач и трекпад прокручивают сами, поэтому
   перехватываем только настоящую мышь и только левую кнопку. */
function dragScroll(rail) {
  let id = null;
  let startX = 0;
  let startScroll = 0;
  let moved = 0;
  let vel = 0;
  let lastX = 0;
  let stopGlide = null;

  rail.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    stopGlide?.();
    id = e.pointerId;
    startX = lastX = e.clientX;
    startScroll = rail.scrollLeft;
    moved = 0;
    vel = 0;
    rail.setPointerCapture(id);
    rail.classList.add('is-dragging');
  });

  rail.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    vel = vel * 0.6 + (lastX - e.clientX) * 0.4;
    lastX = e.clientX;
    rail.scrollLeft = startScroll - dx;
  });

  const release = e => {
    if (e.pointerId !== id) return;
    id = null;
    rail.classList.remove('is-dragging');
    if (Math.abs(vel) > 1) glide();
  };

  rail.addEventListener('pointerup', release);
  rail.addEventListener('pointercancel', release);

  /* Протащили больше десяти пикселей — это был бросок, а не клик:
     кейс не должен открываться из-под руки */
  rail.addEventListener('click', e => {
    if (moved > 10) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  function glide() {
    let v = vel * 16;
    stopGlide = onTick(dt => {
      rail.scrollLeft += v * dt;
      v *= Math.pow(0.02, dt);   // трение, не зависящее от частоты кадров
      if (Math.abs(v) < 6) { stopGlide(); stopGlide = null; }
    });
  }
}

/* ── Мелочи ────────────────────────────────────────────── */

function img(file, alt, loading) {
  const el = document.createElement('img');
  el.src = imgSrc(file);
  el.alt = alt;
  el.loading = loading;
  el.decoding = 'async';
  el.draggable = false;
  return el;
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function say(node, text) {
  if (!node) return;
  node.hidden = false;
  node.textContent = text;
}

function plural(n) {
  const tail = n % 10;
  if (n > 4 && n < 21) return 'работ';
  if (tail === 1) return 'работа';
  if (tail > 1 && tail < 5) return 'работы';
  return 'работ';
}
