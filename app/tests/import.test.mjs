import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);
test('Импорт публикует только проект с файлами и повторно не размножает снимки',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portfolio-import-'));
  try {
    const root=new URL('../../',import.meta.url);
    for(const path of ['app/scripts','app/public/admin','content','materials'])await cp(new URL(path,root),join(dir,path),{recursive:true});
    await writeFile(join(dir,'app/package.json'),'{"type":"module"}');
    await mkdir(join(dir,'materials/donerio'),{recursive:true});
    await cp(new URL('../public/assets/photo.webp',import.meta.url),join(dir,'materials/donerio/cover.webp'));
    const before=JSON.parse(await readFile(join(dir,'content/data/site.json'),'utf8'));
    await run(process.execPath,[join(dir,'app/scripts/import-cases.mjs'),'--publish']);
    const after=JSON.parse(await readFile(join(dir,'content/data/site.json'),'utf8'));
    assert.equal(after.projects.projects[0].status,'published');assert.equal(after.projects.projects[0].shots.length,1);
    assert.deepEqual(after.profile,before.profile);assert.deepEqual(after.projects.projects.slice(1),before.projects.projects.slice(1));
    const files=await readdir(join(dir,'content/work'));
    await run(process.execPath,[join(dir,'app/scripts/import-cases.mjs'),'--publish']);
    assert.deepEqual(await readdir(join(dir,'content/work')),files);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
