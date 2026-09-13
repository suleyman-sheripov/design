import { cp, mkdir, readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateContent, imageNames } from '../public/admin/model.js';
const root = new URL('../../', import.meta.url);
const data = validateContent(JSON.parse(await readFile(new URL('content/data/site.json', root), 'utf8')));
for (const name of imageNames(data)) await access(new URL(`content/work/${name}.webp`, root));
console.log(`Контент проверен: ${data.projects.projects.filter(p=>p.status==='published').length} опубликовано, ${data.projects.projects.filter(p=>p.status==='draft').length} черновика.`);
if (process.argv.includes('--copy')) {
  const target = new URL('../public/content/', import.meta.url);
  await mkdir(target, {recursive:true});
  await cp(fileURLToPath(new URL('content/', root)), fileURLToPath(target), {recursive:true});
}
