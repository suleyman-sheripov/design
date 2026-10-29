import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/logoSound.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {renderLogoSound}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const {left,right,sampleRate}=renderLogoSound(48000);
const wav=Buffer.alloc(44+left.length*4);
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(2,22);wav.writeUInt32LE(sampleRate,24);wav.writeUInt32LE(sampleRate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(left.length*4,40);
let peak=0,energy=0;
for(let i=0;i<left.length;i++)for(let c=0;c<2;c++){const value=(c?right:left)[i];peak=Math.max(peak,Math.abs(value));energy+=value*value;wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,value))*32767),44+i*4+c*2)}
const output=process.argv[2]??'/tmp/SHERIPOV-logo-sound.wav';await writeFile(output,wav);
console.log(JSON.stringify({output,seconds:left.length/sampleRate,peakDb:20*Math.log10(peak),rmsDb:20*Math.log10(Math.sqrt(energy/(left.length*2)))}));
