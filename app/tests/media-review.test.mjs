import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../public/admin/history.js';
import { createMediaCommands } from '../public/admin/media-commands.js';
import { createMediaDialog } from '../public/admin/media-dialog.js';

const target = { projectId: 'p1', slot: 'cover' };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
function setup() {
  let data = {id:'p1',title:'before',cover:'original'}, epoch = 0, jobs = 0;
  const pending = [], uploads = new Map();
  const history = createHistory({getData:()=>data,setData:d=>{data=d;epoch++;},onChange(){}});
  const commands = createMediaCommands({findProject:()=>data, uploads, safeName:()=>true,
    shrink:()=>{const d=deferred();pending.push(d);return d.promise;},getEpoch:()=>epoch,
    setImageJobsPending:d=>{jobs+=d;},commit:history.commit,touch:history.touch});
  return {history,commands,pending,uploads,get jobs(){return jobs;},get data(){return data;},
    type(){history.begin('title');data.title='edited';history.markDirty();},
    replace(){epoch++;}};
}
for (const asyncUpload of [false,true]) test(`text and media have separate Undo/Redo: async=${asyncUpload}`, async()=>{
  const h=setup();
  const op=asyncUpload && h.commands.uploadForTarget(target,{});
  h.type();
  if(asyncUpload){h.pending[0].resolve({url:'blob:test',blob:new Blob(['x'])});await op;}
  else h.commands.selectExistingAsset(target,'new');
  const cover=h.data.cover;
  h.history.undo();assert.deepEqual([h.data.title,h.data.cover],['edited','original']);
  h.history.undo();assert.equal(h.data.title,'before');
  h.history.redo();assert.deepEqual([h.data.title,h.data.cover],['edited','original']);
  h.history.redo();assert.equal(h.data.cover,cover);
});
test('selecting same asset preserves Redo; existing selection supersedes pending upload',async()=>{
  const h=setup();h.type();h.history.commit();h.history.undo();
  assert.equal(h.commands.selectExistingAsset(target,'original').status,'unchanged');
  assert.equal(h.history.canRedo(),true);
  const op=h.commands.uploadForTarget(target,{});
  h.commands.selectExistingAsset(target,'chosen');
  h.pending[0].resolve({url:'blob:unused'});
  assert.equal((await op).status,'cancelled');assert.equal(h.data.cover,'chosen');assert.equal(h.uploads.size,0);
});
for (const reason of ['session','epoch','newer']) test(`stale failures are silent: ${reason}`,async()=>{
  const h=setup();let cancelled=false;
  const op=h.commands.uploadForTarget(target,{}, {isCancelled:()=>cancelled});
  if(reason==='session')cancelled=true;
  if(reason==='epoch')h.replace();
  if(reason==='newer')h.commands.selectExistingAsset(target,'newer');
  h.pending[0].reject(Error('old failure'));
  assert.deepEqual(await op,{status:'cancelled'});assert.equal(h.jobs,0);assert.equal(h.uploads.size,0);
});

class Element {
  children=[];handlers={};attrs={};value='';open=false;disabled=false;
  classList={add(){},remove(){}};
  constructor(tag){this.tag=tag;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,fn){(this.handlers[k]??=[]).push(fn);}
  showModal(){this.open=true;}close(){this.open=false;}
  fire(k,e={}){return Promise.all((this.handlers[k]??=[]).map(fn=>fn(e)));}
}
const walk=e=>[e,...e.children.flatMap(walk)];
function ui(onUploadFile){
  globalThis.document={createElement:tag=>new Element(tag)};
  const mount=new Element('main');let focused=0;
  const dialog=createMediaDialog({mount,mediaLibrary:()=>[],assetUrl:n=>n});
  const open=()=>dialog.open(target,'Cover',{onUploadFile,restoreFocus:()=>focused++});
  open();
  const nodes=walk(mount);
  const input=nodes.find(n=>n.type==='file'),status=nodes.find(n=>n.className==='media-status');
  return {dialog,open,status,input,modal:nodes.find(n=>n.tag==='dialog'),get focused(){return focused;},
    upload(){input.files=[{}];return input.fire('change');}};
}
test('inline upload error permits retry; unexpected rejection also releases busy',async()=>{
  let attempt=0;
  const h=ui(async()=>{attempt++;if(attempt===1)return {status:'error',message:'Bad image'};if(attempt===2)throw Error('Preview failed');return {status:'applied'};});
  await h.upload();assert.equal(h.status.textContent,'Bad image');assert.equal(h.input.disabled,false);assert.equal(h.dialog.isOpen(),true);
  await h.upload();assert.equal(h.status.textContent,'Preview failed');assert.equal(h.input.disabled,false);
  await h.upload();assert.equal(h.dialog.isOpen(),false);assert.equal(h.focused,1);
});
test('Escape stays in modal; cancelled old failure cannot affect reopened dialog',async()=>{
  const old=deferred(),next=deferred();let count=0;
  const h=ui(()=>count++?next.promise:old.promise);
  let stopped=false,prevented=false;
  const first=h.upload();
  await h.modal.fire('keydown',{key:'Escape',stopPropagation(){stopped=true;}});
  await h.modal.fire('cancel',{preventDefault(){prevented=true;}});
  assert.equal(stopped,true);assert.equal(prevented,true);assert.equal(h.focused,1);
  h.open();const second=h.upload();
  old.reject(Error('stale'));await first;
  assert.equal(h.input.disabled,true);assert.equal(h.status.textContent,'Готовлю изображение…');
  next.resolve({status:'error',message:'Current failure'});await second;
  assert.equal(h.status.textContent,'Current failure');assert.equal(h.input.disabled,false);
});
