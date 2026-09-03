/* Сборка страницы.

   Контент лежит в data/*.json, а не в разметке: админка правит
   эти файлы через GitHub API и не трогает вёрстку. Контакты при
   этом продублированы в HTML статикой — единственное, что должно
   работать даже если скрипты не пришли, это способ написать. */

import { initIntro } from './intro.js';
import { initCursor } from './cursor.js';
import { initSymbiote } from './symbiote.js';
import { initLettering } from './lettering.js';
import { initWork } from './work.js';
import { initTools } from './tools.js';
import { initBough } from './bough.js';

const intro = initIntro(document);

initCursor();
initSymbiote();
initWork(document);
initBough(document);

renderProfile().then(() => {
  initTools(document);
  initLettering(document);
});

/* Появление не ждёт ни загрузку данных, ни конец интро дольше
   положенного: если шрифты или JSON застряли, страница всё равно
   должна открыться. Пустой экран — худшее, чем можно ответить
   на медленную сеть. */
Promise.race([intro.done, wait(2600)]).then(revealAll);

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function renderProfile() {
  let profile = null;
  try {
    const res = await fetch('data/profile.json');
    if (!res.ok) throw new Error(String(res.status));
    profile = await res.json();
  } catch {
    /* Реестр и инструменты живут только в JSON: без него их нечем
       заполнить, и разделы снимаются целиком. Контакты остаются:
       они есть в разметке. */
    drop('.ledger');
    drop('.tools');
    return;
  }

  applyContacts(profile);
  renderLedger(profile.track || []);
  renderTools(profile.tools || []);
}

function applyContacts({ email, phone, city, links = {} }) {
  const values = {
    email,
    phone,
    city,
    behance: links.behance,
    dribbble: links.dribbble,
  };

  for (const el of document.querySelectorAll('[data-bind]')) {
    const value = values[el.dataset.bind];
    if (!value) continue;

    const scheme = el.dataset.bindHref;
    if (scheme === 'tel:') {
      /* В наборе номер с пробелами, в ссылке — без: иначе часть
         телефонов не поднимает звонилку */
      el.href = 'tel:' + value.replace(/[^\d+]/g, '');
      el.textContent = value;
    } else if (scheme) {
      el.href = scheme + value;
      el.textContent = value;
    } else if (el.tagName === 'A') {
      el.href = value;
      /* Подписью служит домен без протокола: читать https://
         в тексте незачем */
      el.textContent = value.replace(/^https?:\/\//, '');
    } else {
      el.textContent = value;
    }
  }
}

/* ── Реестр ────────────────────────────────────────────── */

function renderLedger(track) {
  const list = document.getElementById('track');
  if (!list) return;

  if (!track.length) return drop('.ledger');

  list.replaceChildren(...track.map((item, i) => {
    const li = document.createElement('li');
    /* Учебная работа весит меньше коммерческой — это видно кеглем */
    li.className = item.kind === 'Учебный проект' ? 'entry entry--minor' : 'entry';
    li.append(
      span('entry-idx', String(i + 1).padStart(2, '0')),
      clientCell(item),
      span('entry-period', item.period),
      span('entry-note', item.note),
    );
    return li;
  }));

  const count = document.getElementById('ledgerCount');
  if (count) count.textContent = track.length + ' ' + plural(track.length, ['место', 'места', 'мест']);
}

function clientCell({ client, role, kind }) {
  const wrap = document.createElement('span');
  wrap.className = 'entry-client';
  wrap.append(span('entry-role', role + ' · ' + kind), document.createTextNode(client));
  return wrap;
}

/* ── Инструменты ───────────────────────────────────────── */

function renderTools(tools) {
  const arena = document.getElementById('kitArena');
  const legend = document.getElementById('kitLegend');
  if (!arena || !legend) return;

  if (!tools.length) return drop('.tools');

  arena.replaceChildren(...tools.map(tool => {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const img = document.createElement('img');
    img.src = tool.logo;
    img.alt = '';
    img.width = 32;
    img.height = 32;

    chip.append(img);
    return chip;
  }));

  legend.replaceChildren(...tools.map(tool => {
    const li = document.createElement('li');
    li.append(span('kit-name', tool.name), span('kit-for', tool.for));
    return li;
  }));
}

/* ── Появление ─────────────────────────────────────────── */

/* Появление волной по 60 мс — один приём на весь сайт.
   Наблюдатель один на все блоки: то, что уже на экране, он отдаёт
   сразу, остальное по мере прокрутки. Отдельной ветки «выше сгиба»
   нет намеренно — именно на ней блоки и терялись. */
function revealAll() {
  const items = [...document.querySelectorAll('.reveal')];

  const io = new IntersectionObserver((entries, self) => {
    entries.filter(e => e.isIntersecting).forEach((e, i) => {
      setTimeout(() => e.target.classList.add('is-in'), i * 60);
      self.unobserve(e.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

  items.forEach(el => io.observe(el));

  /* Страховка. Переход по якорю может пронести раздел мимо
     наблюдателя между двумя кадрами, и блок останется прозрачным
     навсегда. Через четыре секунды показываем всё, что к этому
     моменту уже на экране или выше него. */
  setTimeout(() => {
    for (const el of items) {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in');
    }
  }, 4000);
}

/* ── Мелочи ────────────────────────────────────────────── */

function drop(selector) {
  document.querySelector(selector)?.remove();
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function plural(n, [one, few, many]) {
  const tail = n % 10;
  if (n > 4 && n < 21) return many;
  if (tail === 1) return one;
  if (tail > 1 && tail < 5) return few;
  return many;
}
