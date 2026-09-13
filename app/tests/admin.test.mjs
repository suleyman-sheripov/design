import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, imageNames } from '../public/admin/model.js';
import { GitHub } from '../public/admin/github.js';
const source=JSON.parse(await readFile(new URL('../../content/data/site.json',import.meta.url),'utf8'));
const copy=()=>structuredClone(source);
test('Отдельные превью и обложка кейса не требуют включения в галерею',()=>{
  const d=copy(),p=d.projects.projects.find(p=>p.status==='published'),shots=structuredClone(p.shots);
  p.cover='independent-preview';p.caseCover='independent-case';
  validateContent(d);assert.deepEqual(p.shots,shots);
  assert.ok(imageNames(d).includes(p.cover));assert.ok(imageNames(d).includes(p.caseCover));
  p.caseCover='../secret';assert.throws(()=>validateContent(d));
});
test('Настройки и услуги отклоняют опасные ссылки, CSS и неверные значения',()=>{
  for(const settings of [{resume:'javascript:alert(1)'},{paper:'url(https://invalid)'},{cardRadius:Infinity},{cardRadius:41},{previewStyle:'unknown'},{showRibbon:'false'}]) {
    const d=copy();d.settings=settings;assert.throws(()=>validateContent(d));
  }
  const d=copy();d.settings={paper:'#f0eade',cardRadius:12,showServices:false};assert.equal(validateContent(d).settings.cardRadius,12);
  d.services=[{id:'web',title:'Сайт',group:'digital',hero:true,detail:'Описание'},{id:'web',title:'Дубликат',group:'digital',hero:false,detail:''}];
  assert.throws(()=>validateContent(d),/уникальными/);
});
test('Админка проверяет владельца до чтения репозитория',async()=>{
  const calls=[];
  const client=new GitHub({owner:'Owner',repo:'design',branch:'main',token:'test'},async(url)=>{calls.push(url);return {ok:true,json:async()=>({login:'intruder'})}});
  await assert.rejects(client.authorize(),/владельцу/);
  assert.deepEqual(calls,['https://api.github.com/user']);
});
test('Вход владельца требует права записи, сравнение логина без учёта регистра',async()=>{
  for(const push of [false,true]) {
    const calls=[];
    const client=new GitHub({owner:'Owner',repo:'design',branch:'main',token:'test'},async(url)=>{calls.push(url);return {ok:true,json:async()=>url.endsWith('/user')?{login:'owner'}:{permissions:{push}}}});
    if(push)assert.equal(await client.authorize(),'owner');else await assert.rejects(client.authorize(),/права записи/);
    assert.equal(calls.length,2);
  }
});
test('Отдельно загруженные обложки включаются в тот же коммит, неиспользуемые картинки пропускаются',async()=>{
  const d=copy(),p=d.projects.projects.find(p=>p.status==='published');p.cover='preview-upload';p.caseCover='case-upload';
  const writes=[];
  const client=new GitHub({owner:'owner',repo:'design',branch:'main',token:'test'},async(url,opts)=>{
    const path=new URL(url).pathname,body=opts.body&&JSON.parse(opts.body);writes.push({path,body});
    return {ok:true,json:async()=>path.includes('/git/ref/heads/')?{object:{sha:'old'}}:path.endsWith('/commits/old')?{tree:{sha:'tree'}}:{sha:'new'}};
  });
  await client.save(d,new Map(['preview-upload','case-upload','unused'].map(n=>[n,{bytes:new Uint8Array([1])}])),'old');
  const tree=writes.find(w=>w.path.endsWith('/git/trees')).body.tree;
  assert.deepEqual(tree.map(x=>x.path),['content/data/site.json','content/work/preview-upload.webp','content/work/case-upload.webp']);
  assert.equal(writes.at(-1).body.force,false);
});
