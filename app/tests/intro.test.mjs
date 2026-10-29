import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/introSim.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const sim=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Logo starts empty and resolves to the exact master, including the V tip and terminal dot',()=>{
  const start=sim.frameAt(0);
  for(const key of ['stroke','lower','hLeft','hCross','hRight','dot'])assert.equal(start[key],0);
  assert.equal(start.wordVisible,false);
  const end=sim.frameAt(sim.INTRO_END);
  for(const key of ['stroke','lower','hLeft','hCross','hRight','dot'])assert.equal(end[key],1);
  assert.equal(end.dotX,4759.5);assert.equal(end.wordEdge,4845.5);assert.equal(end.offset,0);
  assert.equal(end.wordVisible,true);
  assert.deepEqual(sim.frameAt(600),end);
});
test('Sweep stays centered and never reverses, overshoots or depends on frame order',()=>{
  const saved=sim.frameAt(2.1);
  let last=sim.DOT_START;
  for(let t=0;t<=sim.INTRO_END;t+=1/144){
    const f=sim.frameAt(t);
    for(const value of Object.values(f))if(typeof value==='number')assert.ok(Number.isFinite(value));
    assert.ok(f.dotX>=last && f.dotX<=sim.DOT_END);
    assert.ok(Math.abs(2*f.offset+f.dotX-sim.DOT_END)<1e-8);
    last=f.dotX;
  }
  assert.deepEqual(sim.frameAt(2.1),saved);
});
test('Drawing is complete before the sweep; the finished logo gets a still hold',()=>{
  const f=sim.frameAt(sim.T.sweep);
  for(const key of ['stroke','lower','hLeft','hCross','hRight','dot'])assert.equal(f[key],1);
  assert.deepEqual(sim.frameAt(sim.T.stop),sim.frameAt(sim.INTRO_END));
  assert.ok(sim.INTRO_END-sim.T.stop>=.7);
});
test('Contours match the supplied full-logo SVG byte for byte',async()=>{
  const master=await readFile(new URL('../../docs/brand/2026-10-26/SHERIPOV-logo.svg',import.meta.url),'utf8');
  const paths=await readFile(new URL('../src/lib/logoPaths.ts',import.meta.url),'utf8');
  for(const [,json]of paths.matchAll(/export const \w+ = (".*")/g))assert.ok(master.includes(JSON.parse(json)));
});
