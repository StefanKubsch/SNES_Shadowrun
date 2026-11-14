import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {decodeTaskWindows} from './task-partial-source.mjs';
import {taskOpcodeSpecs} from './task-opcode-specs.mjs';
import {opcodeDispatchWindow,proveOpcodeTarget,proveOpcodeBinding} from './task-opcode-source.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
test('F390 is the exact original full-WORD-X programbank indirect JMP, with no register/flag/stack effects',async()=>{
 const {map}=decodeTaskWindows(bytes,[opcodeDispatchWindow]),proof=proveOpcodeTarget(map);
 assert.deepEqual(proof.table,{bank:'80',low:'(F2B4+full WORD X)&FFFF',high:'(F2B4+full WORD X+1)&FFFF',width:2,directPageApplied:false,dataBankApplied:false,asl:false,opcodeClamp:false,parityGuard:false});
 const report=JSON.parse(await readFile('analysis/render-task-opcode-dispatch.json'));assert.deepEqual(report.proofs,[proof]);
 assert.throws(()=>proveOpcodeTarget(new Map()));
 const changed=new Map(map),i=changed.get(0x80F390);changed.set(i.cpu,{...i,mode:'ind'});assert.throws(()=>proveOpcodeTarget(changed));
});
for(const spec of taskOpcodeSpecs){
 test(`${spec.name}: original slot, all handler windows, mode/stack/flags and fresh F389 compose without new return assumptions`,async()=>{
  const proof=await proveOpcodeBinding(bytes,spec),report=JSON.parse(await readFile(`analysis/render-task-${spec.name}.json`));
  assert.deepEqual(report.proofs,[proof]);assert.equal(proof.handler_proof.external_return_assumptions??0,0);
  assert.ok(proof.handler_proof.source_closed_to_dispatch||proof.handler_admission);assert.equal(proof.slot.address,'80:'+((0xF2B4+spec.opcode)&65535).toString(16).toUpperCase());
  const mode=proof.handler_proof.output_mode??proof.handler_output_mode;
  assert.equal(mode.e,0);assert.equal(mode.m,0);assert.equal(mode.x,0);
 });
 test(`${spec.name}: changed original table or callee bytes invalidate admission`,async()=>{
  const table=Buffer.from(bytes),body=Buffer.from(bytes);table[cpuToOffset(0x80F2B4+spec.opcode,bytes.length)]^=1;
  body[cpuToOffset(spec.target,bytes.length)]^=1;
  await assert.rejects(()=>proveOpcodeBinding(table,spec));await assert.rejects(()=>proveOpcodeBinding(body,spec));
 });
}
