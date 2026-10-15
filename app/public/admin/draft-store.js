import { DEFAULT_SETTINGS } from './settings.js';
import { imageNames, safeName, SHOTS_DIR } from './model.js';
import { looksLikeDraft } from './bridge-protocol.js';

const VERSION = 1;
export const workspaceKey = ({ owner, repo, branch }, local) => JSON.stringify([owner.toLowerCase(), repo.toLowerCase(), branch, local ? 'local' : 'github']);
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const invalid = () => { throw new Error('Локальная копия повреждена или имеет неподдерживаемый формат. Сохранённая копия не удалена.'); };

// Shape validation deliberately permits unfinished fields. Publication retains
// validateContent. Reject credentials/URLs by persisting only this explicit envelope.
export function checkDraftDocument(data) {
  if (!looksLikeDraft(data) || !plain(data.profile.links) || !Array.isArray(data.profile.track) || !Array.isArray(data.profile.tools)) invalid();
  const strings = (object, keys) => plain(object) && keys.every(key => typeof object[key] === 'string');
  if (!strings(data.profile, ['name', 'role', 'city', 'email', 'phone']) || !strings(data.profile.links, ['behance', 'dribbble'])) invalid();
  if (data.profile.links.linkedin !== undefined && typeof data.profile.links.linkedin !== 'string') invalid();
  if (!data.profile.track.every(v => strings(v, ['client', 'role', 'kind', 'period', 'note'])) || !data.profile.tools.every(v => strings(v, ['name', 'for', 'logo']))) invalid();
  if (data.services !== undefined && (!Array.isArray(data.services) || !data.services.every(plain))) invalid();
  if (data.settings !== undefined) {
    if (!plain(data.settings) || Object.entries(data.settings).some(([key, value]) => !(key in DEFAULT_SETTINGS) || typeof value !== typeof DEFAULT_SETTINGS[key])) invalid();
  }
  if (data.services?.some(v => !strings(v, ['id', 'title', 'detail', 'group']) || typeof v.hero !== 'boolean')) invalid();
  if (data.projects.projects.length > 100) invalid();
  for (const p of data.projects.projects) {
    if (!Array.isArray(p.shots) || p.shots.length > 100 || !p.shots.every(s => plain(s) && safeName(s.file) && typeof s.alt === 'string')) invalid();
    for (const key of ['slug', 'title', 'kind', 'role', 'year', 'note', 'cover']) if (typeof p[key] !== 'string') invalid();
    if (p.story !== undefined && (!plain(p.story) || Object.values(p.story).some(v => typeof v !== 'string'))) invalid();
    if (!['draft', 'published'].includes(p.status) || !['wide', 'tall'].includes(p.ratio) || !['commercial', 'teaching', 'study', 'personal'].includes(p.category)) invalid();
  }
  for (const name of imageNames(data)) if (!safeName(name)) invalid();
  const json = JSON.stringify(data);
  if (json.length > 2 * 1024 * 1024) invalid();
  return data;
}

export function captureDraft({ data, base, baseHead, uploads, knownFiles }) {
  const document = structuredClone(data), assets = {};
  checkDraftDocument(document);
  for (const name of imageNames(document)) {
    const image = uploads.get(name);
    if (image) assets[name] = image.blob || new Blob([image.bytes], { type: 'image/webp' });
  }
  const snapshot = { version: VERSION, document, base: structuredClone(base), baseHead,
    knownFiles: [...knownFiles], assets, savedAt: Date.now() };
  validateSnapshot(snapshot);
  return snapshot;
}

export function validateSnapshot(s) {
  if (!s || s.version !== VERSION || !Number.isFinite(s.savedAt) || typeof s.baseHead !== 'string' || !Array.isArray(s.knownFiles) || !s.knownFiles.every(v => typeof v === 'string') || !plain(s.assets)) invalid();
  checkDraftDocument(s.document); checkDraftDocument(s.base);
  const used = new Set(imageNames(s.document)), known = new Set(s.knownFiles);
  for (const [name, blob] of Object.entries(s.assets)) {
    if (!safeName(name) || !used.has(name) || !(blob instanceof Blob) || blob.type !== 'image/webp' || !blob.size || blob.size > 20 * 1024 * 1024) invalid();
  }
  for (const name of used) if (!s.assets[name] && !known.has(`${SHOTS_DIR}/${name}.webp`)) invalid();
  return s;
}

export function matchesDraftBase(snapshot, baseHead, base) {
  const comparable = value => {
    const copy = structuredClone(value);
    for (const project of copy.projects.projects) {
      delete project.id;
      for (const shot of project.shots) delete shot.id;
    }
    return JSON.stringify(copy);
  };
  return snapshot.baseHead === baseHead && comparable(snapshot.base) === comparable(base);
}

export async function restoreUploads(snapshot) {
  validateSnapshot(snapshot);
  const result = new Map();
  // Read all bytes before creating URLs, so a failed read cannot leak URLs.
  const entries = await Promise.all(Object.entries(snapshot.assets).map(async ([name, blob]) => [name, blob, new Uint8Array(await blob.arrayBuffer())]));
  for (const [name, blob, bytes] of entries) result.set(name, { blob, bytes, url: URL.createObjectURL(blob) });
  return result;
}

export function createDraftStore(indexedDB, name = 'portfolio-drafts') {
  let opening;
  async function open() {
    if (opening) return opening;
    // Access can itself throw SecurityError in a storage-restricted browser.
    // Resolve it only inside this async operation, never during editor startup.
    const factory = indexedDB === undefined ? globalThis.indexedDB : indexedDB;
    if (!factory) throw new Error('IndexedDB недоступна. Разреши хранилище браузера или скачай копию.');
    return opening = new Promise((resolve, reject) => {
      const req = factory.open(name, VERSION);
      req.onupgradeneeded = () => req.result.createObjectStore('drafts');
      req.onerror = () => { opening = null; reject(req.error); };
      req.onblocked = () => { opening = null; reject(new Error('Закрой старые вкладки редактора и повтори.')); };
      req.onsuccess = () => { const db = req.result; db.onversionchange = () => { db.close(); opening = null; }; resolve(db); };
    }).catch(error => { opening = null; throw error; });
  }
  return {
    async read(key) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readonly'), req = tx.objectStore('drafts').get(key);
        tx.oncomplete = () => resolve(req.result || { revision: 0, snapshot: null });
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('Не удалось прочитать черновик.'));
      });
    },
    async write(key, expected, snapshot) {
      if (snapshot) validateSnapshot(snapshot);
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts');
        let failure;
        const req = store.get(key);
        req.onsuccess = () => {
          if ((req.result?.revision || 0) !== expected) {
            failure = new Error('Другая вкладка сохранила этот черновик. Автосохранение остановлено. Скачай свою копию или перечитай данные.');
            failure.name = 'DraftConflictError'; tx.abort(); return;
          }
          // Keep a revisioned tombstone on discard; deletion would allow an old
          // tab with expected revision 0 to resurrect a discarded document.
          try { store.put({ revision: expected + 1, snapshot }, key); }
          catch (err) { failure = err; tx.abort(); }
        };
        tx.oncomplete = () => resolve(expected + 1);
        tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Не удалось записать черновик.'));
      });
    },
  };
}

// Serial/coalescing writer. Captures arrive immutable; completion of an older
// revision never announces the newest edit as saved. flush never throws from
// lifecycle events; explicit discard does propagate failures to its caller.
export function createDraftQueue({ store, key, revision = 0, onState = () => {}, delay = 600 }) {
  let pending, running, timer, error, stopped = false;
  let sequence = 0;
  function report(state, err) { onState({ state, error: err, revision }); }
  async function run() {
    while (pending && !error && !stopped) {
      const job = pending; pending = undefined;
      try {
        revision = await store.write(key, revision, job.snapshot);
        if (job.sequence === sequence && !pending && !stopped) report('saved');
      } catch (err) {
        error = err;
        if (!pending) pending = job;
        report('error', err);
      }
    }
  }
  function flush() {
    clearTimeout(timer);
    if (running) return running;
    running = run().finally(() => { running = null; });
    return running;
  }
  return {
    schedule(snapshot, immediate = false) {
      if (stopped) return;
      pending = { snapshot, sequence: ++sequence };
      if (error) { report('error', error); return; }
      report('saving'); clearTimeout(timer);
      if (immediate) void flush(); else timer = setTimeout(flush, delay);
    },
    flush,
    fail(err) {
      error = err; sequence++; pending = undefined; clearTimeout(timer); report('error', err);
    },
    async retry() {
      if (error?.name === 'DraftConflictError') return;
      error = null; report('saving'); await flush();
    },
    async discard() {
      clearTimeout(timer);
      const previousPending = pending;
      pending = undefined; stopped = true;
      try {
        if (running) await running;
        if (error) throw error;
        revision = await store.write(key, revision, null);
      } catch (err) {
        // A failed discard must not leave the current editor permanently
        // stopped, lose its pending snapshot, or suppress the unload warning.
        stopped = false; pending ||= previousPending; error = err;
        report('error', err); throw err;
      }
    },
    async stop() { await flush(); stopped = true; clearTimeout(timer); },
    hasConflict: () => error?.name === 'DraftConflictError',
    unsafe: () => !!pending || !!running || !!error,
  };
}
