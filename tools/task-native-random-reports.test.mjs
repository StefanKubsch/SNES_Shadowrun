import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';

const sources=['analysis/render-task-native-opcode-c51f.json','analysis/render-task-native-opcode-c560.json'];
const outputs=sources.map(path=>path.replace('.json','-native.json'));
let invocation=0;

async function probeFixture(t){
 const originalRead=fs.promises.readFile,overrides=new Map(),writes=[];
 const originals=new Map(await Promise.all([...sources,...outputs,'Shadowrun (E).smc']
  .map(async path=>[path,await originalRead(path)])));
 let romReads=0;
 t.mock.method(fs.promises,'readFile',async(path,...args)=>{
  if(path==='Shadowrun (E).smc')romReads++;
  if(overrides.has(path)){
   const value=overrides.get(path);
   if(value instanceof Error)throw value;
   return value;
  }
  return originalRead(path,...args);
 });
 t.mock.method(fs.promises,'writeFile',async(path,data)=>{
  assert.ok(outputs.includes(path),'The probe may write only its native reports: '+path);
  writes.push({path,bytes:Buffer.from(data)});
 });
 t.mock.method(console,'log',()=>{});
 syncBuiltinESMExports();
 t.after(()=>{t.mock.restoreAll();syncBuiltinESMExports();});
 return {originals,overrides,writes,get romReads(){return romReads;},
  run:()=>import(new URL(`./probe-render-task-native-random-opcode.mjs?report-test=${invocation++}`,import.meta.url).href)};
}

test('The probe reads both sources, recomputes ROM proofs and emits byte-identical native reports only',async t=>{
 const fixture=await probeFixture(t);
 await fixture.run();
 assert.ok(fixture.romReads>=2,'Each report must be proved against a fresh ROM read');
 assert.deepEqual(fixture.writes.map(write=>write.path),outputs);
 for(const write of fixture.writes)assert.deepEqual(write.bytes,fixture.originals.get(write.path));
});

for(const source of sources){
 const changes={
  'ROM identity':report=>{report.rom_sha256='0'.repeat(64);},
  'source window':report=>{report.windows[0].machine_bytes='00';},
  'proof':report=>{report.proofs[0].source_closed_to_dispatch=false;},
  'graph flags':report=>{report.source_graph.native_binding=true;},
 };
 for(const [name,change]of Object.entries(changes))test(`${source}: rejects changed ${name} before any write`,async t=>{
  const fixture=await probeFixture(t),report=JSON.parse(fixture.originals.get(source));
  change(report);fixture.overrides.set(source,JSON.stringify(report));
  await assert.rejects(fixture.run,/Random opcode source report drift/);
  assert.deepEqual(fixture.writes,[]);
 });
 test(`${source}: missing sources fail without being regenerated`,async t=>{
  const fixture=await probeFixture(t);
  fixture.overrides.set(source,Object.assign(new Error('Missing source fixture'),{code:'ENOENT'}));
  await assert.rejects(fixture.run,{code:'ENOENT'});
  assert.deepEqual(fixture.writes,[]);
 });
 test(`${source}: malformed sources fail before any write`,async t=>{
  const fixture=await probeFixture(t);fixture.overrides.set(source,'{invalid JSON');
  await assert.rejects(fixture.run,SyntaxError);
  assert.deepEqual(fixture.writes,[]);
 });
}

test('The probe retains the ROM identity check before any native report write',async t=>{
 const fixture=await probeFixture(t),changed=Buffer.from(fixture.originals.get('Shadowrun (E).smc'));
 changed[0]^=1;fixture.overrides.set('Shadowrun (E).smc',changed);
 await assert.rejects(fixture.run,/Wrong ROM/);
 assert.deepEqual(fixture.writes,[]);
});
