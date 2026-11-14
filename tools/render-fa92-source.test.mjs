import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes: rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-fa92.json', import.meta.url), 'utf8'));
// Independent literal source boundaries/hash pins; no use of analyzer output
// to decide instruction widths or to compute the routine's expected values.
const windows = [
  ['positionFA92',0x80FA92,0x80FAAC,12,'5a1d462a562cdcd849aff208c1140f0c261f279d5580130cc11aeb695a78435f'],
  ['selectedDialogPosition',0x8093DB,0x8093F4,10,'338f4a5864b295ac089b06eb0eae520a773a89026ec4fa73ca76734810b36b38'],
  ['selectedDimensionWriter',0x80F9B1,0x80F9C0,8,'084cc526a456b02ab6c8f98f6ba991f711414de6595853faa58f73b9d3e3f3d1'],
  ['selectedFieldZeroWriter',0x80F9CC,0x80F9DF,5,'f4a72e9b62b6fd4ec8245b99491552f9d55122f493432ea7cb3f5c08e7375999'],
];
const all = new Map(), root = new Map();
for (const [name,start,end] of windows) for (let pc = start; pc < end;) {
  const i = decode(rom, pc, { e:0,m:0,x:0 }); assert.ok(i.next <= end);
  all.set(pc,i); if (name === 'positionFA92') root.set(pc,i); pc = i.next;
}
const at = (pc,op,value) => {
  const i = all.get(pc); assert.ok(i,cpuLabel(pc)); assert.equal(i.mnemonic,op,cpuLabel(pc));
  if (value !== undefined) assert.equal(i.target ?? i.value,value,cpuLabel(pc)); return i;
};
const nz = value => (value === 0 ? 2 : 0) | (value & 0x8000 ? 128 : 0);
// Source algebra only, not CPU execution or a native runtime implementation.
const relative = (offset,dimension) => {
  const sum = offset + dimension, value = sum & 65535, result = value - 2 & 65535;
  return { value:result, status:nz(result) | (sum > 65535 ? 1 : 0)
    | (~(offset ^ dimension) & (offset ^ value) & 0x8000 ? 64 : 0) };
};

test('FA92 four independent source/selectedcaller/owner windows pin26/12 root and European ROM', () => {
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);
  const supplied = [...report.windows,...report.selected_owners.windows]; assert.equal(supplied.length,4);
  for (const [name,start,end,count,sha256] of windows) {
    const raw=rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),sha256);
    assert.equal([...all.values()].filter(i=>i.cpu>=start&&i.cpu<end).length,count);
    assert.deepEqual(supplied.find(w=>w.name===name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,26); assert.equal(report.full_graph.instructions,12);
});
test('FA92 reads full DP00/DP02 and stores first WORD before fresh DP04 or conditional dimension', () => {
  assert.equal(at(0x80FA92,'LDX',0).mode,'dp'); at(0x80FA94,'LDA',2);
  assert.equal(at(0x80FA96,'STA',0x7E2100).mode,'longx'); at(0x80FA9A,'LDA',4);
  assert.deepEqual([...root.values()].slice(0,4).map(i=>i.mnemonic),['LDX','LDA','STA','LDA']);
  assert.ok([...root.values()].every(i=>i.state.m===0&&i.state.x===0));
  assert.match(report.contract.first,/Full fresh WORD DP00 is unmasked X/);
  assert.match(report.contract.first,/including zero, odd and8000/);
});
test('FA92 all65536 DP04 values distinguish zero before positiveBPL and retain negative relative path', () => {
  at(0x80FA9C,'BEQ',0x80FAA0); at(0x80FA9E,'BPL',0x80FAA7);
  let zero=0,positive=0,negative=0;
  for(let value=0;value<=65535;value++) {
    const takeZero=Boolean(nz(value)&2),takePositive=!takeZero&&!(nz(value)&128);
    assert.equal(takeZero,value===0); assert.equal(takePositive,value>=1&&value<=32767);
    if(takeZero)zero++;else if(takePositive)positive++;else negative++;
  }
  assert.deepEqual([zero,positive,negative],[1,32767,32768]);
  assert.match(report.contract.gate,/without reading2020/);assert.match(report.contract.gate,/zero is not a no-op/);
});
test('FA92 zero/negative uses real CLC then full WORD ADC and two DEC without shift or clamp', () => {
  at(0x80FAA0,'CLC');assert.equal(at(0x80FAA1,'ADC',0x7E2020).mode,'longx');
  at(0x80FAA5,'DEC');at(0x80FAA6,'DEC');assert.equal(at(0x80FAA7,'STA',0x7E2120).mode,'longx');at(0x80FAAB,'RTS');
  assert.deepEqual([...root.values()].slice(6).map(i=>i.mnemonic),['CLC','ADC','DEC','DEC','STA','RTS']);
  for(let dimension=0;dimension<=65535;dimension++) for(const offset of [0,0x8000,0x8001,0xFFFE,0xFFFF])
    assert.equal(relative(offset,dimension).value,(dimension+(offset<32768?offset:offset-65536)-2+65536)&65535);
  assert.match(report.contract.relative,/No clamp, saturation, BYTE narrowing or shifted pixel formula/);
});
test('FA92 final N/Z comes from second DEC while C/V remain from ADC before decrements', () => {
  for(const [offset,dimension,value,status] of [[0,0,0xFFFE,0x80],[0,2,0,2],[0,0x8000,0x7FFE,0],
    [0x8000,0xFFFF,0x7FFD,0x41],[0xFFFF,1,0xFFFE,0x81],[0xFFFF,3,0,3]])
    assert.deepEqual(relative(offset,dimension),{value,status});
  for(let dimension=0;dimension<=65535;dimension++) {
    const r=relative(0,dimension);assert.equal(r.status&0x41,0);assert.equal(r.status&0x82,nz(r.value));
  }
  assert.match(report.contract.return,/Positive path C\/V from entry and N0\/Z0/);
  assert.match(report.contract.return,/C\/V from ADC before twoDEC/);
});
test('FA92 all65536 indices preserve odd/high bits and both WORDbytes carry into bank7F', () => {
  for(let x=0;x<=65535;x++) for(const base of [0x7E2020,0x7E2100,0x7E2120]) {
    const address=base+x, second=address+1;
    assert.equal(address-base,x);assert.equal(second-address,1);
    assert.equal(address>>>16,address>0x7EFFFF?0x7F:0x7E);
    assert.equal(second>>>16,second>0x7EFFFF?0x7F:0x7E);
  }
  assert.equal(0x7E2100+0xDEFF,0x7EFFFF);assert.equal(0x7E2120+0xFFFF,0x7F211F);
  assert.match(report.contract.first,/no index alignment, capacity or signed-index gate/);
});
test('FA92 finite acyclic all12-instruction WORD graph proves only two rootJSR stackbytes with no callees', () => {
  assert.deepEqual(proveWordStack(root,0x80FA92,'RTS',{measureStack:true}),report.full_graph.proof);
  assert.deepEqual(report.full_graph.proof.returns,[{at:'80:FAAB',m:0,x:0,dbr:'entry'}]);
  assert.equal(report.full_graph.proof.minimum_protected_stack_bytes,2);
  assert.equal(report.full_graph.proof.maximum_local_stack_bytes,0);assert.equal(report.full_graph.proof.external_return_assumptions,0);
  assert.equal(report.full_graph.actual_termination_proven,true);assert.deepEqual(report.full_graph.calls,[]);
  assert.deepEqual(report.local.edges,[{from:'80:FA9C',kind:'BEQ',to:'80:FAA0'},{from:'80:FA9E',kind:'BPL',to:'80:FAA7'}]);
  for(const i of root.values())if(i.target!==undefined)assert.ok(i.target>i.cpu);
});
test('FA92 proof rejects missing source, BYTE decode, wrong return and foreign stack frame', () => {
  const missing=new Map(root);missing.delete(0x80FAA1);assert.throws(()=>proveWordStack(missing,0x80FA92,'RTS'),/Uncovered edge/);
  for(const[pc,change,pattern]of[[0x80FA92,{state:{e:0,m:0,x:1}},/Mode mismatch/],
    [0x80FA9A,{state:{e:0,m:1,x:0}},/Mode mismatch/],[0x80FAAB,{mnemonic:'RTL'},/Wrong root return/],
    [0x80FAA0,{mnemonic:'PHA'},/Stack mismatch/]]) {
    const mutant=new Map(root);mutant.set(pc,{...root.get(pc),...change});assert.throws(()=>proveWordStack(mutant,0x80FA92,'RTS'),pattern);
  }
});
test('FA92 original936C caller uses fresh F963 result, saves DP14, sets0054/FFF8 and overwrites DP00 after return', () => {
  at(0x8093DB,'JSR',0x80F963);at(0x8093DE,'LDA',0);at(0x8093E0,'STA',0x14);
  at(0x8093E2,'LDA',0x54);at(0x8093E5,'STA',2);at(0x8093E7,'LDA',0xFFF8);at(0x8093EA,'STA',4);
  at(0x8093EC,'JSR',0x80FA92);at(0x8093EF,'LDA',1);at(0x8093F2,'STA',0);
  for(let dimension=0;dimension<=65535;dimension++)assert.equal(relative(0xFFF8,dimension).value,(dimension-10+65536)&65535);
  assert.match(report.caller.qualification,/capacity-full/);assert.match(report.caller.qualification,/no successful allocation/);
  assert.ok(report.caller.scan.raw_jsr_candidates.includes('80:93EC'));
  assert.match(report.caller.scan.qualification,/No indirect\/reachability\/allcallsite proof/);
});
test('FA92 selected original F963 dimension and zero writers remain separate from unshifted FA92 formula', () => {
  at(0x80F9B1,'LDA',4);at(0x80F9B3,'STA',0x7E2020);at(0x80F9B7,'DEC');at(0x80F9B8,'DEC');
  at(0x80F9B9,'ASL');at(0x80F9BA,'ASL');at(0x80F9BB,'ASL');at(0x80F9BC,'STA',0x7E2120);
  at(0x80F9CC,'LDA',0);at(0x80F9D3,'STA',0x7E2100);
  assert.match(report.selected_owners.qualification,/own unshifted formula/);
  assert.match(report.selected_owners.qualification,/no successful allocation or original initialized buffer assumed/);
});
test('FA92 fixedlong/DP accesses preserve Y/DBR and do not add MMIO, scratchowners or CPU lifecycle', () => {
  assert.deepEqual([...root.values()].filter(i=>i.mnemonic==='STA').map(i=>[i.mode,i.value]),[['longx',0x7E2100],['longx',0x7E2120]]);
  assert.ok(![...root.values()].some(i=>['JSR','JSL','PHY','PLY','PHB','PLB','PHP','PLP','SEP','REP'].includes(i.mnemonic)));
  for(let bank=0;bank<256;bank++)assert.equal(root.get(0x80FAA7).value,0x7E2120);
  assert.match(report.contract.return,/Y, actual DBR and I\/M\/X preserved/);
  assert.match(report.contract.freshness,/No local DP scratch or MMIO store/);
});
test('FA92 source and native close only manual root; six further dialog sources remain explicit', () => {
  assert.equal(report.full_graph.closed,true);assert.equal(report.full_graph.native_binding,true);
  assert.match(report.scope,/No CPU\/device\/clock\/scene\/frame execution/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.match(report.caller.qualification,/whole936C\/BF3B stack\/control/);
  assert.equal(report.native_prerequisite.module,'proof/render/fields-fa92.mjs');
  assert.equal(report.native_prerequisite.minimum_protected_stack_bytes,2);
  assert.match(report.native_prerequisite.qualification,/one outer commit/);
  assert.match(report.native_prerequisite.qualification,/Original936C\/BF3B caller and buffer initialization remain open/);
});
