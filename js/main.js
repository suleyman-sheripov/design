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

const intro = initIntro(document);

initCursor();
const symbiote = initSymbiote();
initWork(document);

renderProfile().then(() => {
  initLettering(document);
});

/* Первый экран собирается ПОСЛЕ интро, а не во время: страховка
   в 2.6 с срабатывала раньше конца занавеса, блоки проявлялись
   за закрытой шторкой, и к её подъёму всё уже стояло собранным.
   Девять секунд — заведомо больше интро, но всё ещё предел:
   застрявшие шрифты или JSON не оставят посетителя с пустым
   экраном навсегда. */
Promise.race([intro.done, wait(9000)]).then(() => {
  revealAll();
  /* Голова здоровается один раз сразу после сборки экрана,
     дальше показывается вразнобой */
  symbiote?.wake();
});

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
    /* Опыт и инструменты живут только в JSON: без него их нечем
       заполнить, и плитки снимаются целиком. Контакты остаются:
       они есть в разметке. */
    drop('.t-track');
    drop('.t-kit');
    return;
  }

  applyContacts(profile);
  renderTrack(profile.track || []);
  renderKit(profile.tools || []);
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

/* ── Опыт ──────────────────────────────────────────────────
   Свежее место сверху — так же, как оно лежит в JSON. Точка на
   вертикальной нити отмечает каждое, дата стоит справа: строка
   читается как «кем и когда», а не как абзац. */

function renderTrack(track) {
  const list = document.getElementById('track');
  if (!list) return;

  if (!track.length) return drop('.t-track');

  list.replaceChildren(...track.map(item => {
    const li = document.createElement('li');
    /* Учебная работа весит меньше коммерческой — это видно цветом */
    li.className = item.kind === 'Учебный проект' ? 'tr tr--minor' : 'tr';

    const what = document.createElement('div');
    what.className = 'tr-what';
    what.append(span('tr-role', item.role), span('tr-client', item.client));

    li.append(span('tr-dot', ''), what, span('tr-period', item.period));
    return li;
  }));

  markCut(list);
  /* Плитка меняет высоту вместе с шириной окна, поэтому обрезано
     или нет — величина не постоянная. Наблюдатель дешевле, чем
     обработчик resize: он молчит, пока размер не поменялся. */
  new ResizeObserver(() => markCut(list)).observe(list);
}

/* Растворять низ списка можно, только если под краем правда
   что-то есть */
function markCut(list) {
  list.classList.toggle('is-cut', list.scrollHeight > list.clientHeight + 1);
}

/* ── Инструменты ───────────────────────────────────────── */

function renderKit(tools) {
  const list = document.getElementById('kitLegend');
  if (!list) return;

  if (!tools.length) return drop('.t-kit');

  list.replaceChildren(...tools.map(tool => {
    const li = document.createElement('li');

    const img = document.createElement('img');
    img.src = tool.logo;
    img.alt = '';
    img.width = 26;
    img.height = 26;

    const text = document.createElement('div');
    text.append(span('kit-name', tool.name), span('kit-for', tool.for));

    li.append(img, text);
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
      aimFrom(e.target);
      setTimeout(() => e.target.classList.add('is-in'), i * 70);
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

/* Каждый блок приезжает со своей стороны: что слева от середины
   экрана — слева, что справа — справа. Направление берётся из
   фактического положения, поэтому его не нужно прописывать руками
   и оно не разъедется при смене вёрстки. */
function aimFrom(el) {
  const r = el.getBoundingClientRect();
  if (!r.width) return;

  const fromLeft = r.left + r.width / 2 < innerWidth / 2;
  /* Широкий блок во всю ширину ехать вбок не должен: у него нет
     своей стороны, он приходит снизу */
  const wide = r.width > innerWidth * 0.7;

  el.style.setProperty('--from-x', wide ? '0px' : (fromLeft ? '-38px' : '38px'));
  el.style.setProperty('--from-y', wide ? '26px' : '14px');
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
