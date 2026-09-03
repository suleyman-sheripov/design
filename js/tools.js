/* Инструменты падают в короб и лежат там кучей. Держит их верле
   из physics.js — тот же код, что и всё остальное движение.

   Смысл не в аттракционе: страница дизайнера, который делает
   упаковку, обязана вести себя как предмет, а не как документ.
   Фишку можно взять, потащить и бросить, и она полетит по той
   скорости, с какой её отпустили.

   Список названий под коробом — не подпись к анимации, а сам
   контент. Без скриптов и при выключенном движении остаётся он. */

import { World, Body, onTick } from './physics.js';

const CHIP = 112;       // диаметр фишки на широком экране
const CHIP_SMALL = 76;

export function initTools(root = document) {
  const arena = root.getElementById('kitArena');
  const again = root.getElementById('kitAgain');
  if (!arena) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const chips = [...arena.querySelectorAll('.chip')];
  if (!chips.length) return;

  arena.classList.add('is-live');
  if (again) again.hidden = false;

  const world = new World({ gravity: 2200, friction: 0.99, bounce: 0.3 });
  const size = () => (innerWidth < 700 ? CHIP_SMALL : CHIP);

  const units = chips.map(el => {
    const r = size() / 2;
    el.style.setProperty('--chip', size() + 'px');
    return { el, body: world.add(new Body(0, -400, r)) };
  });

  measure();
  addEventListener('resize', measure, { passive: true });

  let dropped = false;
  let live = false;

  /* Один наблюдатель на два дела: первый показ роняет фишки,
     дальше он же выключает счёт, когда короб ушёл с экрана */
  const io = new IntersectionObserver(entries => {
    live = entries.some(e => e.isIntersecting);
    if (!live || dropped) return;
    dropped = true;
    drop();
  }, { rootMargin: '120px' });
  io.observe(arena);

  again?.addEventListener('click', drop);
  grab(arena, world, units);

  onTick(dt => {
    if (!dropped || !live) return;
    world.step(dt);
    for (const u of units) {
      u.el.style.transform =
        'translate3d(' + (u.body.x - u.body.r).toFixed(1) + 'px, ' +
        (u.body.y - u.body.r).toFixed(1) + 'px, 0) rotate(' +
        ((u.body.angle * 180) / Math.PI).toFixed(1) + 'deg)';
    }
  });

  function measure() {
    world.bounds.w = arena.clientWidth;
    world.bounds.h = arena.clientHeight;
    const r = size() / 2;
    for (const u of units) {
      u.body.r = r;
      u.el.style.setProperty('--chip', size() + 'px');
    }
  }

  /* Сбрасываем по очереди с разбросом по горизонтали и лёгким
     закрутом: одновременный старт из одной точки выглядит
     как сетка, а не как высыпанная горсть. */
  function drop() {
    const w = world.bounds.w || arena.clientWidth;
    units.forEach((u, i) => {
      setTimeout(() => {
        const x = w * (0.18 + 0.64 * (i + 0.5) / units.length);
        u.body.x = u.body.px = x;
        u.body.y = u.body.py = -u.body.r * 2;
        u.body.push((Math.random() - 0.5) * 6, 0);
      }, i * 130);
    });
  }
}

/* Захват. Пока фишка в руке, она приколота и просто едет за
   курсором; физика её не тянет. При отпускании отдаём накопленную
   скорость руки — поэтому бросок ощущается броском. */
function grab(arena, world, units) {
  const byEl = new Map(units.map(u => [u.el, u.body]));
  let held = null;
  let id = null;
  let last = { x: 0, y: 0 };
  let vel = { x: 0, y: 0 };

  arena.addEventListener('pointerdown', e => {
    const el = e.target.closest('.chip');
    const body = el && byEl.get(el);
    if (!body) return;

    e.preventDefault();
    held = body;
    id = e.pointerId;
    body.pinned = true;
    el.classList.add('is-held');
    last = local(e);
    vel = { x: 0, y: 0 };
    arena.setPointerCapture(id);
  });

  arena.addEventListener('pointermove', e => {
    if (!held || e.pointerId !== id) return;
    const p = local(e);
    vel = { x: p.x - last.x, y: p.y - last.y };
    last = p;
    held.x = held.px = p.x;
    held.y = held.py = p.y;
  });

  const release = e => {
    if (!held || e.pointerId !== id) return;
    held.pinned = false;
    /* Гасим бросок вдвое: рука на экране быстрее, чем должен
       лететь предмет такого веса */
    held.push(vel.x * 0.5, vel.y * 0.5);
    arena.querySelector('.chip.is-held')?.classList.remove('is-held');
    held = null;
    id = null;
  };

  arena.addEventListener('pointerup', release);
  arena.addEventListener('pointercancel', release);

  function local(e) {
    const r = arena.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
