/* Буквы, которые тянутся к руке. Тот же жест, что и капля
   на главной кнопке, только вместо одного тела — двадцать шесть.
   Смысл в том, чтобы адрес был не подписью, а предметом.

   Каждая буква — своя пружина, поэтому ближние уходят дальше
   дальних и возвращаются вразнобой. Строка ведёт себя как ткань,
   а не как картинка, которую сдвинули целиком. */

import { Spring2, onTick } from './physics.js';

const REACH = 170;   // радиус, за которым руку уже не чувствуют
const PULL = 15;     // насколько далеко уходит самая близкая буква

export function initLettering(root = document) {
  const nodes = [...root.querySelectorAll('[data-letters]')];
  if (!nodes.length) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wantsMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || !wantsMotion) return;

  const chars = [];

  for (const node of nodes) {
    const text = node.textContent.trim();
    /* Экранный диктор читает подпись целиком, а не по буквам:
       разрезанный текст остаётся текстом только на вид */
    node.setAttribute('aria-label', text);

    node.replaceChildren(...[...text].map(letter => {
      const el = document.createElement('span');
      el.className = 'ch';
      el.textContent = letter;
      chars.push({ el, spring: new Spring2(0, 0, { stiffness: 210, damping: 15 }), x: 0, y: 0 });
      return el;
    }));
  }

  measure();
  addEventListener('resize', measure, { passive: true });
  /* Свой шрифт приходит после первой отрисовки и двигает буквы */
  document.fonts?.ready.then(measure);

  let px = -9999, py = -9999;
  let live = false;

  addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; }, { passive: true });

  const io = new IntersectionObserver(entries => {
    live = entries.some(e => e.isIntersecting);
  }, { rootMargin: '80px' });
  nodes.forEach(n => io.observe(n));

  onTick(dt => {
    if (!live) return;

    for (const c of chars) {
      const dx = px - (c.x - scrollX);
      const dy = py - (c.y - scrollY);
      const d = Math.hypot(dx, dy);
      const near = d < REACH ? 1 - d / REACH : 0;

      if (near > 0 && d > 0.01) {
        /* Квадрат близости, а не линия: буква под самым курсором
           уходит заметно, соседняя уже почти нет */
        const k = (near * near * PULL) / d;
        c.spring.set(dx * k, dy * k);
      } else {
        c.spring.set(0, 0);
      }

      c.spring.step(dt);
      c.el.style.transform =
        'translate3d(' + c.spring.x.value.toFixed(2) + 'px, ' + c.spring.y.value.toFixed(2) + 'px, 0)';
    }
  });

  /* Координаты снимаем в системе страницы и один раз: трогать
     getBoundingClientRect у элементов, которые мы же и двигаем
     каждый кадр, значит гонять раскладку по кругу. */
  function measure() {
    for (const c of chars) {
      c.el.style.transform = '';
      c.spring.reset(0, 0);
    }
    for (const c of chars) {
      const r = c.el.getBoundingClientRect();
      c.x = r.left + r.width / 2 + scrollX;
      c.y = r.top + r.height / 2 + scrollY;
    }
  }
}
