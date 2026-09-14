// Прямые проверки createMediaCommands() из media-commands.js — модуль
// не знает о DOM, поэтому тестируется без харнесса bridge.test.mjs.
// Повторяет ту же защиту от гонок, что уже проверена на replaceCover
// (см. bridge.test.mjs), плюс новый третий случай — isCancelled,
// которым медиадиалог аннулирует операцию при закрытии.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaCommands } from '../public/admin/media-commands.js';
import { createHistory } from '../public/admin/history.js';
import { safeName } from '../public/admin/model.js';

function setup(overrides = {}) {
  const uploads = new Map();
  const pending = new Map();
  let data = { projects: { projects: [{ id: 'p1', slug: 'beautylab', title: 'Beauty Lab', cover: 'original', shots: [{ id: 's1', file: 'shot-a', alt: '' }] }] } };
  let epoch = 0, touches = 0, statuses = [];

  const shrink = file => new Promise(resolve => pending.set(file.name, () => resolve({ url: 'blob:' + file.name, blob: new Blob([file.name]), bytes: new Uint8Array([1]) })));

  const commands = createMediaCommands({
    findProject: id => data.projects.projects.find(p => (p.id ?? p.slug) === id),
    uploads,
    safeName,
    shrink,
    getEpoch: () => epoch,
    setImageJobsPending: () => {},
    commit() {},
    touch: () => touches++,
    setStatus: message => statuses.push(message),
    ...overrides,
  });

  return {
    commands, uploads, pending,
    get data() { return data; },
    get project() { return data.projects.projects[0]; },
    get touches() { return touches; },
    get statuses() { return statuses; },
    replaceDocument() { data = structuredClone(data); epoch++; },
    deleteProject() { data.projects.projects.length = 0; },
  };
}

test('selectExistingAsset: применяет существующее имя, не трогает uploads, коммитит одной записью', () => {
  const h = setup();
  const ok = h.commands.selectExistingAsset({ projectId: 'p1', slot: 'cover' }, 'shot-a');
  assert.equal(ok.status, 'applied');
  assert.equal(h.project.cover, 'shot-a');
  assert.equal(h.uploads.size, 0, 'выбор уже существующего файла не создаёт новый бинарный аплоад');
  assert.equal(h.touches, 1);
});

test('selectExistingAsset: отвергает небезопасное имя и несуществующую цель, не коммитит', () => {
  const h = setup();
  assert.equal(h.commands.selectExistingAsset({ projectId: 'p1', slot: 'cover' }, '../evil').status, 'cancelled');
  assert.equal(h.commands.selectExistingAsset({ projectId: 'p1', slot: 'cover' }, '').status, 'cancelled');
  assert.equal(h.commands.selectExistingAsset({ projectId: 'ghost', slot: 'cover' }, 'shot-a').status, 'cancelled');
  assert.equal(h.touches, 0);
  assert.equal(h.project.cover, 'original', 'ни одна из отвергнутых попыток не должна была изменить документ');
});

test('selectExistingAsset: применяется к вхождению галереи по устойчивому id, а не по индексу', () => {
  const h = setup();
  const ok = h.commands.selectExistingAsset({ projectId: 'p1', slot: 'gallery', galleryItemId: 's1' }, 'new-file');
  assert.equal(ok.status, 'applied');
  assert.equal(h.project.shots[0].file, 'new-file');
  assert.equal(h.commands.selectExistingAsset({ projectId: 'p1', slot: 'gallery', galleryItemId: 'ghost' }, 'x').status, 'cancelled', 'несуществующий id вхождения отклоняется');
});

test('clearAsset: снимает явную caseCover — слот падает на fallback (используется в инспекторе для «Использовать превью»)', () => {
  // findProject возвращает устойчивую ссылку на объект внутри h.data
  // (см. setup() ниже), а не новый литерал на каждый вызов — иначе
  // мутация никак не проверялась бы после возврата команды.
  const h = setup();
  h.project.caseCover = 'case-a';
  const result = h.commands.clearAsset({ projectId: 'p1', slot: 'caseCover' });
  assert.equal(result.status, 'applied');
  assert.equal(h.project.caseCover, undefined, 'мутация обязана была реально снять caseCover с устойчивого объекта проекта');
  assert.equal(h.touches, 1);
});

test('clearAsset: уже пустая caseCover — unchanged, без записи в историю', () => {
  const h = setup();
  const result = h.commands.clearAsset({ projectId: 'p1', slot: 'caseCover' });
  assert.equal(result.status, 'unchanged');
  assert.equal(h.touches, 0);
});

test('clearAsset: несуществующая цель — cancelled', () => {
  const h = setup();
  assert.equal(h.commands.clearAsset({ projectId: 'ghost', slot: 'caseCover' }).status, 'cancelled');
});

test('clearAsset: отказывается работать со слотами cover/gallery — не трогает данные и историю (внешнее ревью 9a213e9)', () => {
  // cover обязателен — у него нет fallback, снимать нечем; вхождение
  // галереи удаляется целиком отдельной командой, а не сводится к
  // shot.file=undefined. Раньше clearAsset принимал любой target,
  // который проходил через resolve(), включая эти два случая.
  const h = setup();
  assert.equal(h.commands.clearAsset({ projectId: 'p1', slot: 'cover' }).status, 'cancelled');
  assert.equal(h.project.cover, 'original', 'cover не должен был измениться');
  assert.equal(h.commands.clearAsset({ projectId: 'p1', slot: 'gallery', galleryItemId: 's1' }).status, 'cancelled');
  assert.equal(h.project.shots[0].file, 'shot-a', 'вхождение галереи не должно было измениться');
  assert.equal(h.touches, 0, 'ни одна из отклонённых попыток не должна была попасть в историю');
});

test('uploadForTarget: caseCover — тот же резолвер slot, что и cover, полностью проходит через ту же защиту', async () => {
  const h = setup();
  const target = { projectId: 'p1', slot: 'caseCover' };
  const op = h.commands.uploadForTarget(target, { name: 'case-photo' });
  h.pending.get('case-photo')();
  const result = await op;
  assert.equal(result.status, 'applied');
  assert.equal(h.uploads.size, 1, 'ровно один новый бинарный аплоад для caseCover');
  assert.equal(h.uploads.get(h.project.caseCover).url, 'blob:case-photo', 'caseCover указывает на реально загруженный файл, cover не тронут');
  assert.equal(h.project.cover, 'original', 'cover не должен был измениться от загрузки caseCover');
});

test('cover → caseCover → сброс caseCover: три раздельных шага с НАСТОЯЩЕЙ историей — три Undo, три Redo (внешнее ревью 9a213e9)', () => {
  // Раньше «раздельные записи Undo» проверялись счётчиком вызовов
  // touch(), что не гарантирует ни правильный порядок отмены, ни то,
  // что commit() действительно закрывает предыдущий шаг ДО следующей
  // мутации. Здесь — настоящая createHistory поверх настоящего data.
  let data = { projects: { projects: [{ id: 'p1', slug: 'beautylab', title: 'Beauty Lab', cover: 'original', shots: [] }] } };
  const history = createHistory({ getData: () => data, setData: d => { data = d; }, onChange() {} });
  const commands = createMediaCommands({
    findProject: id => data.projects.projects.find(p => (p.id ?? p.slug) === id),
    uploads: new Map(),
    safeName,
    shrink: () => Promise.reject(new Error('не используется в этом тесте')),
    getEpoch: () => 0,
    setImageJobsPending: () => {},
    commit: history.commit,
    touch: history.touch,
  });
  const project = () => data.projects.projects[0];

  assert.equal(commands.selectExistingAsset({ projectId: 'p1', slot: 'cover' }, 'cover-a').status, 'applied');
  assert.equal(project().cover, 'cover-a');
  assert.equal(project().caseCover, undefined);

  assert.equal(commands.selectExistingAsset({ projectId: 'p1', slot: 'caseCover' }, 'case-a').status, 'applied');
  assert.equal(project().cover, 'cover-a', 'назначение caseCover не тронуло cover');
  assert.equal(project().caseCover, 'case-a');

  assert.equal(commands.clearAsset({ projectId: 'p1', slot: 'caseCover' }).status, 'applied');
  assert.equal(project().cover, 'cover-a');
  assert.equal(project().caseCover, undefined);
  assert.equal(JSON.stringify(project()).includes('caseCover'), false, 'сериализация обязана была отбросить ключ целиком (undefined, не null/"")');

  assert.equal(history.undo(), true, '1/3: отменяет именно сброс caseCover');
  assert.equal(project().caseCover, 'case-a');
  assert.equal(project().cover, 'cover-a');

  assert.equal(history.undo(), true, '2/3: отменяет именно назначение caseCover');
  assert.equal(project().caseCover, undefined);
  assert.equal(project().cover, 'cover-a');

  assert.equal(history.undo(), true, '3/3: отменяет именно назначение cover');
  assert.equal(project().cover, 'original');
  assert.equal(project().caseCover, undefined);
  assert.equal(history.canUndo(), false, 'три шага записаны раздельно — после трёх Undo стек пуст');

  assert.equal(history.redo(), true, '1/3: возвращает назначение cover');
  assert.equal(project().cover, 'cover-a');
  assert.equal(project().caseCover, undefined);

  assert.equal(history.redo(), true, '2/3: возвращает назначение caseCover');
  assert.equal(project().caseCover, 'case-a');

  assert.equal(history.redo(), true, '3/3: возвращает сброс caseCover');
  assert.equal(project().caseCover, undefined);
  assert.equal(project().cover, 'cover-a');
  assert.equal(history.canRedo(), false);
});

test('uploadForTarget: гонка A → B — побеждает B, даже если A завершился позже', async () => {
  const h = setup();
  const target = { projectId: 'p1', slot: 'cover' };
  const first = h.commands.uploadForTarget(target, { name: 'A' });
  const second = h.commands.uploadForTarget(target, { name: 'B' });
  h.pending.get('B')(); await second;
  h.pending.get('A')(); await first;
  assert.equal(h.uploads.get(h.project.cover).url, 'blob:B');
});

test('uploadForTarget: документ заменили целиком, пока файл сжимался — устаревший результат не пишет в новую версию', async () => {
  const h = setup();
  const target = { projectId: 'p1', slot: 'cover' };
  const op = h.commands.uploadForTarget(target, { name: 'pending' });
  h.replaceDocument();
  h.pending.get('pending')();
  const ok = await op;
  assert.equal(ok.status, 'cancelled');
  assert.equal(h.project.cover, 'original');
  assert.equal(h.uploads.size, 0);
  assert.equal(h.touches, 0);
});

test('uploadForTarget: цель удалена, пока файл сжимался — результат отбрасывается', async () => {
  const h = setup();
  const target = { projectId: 'p1', slot: 'cover' };
  const op = h.commands.uploadForTarget(target, { name: 'pending' });
  h.deleteProject();
  h.pending.get('pending')();
  assert.equal((await op).status, 'cancelled');
  assert.equal(h.touches, 0);
});

test('uploadForTarget: isCancelled (диалог закрыли до завершения) отбрасывает результат без записи в историю', async () => {
  const h = setup();
  const target = { projectId: 'p1', slot: 'cover' };
  let cancelled = false;
  const op = h.commands.uploadForTarget(target, { name: 'pending' }, { isCancelled: () => cancelled });
  cancelled = true; // например, пользователь закрыл диалог или открыл заново для другого проекта
  h.pending.get('pending')();
  assert.equal((await op).status, 'cancelled');
  assert.equal(h.project.cover, 'original');
  assert.equal(h.touches, 0);
});

test('uploadForTarget: ошибка shrink() снимает занятость через setStatus, не трогает документ', async () => {
  const h = setup({ shrink: () => Promise.reject(new Error('плохой файл')) });
  const ok = await h.commands.uploadForTarget({ projectId: 'p1', slot: 'cover' }, { name: 'bad' });
  assert.deepEqual(ok, {status: 'error', message: 'плохой файл'});
  assert.deepEqual(h.statuses, []);
  assert.equal(h.project.cover, 'original');
});

test('uploadForTarget: снятие занятости не затирает текст ошибки (обе пишут в одну строку статуса)', () => {
  // setImageJobsPending(0 → пусто) сама переписывает строку статуса
  // ("Обрабатываю…" → "Есть несохранённые правки" или пусто) — если бы
  // она сработала ПОСЛЕ setStatus(err.message), только что показанная
  // причина ошибки тут же пропадала бы. Поймано живой проверкой в
  // браузере с намеренно битым PNG, не этим тестом — тест лишь
  // закрепляет порядок вызовов на будущее.
  const calls = [];
  const h = setup({
    shrink: () => Promise.reject(new Error('плохой файл')),
    setImageJobsPending: delta => calls.push(['jobs', delta]),
    setStatus: message => calls.push(['status', message]),
  });
  return h.commands.uploadForTarget({ projectId: 'p1', slot: 'cover' }, { name: 'bad' }).then(result => {
    assert.deepEqual(calls, [['jobs', 1], ['jobs', -1]]);
    assert.deepEqual(result, {status: 'error', message: 'плохой файл'});
  });
});
