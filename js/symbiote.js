/* Главная кнопка — симбиот.

   В покое из неё время от времени высовывается голова с глазами,
   ведёт из стороны в сторону и ныряет обратно. Если рука подходит,
   пока голова снаружи, она ныряет резко; если подходит, когда голова
   уже уходит, — ныряет ещё быстрее. Только после этого кнопка
   начинает тянуться навстречу.

   Слияние капли с телом делает не JS, а SVG-фильтр goo: размытие
   плюс резкий порог по альфе. Две отдельные фигуры, попав в один
   порог, читаются как одна тягучая масса. Подпись и глаза лежат
   выше слоя с фильтром и в него не попадают, иначе размылись бы. */

import { Spring2, Spring, onTick } from './physics.js';

const REACH = 250;      // с какого расстояния кнопка чувствует руку
const OUT_MAX = 52;     // запас хода, дальше вступает предел по радиусу
const DROP_R = 29;      // радиус .cta-drop в CSS, из него считается предел

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

    /* Глаза отдельным слоем: попади они под фильтр, размылись бы
       вместе с телом и превратились в пятно */
    const eyes = document.createElement('span');
    eyes.className = 'cta-eyes';
    eyes.setAttribute('aria-hidden', 'true');
    eyes.innerHTML = '<i></i><i></i>';
    el.prepend(eyes);

    const text = el.querySelector('.cta-text');
    if (!text) return null;

    const unit = {
      el, text, eyes,
      drop: goo.querySelector('.cta-drop'),
      pos: new Spring2(0, 0, { stiffness: 260, damping: 18 }),
      size: new Spring(0, { stiffness: 200, damping: 24 }),
      lean: new Spring2(0, 0, { stiffness: 190, damping: 20 }),
      gaze: new Spring2(0, 0, { stiffness: 150, damping: 15 }),
      glanceIn: 0,
      press: 1,
      mode: 'idle',
      wait: 2 + Math.random() * 3,
      sway: 0,
      eyeOpen: 0,
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

    if (near > 0 && headIsOut(u)) {
      /* Рука подошла, пока голова снаружи. Из показа ныряем резко,
         а если уже уходили — ещё быстрее: пружина не доигрывает
         старую цель, а доворачивает к новой. */
      u.mode = 'dive';
      u.wait = u.mode === 'retract' ? 0.18 : 0.3;
      u.size.k = 420;
      u.size.c = 34;
    }

    if (near > 0 && u.mode !== 'dive') {
      reachTo(u, r, dx, dy, d, near);
    } else if (u.mode === 'dive') {
      dive(u, dt);
    } else if (u.focused) {
      u.mode = 'idle';
      u.pos.set(0, 0);
      u.size.target = 0.55;
      u.lean.set(0, 0);
      u.eyeOpen = 0;
    } else {
      idleLife(u, dt, r);
    }

    u.pos.step(dt);
    u.size.step(dt);
    u.lean.step(dt);
    u.gaze.step(dt);

    render(u);
  }

  /* Капля тянется к руке. Вылет считается ОТ КРАЯ кнопки в сторону
     руки, а не от центра: кнопка втрое шире, чем выше, и от центра
     вбок капля просто не успевала выйти из силуэта. */
  function reachTo(u, r, dx, dy, d, near) {
    u.mode = 'reach';
    u.wait = idleWait();
    u.size.k = 200;
    u.size.c = 24;
    u.eyeOpen = 0;

    const ux = d > 0.01 ? dx / d : 0;
    const uy = d > 0.01 ? dy / d : -1;

    /* Капля не может уйти дальше, чем на 62% своего радиуса за край:
       за этим пределом плёнка goo перестаёт мостить разрыв и капля
       читается как отдельный кружок. Раньше по вертикали выходило
       92 px от центра при радиусе 25 — она и отрывалась.

       Вбок капля всё равно уходит дальше, потому что там дальше сам
       край: у кнопки 181x53 до бокового края 90 px, до верхнего 26.
       Наружу же она высовывается одинаково со всех сторон. */
    const edge = edgeAlong(r, ux, uy);
    const dropR = DROP_R * Math.max(0.2, u.size.target) * 0.86;
    const out = Math.min(d, OUT_MAX) * near;
    const reach = edge + Math.min(out, dropR * 0.62);

    u.pos.set(ux * reach, uy * reach);
    u.size.target = 0.45 + near * 0.55;
    u.lean.set(ux * near * 7, uy * near * 7);
  }

  function dive(u, dt) {
    u.wait -= dt;
    u.pos.set(0, 0);
    u.size.target = 0;
    u.lean.set(0, 0);
    u.eyeOpen = 0;

    if (u.wait <= 0) {
      u.mode = 'idle';
      u.wait = idleWait();
      u.size.k = 200;
      u.size.c = 24;
    }
  }

  /* ── Жизнь в покое ───────────────────────────────────────
     Пока руки нет, из верхнего края кнопки поднимается голова,
     ведёт из стороны в сторону и уходит обратно. Смысл в том,
     что кнопка ждёт, а не выключена. */

  function idleLife(u, dt, r) {
    u.wait -= dt;

    if (u.mode === 'reach') { u.mode = 'idle'; u.wait = idleWait(); }

    const lift = -(r.height / 2 + DROP_R * 0.55);

    switch (u.mode) {
      case 'peek':
        u.size.target = 0.66;
        u.pos.set(0, lift);
        u.eyeOpen = 1;
        if (u.wait <= 0) {
          u.mode = 'look';
          /* Сколько взглядов успеет сделать — тоже вразнобой:
             иногда один, иногда четыре */
          u.wait = 1.8 + Math.random() * 3.4;
          u.glanceIn = 0;
        }
        break;

      case 'look': {
        /* Взгляд не описывает круг по расписанию, а перескакивает:
           выбирает случайное направление, держит его случайное время
           и переводит дальше. Иногда вбок, иногда вверх, иногда по
           диагонали — потому что угол берётся из всей окружности. */
        u.glanceIn -= dt;
        if (u.glanceIn <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const far = 0.4 + Math.random() * 0.6;
          /* По вертикали размах меньше: глаз в голове ходит
             в приплюснутом поле, а не в круге */
          u.gaze.set(Math.cos(angle) * far, Math.sin(angle) * far * 0.62);
          u.glanceIn = 0.45 + Math.random() * 1.3;
        }

        u.size.target = 0.66;
        /* Голова тянется за взглядом, но слабее его: сначала глаза,
           потом уже сама повернулась */
        u.pos.set(u.gaze.x.value * 26, lift + u.gaze.y.value * 8);
        u.lean.set(u.gaze.x.value * 3, -2);
        u.eyeOpen = 1;

        if (u.wait <= 0) { u.mode = 'retract'; u.wait = 1.2; }
        break;
      }

      case 'retract':
        u.size.target = 0;
        u.pos.set(0, 0);
        u.lean.set(0, 0);
        u.gaze.set(0, 0);
        u.eyeOpen = 0;
        if (u.wait <= 0) { u.mode = 'idle'; u.wait = idleWait(); }
        break;

      default:
        u.size.target = 0;
        u.pos.set(0, 0);
        u.lean.set(0, 0);
        u.eyeOpen = 0;
        if (u.wait <= 0) { u.mode = 'peek'; u.wait = 1; }
    }
  }

  function render(u) {
    const s = Math.max(0, u.size.value);
    const x = u.pos.x.value;
    const y = u.pos.y.value;

    u.drop.style.transform =
      'translate3d(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px, 0) scale(' + (s * 0.86).toFixed(3) + ')';

    /* Глаза едут вместе с головой и открываются только когда она
       снаружи: в тянущейся капле глаз быть не должно */
    u.eyes.style.opacity = (u.eyeOpen * Math.min(1, s / 0.5)).toFixed(3);
    u.eyes.style.transform =
      'translate3d(' + x.toFixed(2) + 'px, ' + y.toFixed(2) + 'px, 0) scale(' + Math.max(0.2, s).toFixed(3) + ')';
    u.eyes.style.setProperty('--gaze-x', u.gaze.x.value.toFixed(3));
    u.eyes.style.setProperty('--gaze-y', u.gaze.y.value.toFixed(3));

    u.el.style.transform =
      'translate3d(' + u.lean.x.value.toFixed(2) + 'px, ' + u.lean.y.value.toFixed(2) + 'px, 0) scale(' + u.press + ')';

    /* Подпись сдвигается втрое слабее тела: поверхность кнопки
       тянется, а буквы по ней едут, а не приклеены намертво */
    u.text.style.transform =
      'translate3d(' + (u.lean.x.value / 3).toFixed(2) + 'px, ' + (u.lean.y.value / 3).toFixed(2) + 'px, 0)';
  }
}

/* Голова снаружи — значит её видно и есть чему нырять */
function headIsOut(u) {
  return (u.mode === 'peek' || u.mode === 'look' || u.mode === 'retract') && u.size.value > 0.08;
}

/* Расстояние от центра прямоугольника до края в заданную сторону */
function edgeAlong(r, ux, uy) {
  const a = r.width / 2;
  const b = r.height / 2;
  const tx = Math.abs(ux) > 1e-3 ? a / Math.abs(ux) : Infinity;
  const ty = Math.abs(uy) > 1e-3 ? b / Math.abs(uy) : Infinity;
  return Math.min(tx, ty);
}

/* Пауза между показами — вразнобой, чтобы кнопка не тикала
   как метроном */
function idleWait() {
  return 9 + Math.random() * 11;
}

/* Фильтр живёт в одном скрытом SVG на документ: несколько копий
   одного id ломают ссылку url(#goo) в части браузеров. */
function injectFilter() {
  if (document.getElementById('goo')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'goo-defs');
  svg.setAttribute('aria-hidden', 'true');
  /* Область фильтра щедрая: капля уходит далеко за габарит кнопки,
     и по умолчанию её обрезало бы вместе с размытием */
  svg.innerHTML = `
    <defs>
      <filter id="goo" x="-130%" y="-260%" width="360%" height="620%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur"/>
        <feColorMatrix in="blur" type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="goo"/>
        <feBlend in="SourceGraphic" in2="goo"/>
      </filter>
    </defs>`;
  document.body.append(svg);
}
