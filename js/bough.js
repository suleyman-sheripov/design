/* Ветка на первом экране — маятник, а не картинка.

   Иллюстрация своя: из неё взят мох в палитре, поэтому она здесь
   не украшение, а источник цвета, поставленный на видное место.

   Раскачивают её две вещи: прокрутка (страницу дёрнули, ветка
   отстала) и рука, прошедшая рядом с концом. Уравнение обычное,
   маятниковое: возвращающий момент по синусу угла плюс трение.
   Синус, а не угол, — поэтому на больших размахах ветка идёт
   медленнее, и качание не выглядит равномерным тиканьем. */

import { onTick } from './physics.js';

const K = 30;        // жёсткость подвеса
const C = 2.1;       // трение
const LIMIT = 0.2;   // предел размаха, радианы
const NUDGE = 170;   // на каком расстоянии от конца ветка чувствует руку

export function initBough(root = document) {
  const el = root.getElementById('bough');
  if (!el) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let angle = 0;
  let omega = 0;
  let impulse = 0;
  let live = true;

  /* Коробку читаем на прокрутке и ресайзе, а не каждый кадр:
     запрос геометрии у элемента, который сам же и крутится,
     заставляет браузер пересчитывать раскладку по кругу */
  let box = el.getBoundingClientRect();
  const remeasure = () => { box = el.getBoundingClientRect(); };
  addEventListener('resize', remeasure, { passive: true });

  let lastScroll = scrollY;
  addEventListener('scroll', () => {
    impulse += scrollY - lastScroll;
    lastScroll = scrollY;
    if (live) remeasure();
  }, { passive: true });

  let px = -9999, py = -9999, lastPx = -9999;
  addEventListener('pointermove', e => {
    px = e.clientX;
    py = e.clientY;
  }, { passive: true });

  const io = new IntersectionObserver(entries => {
    live = entries.some(e => e.isIntersecting);
  });
  io.observe(el);

  onTick(dt => {
    if (!live) return;

    /* Конец ветки — левый нижний угол картинки: подвес наверху справа */
    const tipX = box.left + box.width * 0.36;
    const tipY = box.bottom - box.height * 0.12;
    const d = Math.hypot(px - tipX, py - tipY);

    if (d < NUDGE && lastPx > -9000) {
      /* Толкает не близость, а движение руки: неподвижный курсор
         рядом с веткой ничего не делает */
      const hand = px - lastPx;
      omega += hand * (1 - d / NUDGE) * 0.004;
    }
    lastPx = px;

    omega += impulse * 0.0018;
    impulse = 0;

    omega += (-K * Math.sin(angle) - C * omega) * dt;
    angle += omega * dt;

    if (angle > LIMIT) { angle = LIMIT; omega *= -0.4; }
    if (angle < -LIMIT) { angle = -LIMIT; omega *= -0.4; }

    el.style.transform = 'rotate(' + ((angle * 180) / Math.PI).toFixed(3) + 'deg)';
  });
}
