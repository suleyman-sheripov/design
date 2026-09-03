/* Интро первого экрана.

   Шарик медленно выкатывается слева. Ему в путь падает S, он
   ударяется и откатывается назад. Пока катится обратно, перед ним
   падает H. Буквы упали далеко друг от друга и начинают сходиться,
   увозя замок на его место; шарик зажат между ними и стучит об обе
   стенки всё чаще и короче. В момент схлопывания буквы подменяются
   знаком Ш, а шарик садится точкой.

   Геометрия замка не задана числами, а считается из метрик шрифта:
   высота знака равна высоте прописных, низ знака и низ точки садятся
   на базовую линию текста. Поэтому Ш не может оказаться выше или
   ниже ERIPOV ни при каком кегле. */

const SCENE_H = 150;    // совпадает с .intro-scene в hero.css
const TEXT_TOP = 50;    // .intro-rest / .intro-glyph top в hero.css
const MARK_RATIO = 483 / 300;

/* Отступы внутри замка — доли высоты прописных, а не пиксели:
   при смене кегля ритм остаётся тем же */
const GAP_MARK_DOT = 0.20;
const GAP_DOT_TEXT = 0.16;
const REST_SLIDE = 26;  // на сколько ERIPOV выезжает из-за знака

/* Шарик и точка тоже доли высоты прописных */
const BALL_RATIO = 0.78;
const DOT_RATIO = 0.30;

/* Старт за левым краем сцены: .intro обрезает всё, что левее нуля */
const BALL_START = -90;

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
  const g = {
    ballSize: 33, dotSize: 13, lockupW: 450, ballTop: 60,
    dotX: 90, restX: 130,
    hX: 60, sX: 190, hEnd: 0, sEnd: 46,
    ballStop: 155, ballBack: 119, ballTrap: 43,
  };

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

  /* ── Геометрия ─────────────────────────────────────────── */

  function layout() {
    const cs = getComputedStyle(rest);
    const size = parseFloat(cs.fontSize);
    const m = measure(cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, 'ERIPOV');

    /* Высота прописных — от базовой линии до верха реальных очертаний.
       Для строки из одних заглавных это ровно cap height. */
    const capH = m.capH || size * 0.75;
    const baseline = TEXT_TOP + m.baselineFromTop;

    const markW = capH * MARK_RATIO;
    markSvg.style.width = markW.toFixed(1) + 'px';
    markSvg.style.height = capH.toFixed(1) + 'px';

    g.ballSize = capH * BALL_RATIO;
    g.dotSize = capH * DOT_RATIO;
    sizeSquare(ball, g.ballSize);
    sizeSquare(dot, g.dotSize);

    /* Низ знака и низ точки садятся на базовую линию текста */
    place(mark, 0, baseline - capH);
    g.dotX = markW + capH * GAP_MARK_DOT;
    place(dot, g.dotX, baseline - g.dotSize);

    g.restX = g.dotX + g.dotSize + capH * GAP_DOT_TEXT;
    place(rest, g.restX - REST_SLIDE);
    g.lockupW = g.restX + rest.offsetWidth;

    /* Шарик едет по середине прописных */
    g.ballTop = baseline - capH / 2 - g.ballSize / 2;
    place(ball, BALL_START, g.ballTop);

    /* У букв по две координаты: куда упали и куда пришли. Падают
       далеко друг от друга, сходятся — и этим сдвигом увозят
       собранный замок к левому краю. */
    const hW = gH.offsetWidth;
    g.hEnd = 0;
    g.sEnd = hW + 6;
    g.hX = g.hEnd + 62;
    g.sX = g.sEnd + 148;

    g.ballStop = g.sX - g.ballSize - 2;   // упирается в левый край S
    g.ballBack = g.ballStop - 38;         // отскок назад влево
    g.ballTrap = g.hEnd + hW + 3;         // стенка, у которой его зажимает

    place(gH, g.hX);
    place(gS, g.sX);
  }

  function onResize() { layout(); fit(); if (reduce || seen) settle(); }

  /* Масштабируем по ширине собранного замка, а не всей сцены:
     хвост сцены — разгон для шарика, он всегда за краем. */
  function fit() {
    const room = scene.parentElement.clientWidth || g.lockupW;
    const s = Math.min(1, room / g.lockupW);
    scene.style.transform = 'scale(' + s + ')';
    scene.parentElement.style.height = Math.round(SCENE_H * s) + 'px';
  }

  function sizeSquare(el, px) {
    el.style.width = px.toFixed(1) + 'px';
    el.style.height = px.toFixed(1) + 'px';
  }

  function place(el, x, y) {
    el.style.left = x + 'px';
    if (y != null) el.style.top = y + 'px';
  }

  function settle() {
    ball.style.opacity = '0';
    gS.style.opacity = '0';
    gH.style.opacity = '0';
    mark.style.opacity = '1';
    dot.style.opacity = '1';
    rest.style.opacity = '1';
    rest.style.transform = 'translateX(' + REST_SLIDE + 'px)';
  }

  /* ── Сборка ────────────────────────────────────────────── */

  function play() {
    /* Шарик двигается трансформой от точки старта, поэтому все
       позиции переводятся в смещение. Угол берётся из пройденного
       пути и длины окружности — он катится, а не скользит. */
    const at = x => x - BALL_START;
    const spin = x => (at(x) / (Math.PI * g.ballSize)) * 360;
    const roll = (x) => 'translateX(' + at(x).toFixed(1) + 'px) rotate(' + spin(x).toFixed(1) + 'deg)';

    const ballCx = BALL_START + g.ballSize / 2;
    const ballCy = g.ballTop + g.ballSize / 2;
    const dotCx = g.dotX + g.dotSize / 2;
    const dotCy = parseFloat(dot.style.top) + g.dotSize / 2;

    const anims = [];
    const run = (el, frames, opts) => {
      const a = el.animate(frames, Object.assign({ fill: 'both', easing: 'linear' }, opts));
      anims.push(a);
      return a;
    };

    // 1. Шарик медленно выкатывается из левого края
    run(ball, [
      { transform: roll(BALL_START) },
      { transform: roll(g.ballStop) },
    ], { duration: 1400, easing: EASE_ROLL });

    // 2. Прямо перед ним быстро падает S
    run(gS, [
      { transform: 'translateY(-280px)', opacity: 0, offset: 0 },
      { transform: 'translateY(-280px)', opacity: 1, offset: 0.04 },
      { transform: 'translateY(0)',      opacity: 1, offset: 1 },
    ], { duration: 240, delay: 1160, easing: EASE_FALL });

    // 3. Удар: шарик откатывается назад, S вздрагивает
    run(ball, [
      { transform: roll(g.ballStop) },
      { transform: roll(g.ballBack) },
    ], { duration: 220, delay: 1400, easing: EASE_OUT });

    run(gS, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(9px)' },
      { transform: 'translateX(0)' },
    ], { duration: 230, delay: 1400, easing: EASE_OUT });

    // 4. Пока катится обратно, перед ним падает H
    run(gH, [
      { transform: 'translateY(-280px)', opacity: 0, offset: 0 },
      { transform: 'translateY(-280px)', opacity: 1, offset: 0.04 },
      { transform: 'translateY(0)',      opacity: 1, offset: 1 },
    ], { duration: 250, delay: 1520, easing: EASE_FALL });

    // 5. Буквы сходятся и этим же движением увозят замок влево
    run(gH, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(' + (g.hEnd - g.hX) + 'px)' },
    ], { duration: 340, delay: 1790, easing: EASE_OUT });

    run(gS, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(' + (g.sEnd - g.sX) + 'px)' },
    ], { duration: 340, delay: 1790, easing: EASE_OUT });

    // 6. Дробь: стенки сходятся, шарик бьётся об обе всё чаще и
    //    короче. Амплитуды затухают, поэтому слышно «тык-тык-тык».
    const knocks = [0.66, -0.47, 0.32, -0.2, 0.12, -0.06, 0];
    run(ball, [
      { transform: roll(g.ballBack), offset: 0 },
      ...knocks.map((k, i) => ({
        transform: roll(g.ballTrap + k * 44),
        offset: (i + 1) / (knocks.length + 1),
      })),
      { transform: roll(g.ballTrap), offset: 1 },
    ], { duration: 640, delay: 1830 });

    // 7. Держать шарика больше нечем — выстреливает вверх и садится точкой
    run(ball, [
      { transform: roll(g.ballTrap) + ' translateY(0) scale(1)', offset: 0 },
      { transform: roll(g.ballTrap) + ' translateY(-4px) scale(.74,1.24)', offset: 0.14 },
      { transform: 'translateX(' + (dotCx - ballCx).toFixed(1) + 'px) translateY(-92px) scale(.62)', offset: 0.58 },
      { transform: 'translateX(' + (dotCx - ballCx).toFixed(1) + 'px) translateY(' + (dotCy - ballCy).toFixed(1) + 'px) scale(' + (g.dotSize / g.ballSize).toFixed(3) + ')', offset: 1 },
    ], { duration: 470, delay: 2470, easing: EASE_OUT });

    run(ball, [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: 2936 });

    // 8. Подмена спрятана в схлопывании: буквы гаснут за 130,
    //    знак встаёт за 190 — шва не видно
    run(gS, [{ opacity: 1 }, { opacity: 0 }], { duration: 130, delay: 2400 });
    run(gH, [{ opacity: 1 }, { opacity: 0 }], { duration: 130, delay: 2400 });

    run(mark, [
      { opacity: 0, transform: 'scale(.88)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: 190, delay: 2420, easing: EASE_OUT });

    // 9. Точка приземляется
    run(dot, [
      { opacity: 0, transform: 'scale(1.4)' },
      { opacity: 1, transform: 'scale(1)' },
    ], { duration: 170, delay: 2900, easing: EASE_OUT });

    // 10. ERIPOV выезжает из-за знака
    run(rest, [
      { opacity: 0, transform: 'translateX(0)' },
      { opacity: 1, transform: 'translateX(' + REST_SLIDE + 'px)' },
    ], { duration: 380, delay: 2620, easing: EASE_OUT });

    return Promise.all(anims.map(a => a.finished.catch(() => {})));
  }
}

/* Метрики строки: высота прописных и положение базовой линии
   внутри строчного бокса при line-height: 1. */
function measure(font, text) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = font;
  const m = ctx.measureText(text);
  const size = parseFloat((font.match(/(\d+(?:\.\d+)?)px/) || [])[1] || '16');
  const ascent = m.fontBoundingBoxAscent || size * 0.8;
  const descent = m.fontBoundingBoxDescent || size * 0.2;
  return {
    capH: m.actualBoundingBoxAscent || 0,
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
