import { initIntro } from './intro.js';

const intro = initIntro(document);

renderLedger().then(() => intro.done).then(revealAll);

/* Опыт лежит в data/profile.json, а не в разметке: админка будет
   править этот файл через GitHub API, не трогая вёрстку. */
async function renderLedger() {
  const list = document.getElementById('track');
  if (!list) return;

  try {
    const res = await fetch('data/profile.json');
    if (!res.ok) throw new Error(String(res.status));
    const { track = [] } = await res.json();

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
    if (count) count.textContent = `${track.length} ${plural(track.length)}`;
  } catch {
    /* Файл не отдался — секция снимается целиком, экран не ломается */
    list.closest('.ledger')?.remove();
  }
}

function clientCell({ client, role, kind }) {
  const wrap = document.createElement('span');
  wrap.className = 'entry-client';
  wrap.append(span('entry-role', `${role} · ${kind}`), document.createTextNode(client));
  return wrap;
}

function span(className, text) {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function plural(n) {
  const tail = n % 10;
  if (n > 4 && n < 21) return 'мест';
  if (tail === 1) return 'место';
  if (tail > 1 && tail < 5) return 'места';
  return 'мест';
}

/* Появление волной по 60 мс — один приём на весь сайт.
   Первый экран открывается сразу после интро, остальное по прокрутке. */
function revealAll() {
  const items = [...document.querySelectorAll('.reveal')];
  const above = items.filter(el => el.getBoundingClientRect().top < innerHeight);
  above.forEach((el, i) => setTimeout(() => el.classList.add('is-in'), i * 60));

  const rest = items.filter(el => !above.includes(el));
  if (!rest.length) return;

  const io = new IntersectionObserver((entries, self) => {
    entries.filter(e => e.isIntersecting).forEach((e, i) => {
      setTimeout(() => e.target.classList.add('is-in'), i * 60);
      self.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  rest.forEach(el => io.observe(el));
}

/* Магнитная кнопка. Только там, где есть настоящий курсор:
   на тач-экране наведения не существует. */
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const wantsMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

if (canHover && wantsMotion) {
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    let frame = null;

    el.addEventListener('pointermove', e => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const r = el.getBoundingClientRect();
        const dx = clamp((e.clientX - (r.left + r.width / 2)) * 0.28, 6);
        const dy = clamp((e.clientY - (r.top + r.height / 2)) * 0.34, 6);
        el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
      });
    });

    const reset = () => {
      if (frame) { cancelAnimationFrame(frame); frame = null; }
      el.style.transform = '';
    };
    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset);
  });
}

function clamp(value, limit) {
  return Math.max(-limit, Math.min(limit, value));
}
