import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateContent } from '../public/admin/model.js';
const root = new URL('../../', import.meta.url);
const file = new URL('content/data/site.json', root);
const data = JSON.parse(await readFile(file, 'utf8'));
const publish = process.argv.includes('--publish');
let count = 0;
for (const slug of ['donerio', 'dr-green', 'pro-it', 'billions-lottery']) {
  const directory = new URL(`materials/${slug}/`, root);
  const brief = JSON.parse(await readFile(new URL('images.json', directory), 'utf8'));
  const project = data.projects.projects.find(p => p.slug === slug);
  if (!project) throw new Error(`Не найден проект ${slug}.`);
  const shots = [];
  for (const image of brief) {
    if (!/^[a-z0-9-]+\.webp$/.test(image.input)) throw new Error('Недопустимое имя файла.');
    let bytes;
    try { bytes = await readFile(new URL(image.input, directory)); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.length > 3 * 1024 * 1024) throw new Error(`${slug}/${image.input}: нужен WebP до 3 МБ.`);
    const name = `${slug}-${image.input.slice(0, -5)}-${createHash('sha256').update(bytes).digest('hex').slice(0, 12)}`;
    await copyFile(new URL(image.input, directory), new URL(`content/work/${name}.webp`, root));
    shots.push({ file: name, alt: image.alt });
  }
  if (!shots.length) continue;
  if (!shots.some(s => s.file.startsWith(`${slug}-cover-`))) throw new Error(`Для ${slug} нужна cover.webp.`);
  project.shots = shots;
  project.cover = shots.find(s => s.file.startsWith(`${slug}-cover-`)).file;
  if (publish) project.status = 'published';
  console.log(`${project.title}: ${shots.length} снимков, ${project.status === 'published' ? 'готов к публикации' : 'черновик'}.`);
  count++;
}
validateContent(data);
if (count) await writeFile(file, JSON.stringify(data, null, 2) + '\n');
else console.log('Новых снимков нет. Положи WebP в materials/<проект>/ или загрузи их через админку.');
// Обновляем только локальную копию для уже открытого Vite; приложение не собираем.
if (count) {
  const { cp } = await import('node:fs/promises');
  await mkdir(new URL('../public/content/', import.meta.url), {recursive:true});
  await cp(new URL('content/', root), new URL('../public/content/', import.meta.url), {recursive:true});
}
