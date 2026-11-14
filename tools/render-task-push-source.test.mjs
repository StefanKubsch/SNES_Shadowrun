import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {inspectRom,cpuLabel,cpuToOffset} from './rom.mjs';
import {decode} from './disassemble.mjs';
import {provePushToDispatch,describePushByteOwners} from './render-task-push-source-proof.mjs';
import {stepStackPrimitive} from '../proof/script/stack-primitives.mjs';
const {bytes:rom,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
const report=JSON.parse(await readFile('analysis/render-task-push.json','utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const windows=[
  ['pushZeroF393',0x80F393,0x80F398,2,'52c4a833caa791813d107e61f5b771c0c703c9487932577488235789af33da4f'],
  ['pushU8F398',0x80F398,0x80F3A1,5,'02d6e1b706bb0aa32cba0160e90a2ab9073bf38511345a3886abc79af86df6f5'],
  ['pushU16F3B1',0x80F3B1,0x80F3B9,5,'4025103a86e5dbc481fc5445fc3353b1ce056c6d6b2b890e4e89c1e7d43eaaa2'],
  ['fetchF389',0x80F389,0x80F393,5,'4c3f34f823702042ca64c29aeb6edbae702c6dfe3735c436921cd418d83c81cf']];
const map=new Map();
for(const [,start,end]of windows)for(let pc=start;pc<end;){const i=decode(rom,pc,{e:0,m:0,x:0});assert.ok(i.next<=end);map.set(pc,i);pc=i.next;}
const at=(pc,op,value,mode)=>{const i=map.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op);
  if(value!==undefined)assert.equal(i.target??i.value,value);if(mode!==undefined)assert.equal(i.mode,mode);return i;};
const context={d:0x3D6,bank:0x9D,s:0x3F0,y:4,pointerBefore:0xA001,pointerAfter:0xA001};
const own=(entry,patch={})=>describePushByteOwners({...context,entry,...patch});
// Explicit synthetic address/data equations only. No CPU, real task/script,
// hardware, scene, timing or frame traces are constructed by these tests.

test('push source32/17 andactualF389 have independent European-ROM windows/hashes/counts',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');assert.equal(report.rom_sha256,metadata.rom_sha256);
  for(const [name,start,end,count,hash]of windows){const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));assert.equal(sha(raw),hash);
    assert.equal([...map.keys()].filter(pc=>pc>=start&&pc<end).length,count);
    assert.deepEqual(report.windows.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});}
  assert.equal(map.size,17);assert.equal(report.source_graph.code_bytes,32);assert.equal(report.source_graph.instructions,17);
});

test('original C0/00/14 WORDtable slots match entrypins; sharedfetch keeps actualC1CA sourceowner',async()=>{
  for(const [opcode,source,target,hash]of [[0xC0,0x80F374,0x80F393,'c3d8c0968517cccf975e4ba304809d3afc3bc1f6de4ae85847502744ac152941'],
    [0,0x80F2B4,0x80F398,'a27deccca59d8c7e1ddb9cf3cf617c8fd2f81d9ac4daf3796429876a8fa06f17'],
    [0x14,0x80F2C8,0x80F3B1,'2531a2768ba09d26dc8430ac9378b622e4de044c41cc23d3d5371ba24f597b9e']]){
    const off=cpuToOffset(source,rom.length),raw=rom.subarray(off,off+2);assert.equal(raw.readUInt16LE(),target&65535);assert.equal(sha(raw),hash);
    assert.deepEqual(report.dispatch_entries.find(d=>d.opcode===opcode),{opcode,word_source:cpuLabel(source),target:cpuLabel(target),machine_bytes:raw.toString('hex').toUpperCase(),sha256:hash});}
  const d=report.dependencies[0],owner=JSON.parse(await readFile(d.report,'utf8'));assert.equal(owner.rom_sha256,metadata.rom_sha256);
  assert.deepEqual(d.window,owner.windows.find(w=>w.name==='interpreterF378'));
  assert.equal(d.window.machine_bytes.slice(34),report.windows.find(w=>w.name==='fetchF389').machine_bytes);
  assert.equal(d.opcode_source_sha256,owner.dispatch.opcode_source.sha256);
});

test('F393 literalPEA0000 has nooperand read/Y advance/rootJSR and still refetches realnextWORD',()=>{
  at(0x80F393,'PEA',0,'word');at(0x80F396,'BRA',0x80F389);
  const p=provePushToDispatch(map,0x80F393);assert.deepEqual(p,report.primitives[0]);assert.equal(p.reachable_instructions,7);
  assert.deepEqual(p.reads.map(r=>r.kind),['next-opcode']);assert.equal(p.y_delta_before_next_opcode,0);
  assert.deepEqual(p.stack_writes.map(w=>w.byte),['00','00']);assert.equal(p.outer_return_frames_added,0);assert.equal(p.operand_s_delta,-2);
  assert.equal(own(0x80F393,{pointerBefore:undefined}).operand_sources,null);
});

test('F398 lowBYTE payload needs fullWORDread/highbyte then oneWORDINY and aWORDPHA with zeroHigh',()=>{
  at(0x80F398,'LDA',0,'diy');at(0x80F39A,'INY');at(0x80F39B,'AND',255,'immM');at(0x80F39E,'PHA');at(0x80F39F,'BRA',0x80F389);
  const p=provePushToDispatch(map,0x80F398);assert.deepEqual(p,report.primitives[1]);assert.equal(p.reachable_instructions,10);
  assert.equal(p.reads[0].bytes,2);assert.equal(p.reads[0].highbyte_required,true);assert.deepEqual(p.stack_writes.map(w=>w.byte),['00','Original operand lowbyte']);
  for(let word=0;word<65536;word++)assert.equal(word&255,word%256);
  assert.equal(own(0x80F398).operand_sources.word_reads.length,2);assert.equal(own(0x80F398).frontier_y,6);
});

test('F3B1 reads originalWORD, advancesYtwice beforePHA and preservesHigh/Low until realnextfetch',()=>{
  at(0x80F3B1,'LDA',0,'diy');at(0x80F3B3,'INY');at(0x80F3B4,'INY');at(0x80F3B5,'PHA');at(0x80F3B6,'JMP',0x80F389);
  const p=provePushToDispatch(map,0x80F3B1);assert.deepEqual(p,report.primitives[2]);assert.equal(p.reachable_instructions,10);
  assert.deepEqual(p.stack_writes.map(w=>w.byte),['Original operand highbyte','Original operand lowbyte']);
  for(let word=0;word<65536;word++)assert.equal((word>>>8)<<8|(word&255),word);
  assert.equal(own(0x80F3B1).next_opcode_y,6);assert.equal(own(0x80F3B1).frontier_y,7);
});

test('every native16bit S descends2 with high-first stores, exact0/1/FFFF wrap and actualbank00 owners',()=>{
  for(let s=0;s<65536;s++){
    const p=own(0x80F3B1,{s});assert.equal(p.stack_writes[0].address,cpuLabel(s));assert.equal(p.stack_writes[1].address,cpuLabel((s+65535)%65536));
    assert.equal(p.output_operand_s,(s+65534)%65536);}
  assert.equal(own(0x80F393,{s:0}).output_operand_s,65534);assert.equal(own(0x80F393,{s:1}).output_operand_s,65535);
  assert.equal(own(0x80F393,{s:65535}).output_operand_s,65533);
  assert.deepEqual(own(0x80F393,{s:1}).stack_writes.map(w=>w.physical_address),['7E:0001','7E:0000']);
  assert.equal(own(0x80F393,{s:0}).stack_writes_have_known_wram_addresses,false);
  assert.equal(own(0x80F393,{s:0x2000}).stack_writes[0].physical_address,null);
  assert.equal(own(0x80F393,{s:0x8000}).stack_writes_have_known_wram_addresses,false);
});

test('everyWORD Y wraps independently for payloadwidth0/1/2 and the nextopcode additionalINY',()=>{
  for(let y=0;y<65536;y++)for(const [entry,width]of [[0x80F393,0],[0x80F398,1],[0x80F3B1,2]]){
    assert.equal((y+width)&65535,(y+width)%65536);assert.equal((y+width+1)&65535,(y+width+1)%65536);}
  assert.equal(own(0x80F398,{y:65535}).next_opcode_y,0);assert.equal(own(0x80F3B1,{y:65535}).next_opcode_y,1);
});

test('freshDPpointer bytes wrap withinbank00 while DBRindexedWORD sources can carry across fullbanks',()=>{
  const p=own(0x80F398,{d:65535,bank:0x9D,y:65535,pointerBefore:65535,pointerAfter:0x8000});
  assert.deepEqual(p.operand_sources.pointer_reads.map(r=>r.address),['00:FFFF','00:0000']);
  assert.deepEqual(p.operand_sources.word_reads.map(r=>r.address),['9E:FFFE','9E:FFFF']);
  assert.deepEqual(p.next_opcode_sources.word_reads.map(r=>r.address),['9D:8000','9D:8001']);
  for(let bank=0;bank<256;bank++){
    const a=own(0x80F3B1,{bank,y:1,pointerBefore:65535,pointerAfter:0});
    assert.equal(a.operand_sources.word_reads[0].address,cpuLabel(((bank+1)&255)*65536));
    const b=own(0x80F3B1,{bank,y:0,pointerBefore:65535,pointerAfter:0});
    assert.equal(b.operand_sources.word_reads[1].address,cpuLabel(((bank+1)&255)*65536));}
});

test('stack alias updates pointer/control sources before freshrefetch; savedframe7 is not explicitly updated',()=>{
  const p=own(0x80F3B1,{bank:0x80,s:0x3D7,y:4,pointerBefore:0x1200,pointerAfter:0x1234});
  assert.deepEqual(p.stack_writes.map(w=>w.physical_address),p.next_opcode_sources.pointer_reads.slice().reverse().map(r=>r.physical_address));
  assert.equal(p.operand_sources.word_reads[0].address,'80:1204');assert.equal(p.next_opcode_sources.word_reads[0].address,'80:123A');
  assert.notEqual(p.next_opcode_sources.word_reads[0].address,'80:1206');
  const metadata=own(0x80F3B1,{s:0x3DE});assert.deepEqual(metadata.stack_writes.map(w=>w.address),['00:03DE','00:03DD']); // D+8/D+7
  assert.ok(report.primitives.every(p=>p.saved_frame_cursor_write===false));
  assert.match(report.contract.stack_owner,/physical overlap may still modify/);assert.match(report.contract.aliases,/not cached operandpointer/);
});

test('actualF389 freshWORDread, AND/TAX flags and indxJMP preservesD/DBR/C/V/I/decimal without binary-only premise',()=>{
  at(0x80F389,'LDA',0,'diy');at(0x80F38B,'INY');at(0x80F38C,'AND',255,'immM');at(0x80F38F,'TAX');at(0x80F390,'JMP',0xF2B4,'indx');
  for(let status=0;status<256;status++)if(!(status&0x30))for(let low=0;low<256;low++){
    const final=(status&~0x82)|(low===0?2:0);assert.equal(final&0x80,0);assert.equal(Boolean(final&2),low===0);
    assert.equal(final&0x4D,status&0x4D);}
  assert.ok(![...map.values()].some(i=>['JSR','JSL','RTS','ADC','SBC','STA','TCS','TCD','PLB'].includes(i.mnemonic)));
  assert.ok(report.primitives.every(p=>p.minimum_protected_stack_bytes===undefined));
});

test('all65536 word payloads and256 BYTE payloads agree with bounded hostvalues without supplying ignored-high/refetch ownership',()=>{
  for(let value=0;value<65536;value++){
    const stack=[];const p=stepStackPrimitive(Uint8Array.of(0x14,value&255,value>>>8),0,stack);assert.equal(stack[0],value);assert.equal(p.nextPc,3);}
  for(let value=0;value<256;value++){
    const stack=[];assert.equal(stepStackPrimitive(Uint8Array.of(0,value),0,stack).nextPc,2);assert.equal(stack[0],value);}
  const zero=[];stepStackPrimitive(Uint8Array.of(0xC0),0,zero);assert.deepEqual(zero,[0]);
  assert.match(report.contract.host_boundary,/source F390 Y is already past/);
  assert.equal(report.primitives[1].reads[0].highbyte_required,true);
  assert.ok(report.primitives.every(p=>p.reads.at(-1).after_push));
});

test('sourceproof rejects missing path/window, wrong widths/branches/pushes/modes/dispatch while ignoring unrelated push entries',()=>{
  for(const [entry,start,end]of [[0x80F393,0x80F393,0x80F398],[0x80F398,0x80F398,0x80F3A1],[0x80F3B1,0x80F3B1,0x80F3B9]]){
    const local=new Map([...map].filter(([pc])=>pc>=start&&pc<end||pc>=0x80F389&&pc<0x80F393));
    assert.deepEqual(provePushToDispatch(local,entry),provePushToDispatch(map,entry));
    for(const pc of local.keys()){const m=new Map(local);m.delete(pc);assert.throws(()=>provePushToDispatch(m,entry));}}
  for(const [entry,pc,patch]of [[0x80F393,0x80F393,{value:1}],[0x80F398,0x80F39E,{mnemonic:'PHX'}],
    [0x80F3B1,0x80F3B4,{mnemonic:'NOP'}],[0x80F398,0x80F39F,{target:0x80F3B1}],
    [0x80F393,0x80F390,{mode:'abs'}],[0x80F398,0x80F398,{length:1}],
    [0x80F3B1,0x80F38C,{state:{e:0,m:1,x:0}}],[0x80F393,0x80F38B,{state:{e:0,m:0,x:1}}],
    [0x80F3B1,0x80F3B6,{next:0x80F389}]]){
    const m=new Map(map);m.set(pc,{...m.get(pc),...patch});assert.throws(()=>provePushToDispatch(m,entry));}
  assert.throws(()=>provePushToDispatch(map,0x80F378),/Invalid/);
});

test('addressdescriptor requires actualWORD context andfresh pointers, never invents defaultowners or validWRAM writes',()=>{
  for(const patch of [{d:-1},{d:65536},{s:null},{y:undefined},{bank:256},{pointerBefore:undefined},{pointerAfter:undefined}])
    assert.throws(()=>own(0x80F398,patch),/Explicit/);
  assert.throws(()=>own(0x80F532),/Invalid/);
  assert.match(own(0x80F393).qualification,/not an actual byte owner/);
  assert.equal(own(0x80F393,{s:0x2000}).stack_writes_have_known_wram_addresses,false);
  assert.ok(report.synthetic_address_examples.every(p=>p.qualification.includes('No')||p.qualification.includes('no read/write')));
});

test('sources close only to dynamicdispatch; parent/central leave C1CA/9178 native andglobalstack open',async()=>{
  const [visit,text,progress]=await Promise.all(['analysis/render-c1ca.json','analysis/render-9178.json','docs/PORTIERUNGSSTAND.json'].map(async p=>JSON.parse(await readFile(p,'utf8'))));
  assert.equal(report.source_graph.source_closed_to_dispatch,true);assert.equal(report.source_graph.full_graph_closed,false);assert.equal(report.source_graph.native_binding,false);assert.equal(report.source_graph.minimum_protected_stack_bytes,null);
  assert.equal(visit.full_graph.supplied_opcode_sources[0].operand_output_bytes_each,2);assert.equal(visit.full_graph.supplied_opcode_sources[0].outer_return_frames_added,0);
  assert.equal(visit.full_graph.closed,false);assert.equal(visit.full_graph.minimum_protected_stack_bytes,null);assert.equal(text.full_graph.closed,false);
  assert.ok(['native-required','composition-required'].includes(progress.work_groups.find(g=>g.id==='task-f378-stack-primitives').status));
  assert.ok(!progress.supplied.some(r=>['80:F393','80:F398','80:F3B1','80:C1CA','80:9178'].includes(r.entry)));
});
