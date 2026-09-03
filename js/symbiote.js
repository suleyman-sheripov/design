/* Главная кнопка — симбиот. Она не ждёт, пока на неё наведут:
   на подходе курсора из её тела выходит капля, тянется навстречу
   и втягивается обратно, когда рука уходит.

   Слияние капли с телом кнопки делает не JS, а SVG-фильтр goo:
   размытие плюс резкий порог по альфе. Две отдельные фигуры,
   попав в один порог, читаются как одна тягучая масса. Текст
   лежит отдельным слоем поверх и в фильтр не попадает, иначе
   он размылся бы вместе с фоном. */

import { Spring2, Spring, onTick } from './physics.js';

const REACH = 260;      // с какого расстояния кнопка чувствует руку
const MAX_PULL = 78;    // дальше капля не тянется, связь рвётся

export function initSymbiote(root = document) {
  const nodes = [...root.querySelectorAll('[data-symbiote]')];
  if (!nodes.length) return;

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wantsMotion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || !wantsMotion) return;

  injectFilter();

  const units = nodes.map(build).filter(Boolean);
  if (!units.length) return;

  let px = -9999, py = -9999;
  addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; }, { passive: true });
  addEventListener('pointerleave', () => { px = py = -9999; }, { passive: true });

  onTick(dt => { for (const u of units) update(u, dt); });

  function build(el) {
    const goo = document.createElement('span');
    goo.className = 'cta-goo';
    goo.setAttribute('aria-hidden', 'true');
    goo.innerHTML = '<span class="cta-body"></span><span class="cta-drop"></span>';
    el.prepend(goo);

    const text = el.querySelector('.cta-text');
    if (!text) return null;

    const unit = {
      el, text,
      drop: goo.querySelector('.cta-drop'),
      pos: new Spring2(0, 0, { stiffness: 260, damping: 18 }),
      size: new Spring(0, { stiffness: 200, damping: 24 }),
      lean: new Spring2(0, 0, { stiffness: 190, damping: 20 }),
      press: 1,
    };

    el.addEventListener('pointerdown', () => { unit.press = 0.94; });
    addEventListener('pointerup', () => { unit.press = 1; }, { passive: true });
    /* Фокус с клавиатуры — капля выходит вперёд, чтобы состояние
       читалось и без мыши */
    el.addEventListener('focus', () => { unit.focused = true; });
    el.addEventListener('blur', () => { unit.focused = false; });

    return unit;
  }

  function update(u, dt) {
    const r = u.el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;

    const dx = px - cx;
    const dy = py - cy;
    const d = Math.hypot(dx, dy);
    const near = Math.max(0, 1 - d / REACH);

    if (near > 0) {
      /* Длина щупальца гаснет и от близости, и от дальности:
         вплотную капля сидит в теле, далеко — связь уже порвана.
         Максимум вылета приходится на середину пути. */
      const pull = Math.min(d, MAX_PULL) * near;
      const ux = d > 0.01 ? dx / d : 0;
      const uy = d > 0.01 ? dy / d : 0;
      u.pos.set(ux * pull, uy * pull);
      u.size.target = near;
      u.lean.set(ux * near * 7, uy * near * 7);
    } else {
      u.pos.set(0, 0);
      u.size.target = u.focused ? 0.55 : 0;
      u.lean.set(0, 0);
    }

    u.pos.step(dt);
    u.size.step(dt);
    u.lean.step(dt);

    const s = Math.max(0, u.size.value);
    u.drop.style.transform =
      `translate3d(${u.pos.x.value.toFixed(2)}px, ${u.pos.y.value.toFixed(2)}px, 0) scale(${(s * 0.86).toFixed(3)})`;

    u.el.style.transform =
      `translate3d(${u.lean.x.value.toFixed(2)}px, ${u.lean.y.value.toFixed(2)}px, 0) scale(${u.press})`;

    /* Подпись сдвигается втрое слабее тела: поверхность кнопки
       тянется, а буквы по ней едут, а не приклеены намертво */
    u.text.style.transform =
      `translate3d(${(u.lean.x.value / 3).toFixed(2)}px, ${(u.lean.y.value / 3).toFixed(2)}px, 0)`;
  }
}

/* Фильтр живёт в одном скрытом SVG на документ: несколько копий
   одного id ломают ссылку url(#goo) в части браузеров. */
function injectFilter() {
  if (document.getElementById('goo')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'goo-defs');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <filter id="goo" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur"/>
        <feColorMatrix in="blur" type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="goo"/>
        <feBlend in="SourceGraphic" in2="goo"/>
      </filter>
    </defs>`;
  document.body.append(svg);
}

