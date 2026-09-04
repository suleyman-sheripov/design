/* Интро первого экрана.

   Пустая страница. Слева выкатывается зелёный шарик. Перед ним
   возникает вторая половина имени — ERIPOV. Шарик ударяется об неё
   и катится обратно; на обратном ходу перед ним встаёт первая
   половина — знак Ш. Шарик ударяется и об неё, после чего обе
   половины начинают смыкаться, а шарик частит между ними, пока
   места не остаётся. Он и есть точка в «Ш.ERIPOV» — на неё и
   садится. Дальше по одному проявляются блоки первого экрана.

   Геометрия замка не задана числами, а считается из метрик шрифта:
   высота знака равна высоте прописных, низ знака и низ точки садятся
   на базовую линию текста. Поэтому Ш не может оказаться выше или
   ниже ERIPOV ни при каком кегле. */

const SCENE_H = 118;   // совпадает с .intro-scene в hero.css
const TEXT_TOP = 38;   // .intro-rest top в hero.css
const MARK_RATIO = 483 / 300;

/* Отступы внутри замка — доли высоты прописных, а не пиксели:
   при смене кегля ритм остаётся тем же */
const GAP_MARK_DOT = 0.20;
const GAP_DOT_TEXT = 0.16;

/* Шарик и точка тоже доли высоты прописных */
const BALL_RATIO = 0.64;
const DOT_RATIO = 0.30;


/* Насколько далеко половины стоят до смыкания */
const FAR_RIGHT = 175;
const FAR_LEFT = 96;

const SESSION_KEY = 'intro-seen';

const EASE_ROLL = 'cubic-bezier(.15,.62,.36,1)';
const EASE_FALL = 'cubic-bezier(.55,.06,.68,.19)';
const EASE_OUT  = 'cubic-bezier(.16,1,.3,1)';

export function initIntro(root) {
  const scene = root.querySelector('#introScene');
  if (!scene) return { done: Promise.resolve() };

  const ball = root.querySelector('#introBall');
  const mark = root.querySelector('#introMark');
  const dot  = root.querySelector('#introDot');
  const rest = root.querySelector('#introRest');
  const markSvg = mark.querySelector('svg');

  let curtain = null;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = sessionRead(SESSION_KEY);

  /* Считается в layout(), используется в play() */
  const g = {
    ballSize: 33, dotSize: 13, lockupW: 450, ballTop: 60,
    markW: 68, dotX: 90, restX: 130, shiftY: 0, ballStart: -90,
    markFar: -96, restFar: 305,
    hitRest: 240, backOff: 195, hitMark: 60,
  };

  layout();
  fit();
  addEventListener('resize', onResize, { passive: true });
  /* Первый расчёт идёт на подменном шрифте — пересчитываем, когда придёт свой */
  if (document.fonts?.ready) document.fonts.ready.then(() => {
    if (curtain) return;   // интро пересчитает само, когда будет готово
    layout();
    fit();
  });

  if (reduce || seen) {
    settle();
    return { done: Promise.resolve() };
  }

  sessionWrite(SESSION_KEY, '1');
  /* Предел на всё интро. Застрять может что угодно — шрифт, кадр,
     фоновая вкладка, — но занавес обязан уйти в любом случае. */
  return { done: Promise.race([run(), pause(8000).then(rescue)]) };

  function rescue() {
    if (!curtain) return;
    settle();
    exitCurtain();
  }

  /* ── Занавес ───────────────────────────────────────────────
     Интро идёт во весь экран по центру, а не в углу шапки:
     в коробке шириной 290 px это читалось как виджет, а не как
     титры. Когда замок собран, он уезжает и уменьшается на своё
     место в шапке, занавес гаснет, и только тогда начинает
     собираться первый экран. */

  async function run() {
    /* Порядок здесь и был причиной «шарик уже стоит посередине».
       Между поднятием занавеса и приходом шрифта браузер успевает
       нарисовать кадр. На подменном шрифте ширина замка другая,
       значит другие и масштаб, и точка старта — а когда шрифт
       приходит, всё пересчитывается, и шарик телепортируется.
       Поэтому до готовности геометрии сцена не показывается вовсе. */
    enterCurtain();

    /* Застрявший шрифт не должен держать интро вечно */
    if (document.fonts?.ready) await Promise.race([document.fonts.ready, pause(1500)]);
    layout();
    placeCurtain();

    /* Даём кадр на применение новой геометрии, и только потом
       показываем сцену: иначе первый показ снова придётся на старую */
    await frame();
    scene.classList.add('is-ready');
    await frame();

    await play();
    await flyHome();
    exitCurtain();
  }

  function enterCurtain() {
    curtain = document.createElement('div');
    curtain.className = 'curtain';
    curtain.setAttribute('aria-hidden', 'true');
    document.body.append(curtain);
    document.documentElement.classList.add('is-intro');

    scene.classList.add('is-curtain');
    placeCurtain();
  }

  /* Считается отдельно от fit(): пока идёт занавес, сцена живёт в
     координатах окна, а не шапки. Пересчёт после загрузки шрифта
     раньше затирал эту трансформу домашней, и замок улетал в угол
     со scale(1). */
  function placeCurtain() {
    /* Масштаб от ширины окна, но не больше, чем влезает по высоте:
       на низком окне замок иначе упрётся в края */
    const byWidth = (innerWidth * 0.62) / g.lockupW;
    const capH = parseFloat(markSvg.style.height) || 42;
    const byHeight = (innerHeight * 0.3) / capH;
    const K = Math.max(1, Math.min(byWidth, byHeight, 3));

    const L = innerWidth / 2 - (g.lockupW / 2) * K;
    const T = innerHeight / 2 - (SCENE_H / 2) * K;

    /* Шарик должен заезжать из-за края экрана, а не появляться
       в кадре: старт считается от того, где этот край оказался */
    g.ballStart = -(L / K) - 110;
    place(ball, g.ballStart, g.ballTop);

    scene.style.transform = 'translate(' + L.toFixed(1) + 'px, ' + T.toFixed(1) + 'px) scale(' + K.toFixed(4) + ')';
  }

  /* Замок уезжает на своё место в шапке. Летит трансформой, а не
     сменой положения: layout в каждом кадре здесь не нужен.
     Домашнюю точку меряем сейчас, а не на входе: к этому моменту
     шрифт уже пришёл и коробка шапки встала окончательно. */
  function flyHome() {
    const box = scene.parentElement.getBoundingClientRect();
    const s = Math.min(1, (scene.parentElement.clientWidth || g.lockupW) / g.lockupW);

    const from = scene.style.transform;
    const to = 'translate(' + box.left.toFixed(1) + 'px, ' + box.top.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';

    const fly = scene.animate(
      [{ transform: from }, { transform: to }],
      { duration: 820, delay: 320, easing: EASE_OUT, fill: 'both' },
    );

    curtain.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 460, delay: 560, easing: 'linear', fill: 'both' },
    );

    return fly.finished.catch(() => {});
  }

  function exitCurtain() {
    scene.classList.remove('is-curtain', 'is-ready');
    scene.getAnimations().forEach(a => a.cancel());
    document.documentElement.classList.remove('is-intro');
    curtain?.remove();
    curtain = null;
    g.ballStart = -90;
    fit();
  }

  /* ── Геометрия ─────────────────────────────────────────── */

  function layout() {
    const cs = getComputedStyle(rest);
    const size = parseFloat(cs.fontSize);
    const m = measure(cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily, 'ERIPOV');

    /* Высота прописных — от базовой линии до верха реальных очертаний.
       Для строки из одних заглавных это ровно cap height. */
    const capH = m.capH || size * 0.75;
    const baseline = TEXT_TOP + m.baselineFromTop;

    g.markW = capH * MARK_RATIO;
    markSvg.style.width = g.markW.toFixed(1) + 'px';
    markSvg.style.height = capH.toFixed(1) + 'px';

    g.ballSize = capH * BALL_RATIO;
    g.dotSize = capH * DOT_RATIO;
    sizeSquare(ball, g.ballSize);
    sizeSquare(dot, g.dotSize);

    /* Низ знака и низ точки садятся на базовую линию текста */
    place(mark, 0, baseline - capH);
    g.dotX = g.markW + capH * GAP_MARK_DOT;
    place(dot, g.dotX, baseline - g.dotSize);

    g.restX = g.dotX + g.dotSize + capH * GAP_DOT_TEXT;
    place(rest, g.restX);
    g.lockupW = g.restX + rest.offsetWidth;

    /* Шарик едет по середине прописных */
    g.ballTop = baseline - capH / 2 - g.ballSize / 2;
    place(ball, g.ballStart, g.ballTop);

    /* До смыкания половины стоят врозь. У знака отрицательная
       координата — он ждёт за левым краем и выходит оттуда. */
    g.restFar = g.restX + FAR_RIGHT;
    g.markFar = -(g.markW + FAR_LEFT);

    g.hitRest = g.restFar - g.ballSize - 2;   // упирается в ERIPOV
    g.backOff = g.hitRest - 74;               // откат влево
    g.hitMark = g.markFar + g.markW + 2;      // упирается в знак
  }

  function onResize() {
    if (curtain) return;   // менять размер посреди интро нечего
    layout();
    fit();
    if (reduce || seen) settle();
  }

  /* Масштабируем по ширине собранного замка, а не всей сцены:
     хвост сцены — разгон для шарика, он всегда за краем. */
  function fit() {
    if (curtain) return placeCurtain();

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
    mark.style.opacity = '1';
    mark.style.transform = 'none';
    dot.style.opacity = '1';
    rest.style.opacity = '1';
    rest.style.transform = 'none';
  }

  /* ── Сборка ────────────────────────────────────────────── */

  function play() {
    /* Шарик двигается трансформой от точки старта, поэтому все
       позиции переводятся в смещение. Угол берётся из пройденного
       пути и длины окружности — он катится, а не скользит. */
    const at = x => x - g.ballStart;
    const roll = x =>
      'translateX(' + at(x).toFixed(1) + 'px) rotate(' +
      ((at(x) / (Math.PI * g.ballSize)) * 360).toFixed(1) + 'deg)';

    const ballCx = g.ballStart + g.ballSize / 2;
    const ballCy = g.ballTop + g.ballSize / 2;
    const dotCx = g.dotX + g.dotSize / 2;
    const dotCy = parseFloat(dot.style.top) + g.dotSize / 2;

    const anims = [];

    /* fill: forwards, а НЕ both — и это здесь главное.

       Шаги идут цепочкой с задержками. При fill: both анимация
       применяет свой первый кадр ещё до собственного старта, а более
       поздняя в стопке перебивает раннюю. В итоге с нулевой секунды
       побеждал последний шаг, и шарик стоял на финальном месте всё
       интро: движение было, но его никто не видел — сверху лежала
       заливка будущего кадра.

       При forwards анимация до старта не влияет ни на что, а после
       конца держит последний кадр. Ровно та передача эстафеты,
       которая цепочке и нужна. */
    const run = (el, frames, opts) => {
      const a = el.animate(frames, Object.assign({ fill: 'forwards', easing: 'linear' }, opts));
      anims.push(a);
      return a;
    };

    /* Шарик сразу едет туда, где ему и место — в точку между
       половинами. Никаких отскоков и дроби: движение одно, и оно
       читается с первого раза. */
    const home = dotCx - g.ballSize / 2;

    // 1. Выкатывается слева и останавливается на своём месте
    run(ball, [
      { transform: roll(g.ballStart) },
      { transform: roll(home) },
    ], { duration: 1200, easing: EASE_ROLL });

    /* Обе половины уже стоят на финальных left, поэтому дальняя
       позиция задаётся смещением, а смыкание — возвратом в ноль. */
    const restOff = g.restFar - g.restX;   // ERIPOV ждёт справа
    const markOff = g.markFar;             // знак ждёт за левым краем

    // 2. Справа сверху падает вторая половина имени
    run(rest, [
      { transform: 'translate(' + restOff.toFixed(1) + 'px, -220px)', opacity: 0, offset: 0 },
      { transform: 'translate(' + restOff.toFixed(1) + 'px, -220px)', opacity: 1, offset: 0.05 },
      { transform: 'translate(' + restOff.toFixed(1) + 'px, 0)',      opacity: 1, offset: 1 },
    ], { duration: 260, delay: 1340, easing: EASE_FALL });

    // 3. Слева сверху падает первая половина — знак
    run(mark, [
      { transform: 'translate(' + markOff.toFixed(1) + 'px, -220px)', opacity: 0, offset: 0 },
      { transform: 'translate(' + markOff.toFixed(1) + 'px, -220px)', opacity: 1, offset: 0.05 },
      { transform: 'translate(' + markOff.toFixed(1) + 'px, 0)',      opacity: 1, offset: 1 },
    ], { duration: 260, delay: 1660, easing: EASE_FALL });

    // 4. Половины смыкаются вокруг шарика
    run(mark, [
      { transform: 'translateX(' + markOff.toFixed(1) + 'px)' },
      { transform: 'translateX(0)' },
    ], { duration: 620, delay: 2020, easing: EASE_OUT });

    run(rest, [
      { transform: 'translateX(' + restOff.toFixed(1) + 'px)' },
      { transform: 'translateX(0)' },
    ], { duration: 620, delay: 2020, easing: EASE_OUT });

    /* 5. Шарик медленно оседает в точку. Медленно — потому что это
       последнее движение сцены: на нём глаз и останавливается. */
    run(ball, [
      { transform: roll(home) + ' translateY(0) scale(1)' },
      {
        transform: 'translateX(' + (dotCx - ballCx).toFixed(1) + 'px) translateY(' +
          (dotCy - ballCy).toFixed(1) + 'px) scale(' + (g.dotSize / g.ballSize).toFixed(3) + ')',
      },
    ], { duration: 620, delay: 2720, easing: EASE_OUT });

    /* Подмена шарика на точку в самом конце: они одного размера
       и цвета, шва не видно */
    run(ball, [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: 3340 });
    run(dot, [{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: 3340 });

    return Promise.all(anims.map(a => a.finished.catch(() => {})));
  }
}

function pause(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/* В фоновой вкладке и в скрытой панели requestAnimationFrame не
   вызывается вовсе. Без страховки ожидание кадра подвешивает интро
   навсегда, и человек возвращается к пустой странице под занавесом. */
function frame() {
  return new Promise(res => {
    const bail = setTimeout(res, 120);
    requestAnimationFrame(() => { clearTimeout(bail); res(); });
  });
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
