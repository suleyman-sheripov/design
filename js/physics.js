/* Движок движения. Всё, что двигается на сайте, считается здесь.

   Причина такая: кривая Безье задаёт, как объект выглядит в пути,
   а пружина задаёт, почему он так идёт. У пружины есть натяжение,
   трение и масса, поэтому она промахивается мимо цели и возвращается,
   а при смене цели на полпути не дёргается, а доворачивает. Курсор,
   капля-симбиот и брошенная карточка ведут себя одинаково правдиво
   именно потому, что считаются одним и тем же кодом. */

/* Общий такт на весь сайт: один requestAnimationFrame вместо
   десятка независимых петель. */
const listeners = new Set();
let running = false;
let last = 0;

export function onTick(fn) {
  listeners.add(fn);
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
  return () => listeners.delete(fn);
}

function tick(now) {
  /* Вкладка была в фоне — не отдаём в физику полсекунды разом,
     иначе пружины взрываются. */
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;

  for (const fn of listeners) fn(dt);

  if (listeners.size) requestAnimationFrame(tick);
  else running = false;
}

/* ── Пружина ───────────────────────────────────────────────
   Полуявный метод Эйлера: скорость обновляется по силе,
   позиция — по уже новой скорости. Устойчив на шаге 1/60 и
   не требует подшагов до жёсткости в районе 400. */

export class Spring {
  constructor(value = 0, { stiffness = 170, damping = 22, mass = 1 } = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.k = stiffness;
    this.c = damping;
    this.m = mass;
  }

  step(dt) {
    const force = -this.k * (this.value - this.target) - this.c * this.velocity;
    this.velocity += (force / this.m) * dt;
    this.value += this.velocity * dt;
    return this.value;
  }

  /* Телепорт без замаха: для первого кадра и для resize */
  reset(value = this.target) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
  }

  get settled() {
    return Math.abs(this.velocity) < 0.02 && Math.abs(this.value - this.target) < 0.02;
  }
}

export class Spring2 {
  constructor(x = 0, y = 0, opts) {
    this.x = new Spring(x, opts);
    this.y = new Spring(y, opts);
  }

  set(x, y) {
    this.x.target = x;
    this.y.target = y;
  }

  step(dt) {
    this.x.step(dt);
    this.y.step(dt);
  }

  reset(x, y) {
    this.x.reset(x);
    this.y.reset(y);
  }

  get settled() { return this.x.settled && this.y.settled; }
}

/* ── Верле ─────────────────────────────────────────────────
   Позиционная схема: скорость не хранится, а выводится из
   разницы двух последних позиций. Столкновения решаются
   сдвигом позиций, и скорость пересчитывается сама. Поэтому
   куча логотипов не дрожит и не расползается, а лежит. */

export class Body {
  constructor(x, y, radius, mass = 1) {
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.r = radius;
    this.mass = mass;
    this.angle = 0;
    this.pinned = false;
  }

  /* Толчок в единицах «пикселей за кадр»: верле не знает сил,
     он знает только сдвиг предыдущей позиции. */
  push(vx, vy) {
    this.px -= vx;
    this.py -= vy;
  }

  get vx() { return this.x - this.px; }
  get vy() { return this.y - this.py; }
}

export class World {
  constructor({ gravity = 1400, friction = 0.985, bounce = 0.35, iterations = 4 } = {}) {
    this.bodies = [];
    this.gravity = gravity;
    this.friction = friction;
    this.bounce = bounce;
    this.iterations = iterations;
    this.bounds = { w: 0, h: 0 };
  }

  add(body) { this.bodies.push(body); return body; }

  step(dt) {
    for (const b of this.bodies) {
      if (b.pinned) { b.px = b.x; b.py = b.y; continue; }

      const vx = (b.x - b.px) * this.friction;
      const vy = (b.y - b.py) * this.friction;

      b.px = b.x;
      b.py = b.y;
      b.x += vx;
      b.y += vy + this.gravity * dt * dt;

      /* Катится, а не скользит: угол берётся из пройденного пути */
      b.angle += vx / b.r;
    }

    for (let i = 0; i < this.iterations; i++) {
      this.collide();
      this.contain();
    }
  }

  collide() {
    const list = this.bodies;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        let dist = Math.hypot(dx, dy);

        /* Тела ровно друг в друге: направление любое, лишь бы одно */
        if (dist === 0) { dx = 0.01; dy = 0; dist = 0.01; }
        if (dist >= min) continue;

        const push = (min - dist) / dist * 0.5;
        const total = a.mass + b.mass;
        const aShare = a.pinned ? 0 : b.mass / total * 2;
        const bShare = b.pinned ? 0 : a.mass / total * 2;

        a.x -= dx * push * aShare;
        a.y -= dy * push * aShare;
        b.x += dx * push * bShare;
        b.y += dy * push * bShare;
      }
    }
  }

  contain() {
    const { w, h } = this.bounds;
    for (const b of this.bodies) {
      if (b.pinned) continue;

      if (b.x - b.r < 0) { b.x = b.r; b.px = b.x + b.vx * this.bounce; }
      if (b.x + b.r > w) { b.x = w - b.r; b.px = b.x + b.vx * this.bounce; }
      if (b.y + b.r > h) { b.y = h - b.r; b.py = b.y + b.vy * this.bounce; }
      /* Сверху потолка нет: логотипы падают в кадр из-за верхнего края */
    }
  }
}

/* ── Пружина как CSS-кривая ────────────────────────────────
   Web Animations и переходы принимают linear() со списком
   точек. Прогоняем ту же пружину численно и отдаём её след
   как кривую: анимации в CSS начинают двигаться по той же
   физике, что и всё остальное, без своего rAF на каждый чих. */

const SUPPORTS_LINEAR = typeof CSS !== 'undefined'
  && CSS.supports?.('transition-timing-function', 'linear(0, 1)');

export function springCss({ stiffness = 210, damping = 20, mass = 1 } = {}, maxMs = 2200) {
  if (!SUPPORTS_LINEAR) {
    return { easing: 'cubic-bezier(.16, 1, .3, 1)', duration: 480 };
  }

  const s = new Spring(0, { stiffness, damping, mass });
  s.target = 1;

  const dt = 1 / 60;
  const points = [];
  const limit = Math.round((maxMs / 1000) / dt);

  for (let i = 0; i < limit; i++) {
    points.push(s.value);
    if (i > 8 && s.settled) break;
    s.step(dt);
  }
  points.push(1);

  return {
    easing: `linear(${points.map(v => v.toFixed(4)).join(',')})`,
    duration: Math.round(points.length * dt * 1000),
  };
}
