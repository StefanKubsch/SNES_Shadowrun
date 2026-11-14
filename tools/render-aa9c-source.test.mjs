import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom=await readFile(new URL('../Shadowrun (E).smc',import.meta.url));
const report=JSON.parse(await readFile(new URL('../analysis/render-aa9c.json',import.meta.url),'utf8'));
const specs=[['loaderAA9C',0x81AA9C,0x81AB2C,62,'05737aeffd0aed87724672ee9c24d0bbd99e777c053c69a524bb0cb23e681a23'],
  ['mainInitialize9629',0x809629,0x809688,32,'a4a14c25e82df880c6a722abdc8667984b1ec0c6b12fe23c3a65c981c705e33f']];
const data=[['record0WordReads',0x80FFAD,0x80FFB4,'98FF803AFF81C0','a291f747bf19e7ef652b6c90644b22c1531ef328fef6bc285122dd7904b06672'],
  ['firstHeader',0x80FF98,0x80FF9A,'5000','6fd27b6685dd017d06230f819aafdbd609480ce22aa2590ed1ed2f46c6af6716'],
  ['firstPalette',0x81FF3A,0x81FF40,'D60010420000','9a3d8d5a0401c1074b150f49fecc0e348a5c8c8a61a69984d7d1360f2df2a593'],
  ['renderHeader',0x81FF40,0x81FF42,'4007','949925a1b12c20f45886ad313de257cc21c28990ea40a39f73a659cd2a7469c3']];
const map=new Map();
for(const [,start,end] of specs)for(let pc=start;pc<end;){
  const m=pc>=0x81AAD0&&pc<0x81AADC||pc>=0x81AAF2&&pc<0x81AB23||pc>=0x80962B&&pc<0x809638||pc>=0x80966F&&pc<0x809687?1:0;
  const i=decode(rom,pc,{e:0,m,x:0});assert.ok(i.next<=end);map.set(pc,i);pc=i.next;
}
const range=(start,end)=>[...map.values()].filter(i=>i.cpu>=start&&i.cpu<end);
const at=(pc,op,value,target)=>{const i=map.get(pc);assert.ok(i,cpuLabel(pc));assert.equal(i.mnemonic,op);
  if(value!==undefined)assert.equal(i.value,value);if(target!==undefined)assert.equal(i.target,target);return i;};

test('AA9C and complete main caller pin 239 codebytes with two independent digests and explicit widths',()=>{
  for(const [name,start,end,count,digest] of specs){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),digest);assert.equal(range(start,end).length,count);
    assert.deepEqual(report.windows.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256:digest,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.code_bytes,239);
});

test('Original first-source windows include the extra WORD highbyte and preserve both raw headers without claiming decoded output',()=>{
  for(const [name,start,end,hex,digest] of data){
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(raw.toString('hex').toUpperCase(),hex);assert.equal(createHash('sha256').update(raw).digest('hex'),digest);
    assert.deepEqual(report.data.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),covered_bytes:end-start,sha256:digest,machine_bytes:hex});
  }
  assert.equal(rom.readUInt16LE(cpuToOffset(0x80FFAF,rom.length)),0x3A80);
  assert.equal(rom.readUInt16LE(cpuToOffset(0x80FFB2,rom.length)),0xC081);
  assert.match(report.first_source.qualification,/not complete streamdecode/);
});

test('Equal cachegate jumps straight to RTL while active writes cache and scratch before any source read or call',()=>{
  at(0x81AA9C,'CMP',0x214);at(0x81AA9F,'BNE',undefined,0x81AAA4);at(0x81AAA1,'JMP',undefined,0x81AB2B);
  at(0x81AAA4,'PHB');at(0x81AAA5,'STA',0x214);at(0x81AAA8,'STA',0xD8);at(0x81AB2B,'RTL');
  assert.deepEqual(range(0x81AA9C,0x81AAA4).map(i=>i.mnemonic),['CMP','BNE','JMP']);
  assert.match(report.loader.gate,/prematurecachewrite is not success/);
});

test('Loader index keeps ASL Carry in following ADC instead of multiplying all WORD inputs by three',()=>{
  at(0x81AAAA,'ASL');at(0x81AAAB,'ADC',0xD8);at(0x81AAAD,'TAX');
  assert.equal(at(0x81AAAA,'ASL').mode,'A');
  for(const [requested,index] of [[0,0],[0x7FFF,0x7FFD],[0x8000,0x8001],[0xFFFF,0xFFFE]]){
    assert.equal((((requested<<1)&65535)+requested+(requested>>>15))&65535,index);
  }
  assert.match(report.loader.index,/ADC freshWORDD8 withoutCLC/);assert.match(report.loader.index,/realalias/);
});

test('First copy reads bank WORD before pointer WORD, saves the index and passes actual returned header to transfer size',()=>{
  assert.equal(at(0x81AAAE,'LDA',0x80FFAF).mode,'longx');at(0x81AAB2,'TAY');at(0x81AAB3,'LDA',0x80FFAD);
  at(0x81AAB7,'PHX');at(0x81AAB8,'LDX',0x23A0);at(0x81AABB,'JSL',undefined,0x809F49);
  at(0x81AABF,'STA',0x4375);at(0x81AAC2,'LDA',0x23A0);at(0x81AAC5,'STA',0x4372);at(0x81AAC8,'LDA',0x50B8);at(0x81AACB,'STA',0x2116);
  at(0x81AAD7,'STA',0x420B);at(0x81AADA,'REP',32);at(0x81AADC,'PLX');
  assert.match(report.loader.first_copy,/Yhighbyte becomes realscratchE4/);
});

test('Masked bank WORD source lemma materializes high then low stack bytes and invalid annotations fail closed',()=>{
  at(0x81AADD,'LDA',0x80FFB2);at(0x81AAE1,'AND',255);at(0x81AAE4,'STA',0x1F4);at(0x81AAE7,'XBA');
  at(0x81AAE8,'PHA');at(0x81AAE9,'PLB');at(0x81AAEA,'PLB');
  assert.deepEqual(report.bank_push_lemma.pushed_high_then_low,['palette-bank@81:AADD',0]);
  assert.throws(()=>proveWordStack(map,0x81AA9C,'RTL',{wordPushes:new Map([[0x81AAE8,[0]]])}),/Invalid WORD push lemma/);
  assert.throws(()=>proveWordStack(map,0x81AA9C,'RTL',{wordPushes:new Map([[0x81AAE9,[0,1]]])}),/Invalid WORD push lemma/);
  assert.equal(((0xC081&255)<<8)&255,0);
});

test('Palette uses six fresh banked BYTE reads with six index increments before WORD01FE and the second shared-buffer call',()=>{
  at(0x81AAEB,'LDA',0x80FFB0);at(0x81AAEF,'TAX');at(0x81AAF2,'LDA',0xD);at(0x81AAF4,'STA',0x2121);
  assert.deepEqual(range(0x81AAF7,0x81AB21).map(i=>i.mnemonic),Array(6).fill(['LDA','STA','INX']).flat());
  for(const i of range(0x81AAF7,0x81AB21))if(i.mnemonic==='LDA'){assert.equal(i.value,0);assert.equal(i.mode,'absx');assert.equal(i.state.m,1);}
  at(0x81AB21,'REP',32);at(0x81AB23,'STX',0x1FE);at(0x81AB26,'JSL',undefined,0x81A9B2);at(0x81AB2A,'PLB');
  assert.equal((0xFF3A+6)&65535,0xFF40);assert.equal((0xFFFC+6)&65535,2);
  assert.match(report.loader.palette,/usespaletteDBR/);assert.match(report.loader.second_copy,/sameWRAM23A0/);
});

test('Main caller writes control zero before initializers and registers callback only after AB2C and four more genuine returns',()=>{
  at(0x809630,'STZ',0x4200);at(0x809633,'STZ',0x420C);assert.equal(map.get(0x809630).state.m,1);
  assert.deepEqual(range(0x809638,0x809663).filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>i.target),
    [0x81B064,0x808FB3,0x80BC1A,0x81891A,0x818CB9,0x81A840,0x81A772,0x81AB2C,0x80C1A6,0x80CC44,0x80E41B,0x81EF26]);
  at(0x809663,'LDX',0xC152);at(0x809666,'LDY',0x80);at(0x809669,'JSL',undefined,0x80C109);at(0x809671,'STA',0x4200);at(0x809687,'RTS');
  assert.deepEqual(report.initialization.call_scan.raw_jsl_candidates,['80:9652']);assert.match(report.initialization.qualification,/No unconditional interrupts-off guarantee/);
});

test('Reused original initializer selects A0 after FFFF cache and calls transfer directly before local caller registration',()=>{
  const init=report.dependencies.flatMap(d=>d.windows).find(w=>w.name==='initializeAB2C');assert.ok(init);
  const i=new Map();for(let pc=0x81ABCE;pc<0x81AC0C;){const op=decode(rom,pc,{e:0,m:0,x:0});i.set(pc,op);pc=op.next;}
  assert.equal(i.get(0x81ABCE).value,0xFFFF);assert.equal(i.get(0x81ABD1).value,0x214);
  assert.equal(i.get(0x81ABDF).value,0);assert.equal(i.get(0x81ABE2).target,0x81AA9C);
  assert.equal(i.get(0x81AC04).mnemonic,'INC');assert.equal(i.get(0x81AC07).target,0x81A9E1);
  assert.match(report.initialization.direct_request,/BEFOREmain callbackregistration/);
});

test('Byte-verified dependencies close loader and initializer WORD/DBR graphs with explicit bank lemma and no execution claim',()=>{
  for(const d of report.dependencies)for(const w of d.windows){
    const start=parseInt(w.entry.replace(':',''),16),end=parseInt(w.end_exclusive.replace(':',''),16);
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(raw.toString('hex').toUpperCase(),w.machine_bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),w.sha256);
    const state={e:0,m:0,x:0},p=[];
    for(let pc=start;pc<end;){const i=decode(rom,pc,state);map.set(pc,i);pc=i.next;
      if(i.mnemonic==='PHP')p.push({...state});if(i.mnemonic==='PLP')Object.assign(state,p.pop());
      if(['REP','SEP'].includes(i.mnemonic)){if(i.value&32)state.m=i.mnemonic==='SEP'?1:0;if(i.value&16)state.x=i.mnemonic==='SEP'?1:0;}}
  }
  assert.throws(()=>proveWordStack(map,0x81AA9C),/Stack mismatch/);
  const wordPushes=new Map([[0x81AAE8,['palette-bank@81:AADD',0]]]);
  for(const p of report.structural_proofs)assert.deepEqual(proveWordStack(map,parseInt(p.entry.replace(':',''),16),'RTL',{wordPushes}),p);
  assert.deepEqual(report.closed_graphs.map(g=>[g.code_bytes,g.instructions,g.actual_termination_proven]),[[685,311,false],[1096,468,false]]);
  assert.deepEqual(report.structural_proofs[0].returns,[{at:'81:AB2B',m:0,x:0,dbr:'entry'}]);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
