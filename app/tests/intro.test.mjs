import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/lib/introSim.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const sim=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('Интро: первые полсекунды шар остаётся за краем, конечное состояние собрано',()=>{
  for(const [left,font] of [[12,24],[100,32],[480,73.6]]) {
    sim.setStart(left,font);
    const before=sim.frameAt(.5);
    assert.ok(left+font*(before.ballCx+sim.geom.ball/2)<0);
    const end=sim.frameAt(sim.INTRO_END);
    for (const value of [end.markX,end.markY,end.restX,end.restY]) assert.equal(Math.abs(value),0);
    assert.equal(end.dotVisible,true);assert.equal(end.ballVisible,false);
    assert.equal(end.ballCx,sim.BALL_HOME_CX);assert.ok(end.hits>=2);
  }
});
test('Интро: состояние не зависит от порядка запросов кадров; в прогоне нет NaN',()=>{
  sim.setStart(360,60);const fixed=sim.frameAt(3.2);
  for(let t=0;t<=sim.INTRO_END;t+=1/120)for(const value of Object.values(sim.frameAt(t)))if(typeof value==='number')assert.ok(Number.isFinite(value));
  assert.deepEqual(sim.frameAt(3.2),fixed);
});
