/* Интро первого экрана.
   Шарик выкатывается справа, S падает ему в путь, H запирает сзади,
   схлопывание подменяет обе буквы знаком Ш, шарик становится точкой.

   Сцена размечена в логических пикселях и масштабируется целиком.
   Геометрия замка не задана числами, а считается из метрик шрифта:
   высота знака = высоте прописных, низ знака = базовой линии текста.
   Поэтому Ш никогда не окажется выше или ниже ERIPOV. */

const SCENE_H = 200;    // совпадает с .intro-scene в hero.css
const TEXT_TOP = 81;    // .intro-rest / .intro-glyph top в hero.css
const MARK_RATIO = 483 / 300;

/* Отступы внутри замка — доли высоты прописных, а не пиксели:
   при смене кегля ритм остаётся тем же */
const GAP_MARK_DOT = 0.20;
const GAP_DOT_TEXT = 0.16;
const REST_SLIDE = 26;  // на сколько ERIPOV выезжает из-за знака

const BALL_SIZE = 46;
const DOT_SIZE = 18;
const BALL_START = 780;

const SESSION_KEY = 'intro-seen';

const EASE_ROLL = 'cubic-bezier(.15,.62,.36,1)';
const EASE_FALL = 'cubic-bezier(.55,.06,.68,.19)';
const EASE_OUT  = 'cubic-bezier(.16,1,.3,1)';

export function initIntro(root) {
  const scene = root.querySelector('#introScene');
  if (!scene) return { done: Promise.resolve() };

  const ball = root.querySelector('#introBall');
  const gS   = root.querySelector('#introS');
  const gH   = root.querySelector('#introH');
  const mark = root.querySelector('#introMark');
  const dot  = root.querySelector('#introDot');
  const rest = root.querySelector('#introRest');
  const markSvg = mark.querySelector('svg');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = sessionRead(SESSION_KEY);

  /* Считается в layout(), используется в play() */
  const g = { lockupW: 450, ballTop: 87, ballStop: 60, ballBack: 82, dotX: 112, restX: 152, hX: 130, hEnd: 58 };

  layout();
  fit();
  addEventListener('resize', onResize, { passive: true });
  /* Первый расчёт идёт на подменном шрифте — пересчитываем, когда придёт свой */
  if (document.fonts?.ready) document.fonts.ready.then(() => { layout(); fit(); });

  if (reduce || seen) {
    settle();
    return { done: Promise.resolve() };
  }

  sessionWrite(SESSION_KEY, '1');
  return { done: play() };

  /* ── Геометрия ─────────────────────────────────────── */

  function layout() {
    const cs = getComputedStyle(rest);
    const size = parseFloat(cs.fontSize);
    const m = measure(`${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, 'ERIPOV');

    /* Высота прописных — расстояние от базовой линии до верха реальных
       очертаний. Для строки из одних заглавных это ровно cap height. */
    const capH = m.capH || size * 0.75;
    const baseline = TEXT_TOP + m.baselineFromTop;

    const markW = capH * MARK_RATIO;
    markSvg.style.width = `${markW.toFixed(1)}px`;
    markSvg.style.height = `${capH.toFixed(1)}px`;

    /* Низ знака и низ точки садятся на базовую линию текста */
    place(mark, 0, baseline - capH);
    g.dotX = markW + capH * GAP_MARK_DOT;
    place(dot, g.dotX, baseline - DOT_SIZE);

    g.restX = g.dotX + DOT_SIZE + capH * GAP_DOT_TEXT;
    place(rest, g.restX - REST_SLIDE);
    g.lockupW = g.restX + rest.offsetWidth;

    /* Шарик едет по середине прописных */
    g.ballTop = baseline - capH / 2 - BALL_SIZE / 2;
    place(ball, BALL_START, g.ballTop);

    /* S падает на место знака, H — позади шарика */
    place(gS, 0);
    g.ballStop = gS.offsetWidth + 6;
    g.ballBack = g.ballStop + 22;
    g.hEnd = gS.offsetWidth + 4;
    g.hX = g.hEnd + 72;
    place(gH, g.hX);
  }

  function onResize() { layout(); fit(); if (reduce || seen) settle(); }

  /* Масштабируем по ширине собранного замка, а не всей сцены:
     хвост сцены — разгон для шарика, он всегда за краем. */
  function fit() {
    const room = scene.parentElement.clientWidth || g.lockupW;
    const s = Math.min(1, room / g.lockupW);
    scene.style.transform = `scale(${s})`;
    scene.parentElement.style.height = `${Math.round(SCENE_H * s)}px`;
  }

  function place(el, x, y) {
    el.style.left = `${x}px`;
    if (y != null) el.style.top = `${y}px`;
  }

  function settle() {
    ball.style.opacity = '0';
    gS.style.opacity = '0';
    gH.style.opacity = '0';
    mark.style.opacity = '1';
    dot.style.opacity = '1';
    rest.style.opacity = '1';
    rest.style.transform = `translateX(${REST_SLIDE}px)`;
  }

  /* ── Сборка ────────────────────────────────────────── */

  function play() {
    const roll = g.ballStop - BALL_START;
    const turns = (roll / (Math.PI * BALL_SIZE)) * 360;   // качение, а не скольжение

    const ballCx = BALL_START + BALL_SIZE / 2;
    const ballCy = g.ballTop + BALL_SIZE / 2;
    const dotCx = g.dotX + DOT_SIZE / 2;
    const dotCy = parseFloat(dot.style.top) + DOT_SIZE / 2;

    const anims = [];
    const run = (el, frames, opts) => {
      const a = el.animate(frames, { fill: 'both', easing: 'linear', ...opts });
      anims.push(a);
      return a;
    };

    // 1. Шарик выкатывается справа
    run(ball, [
      { transform: 'translateX(0) rotate(0deg)' },
      { transform: `translateX(${roll}px) rotate(${turns.toFixed(1)}deg)` }
    ], { duration: 950, easing: EASE_ROLL });

    // 2. S падает ему в путь
    run(gS, [
      { transform: 'translateY(-260px)', opacity: 0, offset: 0 },
      { transform: 'translateY(-260px)', opacity: 1, offset: 0.05 },
      { transform: 'translateY(0)',      opacity: 1, offset: 1 }
    ], { duration: 270, delay: 640, easing: EASE_FALL });

    // 3. Удар: шарик отскакивает, S вздрагивает
    run(ball, [
      { transform: `translateX(${roll}px) rotate(${turns.toFixed(1)}deg)` },
      { transform: `translateX(${g.ballBack - BALL_START}px) rotate(${(turns + 30).toFixed(1)}deg)` }
    ], { duration: 180, delay: 950, easing: EASE_OUT });

    run(gS, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-10px)' },
      { transform: 'translateX(0)' }
    ], { duration: 210, delay: 950, easing: EASE_OUT });

    // 4. H падает сзади и запирает
    run(gH, [
      { transform: 'translateY(-260px)', opacity: 0, offset: 0 },
      { transform: 'translateY(-260px)', opacity: 1, offset: 0.05 },
      { transform: 'translateY(0)',      opacity: 1, offset: 1 }
    ], { duration: 250, delay: 1000, easing: EASE_FALL });

    // 5. Схлопывание
    run(gH, [
      { transform: 'translateX(0)' },
      { transform: `translateX(${g.hEnd - g.hX}px)` }
    ], { duration: 240, delay: 1240, easing: EASE_OUT });

    // 6. Шарика нечем удержать — выстреливает вверх и садится точкой
    run(ball, [
      { transform: `translateX(${g.ballBack - BALL_START}px) translateY(0) scale(1)`, offset: 0 },
      { transform: `translateX(${g.ballBack - BALL_START - 14}px) translateY(-6px) scale(.74,1.22)`, offset: 0.16 },
      { transform: `translateX(${dotCx - ballCx}px) translateY(-98px) scale(.62)`, offset: 0.6 },
      { transform: `translateX(${dotCx - ballCx}px) translateY(${(dotCy - ballCy).toFixed(1)}px) scale(${(DOT_SIZE / BALL_SIZE).toFixed(3)})`, offset: 1 }
    ], { duration: 430, delay: 1340, easing: EASE_OUT });

    run(ball, [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: 1768 });

    // 7. Подмена спрятана внутри удара: буквы гаснут за 120, знак встаёт за 180
    run(gS, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 1420 });
    run(gH, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, delay: 1420 });

    run(mark, [
      { opacity: 0, transform: 'scale(.86)' },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: 180, delay: 1440, easing: EASE_OUT });

    // 8. Точка приземляется
    run(dot, [
      { opacity: 0, transform: 'scale(1.45)' },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: 160, delay: 1745, easing: EASE_OUT });

    // 9. ERIPOV выезжает из-за знака
    run(rest, [
      { opacity: 0, transform: 'translateX(0)' },
      { opacity: 1, transform: `translateX(${REST_SLIDE}px)` }
    ], { duration: 340, delay: 1640, easing: EASE_OUT });

    return Promise.all(anims.map(a => a.finished.catch(() => {})));
  }
}

/* Метрики строки: высота прописных и положение базовой линии
   внутри строчного бокса при line-height: 1. */
function measure(font, text) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  const size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '16');
  const ascent = m.fontBoundingBoxAscent ?? size * 0.8;
  const descent = m.fontBoundingBoxDescent ?? size * 0.2;
  return {
    capH: m.actualBoundingBoxAscent ?? 0,
    baselineFromTop: (size - (ascent + descent)) / 2 + ascent,
  };
}

/* Приватный режим и заблокированные куки роняют sessionStorage на чтении */
function sessionRead(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function sessionWrite(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* не критично */ }
}
