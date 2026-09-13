import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateContent, CONTENT_FILE } from '../public/admin/model.js';
import { GitHub, encode, decode } from '../public/admin/github.js';
const source = JSON.parse(await readFile(new URL('../../content/data/site.json', import.meta.url),'utf8'));
const copy = () => structuredClone(source);
test('Контент: опубликованные кейсы имеют обложки; четыре новых кейса скрыты', () => {
  assert.equal(validateContent(copy()).projects.projects.filter(p=>p.status==='draft').length,4);
  assert.equal(source.profile.track.find(j=>j.client==='Beauty Lab').kind,'Учебный проект');
});
test('Нельзя опубликовать черновик без изображений', () => {
  const d=copy(); d.projects.projects[0].status='published'; assert.throws(()=>validateContent(d),/снимки/);
});

test('Описание кейса необязательно, сохраняет абзацы и проверяет типы полей', () => {
  const d = copy();
  d.projects.projects[0].story = { task: 'Контекст\n\nЗадача', solution: '', details: 'Детали' };
  assert.equal(validateContent(d).projects.projects[0].story.task, 'Контекст\n\nЗадача');
  for (const invalid of [null, [], 'текст', { task: 42 }, { solution: 'x'.repeat(12001) }]) {
    const bad = copy(); bad.projects.projects[0].story = invalid;
    assert.throws(() => validateContent(bad), /описание кейса|Описание кейса/i);
  }
});
test('Нельзя записать небезопасный путь, HTML-ссылку, повторный ключ и пустой alt', () => {
  const cases = [d=>d.projects.projects[0].slug='../oops', d=>d.profile.links.behance='javascript:alert(1)', d=>d.projects.projects[0].slug=d.projects.projects[1].slug, d=>d.projects.projects[4].shots[0].alt=''];
  for (const mutate of cases) { const d=copy(); mutate(d); assert.throws(()=>validateContent(d)); }
});
test('Кириллица и бинарные данные проходят base64 без потерь', () => {
  const text='Шерипов — упаковка'; assert.equal(decode(encode(new TextEncoder().encode(text))),text);
  assert.equal(atob(encode(new Uint8Array(200000))).length,200000);
});
const auth={owner:'owner',repo:'design',branch:'main',token:'mock-token'};
function fake(routes) {
  const calls=[];
  const request=async (url, options)=>{
    assert.equal(new URL(url).origin,'https://api.github.com');
    assert.equal(options.headers.Authorization,'Bearer mock-token');
    const path=new URL(url).pathname.replace('/repos/owner/design','');
    calls.push({path,method:options.method,body:options.body && JSON.parse(options.body)});
    const next=routes.shift(); assert.ok(next,'Лишний запрос '+path);
    assert.equal(path,next.path);
    return {ok: !next.status, status: next.status || 200, json:async()=>next.body};
  };
  return {client:new GitHub(auth,request),calls,routes};
}
test('Снимок и JSON публикуются одним коммитом; обновление ветки не принудительное',async()=>{
  const d=copy(); const name='donerio-test'; d.projects.projects[0].shots=[{file:name,alt:'Афиша'}];
  const f=fake([
    {path:'/git/ref/heads/main',body:{object:{sha:'old'}}},
    {path:'/git/commits/old',body:{tree:{sha:'tree'}}},
    {path:'/git/blobs',body:{sha:'image'}},
    {path:'/git/trees',body:{sha:'nexttree'}},
    {path:'/git/commits',body:{sha:'next'}},
    {path:'/git/refs/heads/main',body:{}}
  ]);
  assert.equal(await f.client.save(d,new Map([[name,{bytes:new Uint8Array([1,2,3])}]]),'old'),'next');
  const entries=f.calls.find(c=>c.path==='/git/trees').body.tree;
  assert.equal(entries.length,2); assert.equal(entries[0].path,CONTENT_FILE);
  assert.deepEqual(f.calls.at(-1).body,{sha:'next',force:false});
  assert.equal(f.routes.length,0);
});
test('Конфликт до записи не создаёт ни снимков, ни коммитов',async()=>{
  const f=fake([{path:'/git/ref/heads/main',body:{object:{sha:'newer'}}}]);
  await assert.rejects(f.client.save(copy(),new Map(),'old'),/ветка изменилась/); assert.equal(f.calls.length,1);
});
test('Конфликт в момент обновления ветки не повторяется с force:true',async()=>{
  const f=fake([{path:'/git/ref/heads/main',body:{object:{sha:'old'}}},{path:'/git/commits/old',body:{tree:{sha:'tree'}}},{path:'/git/trees',body:{sha:'t'}},{path:'/git/commits',body:{sha:'next'}},{path:'/git/refs/heads/main',status:422}]);
  await assert.rejects(f.client.save(copy(),new Map(),'old'),/отклонил/); assert.equal(f.calls.at(-1).body.force,false);
});
test('401 и 403 дают понятную ошибку и не раскрывают токен',async()=>{
  for(const status of [401,403]) {
    const f=fake([{path:'/git/ref/heads/main',status}]);
    await assert.rejects(f.client.head(),e=>!e.message.includes(auth.token));
  }
});
