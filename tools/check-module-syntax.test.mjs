import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {verifyModuleSyntax,runLogged} from './verify-release.mjs';
async function fixture(t){
 const prefix=join(tmpdir(),'snes-syntax-test-'),root=await mkdtemp(prefix);
 t.after(async()=>{if(!root.startsWith(prefix))throw Error('Unsafe fixture path');await rm(root,{recursive:true,force:true});});
 for(const d of ['src','tools','logs'])await mkdir(join(root,d));return root;
}
test('Batch parser agrees with node --check on independent module grammar and never resolves imports or executes source',async t=>{
 const root=await fixture(t),valid=[
  'import absent from "./missing-module.mjs"; export const x=await Promise.resolve(1);',
  '#!/usr/bin/env node\nexport default import.meta.url;',
  'export const x=1; throw Error("must never execute");',
  '\uFEFFimport data from "./missing.json" with {type:"json"}; export {data};',
  'export function f(){return /[{}]/.test(`literal ${1}`);}'];
 const files=[];
 for(const [n,source]of valid.entries()){
  const path=`src/module-${n}.mjs`;files.push(path);await writeFile(join(root,path),source);
  await runLogged(process.execPath,['--check',path],{root,logPath:join(root,'logs',`reference-${n}.log`)});
 }
 const result=await verifyModuleSyntax({root,files,logDir:join(root,'logs')});assert.equal(result.modules,valid.length);assert.equal(result.executed,0);
 assert.match(await readFile(join(root,'logs/syntax.log'),'utf8'),/"executed":0/);
});
test('Batch parser rejects the same syntax failures as node --check, identifies the file and preserves the full failed log',async t=>{
 const root=await fixture(t),invalid=['export const broken = ;','const duplicate=0;const duplicate=1;',
  'return 1;','export {missing};','import x from "x" assert {type:"json"};'];
 for(const [n,source]of invalid.entries()){
  const path=`tools/broken-${n}.mjs`;await writeFile(join(root,path),source);
  await assert.rejects(()=>runLogged(process.execPath,['--check',path],{root,logPath:join(root,'logs',`reference-${n}.log`)}));
  await assert.rejects(()=>verifyModuleSyntax({root,files:[path],logDir:join(root,'logs')}),/Command failed \(1\)/);
  assert.match(await readFile(join(root,'logs/syntax.log'),'utf8'),new RegExp(`Module syntax failed: tools/broken-${n}\\.mjs:`));
 }
});
test('Release syntax batch requires a complete nonexecuting result and stops on worker failure',async t=>{
 const root=await fixture(t),files=['src/one.mjs'],logDir=join(root,'logs');
 for(const result of [{modules:0,milliseconds:0,executed:0},{modules:1,milliseconds:0,executed:1},'bad'])
  await assert.rejects(()=>verifyModuleSyntax({root,files,logDir,command:async()=>JSON.stringify(result)}),/Incomplete syntax batch result/);
 const failure=Error('Parser failed');await assert.rejects(()=>verifyModuleSyntax({root,files,logDir,command:async()=>{throw failure;}}),e=>e===failure);
});
test('Batch manifest rejects empty, duplicate and escaped module paths; missing files remain failed checks',async t=>{
 const root=await fixture(t),logDir=join(root,'logs');
 for(const files of [[],['src/one.mjs','src/one.mjs'],['../outside.mjs'],['src/../../outside.mjs'],['src/missing.mjs']]){
  await assert.rejects(()=>verifyModuleSyntax({root,files,logDir}),/Command failed \(1\)/);
  assert.match(await readFile(join(logDir,'syntax.log'),'utf8'),/Invalid syntax|outside workspace|Module syntax failed: src\/missing\.mjs/);
 }
});
