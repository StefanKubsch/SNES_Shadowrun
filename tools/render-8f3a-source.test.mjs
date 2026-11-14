import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom,cpuToOffset,cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
const{bytes:rom,metadata}=inspectRom(await readFile('Shadowrun (E).smc'));
const report=JSON.parse(await readFile('analysis/render-8f3a.json','utf8'));
const windows=[
  ['transfer8F3A',0x808F3A,0x808F87,31,'438d7f8aa0efbee5b681d6f0a064fa90c9f6f3a10ff76caf8037931240d2a405'],
  ['window8EFE',0x808EFE,0x808F20,20,'2c56972b47d84375195b597212ee001d4d98f1b5dd3ac4237af954fb7746955e'],
  ['waitB0A1',0x81B0A1,0x81B0AC,4,'376af3db14eef310efd1740299d9f2496c59cd205dbc14e15e2a9786bcd8f076'],
  ['selectedDialogTransfer',0x809476,0x80947C,2,'d4ad143df92dc821376ec75c3c5a1d15aec1646f6a321c43cc5650fb4558b490'],
];
const map=new Map(),all=new Map();
for(const[name,start,end]of windows)for(let pc=start;pc<end;){
  // Independent byte regions; PLP restores entry WORD before RTS8F1F.
  const i=decode(rom,pc,{e:0,m:Number(pc>=0x808F4B&&pc<0x808F6E||pc>=0x808F01&&pc<0x808F1F),x:0});
  assert.ok(i.next<=end);all.set(pc,i);if(name!=='selectedDialogTransfer')map.set(pc,i);pc=i.next;
}
const at=(pc,op,value,mode)=>{const i=all.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op);
  if(value!==undefined)assert.equal(i.target??i.value,value);if(mode!==undefined)assert.equal(i.mode,mode);return i;};
const proof=m=>proveWordStack(m,0x808F3A,'RTS',{measureStack:true});
test('8F3A independent code/table/caller hashes delimit data from instructions',()=>{
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');assert.equal(report.rom_sha256,metadata.rom_sha256);
  for(const[name,start,end,count,hash]of windows){const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);assert.deepEqual([...report.windows,...report.callers].find(w=>w.name===name),
      {name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),covered_bytes:end-start,instruction_count:count,sha256:hash,machine_bytes:raw.toString('hex').toUpperCase()});
    assert.equal([...all.keys()].filter(pc=>pc>=start&&pc<end).length,count);
  }
  const raw=rom.subarray(cpuToOffset(0x808F87,rom.length),cpuToOffset(0x808F97,rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'),'778fcb6fb6d2db2d6e9ff01b5c764c9d92268919313f7a1ec81ad7103184a8ca');
  assert.equal(report.tables[0].sha256,createHash('sha256').update(raw).digest('hex'));
  assert.equal(report.tables[0].machine_bytes,'1AFF00403A3929FF0040C6C57FFF0000');assert.equal(map.has(0x808F87),false);
});
test('8F3A mixed width setup stores and fixedlong descending table copy are original source',()=>{
  for(const[pc,op,v]of [[0x808F3A,'LDA',0x2222],[0x808F3D,'STA',0x2123],[0x808F40,'STZ',0x212A],
    [0x808F43,'LDA',0x144],[0x808F46,'STA',0x4302],[0x808F49,'SEP',32],[0x808F4B,'LDX',15],
    [0x808F55,'DEX',undefined],[0x808F56,'BPL',0x808F4E],[0x808F6C,'REP',32]])at(pc,op,v);
  at(0x808F4E,'LDA',0x808F87,'longx');at(0x808F52,'STA',0x144,'absx');
  assert.equal(all.get(0x808F52).state.m,1);assert.equal(all.get(0x808F55).state.x,0);
  const indices=[];for(let x=15;!(x&0x8000);x=(x-1)&65535)indices.push(x);assert.deepEqual(indices,Array.from({length:16},(_,n)=>15-n));
});
test('8F3A BYTE TSB reads one fresh byte; countdown WORD and setup have no420B store',()=>{
  for(const[pc,v]of [[0x808F5A,0x4300],[0x808F5F,0x4301],[0x808F64,0x4304]])assert.equal(at(pc,'STA',v).state.m,1);
  at(0x808F67,'LDA',1);assert.equal(at(0x808F69,'TSB',0x1C4).state.m,1);
  at(0x808F6E,'LDA',15);assert.equal(at(0x808F71,'STA',0x1C2).state.m,0);
  assert.ok(![...map.values()].some(i=>i.value===0x420B));
});
test('8F3A actual two callees and eleven WORD indices end at0023',()=>{
  at(0x808F74,'LDX',2);at(0x808F77,'JSL',0x81B0A1);at(0x808F7B,'JSR',0x808EFE);
  for(const pc of[0x808F7E,0x808F7F,0x808F80])assert.equal(at(pc,'INX').state.x,0);
  at(0x808F81,'CPX',0x21);at(0x808F84,'BCC',0x808F77);at(0x808F86,'RTS');
  const indices=[];let x=2;for(;x<33;x+=3)indices.push(x);assert.deepEqual(indices,[2,5,8,11,14,17,20,23,26,29,32]);assert.equal(x,35);
});
test('8EFE carry survives TXA/EOR/PHA; two CLC and paired PHP/PLP are source-pinned',()=>{
  for(const[pc,op,v]of [[0x808EFE,'PHP'],[0x808EFF,'SEP',32],[0x808F01,'TXA'],[0x808F02,'CLC'],
    [0x808F03,'ADC',0x39],[0x808F05,'STA',0x149],[0x808F08,'TXA'],[0x808F09,'ADC',0xC5],
    [0x808F0B,'STA',0x14F],[0x808F0E,'TXA'],[0x808F0F,'EOR',255],[0x808F11,'PHA'],
    [0x808F12,'ADC',0x3B],[0x808F14,'STA',0x148],[0x808F17,'PLA'],[0x808F18,'CLC'],
    [0x808F19,'ADC',0xC7],[0x808F1B,'STA',0x14E],[0x808F1E,'PLP'],[0x808F1F,'RTS']])at(pc,op,v);
  assert.equal(all.get(0x808F1F).state.m,0);assert.equal(all.get(0x808F19).state.m,1);
});
test('B0A1 dependency matches existing full source; changed counter is not completion',async()=>{
  const input=JSON.parse(await readFile('analysis/render-input-flow.json','utf8'));
  assert.deepEqual(report.dependencies[0].window,input.windows.find(w=>w.name==='waitB0A1'));
  at(0x81B0A1,'LDA',0x7E1C76,'long');at(0x81B0A5,'CMP',0x7E1C76,'long');at(0x81B0A9,'BEQ',0x81B0A5);at(0x81B0AB,'RTL');
  assert.equal(report.full_graph.actual_termination_proven,false);
});
test('8F3A graph122/55 and helper34/20 protect6/4 bytes with no external returns',()=>{
  assert.equal(report.full_graph.code_bytes,122);assert.equal(map.size,55);assert.deepEqual(proof(map),report.full_graph.proof);
  assert.equal(proof(map).minimum_protected_stack_bytes,6);assert.equal(proof(map).external_return_assumptions,0);
  const helper=new Map([...map].filter(([pc])=>pc>=0x808EFE&&pc<0x808F20));
  assert.deepEqual(proveWordStack(helper,0x808EFE,'RTS',{measureStack:true}),report.helper_graph.proof);
  assert.equal(report.helper_graph.proof.minimum_protected_stack_bytes,4);
});
test('8F3A stack proof rejects absent callees, wrong widths, broken PHP/PLP and uncovered loop',()=>{
  for(const pc of[0x808EFE,0x81B0A1]){const m=new Map(map);m.delete(pc);assert.throws(()=>proof(m),/Uncovered edge/);}
  for(const[pc,change]of [[0x808EFE,{mnemonic:'NOP'}],[0x808F11,{mnemonic:'NOP'}],[0x808F1F,{mnemonic:'RTL'}],
    [0x81B0AB,{mnemonic:'RTS'}],[0x808F84,{target:0x808F87}],[0x808F08,{state:{e:0,m:0,x:0}}]]){
    const m=new Map(map);m.set(pc,{...m.get(pc),...change});assert.throws(()=>proof(m));
  }
});
test('8F3A actual936C caller closes only its prerequisite in BF3B',async()=>{
  at(0x809476,'JSR',0x80905E);at(0x809479,'JSR',0x808F3A);
  const parent=JSON.parse(await readFile('analysis/render-bf3b.json','utf8'));
  assert.equal(parent.full_graph.closed,false);assert.ok(!parent.full_graph.unresolved_nested_callees.includes('80:8F3A'));
  const supplied=parent.full_graph.supplied_source_nested_callees.find(c=>c.entry==='80:8F3A');
  assert.deepEqual([supplied.code_bytes,supplied.instructions,supplied.minimum_protected_stack_bytes,supplied.native_binding],[122,55,6,true]);
});
