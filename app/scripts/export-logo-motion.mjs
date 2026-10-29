import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('..', import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'sheripov-motion-'));
try {
  await build({ configFile:false, root:app, publicDir:false, define:{'process.env.NODE_ENV':'"production"'}, plugins:[react()], build:{ outDir:temp, emptyOutDir:true, lib:{entry:resolve(app,'src/motion-preview.tsx'),name:'SheripovMotion',formats:['iife'],fileName:()=> 'motion.js'}, minify:true } });
  const js=await readFile(join(temp,'motion.js'),'utf8');
  const css=await readFile(join(temp,'app.css'),'utf8');
  const html=`<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SHERIPOV — движение знака</title><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`;
  const destination=resolve(app,'public/brand-motion');
  await mkdir(destination,{recursive:true});
  await writeFile(join(destination,'index.html'),html);
  console.log('Saved self-contained preview: app/public/brand-motion/index.html');
} finally { await rm(temp,{recursive:true,force:true}); }
