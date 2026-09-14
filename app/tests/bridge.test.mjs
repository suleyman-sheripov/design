// Регрессии на четыре дефекта, подтверждённых внешним ревью коммита
// 2680ed8 (см. docs/… и приложенный bridge-review-2680ed8.zip):
// устаревшее завершение обработки изображения побеждало более новое
// действие пользователя, замена черновика во время обработки не
// отменяла устаревшую операцию, одна и та же картинка пересылалась
// заново на каждую букву, а старая форма меняла документ, не
// уведомляя живой предпросмотр. Здесь — тот же тип воспроизведения,
// что в присланном reproduce.mjs, но против исправленного кода и с
// перевёрнутыми ожиданиями: раньше «CONFIRMED» означало баг, теперь
// проверяется, что дефект НЕ воспроизводится.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { initLiveEditor } from '../public/admin/editor-live.js';
import { createHistory, wireTextCommit } from '../public/admin/history.js';
import { safeName } from '../public/admin/model.js';
import {
  CHANNEL, isValidApplied, isValidInit, isValidModeMessage, isValidRevision,
  isValidSelection, isValidSnapshot, looksLikeDraft, readEnvelope,
} from '../public/admin/bridge-protocol.js';

class Element {
  children = []; handlers = {}; attrs = {}; value = ''; open = false;
  classList = { add() {}, remove() {} };
  focus() { document.activeElement = this; }
  constructor(tag) {
    this.tag = tag;
    if (tag === 'iframe') { this.messages = []; this.contentWindow = { postMessage: msg => this.messages.push(msg) }; }
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, fn) { (this.handlers[k] ??= []).push(fn); }
  querySelector() { return this.children.find(x => x.tag === 'input' || x.tag === 'textarea'); }
  contains(node) { return this === node || this.children.some(c => c.contains?.(node)); }
  fire(k, payload = {}) { return Promise.all((this.handlers[k] ?? []).map(fn => fn({ target: this, ...payload }))); }
  /* <dialog> — реальный DOM даёт это бесплатно; мок изображает ровно
     то, чем пользуется media-dialog.js: открыт/закрыт как факт. */
  showModal() { this.open = true; }
  close() { this.open = false; }
}
const walk = e => [e, ...e.children.flatMap(walk)];

/* Гарантированно медленный shrink: разрешается вручную через
   pending.get(name)(), а не таймером — тест сам решает порядок
   завершения, без гонки с реальным временем. */
function harness(overrides = {}) {
  const listeners = {};
  globalThis.location = { origin: 'http://localhost' };
  globalThis.sessionStorage = { setItem() {} };
  globalThis.document = { createElement: tag => new Element(tag), activeElement: null };
  globalThis.addEventListener = (k, fn) => (listeners[k] ??= []).push(fn);
  globalThis.removeEventListener = () => {};

  const mount = new Element('main'), uploads = new Map(), pending = new Map();
  let current = {
    profile: {}, projects: { projects: [{ id: 'p1', slug: 'beautylab', title: 'Beauty Lab', status: 'published', cover: 'original' }] },
  };
  let epoch = 0, commits = 0, imageJobs = 0, editor;

  const shrink = file => new Promise(resolve => pending.set(file.name, () => resolve({ url: 'blob:' + file.name, blob: new Blob([file.name], { type: 'image/webp' }), bytes: new Uint8Array([1]) })));
  /* Заглушка стоит на месте настоящего field() из admin.js, который
     на каждый input сам зовёт wireTextCommit → history.markDirty() →
     notify(). Здесь тот же контракт воспроизведён впрямую: editor —
     let-переменная, к моменту первого события ввода она уже
     присвоена ниже (initLiveEditor к этому моменту уже вернулся). */
  const field = (label, value, change) => {
    const wrapper = new Element('label'), input = new Element('input');
    input.label = label; input.value = value;
    input.addEventListener('input', () => { change(input.value); editor.notify(current); });
    wrapper.append(input);
    return wrapper;
  };

  editor = initLiveEditor({
    mount,
    model: { imageNames: d => d.projects.projects.map(p => p.cover), safeName },
    field, shrink, uploads,
    assetUrl: name => uploads.get(name)?.url ?? name,
    touch: () => { commits++; },
    commit: () => {},
    render: () => editor.sync(current),
    buildPreviewPayload: () => ({ data: current }),
    setStatus: message => { throw Error(message); },
    getEpoch: () => epoch,
    setImageJobsPending: delta => { imageJobs = Math.max(0, imageJobs + delta); },
    mediaLibrary: () => [...uploads.keys()],
    ...overrides,
  });
  editor.sync(current);

  const iframe = walk(mount).find(e => e.tag === 'iframe');
  const send = data => { for (const fn of listeners.message ?? []) fn({ source: iframe.contentWindow, origin: location.origin, data }); };
  send({ channel: CHANNEL, kind: 'ready' });
  const channelId = iframe.messages.find(m => m.kind === 'init').channelId;
  const select = key => send({ channel: CHANNEL, kind: 'selection', channelId, target: { type: 'project', key } });
  select('p1');

  return {
    mount, iframe, uploads, pending, editor, channelId, send, select,
    get current() { return current; },
    get commits() { return commits; },
    get imageJobs() { return imageJobs; },
    /* Имитирует Undo/Reload/импорт: документ меняется целиком, эпоха
       растёт — ровно то, что admin.js делает по-настоящему. */
    replaceDraft() { current = structuredClone(current); epoch++; editor.sync(current); },
    /* Обложка теперь меняется через диалог, а не через голый file-input
       в инспекторе: сперва кнопка «Заменить» открывает диалог (внутри
       вызывается mediaDialog.open(), который и подключает
       onSelectExisting/onUploadFile), только после этого его
       собственный input годится для загрузки. */
    async input() {
      const replaceBtn = walk(mount).find(e => e.tag === 'button' && e.textContent === 'Заменить');
      await replaceBtn.fire('click');
      return walk(mount).find(e => e.tag === 'input' && e.type === 'file');
    },
    title: () => walk(mount).find(e => e.label === 'Заголовок карточки'),
  };
}

test('Гонка загрузки: выбрали A, затем B — побеждает B, даже если A завершился позже', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'A' }]; const first = input.fire('change');
  input.files = [{ name: 'B' }]; const second = input.fire('change');
  h.pending.get('B')(); await second;
  h.pending.get('A')(); await first;
  const actual = h.uploads.get(h.current.projects.projects[0].cover).url;
  assert.equal(actual, 'blob:B');
});

test('Замена черновика во время обработки: устаревшее завершение не пишет в новую версию', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'pending' }]; const operation = input.fire('change');
  h.replaceDraft();
  h.pending.get('pending')();
  await operation;
  assert.equal(h.current.projects.projects[0].cover, 'original');
  assert.equal(h.uploads.size, 0, 'устаревшая загрузка не должна попасть в uploads');
  assert.equal(h.commits, 0, 'устаревшее завершение не пишет фиктивную правку в историю');
  assert.equal(h.imageJobs, 0, 'счётчик занятости корректно уменьшился в finally');
});

test('Публикация ждёт обработку изображения, а не проскакивает мимо неё', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'cover' }]; const operation = input.fire('change');
  assert.equal(h.imageJobs, 1, 'занятость выставлена ДО завершения shrink, не после');
  h.pending.get('cover')();
  await operation;
  assert.equal(h.imageJobs, 0);
});

test('Ошибка обработки снимает занятость и не трогает документ', async () => {
  const statuses = [];
  const h = harness({
    shrink: () => Promise.reject(new Error('плохой файл')),
    setStatus: message => statuses.push(message),
  });
  const input = await h.input();
  input.files = [{ name: 'bad' }];
  await input.fire('change');
  assert.equal(h.current.projects.projects[0].cover, 'original');
  assert.equal(h.imageJobs, 0);
  assert.equal(h.uploads.size, 0);
  assert.deepEqual(statuses, []);
  assert.equal(walk(h.mount).find(e => e.className === 'media-status').textContent, 'плохой файл');
});

test('Текст не пересылает уже отправленную картинку заново на каждую букву', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'cover' }]; const operation = input.fire('change');
  h.pending.get('cover')(); await operation;
  /* Загрузка сама по себе уже толкнула снимок с Blob — считаем его в
     общем итоге, а не сбрасываем: вопрос в том, уйдёт ли Blob ещё раз
     ПОСЛЕ этого, а не в том, ушёл ли он вообще ни разу. */
  const beforeTyping = h.iframe.messages.length;

  const title = h.title();
  title.value = 'X'; await title.fire('input');
  title.value = 'XY'; await title.fire('input');

  const typingSnapshots = h.iframe.messages.slice(beforeTyping).filter(m => m.kind === 'snapshot');
  assert.equal(typingSnapshots.length, 2, 'каждая буква всё равно толкает снимок документа');
  assert.ok(typingSnapshots.every(m => !m.assets), 'но ни один из них не обязан нести уже отправленную картинку');

  const allWithAsset = h.iframe.messages.filter(m => m.kind === 'snapshot' && Object.values(m.assets ?? {}).some(v => v instanceof Blob));
  assert.equal(allWithAsset.length, 1, 'Blob обязан уйти один раз за всю последовательность, а не при каждом снимке');
});

test('Картинка не переотправляется, пока используется; выходит из употребления и возвращается — пересылается заново', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'cover' }]; const operation = input.fire('change');
  h.pending.get('cover')(); await operation;
  const uploadedName = h.current.projects.projects[0].cover;
  const firstSnapshot = h.iframe.messages.findLast(m => m.kind === 'snapshot');
  assert.ok(firstSnapshot.assets, 'первый снимок после загрузки обязан нести Blob');

  // Пока applied не пришёл, повторный толчок снимка не обязан слать Blob
  // ещё раз — он уже "в пути", повторная отправка была бы лишней работой
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  assert.equal(h.iframe.messages.filter(m => m.kind === 'snapshot' && m.assets).length, 0);

  // Подтверждаем получение — теперь картинка окончательно "у ребёнка"
  h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: firstSnapshot.revision });

  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  assert.equal(h.iframe.messages.filter(m => m.kind === 'snapshot' && m.assets).length, 0, 'подтверждённая картинка не пересылается, пока используется');

  // Undo вернул исходную обложку — id вышел из употребления
  h.current.projects.projects[0].cover = 'original';
  h.editor.notify(h.current);

  // Redo вернул её обратно — отметка "уже доставлено" для этого id не
  // должна была пережить период, когда он не использовался
  h.current.projects.projects[0].cover = uploadedName;
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  const resent = h.iframe.messages.filter(m => m.kind === 'snapshot' && Object.values(m.assets ?? {}).some(v => v instanceof Blob));
  assert.equal(resent.length, 1, 'вернувшийся в употребление id обязан прийти снова');
});

test('Запоздалый applied для ревизии, чей id уже вышел из употребления, не помечает его доставленным (внешнее ревью коммита 9301130)', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'cover' }]; const operation = input.fire('change');
  h.pending.get('cover')(); await operation;
  const uploadedName = h.current.projects.projects[0].cover;
  const firstSnapshot = h.iframe.messages.findLast(m => m.kind === 'snapshot');
  assert.ok(firstSnapshot.assets, 'первый снимок после загрузки обязан нести Blob');
  const staleRevision = firstSnapshot.revision;

  // Id вышел из употребления ДО того, как подтверждение за первый снимок пришло
  h.current.projects.projects[0].cover = 'original';
  h.editor.notify(h.current);

  // Запоздавшее applied за старую ревизию приходит уже после этого
  h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: staleRevision });

  // Id снова понадобился — раз ребёнок у себя его уже точно не хранит
  // (сам же освободил object URL, когда id пропал из imageNames), Blob
  // обязан прийти заново, а не потеряться из-за того, что запоздавший
  // applied тихо пометил его «уже доставлен»
  h.current.projects.projects[0].cover = uploadedName;
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  const resent = h.iframe.messages.filter(m => m.kind === 'snapshot' && Object.values(m.assets ?? {}).some(v => v instanceof Blob));
  assert.equal(resent.length, 1, 'запоздавший applied не должен был помешать повторной отправке');
});

test('Быстрый цикл remove → reuse ДО ack: устаревшее applied не подменяет состояние новой отправки', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'cover' }]; const operation = input.fire('change');
  h.pending.get('cover')(); await operation;
  const uploadedName = h.current.projects.projects[0].cover;
  const firstSnapshot = h.iframe.messages.findLast(m => m.kind === 'snapshot');
  const staleRevision = firstSnapshot.revision;

  // remove, затем reuse — оба ДО того, как applied за первую отправку пришёл
  h.current.projects.projects[0].cover = 'original';
  h.editor.notify(h.current);
  h.current.projects.projects[0].cover = uploadedName;
  h.iframe.messages.length = 0;
  h.editor.notify(h.current); // должен переотправить Blob под НОВОЙ ревизией
  const resend = h.iframe.messages.findLast(m => m.kind === 'snapshot' && m.assets);
  assert.ok(resend, 'повторное использование обязано переотправить Blob');
  const freshRevision = resend.revision;
  assert.notEqual(freshRevision, staleRevision);

  // Теперь приходит устаревшее applied за самую первую (уже неактуальную) ревизию
  h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: staleRevision });

  // Оно не должно было пометить доставленным то, что ждёт ИМЕННО freshRevision:
  // следующий толчок снимка не обязан переслать Blob заново без НАСТОЯЩЕГО applied
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  assert.equal(h.iframe.messages.filter(m => m.kind === 'snapshot' && m.assets).length, 0, 'состояние новой отправки не должно было пострадать от чужого устаревшего applied');

  // А настоящее applied за актуальную ревизию по-прежнему принимается штатно
  h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: freshRevision });
  h.current.projects.projects[0].cover = 'original';
  h.editor.notify(h.current);
  h.current.projects.projects[0].cover = uploadedName;
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  assert.equal(h.iframe.messages.filter(m => m.kind === 'snapshot' && Object.values(m.assets ?? {}).some(v => v instanceof Blob)).length, 1, 'после настоящего applied и нового цикла ухода из употребления id всё ещё переотправляется штатно');
});

test('Искажённое applied (нечисловой, отрицательный, отсутствующий revision) не роняет редактор и не мешает настоящему applied', async () => {
  const h = harness(), input = await h.input();
  input.files = [{ name: 'cover' }]; const operation = input.fire('change');
  h.pending.get('cover')(); await operation;
  const firstSnapshot = h.iframe.messages.findLast(m => m.kind === 'snapshot');
  assert.ok(firstSnapshot.assets, 'первый снимок после загрузки обязан нести Blob');

  /* Раньше onApplied читал raw.revision напрямую, без isValidApplied.
     Сравнение status===rev внутри уже устойчиво к типовым нестыковкам
     (строка никогда не совпадёт с сохранённым числом), поэтому здесь
     не поведенческая дыра, а недостающая симметрия с остальными
     четырьмя видами сообщений — на случай, если onApplied когда-нибудь
     станет менее строгим. Проверяем то, что честно можно проверить:
     искажённые сообщения не роняют обработчик и не смешиваются с
     настоящим подтверждением. */
  assert.doesNotThrow(() => {
    h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: 'не число' });
    h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: -1 });
    h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId });
  });

  // Пока не пришло настоящее подтверждение, картинка остаётся "в пути" —
  // это уже проверено другим тестом; здесь достаточно, что искажённые
  // сообщения не подменили это состояние на что-то другое
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  assert.equal(h.iframe.messages.filter(m => m.kind === 'snapshot' && m.assets).length, 0);

  // Настоящее applied за верную ревизию по-прежнему принимается штатно:
  // id выходит из употребления и возвращается — обязан прийти заново,
  // ровно как в сценарии без единого искажённого сообщения
  const uploadedName = Object.keys(firstSnapshot.assets)[0];
  h.send({ channel: CHANNEL, kind: 'applied', channelId: h.channelId, revision: firstSnapshot.revision });
  h.current.projects.projects[0].cover = 'original';
  h.editor.notify(h.current);
  h.current.projects.projects[0].cover = uploadedName;
  h.iframe.messages.length = 0;
  h.editor.notify(h.current);
  const resent = h.iframe.messages.filter(m => m.kind === 'snapshot' && Object.values(m.assets ?? {}).some(v => v instanceof Blob));
  assert.equal(resent.length, 1, 'настоящее applied по-прежнему подтверждает доставку как обычно');
});

/* field()/touch()/select() в admin.js вырезаются как исходный текст и
   выполняются в песочнице — тот же приём, что в присланном
   reproduce.mjs. Раньше песочница подсовывала им плоский массив
   history и свою setDirty; после перехода на общую транзакционную
   историю (history.js) им нужна НАСТОЯЩАЯ history — иначе тест
   проверял бы уже не тот код, который реально выполняется в браузере. */
function adminSandbox(h, current) {
  const notified = [];
  const history = createHistory({
    getData: () => current,
    setData: next => { Object.keys(current).forEach(k => delete current[k]); Object.assign(current, next); },
    onChange: () => { notified.push(1); h.editor.notify(current); },
  });
  return {
    ctx: {
      document: globalThis.document, data: current, history, wireTextCommit,
      el: () => ({ disabled: false }), setDirty() {}, text: () => new Element('span'),
    },
    notified,
  };
}

test('Старое поле формы теперь уведомляет живой предпросмотр на каждый ввод', async () => {
  const h = harness();
  const current = h.current;
  h.iframe.messages.length = 0;
  const { ctx } = adminSandbox(h, current);

  const admin = await readFile(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
  const fieldSource = admin.slice(admin.indexOf('export function field('), admin.indexOf('\nfunction select(')).replace('export function', 'function');

  const wrap = vm.runInNewContext(fieldSource + '\nfield("Имя","Old",value=>data.profile.name=value)', ctx);
  const input = wrap.querySelector();
  input.value = 'New';
  await input.fire('input');

  assert.equal(current.profile.name, 'New');
  assert.ok(h.iframe.messages.some(m => m.kind === 'snapshot'), 'ввод в поле обязан толкнуть снимок в живой предпросмотр немедленно, не дожидаясь паузы или blur');
});

test('select() тоже уведомляет живой предпросмотр', async () => {
  const h = harness();
  const current = h.current;
  h.iframe.messages.length = 0;
  const { ctx } = adminSandbox(h, current);

  const admin = await readFile(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
  const selectSource = admin.slice(admin.indexOf('function select('), admin.indexOf('\nfunction text('));
  const touchSource = admin.match(/function touch\(\) \{[^\n]+/)[0];

  const wrap = vm.runInNewContext(selectSource + '\n' + touchSource + '\nselect("Статус",["draft","published"],"draft",v=>data.status=v)', ctx);
  const box = wrap.children.find(c => c.tag === 'select');
  box.value = 'published';
  await box.fire('change');

  assert.equal(current.status, 'published');
  assert.ok(h.iframe.messages.some(m => m.kind === 'snapshot'));
});

test('Группировка: несколько input подряд в одном поле — одна запись Undo, а Redo после новой правки недоступен', async () => {
  const h = harness();
  const current = h.current;
  const { ctx } = adminSandbox(h, current);
  const history = ctx.history;

  const admin = await readFile(new URL('../public/admin/admin.js', import.meta.url), 'utf8');
  const fieldSource = admin.slice(admin.indexOf('export function field('), admin.indexOf('\nfunction select(')).replace('export function', 'function');
  const wrap = vm.runInNewContext(fieldSource + '\nfield("Имя",current.profile.name,value=>current.profile.name=value)', { ...ctx, current });
  const input = wrap.querySelector();

  input.value = 'N'; await input.fire('input');
  input.value = 'Ne'; await input.fire('input');
  input.value = 'New'; await input.fire('input');
  assert.equal(history.canUndo(), false, 'до commit ничего не должно быть в стеке Undo');

  await input.fire('blur');
  assert.equal(history.canUndo(), true);
  assert.equal(current.profile.name, 'New');

  assert.equal(history.undo(), true);
  assert.notEqual(current.profile.name, 'New');
  assert.equal(history.canRedo(), true);

  assert.equal(history.redo(), true);
  assert.equal(current.profile.name, 'New');

  // Undo снова, затем НОВАЯ правка — ветка Redo обязана исчезнуть
  history.undo();
  assert.equal(history.canRedo(), true);
  input.value = 'Совсем другое'; await input.fire('input');
  assert.equal(history.canRedo(), false, 'начатая новая правка стирает ветку Redo, даже если её ещё не закоммитили');
});

// ── Общий протокол (bridge-protocol.js) ──────────────────────────

test('Протокол: конверт отсеивает постороннее сообщение и неполные поля', () => {
  assert.equal(readEnvelope(null), null);
  assert.equal(readEnvelope('строка'), null);
  assert.equal(readEnvelope({ channel: 'чужой-канал', kind: 'init' }), null);
  assert.equal(readEnvelope({ channel: CHANNEL, kind: 42 }), null);
  assert.ok(readEnvelope({ channel: CHANNEL, kind: 'init' }));
});

test('Протокол: revision — только безопасное неотрицательное целое', () => {
  for (const bad of [-1, 1.5, NaN, Infinity, '3', null, undefined, Number.MAX_SAFE_INTEGER + 1]) assert.equal(isValidRevision(bad), false);
  for (const ok of [0, 1, 999, Number.MAX_SAFE_INTEGER]) assert.equal(isValidRevision(ok), true);
});

test('Протокол: looksLikeDraft допускает пустые строки, но не мусорную форму', () => {
  assert.equal(looksLikeDraft({ profile: {}, projects: { projects: [] } }), true);
  assert.equal(looksLikeDraft({ profile: {}, projects: { projects: [{ title: '' }] } }), true);
  assert.equal(looksLikeDraft('да'), false);
  assert.equal(looksLikeDraft({ profile: {}, projects: { projects: null } }), false);
  assert.equal(looksLikeDraft({ projects: { projects: [] } }), false);
});

test('Протокол: looksLikeDraft отсеивает форму, которая крашит downstream-код (внешнее ревью коммита 9301130)', () => {
  // profile строкой вместо объекта — раньше `!!value.profile` пропускал любую непустую строку
  assert.equal(looksLikeDraft({ profile: 'wrong', projects: { projects: [] } }), false);
  // null внутри списка проектов — раньше Array.isArray(projects.projects) этого не ловил,
  // а imageNames()/рендер карточек падали на p.cover у null
  assert.equal(looksLikeDraft({ profile: {}, projects: { projects: [null] } }), false);
  assert.equal(looksLikeDraft({ profile: {}, projects: { projects: [{ title: '' }, null] } }), false);
  assert.equal(looksLikeDraft({ profile: {}, projects: { projects: ['строка вместо проекта'] } }), false);
  assert.equal(looksLikeDraft({ profile: [], projects: { projects: [] } }), false, 'массив — не профиль');
});

test('Протокол: init/snapshot/selection/mode/applied проверяют свою форму целиком', () => {
  const doc = { profile: {}, projects: { projects: [] } };
  assert.equal(isValidInit({ channelId: 'a', revision: 0, mode: 'select', document: doc }), true);
  assert.equal(isValidInit({ channelId: '', revision: 0, mode: 'select', document: doc }), false);
  assert.equal(isValidInit({ channelId: 'a', revision: -1, mode: 'select', document: doc }), false);
  assert.equal(isValidInit({ channelId: 'a', revision: 0, mode: 'сломано', document: doc }), false);

  assert.equal(isValidSnapshot({ channelId: 'a', revision: 1, mode: 'inspect', document: doc }), true);
  assert.equal(isValidSnapshot({ channelId: 'a', revision: 1, mode: 'inspect', document: doc, assets: { x: 'не-blob' } }), false);
  assert.equal(isValidSnapshot({ channelId: 'a', revision: 1, mode: 'inspect', document: doc, assets: { x: new Blob(['x'], { type: 'text/plain' }) } }), false);
  assert.equal(isValidSnapshot({ channelId: 'a', revision: 1, mode: 'inspect', document: doc, assets: { x: new Blob(['x'], { type: 'image/webp' }) } }), true);

  assert.equal(isValidModeMessage({ channelId: 'a', mode: 'select' }), true);
  assert.equal(isValidModeMessage({ channelId: 'a', mode: 'что-то' }), false);

  assert.equal(isValidSelection({ channelId: 'a', target: { type: 'project', key: 'p1' } }), true);
  assert.equal(isValidSelection({ channelId: 'a', target: { type: 'project', key: '' } }), false);
  assert.equal(isValidSelection({ channelId: 'a', target: { type: 'service', key: 'p1' } }), false);

  assert.equal(isValidApplied({ channelId: 'a', revision: 2 }), true);
  assert.equal(isValidApplied({ channelId: 'a', revision: -2 }), false);
});
