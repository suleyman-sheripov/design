import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory, IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import { createDraftStore, createDraftQueue, captureDraft, validateSnapshot, restoreUploads, workspaceKey, matchesDraftBase } from '../public/admin/draft-store.js';
import { imageNames, SHOTS_DIR, validateContent } from '../public/admin/model.js';
import { GitHub } from '../public/admin/github.js';
import { createHistory } from '../public/admin/history.js';
const source = JSON.parse(await readFile(new URL('../../content/data/site.json', import.meta.url), 'utf8'));
const files = new Set(imageNames(source).map(n => `${SHOTS_DIR}/${n}.webp`));
const key = workspaceKey({ owner: 'Owner', repo: 'design', branch: 'main' }, true);
function snapshot(title = 'Changed') {
  const data = structuredClone(source); data.projects.projects[0].title = title;
  return captureDraft({ data, base: source, baseHead: 'old', uploads: new Map(), knownFiles: files });
}
function store() { return createDraftStore(new IDBFactory()); }
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }

test('Actual IndexedDB roundtrip stores one shared Blob and restores bytes, references, unfinished title and order', async () => {
  const data = structuredClone(source), p = data.projects.projects.find(p=>p.status==='published');
  const projectIndex=data.projects.projects.indexOf(p);
  p.title = ''; p.cover = 'new-image'; p.caseCover = 'new-image';
  p.shots = [{ id:'stable-b',file:'new-image',alt:'' }, { id:'stable-a',file:p.shots[0].file,alt:'Existing' }];
  const bytes = new Uint8Array([9,8,7]), uploads = new Map([['new-image',{ bytes,blob:new Blob([bytes],{type:'image/webp'}),url:'blob:should-never-persist' }]]);
  const s = captureDraft({ data, base:source, baseHead:'old',uploads,knownFiles:files });
  data.projects.projects[projectIndex].title = 'mutated after capture';
  const db = store(); await db.write(key,0,s);
  const record = await db.read(key), restored = await restoreUploads(record.snapshot);
  assert.equal(record.snapshot.document.projects.projects[projectIndex].title,'');
  assert.deepEqual(record.snapshot.document.projects.projects[projectIndex].shots.map(s=>s.id),['stable-b','stable-a']);
  assert.deepEqual([...restored.get('new-image').bytes],[9,8,7]);
  assert.equal(restored.size,1); assert.ok(restored.get('new-image').url.startsWith('blob:'));
  assert.ok(!JSON.stringify(record).includes('should-never-persist'));
  assert.throws(()=>validateContent(record.snapshot.document),/title/);
  URL.revokeObjectURL(restored.get('new-image').url);
});
test('Missing Blob or malformed records are rejected without deleting the last complete copy', async () => {
  const db=store(), good=snapshot(); await db.write(key,0,good);
  const bad=snapshot(); bad.document.projects.projects[0].cover='missing-file';
  await assert.rejects(db.write(key,1,bad),/повреждена/);
  assert.equal((await db.read(key)).revision,1);
  for(const change of [s=>s.version=99,s=>s.document.profile.track=null,s=>s.document.projects.projects[0].shots=[null],s=>s.base=null]) {
    const malformed=snapshot();change(malformed);assert.throws(()=>validateSnapshot(malformed));
  }
});
test('Two tabs use transactional compare-and-swap; exactly one write wins and the loser retains its pending document', async () => {
  const db=store(), states=[];
  const a=createDraftQueue({store:db,key,onState:s=>states.push(s)}), b=createDraftQueue({store:db,key});
  a.schedule(snapshot('tab A')); b.schedule(snapshot('tab B'));
  await Promise.all([a.flush(),b.flush()]);
  const record=await db.read(key);
  assert.equal(record.revision,1); assert.ok(a.unsafe() !== b.unsafe());
  const loser=a.unsafe()?a:b;
  await loser.retry(); assert.equal((await db.read(key)).revision,1);
});
test('Discard tombstone prevents an old empty tab from resurrecting discarded work', async () => {
  const db=store();await db.write(key,0,null);
  await assert.rejects(db.write(key,0,snapshot()),{name:'DraftConflictError'});
  assert.equal((await db.read(key)).snapshot,null);
});
test('Slow real store writes coalesce rapid edits and Undo/Redo; an older completion never reports the newest edit saved', async () => {
  const db=store(), wait=deferred(), entered=deferred(), states=[];
  let first=true;
  const delayed={write:async(...args)=>{if(first){first=false;entered.resolve();await wait.promise;}return db.write(...args);}};
  const q=createDraftQueue({store:delayed,key,onState:s=>states.push(s.state)});
  let data=structuredClone(source);
  const h=createHistory({getData:()=>data,setData:v=>data=v,onChange:()=>q.schedule(captureDraft({data,base:source,baseHead:'old',uploads:new Map(),knownFiles:files}))});
  data.projects.projects[0].title='first';h.touch();const flush=q.flush();await entered.promise;
  data.projects.projects[0].title='latest';h.touch();h.undo();h.redo();
  wait.resolve();await flush;
  assert.equal((await db.read(key)).snapshot.document.projects.projects[0].title,'latest');
  assert.equal(states.filter(s=>s==='saved').length,1);assert.equal(q.unsafe(),false);
});
test('Discard waits for in-flight write and cancels pending older document; import/stop drains before a new session', async () => {
  const db=store(), wait=deferred(), entered=deferred();let first=true;
  const delayed={write:async(...a)=>{if(first){first=false;entered.resolve();await wait.promise;}return db.write(...a);}};
  const q=createDraftQueue({store:delayed,key});q.schedule(snapshot('old'));void q.flush();await entered.promise;
  q.schedule(snapshot('also old'));const discarded=q.discard();wait.resolve();await discarded;
  assert.equal((await db.read(key)).snapshot,null);
  q.schedule(snapshot('too late'));await q.flush();assert.equal((await db.read(key)).snapshot,null);
  const next=createDraftQueue({store:db,key,revision:(await db.read(key)).revision});
  next.schedule(snapshot('imported'));await next.stop();
  assert.equal((await db.read(key)).snapshot.document.projects.projects[0].title,'imported');
});
test('Quota failure leaves the previous committed snapshot, no saved state, and retry stores the latest pending edit', async () => {
  const db=store();await db.write(key,0,snapshot('last complete'));
  const original=IDBDatabase.prototype.transaction, states=[];
  const q=createDraftQueue({store:db,key,revision:1,onState:s=>states.push(s.state)});
  try {
    IDBDatabase.prototype.transaction=function(names,mode,...rest){if(mode==='readwrite')throw new DOMException('Storage full','QuotaExceededError');return original.call(this,names,mode,...rest);};
    q.schedule(snapshot('failed'));await q.flush();
    assert.equal((await db.read(key)).snapshot.document.projects.projects[0].title,'last complete');
    assert.ok(q.unsafe());assert.ok(!states.includes('saved'));
    q.schedule(snapshot('newest after failure'));
  } finally { IDBDatabase.prototype.transaction=original; }
  await q.retry();assert.equal((await db.read(key)).snapshot.document.projects.projects[0].title,'newest after failure');
  assert.equal(states.at(-1),'saved');
});
test('Workspace modes, branches and repositories remain isolated; baseline and head survive roundtrip',async()=>{
  const db=store(), auth={owner:'Owner',repo:'design',branch:'main'};
  const keys=[workspaceKey(auth,true),workspaceKey(auth,false),workspaceKey({...auth,branch:'review'},true),workspaceKey({...auth,repo:'other'},true)];
  assert.equal(new Set(keys).size,4);
  await db.write(keys[0],0,snapshot());
  for(const k of keys.slice(1))assert.equal((await db.read(k)).snapshot,null);
  const s=(await db.read(keys[0])).snapshot;assert.equal(s.baseHead,'old');assert.deepEqual(s.base,source);
});
test('Real GitHub adapter failure preserves the draft; only a successful non-force ref update permits clearing it',async()=>{
  const db=store(), q=createDraftQueue({store:db,key});q.schedule(snapshot());await q.flush();
  let fail=true, patchBody;
  const client=new GitHub({owner:'Owner',repo:'design',branch:'test-only',token:'test-memory-only'},async(url,opts)=>{
    const path=new URL(url).pathname;
    if (opts.method==='PATCH') {
      patchBody=JSON.parse(opts.body);
      if(fail)return {ok:false,status:409};
    }
    const result=path.includes('/git/ref/heads/')?{object:{sha:'old'}}:path.endsWith('/git/commits/old')?{tree:{sha:'tree'}}:{sha:'new'};
    return {ok:true,json:async()=>result};
  });
  const publish=async()=>{await client.save(snapshot().document,new Map(),'old');await q.discard();};
  await assert.rejects(publish(),/Ветка изменилась/);assert.ok((await db.read(key)).snapshot);
  fail=false;await publish();assert.equal((await db.read(key)).snapshot,null);
  assert.equal(patchBody.force,false);
});
test('Base comparison ignores generated legacy IDs but recognises changed content and remote head',()=>{
  const s=snapshot(), loaded=structuredClone(source);
  for (const p of loaded.projects.projects) {p.id=crypto.randomUUID();for(const shot of p.shots)shot.id=crypto.randomUUID();}
  assert.equal(matchesDraftBase(s,'old',loaded),true);
  assert.equal(matchesDraftBase(s,'new',loaded),false);
  loaded.profile.name+=' changed';assert.equal(matchesDraftBase(s,'old',loaded),false);
});
test('Capture failure during a slow write never announces false success; retry preserves last complete copy until valid capture',async()=>{
  const db=store(), wait=deferred(), entered=deferred(), states=[];
  const delayed={write:async(...a)=>{entered.resolve();await wait.promise;return db.write(...a);}};
  const q=createDraftQueue({store:delayed,key,onState:s=>states.push(s.state)});
  q.schedule(snapshot('previous'));const flushing=q.flush();await entered.promise;
  q.fail(Error('Invalid capture'));wait.resolve();await flushing;
  assert.equal(states.at(-1),'error');assert.equal(q.unsafe(),true);
  q.schedule(snapshot('corrected'));await q.retry();
  assert.equal((await db.read(key)).snapshot.document.projects.projects[0].title,'corrected');
});
test('Unavailable IndexedDB rejects without crashing manual editing',async()=>{
  const db=createDraftStore(null);await assert.rejects(db.read(key),/IndexedDB недоступна/);
});

test('An aborted transaction after put cannot persist either a partial document or its new Blob',async()=>{
  const db=store();await db.write(key,0,snapshot('committed'));
  const original=IDBObjectStore.prototype.put;
  try {
    IDBObjectStore.prototype.put=function(...args){const req=original.apply(this,args);this.transaction.abort();return req;};
    const next=snapshot('aborted');next.document.projects.projects[0].cover='transaction-image';
    next.assets['transaction-image']=new Blob([new Uint8Array([1,2,3])],{type:'image/webp'});
    await assert.rejects(db.write(key,1,next));
  } finally {IDBObjectStore.prototype.put=original;}
  const record=await db.read(key);assert.equal(record.revision,1);assert.equal(record.snapshot.document.projects.projects[0].title,'committed');
});
