/* Физика интро.

   Шарик выкатывается слева. Сверху падает ERIPOV и встаёт у него на
   пути — шарик ударяется и отлетает назад. На обратном ходу перед
   ним падает знак, шарик ударяется и об него. Дальше обе половины
   начинают сходиться, шарик оказывается зажат и частит между ними
   всё чаще, пока места не остаётся: щель между половинами в финале
   равна его диаметру. Он и есть точка, на неё и оседает.

   Модуль намеренно чистый и без DOM: состояние на любой момент
   считается прогоном от нуля с фиксированным шагом. Это позволяет
   проверить хореографию прогоном, а не разглядыванием кадров —
   на прошлой версии я именно разглядывал и не увидел, что слова
   не падают вовсе.

   Все длины в em от кегля сцены, время в секундах. */

/* Геометрия замка. Те же доли, что в Lockup, продублированы здесь
   намеренно: модуль обязан считаться без React. */
const MARK_W = 0.75 * (483 / 300)
const GAP_MARK_DOT = 0.75 * 0.2
const DOT = 0.75 * 0.3
const GAP_DOT_TEXT = 0.75 * 0.16
const BALL = 0.75 * 0.64

/* Левый край ERIPOV в собранном замке. Он же правая стенка. */
const REST_X = MARK_W + GAP_MARK_DOT + DOT + GAP_DOT_TEXT

/* Центр точки: сюда шарик обязан прийти */
export const BALL_HOME_CX = MARK_W + GAP_MARK_DOT + DOT / 2

/* Насколько далеко половины ждут до смыкания. Числа подобраны
   прогоном, а не на глаз: при первом наборе шарик не доезжал до
   правой стенки за свой запас хода и не ударялся об неё вовсе. */
const MARK_FAR = -1.05
const REST_FAR = 0.95

/* Откуда выкатывается шарик и с какой скоростью.

   Старт числом не задать: замок стоит по центру окна, и его левый
   край на широком экране далеко от края экрана. Прежние -5em при
   кегле 4.6rem давали -368 px, а до края окна оставалось около 490 —
   шар начинал катиться прямо в кадре, и это было видно. Поэтому
   стартовая точка приходит снаружи, посчитанная из ширины окна. */
const START_V = 8.2

let startCx = -5

/* Насколько левее края окна стоит шар до выката. Полтора диаметра —
   чтобы он успел набрать вид качения ещё за кадром. */
export function setStart(lockupLeftPx: number, fontPx: number) {
  const offEdge = (lockupLeftPx + fontPx * BALL * 1.5) / fontPx
  startCx = -offEdge
}


/* Трение качения и упругость удара. Подобраны так, чтобы первый
   отскок был заметным, а дробь в конце — затухающей. */
const FRICTION = 0.62
const RESTITUTION = 0.66

/* Пауза в начале: пустой бумажный экран, и только потом выкатывается
   шар. Без неё сцена начиналась одновременно с появлением страницы и
   первый кусок выката пропадал за первым кадром. */
export const LEAD = 0.55

/* Половины ждут выше экрана, а не в кадре. На -3.6em они висели в
   поле зрения и было видно, как они возникают, а потом падают. */
const DROP_FROM = -11

export const T = {
  restDrop: LEAD + 0.95,
  markDrop: LEAD + 1.75,
  drop: 0.34,
  close: LEAD + 2.4,
  closeDur: 1.25,
  settle: LEAD + 4,
  settleDur: 0.85,
}

export const INTRO_END = T.settle + T.settleDur

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/* Плавный вход и выход. Для падения нужна обратная кривая: разгон
   вниз, а не торможение. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const easeIn = (t: number) => t * t * t

/* Смещение половины от её домашнего места */
function offsets(t: number) {
  const closing = easeOut(clamp01((t - T.close) / T.closeDur))
  return {
    mark: MARK_FAR * (1 - closing),
    rest: REST_FAR * (1 - closing),
  }
}

/* Падение сверху. До своего момента половина ещё не в кадре. */
function drops(t: number) {
  const kRest = clamp01((t - T.restDrop) / T.drop)
  const kMark = clamp01((t - T.markDrop) / T.drop)
  return {
    restY: DROP_FROM * (1 - easeIn(kRest)),
    markY: DROP_FROM * (1 - easeIn(kMark)),
    restIn: t >= T.restDrop,
    markIn: t >= T.markDrop,
    /* Стенка появляется только когда половина коснулась строки:
       до этого бить не обо что */
    restSolid: kRest >= 1,
    markSolid: kMark >= 1,
  }
}

export type Frame = {
  markX: number
  markY: number
  restX: number
  restY: number
  ballCx: number
  ballScale: number
  ballDrop: number
  ballSpin: number
  ballVisible: boolean
  dotVisible: boolean
  hits: number
}

const DT = 1 / 240

/* Состояние на момент t. Прогон от нуля: шаг фиксированный, поэтому
   результат не зависит от частоты кадров экрана. */
export function frameAt(t: number): Frame {
  let cx = startCx
  let v = START_V
  let spin = 0
  let hits = 0

  /* Физика идёт от конца паузы и до начала оседания. Дальше шарик
     уже никуда не бьётся, он садится, и вести дробь под уменьшение
     незачем. */
  const tSim = Math.min(t, T.settle)
  const steps = Math.max(0, Math.floor((tSim - LEAD) / DT))

  for (let i = 0; i < steps; i++) {
    const now = LEAD + i * DT
    const d = drops(now)
    const o = offsets(now)

    v *= Math.exp(-FRICTION * DT)
    cx += v * DT
    spin += (v * DT) / (Math.PI * BALL)

    const r = BALL / 2
    const left = MARK_W + o.mark
    const right = REST_X + o.rest

    if (d.markSolid && cx - r < left) {
      cx = left + r
      if (v < 0) {
        v = -v * RESTITUTION
        hits++
      }
    }

    if (d.restSolid && cx + r > right) {
      cx = right - r
      if (v > 0) {
        v = -v * RESTITUTION
        hits++
      }
    }
  }

  const d = drops(t)
  const o = offsets(t)

  const k = easeOut(clamp01((t - T.settle) / T.settleDur))

  /* Зажатый шарик стоит чуть левее центра точки: щель между
     половинами шире точки, и её середина не совпадает с середипой
     точки. Доводим на оседании, а не подгоняем зазоры. */
  const settledCx = cx + (BALL_HOME_CX - cx) * k

  /* Уменьшается вниз, а не к своему центру: низ обязан опуститься
     на базовую линию, где и стоит точка. Точка отсчёта масштаба
     стоит по низу, поэтому здесь остаётся только пройти разницу
     между низом шарика и базовой линией. */
  const scale = 1 + (DOT / BALL - 1) * k
  const ballDrop = ((0.75 - BALL) / 2) * k

  return {
    markX: o.mark,
    markY: d.markY,
    restX: o.rest,
    restY: d.restY,
    ballCx: settledCx,
    ballScale: scale,
    ballDrop,
    ballSpin: spin * 360,
    ballVisible: t < INTRO_END - 0.02,
    dotVisible: t >= INTRO_END - 0.06,
    hits,
  }
}

export const geom = {
  markW: MARK_W,
  restX: REST_X,
  ball: BALL,
  dot: DOT,
}
