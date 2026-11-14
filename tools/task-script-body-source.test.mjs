import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectRom,cpuToOffset,cpuLabel} from './rom.mjs';
import {taskHash} from './task-partial-source.mjs';
import {scriptBodySpecs,scriptBodyBatches,scriptBodyReportStem} from '../proof/task/script-body-specs.mjs';
import {proveScriptBody,proveScriptBodyDependencies,proveScriptBodyFrontiers} from './task-script-body-source.mjs';
const {bytes}=inspectRom(await readFile('Shadowrun (E).smc'));
const ids=[0x03F,0x056,0x07F,0x095,0x0A1,0x0B2,0x0B6,0x0BE,0x13A,0x14A,0x197,0x1E1,0x239,0x285,0x325,0x33D,0x344,0x37C,0x38A];
test('grouped body source retains each original identity, full operand/fetch WORD and compact shared dependencies',async()=>{
 assert.deepEqual(scriptBodySpecs.map(s=>s.id),[...ids,0x031,0x0AE,0x0B8,0x152,0x18F,0x211,0x245,0x32F,
  0x67,0x6F,0x94,0xFA,0x14B,0x1B8,0x1D6,0x201,0x208,0x20F,0x212,0x216,0x35C,
  0x10A,0x10B,0x112,0x113,0x11A,0x11B,0x122,0x123,0x156,0x16D,0x333,0x39B,
  0x60,0x7D,0x80,0xD2,0xDF,0xF0,0x10F,0x27E,0x2E6,0x332,0x3A5,0x3A7,
  0x49,0x68,0x7C,0x81,0x9C,0xAF,0x11E,0x134,0x14D,0x151,0x158,0x159,0x15A,0x182,0x184,
  0x1B4,0x1BA,0x1BC,0x1C2,0x21E,0x223,0x23A,0x26C,0x2F3,0x303,0x30F,0x328,0x33E,0x368,0x393,0x39D,
  0x8C,0x91,0x21F,0xBF,0xFC,0x116,0x25A,0x26D,0x2CE,0x2F9,0x38E,0x85,0xFF,0x1B1,
  0xED,0x139,0x13D,0x13F,0x2D4,0x352,4,0x2A,0x73,0xD9,0xDA,0xE1,0x11F,0x1DF,0x1E7,0x266,0x26A,0x273,0x339,0x37F,0x2AB,0x1A9,0x1D3,0x396,0x4B,0x8A,0x99,0x149,0x21A,0x37A,0x16E,0x65,0x7E,0xDB,0x282,0x150,0x171,0x3A4,0x253,0xF9,0x1FB,0x240,0x22A,0x3A3,0x10E,0x31C,0x25B,0x2C6,0x35D,0x3A6,0x224,0x2B9,0x21B,0x229,0x391,0x136,0x1E8,0xF8,0x194,0x04D,0x0A4,0x0C3,0x0C8,0x0D7,0x0E3,0x118,0x143,0x162,0x1E6,0x1ED,0x27A,0x381,0x1A3,0x1FE,0x392,0x29A,0x210,0x2D0,0x1BD,0x1DA,0x2BF,0x2C3,0x119,0x16B,0x180,0x1B7,0x1C4,0x247,0x26F,0x330,0x39C,0x07B,0x086,0x153,0x16A,0x2E9,0x0B7,0x161,0x18B,0x2EE,0x1CF,0x1D2,0xD1,0x15C,0x15E,0x15F,0x164,0x28C,0x1A5,0x3A2].sort((a,b)=>a-b));
 const dependencies=await proveScriptBodyDependencies(bytes);
 assert.deepEqual(dependencies,JSON.parse(await readFile('analysis/render-task-script-body-dependencies.json')));
 for(const batch of scriptBodyBatches){const source=JSON.parse(await readFile(`analysis/render-task-${batch.stem}.json`));
  assert.equal(source.shared_dependencies_sha256,taskHash(Buffer.from(JSON.stringify(dependencies))));
  assert.deepEqual(source.proofs.map(p=>p.script_id),batch.ids);}
 assert.equal(dependencies.handlers.length,38);assert.equal(dependencies.natives.length,70);
 for(const s of scriptBodySpecs){
  const source=JSON.parse(await readFile(`analysis/render-task-${scriptBodyReportStem(s.id)}.json`));
  const p=await proveScriptBody(bytes,s);assert.deepEqual(p,source.proofs.find(p=>p.script_id===s.id));
  assert.equal(p.body_control_flow_complete,true);assert.equal(p.full_task_binding,false);assert.equal(p.external_return_assumptions,0);
  assert.equal(p.word_sources.at(-1).opcode_word[1],cpuLabel(s.scriptEntry+2+s.bytecode.length));
  assert.ok(p.required_opcodes.every(op=>dependencies.handlers.some(h=>h.opcode===op)));
  assert.ok(p.native_ids.every(id=>dependencies.natives.some(n=>n.admitted_targets[0].id===id)));
 }
});
for(const s of scriptBodySpecs)test(`Original body $${s.id.toString(16)} rejects mutation of every header/body/following-highbyte and individual metadata/table byte`,async()=>{
 const metadata=JSON.parse(await readFile(`analysis/render-task-script-opcode-${s.id.toString(16).padStart(3,'0')}.json`)).proofs[0].anchors;
 const addresses=[...Array.from({length:s.bytecode.length+2+Number(s.fetchTail!==null)},(_,n)=>s.scriptEntry+n),
  ...metadata.flatMap(a=>{const pc=parseInt(a.entry.replace(':',''),16);return [pc,pc+1];}),
  ...s.romReads.flatMap(r=>[r.address,r.address+1])];
 for(const address of new Set(addresses)){const changed=Buffer.from(bytes);changed[cpuToOffset(address,bytes.length)]^=1;
  await assert.rejects(()=>proveScriptBody(changed,s),`Script ${s.id}, source ${address.toString(16)}`);}
 await assert.rejects(()=>proveScriptBody(bytes,{...s}));
});
test('shared handler and native source mutations are rejected once per common window and metadata anchor',async()=>{
 const d=await proveScriptBodyDependencies(bytes),addresses=new Set();
 for(const h of d.handlers){addresses.add(parseInt(h.slot.address.replace(':',''),16));
  for(const w of h.handler_windows){const pc=parseInt(w.entry.replace(':',''),16);addresses.add(pc);addresses.add(pc+w.covered_bytes-1);}}
 for(const n of d.natives){for(const part of n.parts)for(const w of part.windows)addresses.add(parseInt(w.entry.replace(':',''),16));
  for(const target of n.admitted_targets){for(const a of target.anchors){const pc=parseInt(a.entry.replace(':',''),16);addresses.add(pc);addresses.add(pc+1);}for(const w of target.windows)addresses.add(parseInt(w.entry.replace(':',''),16));}}
 for(const pc of addresses){const changed=Buffer.from(bytes);changed[cpuToOffset(pc,bytes.length)]^=1;await assert.rejects(()=>proveScriptBodyDependencies(changed));}
});
test('smaller delivery reason is source-pinned: Native9F alternate current-stack RTS and both original child33D calls',async()=>{
 const proof=proveScriptBodyFrontiers(bytes);assert.deepEqual(proof,JSON.parse(await readFile('analysis/render-task-script-body-frontiers.json')));
 assert.equal(proof.completed_script_bodies,0);assert.equal(proof.native_binding,false);
 assert.deepEqual(proof.child_calls.script_ids,[0x2BF,0x2C3]);assert.equal(proof.child_calls.child_id,0x33D);
 for(const source of proof.sources){const start=parseInt(source.entry.replace(':',''),16);
  for(let n=0;n<source.machine_bytes.length/2;n++){const changed=Buffer.from(bytes);changed[cpuToOffset(start+n,bytes.length)]^=1;
   assert.throws(()=>proveScriptBodyFrontiers(changed));}}
});
