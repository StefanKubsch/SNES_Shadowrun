import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {inspectScriptTables} from './scripts.mjs';
import {proveScriptOpcode,proveScriptContinuation} from './task-script-opcode-source.mjs';
import {scriptOpcodeSpecs} from './task-script-opcode-fixtures.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
for(const s of [null,...scriptOpcodeSpecs]){
 const name=s?'script-opcode-'+s.id.toString(16).padStart(3,'0'):'script-opcode';
 test(`${name}: separate original slot/prefix/heap/frame/yield/continuation source renews`,async()=>{
  const proof=await proveScriptOpcode(bytes,s),r=JSON.parse(await readFile(`analysis/render-task-${name}.json`));assert.deepEqual(r.proofs,[proof]);
  assert.equal(proof.full_task_binding,false);assert.equal(proof.external_return_assumptions,0);assert.equal(proof.global_stack_minimum,null);
  assert.equal(proof.source_closed_to_dispatch,false);assert.equal(proof.joins.at(-1).kind,'yield; target observed only');
  assert.equal(proof.parts[1].proofs[0].callee_proof.outer_return_words_consumed,2);
  if(s){assert.equal(proof.anchors.length,5);assert.equal(proof.script_id,s.id);assert.equal(proof.script_header,s.entry);}
 });
 test(`${name}: byte mutation rejects source at every fixed join and individual table/header anchor`,async()=>{
  const addresses=[0x80F306,0x80F460,0x80F488,0x80F492,0x80C36A,0x80C384,0x80C2C8,0x80C242,0x80C281,0x80F495,0x80C1FE,0x80F509,
   ...(s?[0x82E9CC+s.id,0x82DB28+s.id,0x82DED1+2*s.id,0x82E623+s.id,parseInt(s.entry.replace(':',''),16)]
     .flatMap(address=>[address,address+1]):[])];
  for(const address of addresses){const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;await assert.rejects(()=>proveScriptOpcode(changed,s));}
 });
}

for(const [first,last] of [[209,258],[259,308],[309,408],[409,936],[0,936]]){
test(`Script52 IDs${first}..${last} match the independently recovered European table inventory`,()=>{
 const inventory=inspectScriptTables(bytes);
 assert.equal(inventory.script_count,937);
 const batch=scriptOpcodeSpecs.filter(s=>s.id>=first&&s.id<=last);
 assert.deepEqual(batch.map(s=>s.id),Array.from({length:last-first+1},(_,n)=>first+n));
 for(const s of batch){
  const original=inventory.scripts[s.id];
  assert.equal(s.entry,original.cpu_address);
  assert.equal(s.argument&255,original.argument_bytes);
  assert.equal(s.returnMetadata&255,original.return_bytes);
  assert.deepEqual(s.header,[original.scratch_bytes,original.max_stack_bytes]);
 }
});
}
test('separate continuation renews both entry contracts and the shared resume equation',async()=>{
 const p=await proveScriptContinuation(bytes),r=JSON.parse(await readFile('analysis/render-task-script-continuation.json'));
 assert.deepEqual(r.proofs,p);assert.deepEqual(p.map(p=>p.entry),['80:F488','80:F495']);
 assert.ok(p.every(p=>p.native_binding===false&&p.external_return_assumptions===0));
});
test('last original Script52 ID retains the actual WORD highbytes across adjacent metadata tables',async()=>{
 const first=scriptOpcodeSpecs[0],last=scriptOpcodeSpecs.at(-1);
 assert.equal(last.id,936);
 assert.equal(last.bank>>>8,first.pointer&255);
 assert.equal(last.returnMetadata>>>8,first.argument&255);
 assert.equal(last.argument>>>8,bytes[cpuToOffset(0x82E9CC+937,bytes.length)]);
 const proof=await proveScriptOpcode(bytes,last);
 assert.deepEqual(proof.anchors.filter(a=>a.kind.endsWith('-metadata')).map(a=>[a.entry,a.machine_bytes]),
  [['82:ED74','0201'],['82:DED0','9E97'],['82:E9CB','0002']]);
});
