import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Render the real CasePage; isolate unrelated hero/copy modules and asset I/O.
const require=createRequire(import.meta.url);
const source=readFileSync(new URL('../src/components/CasePage.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function render(assetUrl){
  const exports={};
  const imports={
    '../data':{shotSrc:file=>'/published/'+file+'.webp'},
    './Work':{ProjectArt:()=>null},'./CaseCopy':{CaseCopy:()=>null},
    '../lib/projectPresentation':{projectStyle:()=>({}),categoryLabel:()=>'',caseHref:()=>'',handleProjectClick(){}},
    '../lib/previewBridge':{useEditBridge:()=>({assetUrl})},
  };
  vm.runInNewContext(compiled,{exports,require:name=>imports[name]??require(name)});
  return renderToStaticMarkup(React.createElement(exports.CasePage,{
    project:{slug:'test',title:'Case',kind:'Design',ratio:'wide',shots:[{id:'a',file:'new-image',alt:'First'},{id:'b',file:'new-image',alt:'Again'}]},
    profile:{name:'Designer',email:'designer@example.com'},onOpen(){},onHome(){},
  }));
}
test('case gallery renders new bridge assets for every occurrence, not an absent bundled URL',()=>{
  const html=render(file=>file==='new-image'?'blob:live-gallery':undefined);
  assert.equal((html.match(/src="blob:live-gallery"/g)||[]).length,2);
  assert.ok(!html.includes('/published/new-image.webp'));
});
test('case gallery keeps published image fallback outside the live bridge',()=>{
  const html=render(()=>undefined);
  assert.equal((html.match(/src="\/published\/new-image.webp"/g)||[]).length,2);
});
