/* Курсор — приводочная метка. Тем же крестом в типографии совмещают
   краски, и он же стоит на полях макетов, которые владелец отдаёт
   в печать. Форма взята из ремесла, а не из набора «необычных курсоров».

   Метка состоит из двух слоёв, и это принципиально:
   точка идёт за рукой без задержки, поэтому целиться по-прежнему можно,
   а крест догоняет по пружине и сжимается по вектору скорости.
   Отставание — единственное, что отличает живое от приклеенного. */

import { Spring2, onTick } from './physics.js';

const HOT = 'a[href], button, [data-cursor]';

export function initCursor(root = document) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wantsMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || !wantsMotion) return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <span class="cursor-dot"></span>
    <span class="cursor-mark">
      <svg viewBox="-24 -24 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle class="cursor-ring" r="9"/>
        <path class="cursor-ticks" d="M-21 0h7M14 0h7M0-21v7M0 14v7"/>
      </svg>
    </span>
    <span class="cursor-label"></span>`;
  document.body.append(el);
  document.documentElement.classList.add('has-cursor');

  const dot = el.querySelector('.cursor-dot');
  const mark = el.querySelector('.cursor-mark');
  const label = el.querySelector('.cursor-label');

  const trail = new Spring2(0, 0, { stiffness: 320, damping: 26 });
  const open = { value: 0, target: 0 };

  let px = 0, py = 0;
  let visible = false;
  let hot = null;

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', () => el.classList.add('is-press'), { passive: true });
  addEventListener('pointerup', () => el.classList.remove('is-press'), { passive: true });
  addEventListener('pointerleave', hide, { passive: true });
  addEventListener('blur', hide);
  /* Уехали на другую вкладку или в devtools — метка не должна
     висеть на месте, где мышь давно не стоит */
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });

  onTick(step);

  function onMove(e) {
    px = e.clientX;
    py = e.clientY;

    if (!visible) {
      visible = true;
      trail.reset(px, py);
      el.classList.add('is-on');
    }

    const under = e.target instanceof Element ? e.target : null;
    const next = under ? under.closest(HOT) : null;
    if (next !== hot) setHot(next);

    /* Мох по тёмной зоне не читается: над ней метка уходит в бумагу */
    el.classList.toggle('on-night', Boolean(under?.closest('[data-tone="night"]')));
  }

  function hide() {
    visible = false;
    el.classList.remove('is-on', 'is-press');
  }

  function setHot(next) {
    hot = next;
    const kind = next?.dataset.cursor || (next ? 'link' : '');
    const text = next?.dataset.cursorLabel || '';

    el.dataset.state = kind;
    label.textContent = text;
    el.classList.toggle('has-label', Boolean(text));
    open.target = next ? 1 : 0;
  }

  function step(dt) {
    if (!visible) return;

    trail.set(px, py);
    trail.step(dt);

    dot.style.transform = `translate3d(${px}px, ${py}px, 0)`;

    /* Сжатие по вектору скорости. Растягиваем вдоль движения и
       поджимаем поперёк — объём сохраняется, поэтому читается
       как масса, а не как масштабирование. */
    const vx = trail.x.velocity;
    const vy = trail.y.velocity;
    const speed = Math.hypot(vx, vy);
    const stretch = Math.min(speed / 2600, 0.4);
    const angle = speed > 12 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;

    open.value += (open.target - open.value) * Math.min(dt * 14, 1);
    const scale = 1 + open.value * 0.55;

    mark.style.transform =
      `translate3d(${trail.x.value}px, ${trail.y.value}px, 0)` +
      ` rotate(${angle.toFixed(1)}deg) scale(${(scale * (1 + stretch)).toFixed(3)}, ${(scale * (1 - stretch * 0.7)).toFixed(3)})` +
      ` rotate(${(-angle).toFixed(1)}deg)`;

    label.style.transform = `translate3d(${trail.x.value}px, ${trail.y.value}px, 0)`;
  }
}
