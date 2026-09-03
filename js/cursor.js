/* Курсор: кольцо, внутри точка.

   Два слоя, и это принципиально. Кольцо догоняет руку по мягкой
   пружине и отстаёт — отставание единственное, что отличает живое
   от приклеенного. Точка внутри жёстче и ведёт.

   Главное: рядом с тем, что можно нажать, точка тянется к центру
   элемента, а кольцо остаётся на руке. Между ними возникает
   натяжение, и курсор начинает показывать намерение до клика. */

import { Spring2, onTick } from './physics.js';

const HOT = 'a[href], button, [data-cursor]';

/* Радиус, за которым притяжение уже не чувствуется, и предел
   вылета точки: дальше она вышла бы за кольцо и связь порвалась */
const REACH = 120;
const PULL_MAX = 13;

export function initCursor(root = document) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wantsMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || !wantsMotion) return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <span class="cursor-mark">
      <svg viewBox="-24 -24 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle class="cursor-ring" r="11"/>
        <path class="cursor-ticks" d="M-20 0h5M15 0h5M0-20v5M0 15v5"/>
      </svg>
    </span>
    <span class="cursor-dot"></span>
    <span class="cursor-label"></span>`;
  document.body.append(el);
  document.documentElement.classList.add('has-cursor');

  const dot = el.querySelector('.cursor-dot');
  const mark = el.querySelector('.cursor-mark');
  const label = el.querySelector('.cursor-label');

  /* Кольцо мягче точки: разная жёсткость и даёт натяжение */
  const ring = new Spring2(0, 0, { stiffness: 190, damping: 21 });
  const tip = new Spring2(0, 0, { stiffness: 430, damping: 27 });
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
     висеть там, где руки давно нет */
  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });

  onTick(step);

  function onMove(e) {
    px = e.clientX;
    py = e.clientY;

    if (!visible) {
      visible = true;
      ring.reset(px, py);
      tip.reset(px, py);
      el.classList.add('is-on');
    }

    const under = e.target instanceof Element ? e.target : null;
    const next = under ? under.closest(HOT) : null;
    if (next !== hot) setHot(next);

    /* Мох по тёмной зоне не читается: над ней курсор уходит в бумагу */
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

  /* Куда тянется точка. Без цели — за рукой; рядом с целью —
     смещается к её центру тем сильнее, чем ближе рука. */
  function aim() {
    if (!hot) return [px, py];

    const r = hot.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    let dx = cx - px;
    let dy = cy - py;
    const d = Math.hypot(dx, dy);
    if (d < 0.01) return [px, py];

    /* Квадрат близости: у самой кнопки точка уходит заметно,
       на подлёте почти нет */
    const near = d < REACH ? 1 - d / REACH : 0;
    const reach = Math.min(near * near * PULL_MAX, PULL_MAX);

    return [px + (dx / d) * reach, py + (dy / d) * reach];
  }

  function step(dt) {
    if (!visible) return;

    ring.set(px, py);
    ring.step(dt);

    const [ax, ay] = aim();
    tip.set(ax, ay);
    tip.step(dt);

    dot.style.transform = `translate3d(${tip.x.value.toFixed(2)}px, ${tip.y.value.toFixed(2)}px, 0)`;

    /* Сжатие по вектору скорости: растягиваем вдоль движения и
       поджимаем поперёк. Объём сохраняется, поэтому читается как
       масса, а не как масштабирование. */
    const vx = ring.x.velocity;
    const vy = ring.y.velocity;
    const speed = Math.hypot(vx, vy);
    const stretch = Math.min(speed / 2600, 0.36);
    const angle = speed > 12 ? (Math.atan2(vy, vx) * 180) / Math.PI : 0;

    open.value += (open.target - open.value) * Math.min(dt * 14, 1);
    const scale = 1 + open.value * 0.45;

    mark.style.transform =
      `translate3d(${ring.x.value.toFixed(2)}px, ${ring.y.value.toFixed(2)}px, 0)` +
      ` rotate(${angle.toFixed(1)}deg)` +
      ` scale(${(scale * (1 + stretch)).toFixed(3)}, ${(scale * (1 - stretch * 0.7)).toFixed(3)})` +
      ` rotate(${(-angle).toFixed(1)}deg)`;

    label.style.transform = `translate3d(${ring.x.value.toFixed(2)}px, ${ring.y.value.toFixed(2)}px, 0)`;
  }
}
