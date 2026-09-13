// Прямые проверки createHistory() из history.js, без DOM и без
// admin.js. Отдельный файл, потому что эта модель заслуживает
// собственного покрытия: первая версия (снимок в begin()) выглядела
// правильно на группировке текста и молча ломалась именно на
// атомарных действиях (select/add/upload — везде, где мутация стоит
// РАНЬШЕ touch()), а мой прежний тест на группировку текста этого не
// ловил из-за эффекта маскировки на многосимвольном вводе (см.
// коммит — там же объяснение). Здесь touch() проверяется отдельно,
// напрямую, без поля ввода посередине.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../public/admin/history.js';

function setup(initial = { n: 0 }) {
  let data = structuredClone(initial);
  const notified = [];
  const history = createHistory({
    getData: () => data,
    setData: next => { data = next; },
    onChange: () => notified.push(JSON.stringify(data)),
  });
  return { history, get data() { return data; }, notified };
}

test('touch(): мутация ДО вызова (как во всех реальных местах — select/add/upload) всё равно создаёт запись', () => {
  const h = setup();
  h.data.n = 1; // мутация раньше touch() — ровно так вызывается везде в admin.js
  h.history.touch();
  assert.equal(h.history.canUndo(), true, 'без этого баг из внешнего ревью не был бы виден: запись просто не появлялась');
  assert.equal(h.history.undo(), true);
  assert.equal(h.data.n, 0);
});

test('touch(): несколько атомарных действий подряд — несколько отдельных записей', () => {
  const h = setup();
  h.data.n = 1; h.history.touch();
  h.data.n = 2; h.history.touch();
  h.data.n = 3; h.history.touch();
  assert.equal(h.history.undo(), true); assert.equal(h.data.n, 2);
  assert.equal(h.history.undo(), true); assert.equal(h.data.n, 1);
  assert.equal(h.history.undo(), true); assert.equal(h.data.n, 0);
  assert.equal(h.history.undo(), false, 'дальше отменять нечего');
});

test('touch(): без реального изменения запись не создаётся', () => {
  const h = setup();
  h.history.touch(); // ничего не поменяли
  assert.equal(h.history.canUndo(), false);
});

test('begin/markDirty/commit: группирует несколько markDirty под одним ключом в одну запись', () => {
  const h = setup();
  const key = {};
  h.history.begin(key); h.data.n = 1; h.history.markDirty();
  h.history.begin(key); h.data.n = 2; h.history.markDirty(); // тот же key — не новая транзакция
  h.history.begin(key); h.data.n = 3; h.history.markDirty();
  assert.equal(h.history.canUndo(), false, 'markDirty не коммитит сам по себе');
  h.history.commit();
  assert.equal(h.history.canUndo(), true);
  h.history.undo();
  assert.equal(h.data.n, 0, 'откатилось до состояния ДО первого markDirty, а не до n=2');
});

test('begin: смена ключа фиксирует предыдущую транзакцию как отдельный шаг', () => {
  const h = setup();
  const fieldA = {}, fieldB = {};
  h.history.begin(fieldA); h.data.n = 1; h.history.markDirty();
  h.history.begin(fieldB); h.data.n = 2; h.history.markDirty(); // другое поле — A коммитится сам
  h.history.commit();
  assert.equal(h.history.undo(), true); assert.equal(h.data.n, 1, 'первый Undo снимает только B');
  assert.equal(h.history.undo(), true); assert.equal(h.data.n, 0, 'второй — A');
});

test('commit() уведомляет onChange, только когда правда что-то изменилось', () => {
  const h = setup();
  const key = {};
  h.history.begin(key); h.history.commit(); // ничего не мутировали
  assert.equal(h.notified.length, 0);
  h.history.begin(key); h.data.n = 5; h.history.markDirty(); h.history.commit();
  assert.ok(h.notified.length >= 1, 'markDirty уже уведомил; важно, что commit тоже уведомляет, когда он и есть момент фиксации');
});

test('commit(), реально зафиксировавший запись, сам вызывает onChange (кнопки не должны оставаться в устаревшем состоянии)', () => {
  const h = setup();
  const key = {};
  let calls = 0;
  const history = createHistory({ getData: () => h.data, setData: n => { /* не используется в этом тесте */ void n; }, onChange: () => calls++ });
  history.begin(key); h.data.n = 1;
  const callsAfterBeginOnly = calls;
  history.commit();
  assert.ok(calls > callsAfterBeginOnly, 'commit без предшествующего markDirty всё равно обязан уведомить, если что-то изменилось');
});

test('Redo: работает после Undo, стирается новой правкой, даже не завершённой', () => {
  const h = setup();
  h.data.n = 1; h.history.touch();
  h.history.undo();
  assert.equal(h.history.canRedo(), true);
  assert.equal(h.history.redo(), true);
  assert.equal(h.data.n, 1);

  h.history.undo();
  assert.equal(h.history.canRedo(), true);
  const key = {};
  h.history.begin(key); // новая правка ЕЩЁ НЕ завершена
  assert.equal(h.history.canRedo(), false, 'ветка Redo стирается в момент начала новой правки, не дожидаясь commit');
});

test('clear(): обнуляет обе ветки и сбрасывает контрольную точку на текущее состояние', () => {
  const h = setup();
  h.data.n = 1; h.history.touch();
  h.history.undo();
  h.history.clear();
  assert.equal(h.history.canUndo(), false);
  assert.equal(h.history.canRedo(), false);
  h.data.n = 99; // имитация нового состояния после load()
  h.history.clear();
  h.data.n = 100; h.history.touch();
  assert.equal(h.history.undo(), true);
  assert.equal(h.data.n, 99, 'clear() обязан был взять контрольную точку СВЕЖЕЙ, а не старой');
});

test('undo() сам коммитит незавершённую правку и отменяет именно её', () => {
  const h = setup();
  const key = {};
  h.history.begin(key); h.data.n = 1; h.history.markDirty();
  assert.equal(h.history.canUndo(), false, 'правка ещё не зафиксирована явным commit/blur/паузой');
  assert.equal(h.history.undo(), true, 'но Undo обязан сам её зафиксировать и тут же отменить');
  assert.equal(h.data.n, 0);
});
