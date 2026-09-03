import { initIntro } from './intro.js';

const intro = initIntro(document);

/* Опыт лежит в data/profile.json, а не в разметке: админка будет
   править этот файл через GitHub API, не трогая вёрстку. */
renderTrack();

async function renderTrack() {
  const list = document.getElementById('track');
  if (!list) return;

  try {
    const res = await fetch('data/profile.json');
    if (!res.ok) throw new Error(res.status);
    const { track = [] } = await res.json();

    list.replaceChildren(...track.map(item => {
      const li = document.createElement('li');
      li.className = 'track-item';
      li.tabIndex = 0;
      li.innerHTML = `
        <span class="track-role">
          <span class="track-client"></span>
          <span class="track-kind"></span>
        </span>
        <span class="track-period"></span>
        <span class="track-note"></span>`;
      li.querySelector('.track-client').textContent = item.client;
      li.querySelector('.track-kind').textContent = `${item.role} · ${item.kind}`;
      li.querySelector('.track-period').textContent = item.period;
      li.querySelector('.track-note').textContent = item.note;
      return li;
    }));
  } catch {
    /* Файл не отдался — блок просто остаётся пустым, экран не ломается */
    list.closest('.hero-rail')?.remove();
  }
}

/* Содержимое первого экрана появляется после сборки замка,
   волной по 60 мс — так секция оживает, а не моргает целиком. */
intro.done.then(() => {
  document.querySelectorAll('.reveal').forEach((el, i) => {
    setTimeout(() => el.classList.add('is-in'), i * 60);
  });
});

/* Магнитные кнопки. Только там, где есть настоящий курсор:
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
