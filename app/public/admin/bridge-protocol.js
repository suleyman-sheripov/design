/* Протокол моста между админкой (editor-live.js) и сайтом внутри
   iframe (app/src/lib/previewBridge.ts).

   Общий файл для обеих сторон — как model.js уже общий для admin.js
   и app/src/lib/content.ts. Раньше константа канала и форма
   сообщений были продублированы в двух местах с комментарием, что
   общий модуль невозможен без отдельной сборки; это было неверно —
   тот же приём с относительным импортом уже работает для model.js
   в dev и в проде, и здесь работает так же. */

export const CHANNEL = 'portfolio-editor-bridge/1';

/* Черновик во время ввода может на миг содержать пустые строки —
   это не то же самое, что готовность к публикации (её проверяет
   validateContent в model.js). Здесь проверяется только форма:
   профиль и список проектов существуют как объект/массив. */
export function looksLikeDraft(value) {
  if (!value || typeof value !== 'object') return false;
  const projects = value.projects;
  return !!value.profile && !!projects && Array.isArray(projects.projects);
}

export function isValidRevision(value) {
  return Number.isInteger(value) && Number.isFinite(value) && value >= 0;
}

export function isValidMode(value) {
  return value === 'select' || value === 'inspect';
}

/* Конверт: канал и вид сообщения — до того, как читать что-то
   специфичное для конкретного kind. Постороннее сообщение (чужой
   HMR, расширение браузера) отсеивается на этом же шаге. */
export function readEnvelope(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.channel !== CHANNEL) return null;
  if (typeof raw.kind !== 'string') return null;
  return raw;
}

export function isValidInit(raw) {
  return typeof raw.channelId === 'string' && raw.channelId.length > 0
    && isValidRevision(raw.revision) && isValidMode(raw.mode) && looksLikeDraft(raw.document);
}

const ASSET_TYPES = /^image\/(png|jpeg|webp)$/;
const ASSET_MAX_BYTES = 20 * 1024 * 1024;

export function isValidAssetMap(assets) {
  if (assets === undefined) return true;
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) return false;
  for (const blob of Object.values(assets)) {
    if (!(blob instanceof Blob)) return false;
    if (!ASSET_TYPES.test(blob.type)) return false;
    if (blob.size > ASSET_MAX_BYTES) return false;
  }
  return true;
}

export function isValidSnapshot(raw) {
  return typeof raw.channelId === 'string' && isValidRevision(raw.revision) && isValidMode(raw.mode)
    && looksLikeDraft(raw.document) && isValidAssetMap(raw.assets);
}

export function isValidModeMessage(raw) {
  return typeof raw.channelId === 'string' && isValidMode(raw.mode);
}

export function isValidSelection(raw) {
  return typeof raw.channelId === 'string' && !!raw.target && raw.target.type === 'project'
    && typeof raw.target.key === 'string' && raw.target.key.length > 0;
}

export function isValidApplied(raw) {
  return typeof raw.channelId === 'string' && isValidRevision(raw.revision);
}
