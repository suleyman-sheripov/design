import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function module(name){const source=await readFile(new URL(`../src/lib/${name}.ts`,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))}
const {renderLogoSound}=await module('logoSound');
const {smoothRibbonPath}=await module('ribbonGeometry');
const {inquiryMailto,inquiryText}=await module('inquiry');
test('Inquiry retains Russian text, newlines and URL characters without adding mail headers',()=>{
 const data={name:' Анна & Co ',email:'anna+design@example.org',message:'Нужен логотип.\nСайт: https://example.org/?a=1&b=2\n#пример'};
 const url=new URL(inquiryMailto('suleyman.sheripov@icloud.com',data));
 assert.equal(decodeURIComponent(url.pathname),'suleyman.sheripov@icloud.com');
 assert.equal(url.searchParams.get('body'),inquiryText(data));
 assert.deepEqual([...url.searchParams.keys()],['subject','body']);
});
test('Synthesized sound has headroom, silence before the gesture and a click-free ending at both common sample rates',()=>{
 for(const rate of [44100,48000]){
  const {left,right}=renderLogoSound(rate);let peak=0,energy=0;
  assert.equal(left.length,Math.ceil(rate*3.72));
  for(const channel of [left,right])for(let i=0;i<channel.length;i++){
   assert.ok(Number.isFinite(channel[i]));peak=Math.max(peak,Math.abs(channel[i]));energy+=channel[i]**2;
   if(i<rate*.15 || i>channel.length-4)assert.ok(Math.abs(channel[i])<1e-5);
  }
  assert.ok(peak>.15 && peak<.9);assert.ok(energy>10);
 }
});
test('The audio sweep actually crosses from left to right',()=>{
 const rate=48000,{left,right}=renderLogoSound(rate);
 const energy=(channel,a,b)=>{let sum=0;for(let i=Math.floor(a*rate);i<b*rate;i++)sum+=channel[i]**2;return sum};
 assert.ok(energy(left,1.7,2)>energy(right,1.7,2));
 assert.ok(energy(right,2.5,2.8)>energy(left,2.5,2.8));
});
test('Ribbon rounding handles coincident joins and preserves a straight route without creating corners',()=>{
 const line=[0,10,10,100,400].map(x=>({x,y:80,z:0,twist:0}));
 const points=smoothRibbonPath(line);
 for(let i=0;i<points.length;i++){
  assert.ok(Math.abs(points[i].y-80)<1e-8);assert.ok(Number.isFinite(points[i].x));
  if(i)assert.ok(points[i].x>points[i-1].x && points[i].sourceIndex>=points[i-1].sourceIndex);
 }
 assert.ok(Math.abs(points[0].x)<1e-8);assert.ok(Math.abs(points.at(-1).x-400)<1e-8);
});
test('A connector/orbit corner becomes a continuous bend at desktop ribbon width',()=>{
 const source=[];
 for(let i=0;i<=50;i++)source.push({x:i*4,y:0,z:0,twist:0});
 for(let i=1;i<=50;i++)source.push({x:200,y:i*4,z:0,twist:0,card:0});
 const points=smoothRibbonPath(source);let maxTurn=0;
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1];
  const turn=Math.atan2((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x),(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y));maxTurn=Math.max(maxTurn,Math.abs(turn));
 }
 assert.ok(maxTurn<.2,`largest turn ${maxTurn}`);
 assert.ok(points.some(p=>p.card===0));
});
