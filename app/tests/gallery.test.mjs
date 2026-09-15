import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHistory } from '../public/admin/history.js';
import { createMediaCommands } from '../public/admin/media-commands.js';
import { ensureShotIds, validateContent, imageNames, safeName } from '../public/admin/model.js';

const add = {projectId:'p',slot:'gallery-add'};
const target = id => ({projectId:'p',slot:'gallery',galleryItemId:id});
function setup() {
  let data={id:'p',title:'Project',cover:'cover',caseCover:'case',shots:[{id:'a',file:'same',alt:'A'},{id:'b',file:'same',alt:'B'}]}, epoch=0, jobs=0;
  const uploads=new Map(),pending=[];
  const history=createHistory({getData:()=>data,setData:v=>{data=v;epoch++;},onChange(){}});
  const commands=createMediaCommands({findProject:id=>id===data.id?data:undefined,uploads,safeName,
    shrink:()=>new Promise((resolve,reject)=>pending.push({resolve:()=>resolve({url:'blob:test',blob:new Blob(['x'])}),reject})),
    getEpoch:()=>epoch,setImageJobsPending:d=>jobs+=d,commit:history.commit,touch:history.touch});
  return {commands,history,uploads,pending,get data(){return data;},get jobs(){return jobs;},reload(){epoch++;}};
}
test('gallery actions have distinct real Undo/Redo steps and preserve both covers',()=>{
  const h=setup(), snapshots=[JSON.stringify(h.data)];
  const added=h.commands.selectExistingAsset(add,'same');
  assert.notEqual(added.galleryItemId,'a');assert.notEqual(added.galleryItemId,'b');
  snapshots.push(JSON.stringify(h.data));
  h.commands.moveGalleryItem(target(added.galleryItemId),-1);snapshots.push(JSON.stringify(h.data));
  h.commands.selectExistingAsset(target('a'),'replacement');snapshots.push(JSON.stringify(h.data));
  h.commands.removeGalleryItem(target('b'));snapshots.push(JSON.stringify(h.data));
  for(let i=snapshots.length-2;i>=0;i--){assert.equal(h.history.undo(),true);assert.equal(JSON.stringify(h.data),snapshots[i]);}
  for(let i=1;i<snapshots.length;i++){assert.equal(h.history.redo(),true);assert.equal(JSON.stringify(h.data),snapshots[i]);}
  assert.equal(h.data.cover,'cover');assert.equal(h.data.caseCover,'case');assert.equal(h.uploads.size,0);
});
test('gallery replacement follows id while entry moves, not stale index',async()=>{
  const h=setup();const op=h.commands.uploadForTarget(target('a'),{});
  h.commands.moveGalleryItem(target('a'),1);h.pending[0].resolve();
  assert.equal((await op).status,'applied');assert.equal(h.data.shots[0].id,'b');
  assert.equal(h.data.shots[0].file,'same');assert.notEqual(h.data.shots[1].file,'same');assert.equal(h.jobs,0);
});
for(const reason of ['delete','undo','reload','cancel','newer']) test(`pending gallery replacement invalidated by ${reason}`,async()=>{
  const h=setup();let cancelled=false;
  h.commands.moveGalleryItem(target('a'),1);
  const op=h.commands.uploadForTarget(target('a'),{}, {isCancelled:()=>cancelled});
  if(reason==='delete')h.commands.removeGalleryItem(target('a'));
  if(reason==='undo')h.history.undo();
  if(reason==='reload')h.reload();
  if(reason==='cancel')cancelled=true;
  if(reason==='newer')h.commands.selectExistingAsset(target('a'),'selected');
  const expected=JSON.stringify(h.data);h.pending[0].resolve();
  assert.equal((await op).status,'cancelled');assert.equal(JSON.stringify(h.data),expected);assert.equal(h.uploads.size,0);assert.equal(h.jobs,0);
});
test('adding an upload has no placeholder; cancellation/failure leave data and history unchanged',async()=>{
  const h=setup(),before=JSON.stringify(h.data);let cancelled=false;
  const op=h.commands.uploadForTarget(add,{}, {isCancelled:()=>cancelled});
  assert.equal(JSON.stringify(h.data),before);cancelled=true;h.pending[0].resolve();
  assert.equal((await op).status,'cancelled');assert.equal(h.history.canUndo(),false);assert.equal(h.uploads.size,0);
  const failed=h.commands.uploadForTarget(add,{});h.pending[1].reject(Error('bad image'));
  assert.equal((await failed).status,'error');assert.equal(JSON.stringify(h.data),before);assert.equal(h.jobs,0);
});
test('new upload survives delete/Undo; removal never deletes shared assets',async()=>{
  const h=setup();const op=h.commands.uploadForTarget(add,{});h.pending[0].resolve();const result=await op;
  const file=h.data.shots.at(-1).file;
  h.commands.removeGalleryItem(target(result.galleryItemId));assert.equal(h.uploads.has(file),true);
  h.history.undo();assert.equal(h.data.shots.at(-1).file,file);assert.equal(h.uploads.has(file),true);
});
test('text typed during add upload is committed separately',async()=>{
  const h=setup();const op=h.commands.uploadForTarget(add,{});
  h.history.begin('title');h.data.title='Edited';h.history.markDirty();
  h.pending[0].resolve();await op;h.history.undo();assert.equal(h.data.title,'Edited');assert.equal(h.data.shots.length,2);
  h.history.undo();assert.equal(h.data.title,'Project');
});
test('bounds and invalid targets are no-ops and preserve Redo',()=>{
  const h=setup();h.commands.moveGalleryItem(target('a'),1);h.history.undo();
  assert.equal(h.commands.moveGalleryItem(target('a'),-1).status,'unchanged');
  assert.equal(h.commands.removeGalleryItem(target('missing')).status,'cancelled');
  assert.equal(h.commands.moveGalleryItem(target('a'),50).status,'cancelled');
  assert.equal(h.history.canRedo(),true);
});
test('last removal gives empty gallery, no cover change; max 100 enforced',()=>{
  const h=setup();h.commands.removeGalleryItem(target('a'));const r=h.commands.removeGalleryItem(target('b'));
  assert.equal(r.galleryItemId,undefined);assert.equal(h.data.shots.length,0);assert.equal(h.data.cover,'cover');
  h.data.shots=Array.from({length:100},(_,i)=>({id:'shot-'+i,file:'same',alt:'Caption'}));
  assert.equal(h.commands.selectExistingAsset(add,'same').status,'cancelled');assert.equal(h.data.shots.length,100);
});
const fixture=()=>JSON.parse(readFileSync(new URL('../public/content/data/site.json',import.meta.url),'utf8'));
test('reload cannot let an old upload completion unlock saving while a new upload is pending', async()=>{
  const source=readFileSync(new URL('../public/admin/admin.js',import.meta.url),'utf8');
  const loadSource=source.slice(source.indexOf('async function load()'),source.indexOf('/* Стабильная идентичность'));
  const counterSource=source.slice(source.indexOf('function setImageJobsPending'),source.indexOf('\nstart();'));
  const save={disabled:false};
  const ctx={local:false,github:{load:async()=>({data:fixture(),head:'new',files:new Set()})},documentEpoch:0,
    defaultServices:[],stampProjectIds(){},serialize:JSON.stringify,history:{clear(){}},clearUploads(){},
    pendingImageJobs:1,liveEditor:{},render(){},setDirty(){},say(){},ui:{loadState:{},saveState:{}},el:()=>save,dirty:true,busy:false};
  vm.createContext(ctx);vm.runInContext(loadSource+'\n'+counterSource,ctx);
  await ctx.load();assert.equal(ctx.pendingImageJobs,1);
  ctx.setImageJobsPending(1);ctx.setImageJobsPending(-1);
  assert.equal(ctx.pendingImageJobs,1);assert.equal(save.disabled,true);
  ctx.setImageJobsPending(-1);assert.equal(save.disabled,false);
});
test('old JSON gets stable IDs once; repeated file occurrences validate and serialize separately',()=>{
  const data=fixture(),p=data.projects.projects.find(p=>p.shots.length);
  for(const project of data.projects.projects)for(const shot of project.shots)delete shot.id;
  p.shots.push({...p.shots[0]});validateContent(data);ensureShotIds(data);
  const saved=JSON.stringify(data);ensureShotIds(data);assert.equal(JSON.stringify(data),saved);
  assert.equal(new Set(p.shots.map(s=>s.id)).size,p.shots.length);
  validateContent(JSON.parse(saved));assert.equal(imageNames(data).filter(n=>n===p.shots[0].file).length,1);
});
test('invalid or duplicate occurrence IDs are rejected without rejecting shared files',()=>{
  const data=ensureShotIds(fixture()),p=data.projects.projects.find(p=>p.shots.length>1);
  p.shots[1].id=p.shots[0].id;assert.throws(()=>validateContent(data),/Идентификаторы/);
  p.shots[1].id='..';assert.throws(()=>validateContent(data),/Идентификаторы/);
});
