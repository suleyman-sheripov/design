// Прямые проверки createMediaCommands() из media-commands.js — модуль
// не знает о DOM, поэтому тестируется без харнесса bridge.test.mjs.
// Повторяет ту же защиту от гонок, что уже проверена на replaceCover
// (см. bridge.test.mjs), плюс новый третий случай — isCancelled,
// которым медиадиалог аннулирует операцию при закрытии.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaCommands } from '../public/admin/media-commands.js';
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
  assert.equal(ok, true);
  assert.equal(h.project.cover, 'shot-a');
  assert.equal(h.uploads.size, 0, 'выбор уже существующего файла не создаёт новый бинарный аплоад');
  assert.equal(h.touches, 1);
});

test('selectExistingAsset: отвергает небезопасное имя и несуществующую цель, не коммитит', () => {
  const h = setup();
  assert.equal(h.commands.selectExistingAsset({ projectId: 'p1', slot: 'cover' }, '../evil'), false);
  assert.equal(h.commands.selectExistingAsset({ projectId: 'p1', slot: 'cover' }, ''), false);
  assert.equal(h.commands.selectExistingAsset({ projectId: 'ghost', slot: 'cover' }, 'shot-a'), false);
  assert.equal(h.touches, 0);
  assert.equal(h.project.cover, 'original', 'ни одна из отвергнутых попыток не должна была изменить документ');
});

test('selectExistingAsset: применяется к вхождению галереи по устойчивому id, а не по индексу', () => {
  const h = setup();
  const ok = h.commands.selectExistingAsset({ projectId: 'p1', slot: 'gallery', galleryItemId: 's1' }, 'new-file');
  assert.equal(ok, true);
  assert.equal(h.project.shots[0].file, 'new-file');
  assert.equal(h.commands.selectExistingAsset({ projectId: 'p1', slot: 'gallery', galleryItemId: 'ghost' }, 'x'), false, 'несуществующий id вхождения отклоняется');
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
  assert.equal(ok, false);
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
  assert.equal(await op, false);
  assert.equal(h.touches, 0);
});

test('uploadForTarget: isCancelled (диалог закрыли до завершения) отбрасывает результат без записи в историю', async () => {
  const h = setup();
  const target = { projectId: 'p1', slot: 'cover' };
  let cancelled = false;
  const op = h.commands.uploadForTarget(target, { name: 'pending' }, { isCancelled: () => cancelled });
  cancelled = true; // например, пользователь закрыл диалог или открыл заново для другого проекта
  h.pending.get('pending')();
  assert.equal(await op, false);
  assert.equal(h.project.cover, 'original');
  assert.equal(h.touches, 0);
});

test('uploadForTarget: ошибка shrink() снимает занятость через setStatus, не трогает документ', async () => {
  const h = setup({ shrink: () => Promise.reject(new Error('плохой файл')) });
  const ok = await h.commands.uploadForTarget({ projectId: 'p1', slot: 'cover' }, { name: 'bad' });
  assert.equal(ok, false);
  assert.deepEqual(h.statuses, ['плохой файл']);
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
  return h.commands.uploadForTarget({ projectId: 'p1', slot: 'cover' }, { name: 'bad' }).then(() => {
    assert.deepEqual(calls, [['jobs', 1], ['jobs', -1], ['status', 'плохой файл']], 'снятие занятости обязано случиться ДО показа причины ошибки, а не после');
  });
});
