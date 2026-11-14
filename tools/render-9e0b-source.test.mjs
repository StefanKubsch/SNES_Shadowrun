import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-9e0b.json', import.meta.url), 'utf8'));
const windows = [
  ['input9E0B', 0x809E0B, 0x809E1A, 6, '5f9981eb736ef5ecdf0b2b1ee8a1c696f7903bab08c0c9a0a62ce6d03058cecb'],
  ['callbackCallC179', 0x80C179, 0x80C17C, 1, '70abef3c4fd0bd835ce93e8ef0c15b44dc59d8dde172ef6052435291f1a6b83d'],
  ['selectedEdge9E1A', 0x809E1A, 0x809E2C, 6, 'a0d538194a39d18df0614d817a120c5e5256a957147085867bd87edd8975775d'],
  ['selectedGetters9E59', 0x809E59, 0x809E65, 6, 'b2d258af1f23e16c7c623d1ebb53825e43731d071ab0fc25390be5163425edbf'],
];
const instructions = windows.map(([, lo, hi]) => {
  const result=[];for(let pc=lo;pc<hi;){const i=decode(rom,pc,{e:0,m:0,x:0});assert.ok(i.next<=hi);result.push(i);pc=i.next;}return result;
});
test('9E0B source has independent ROM/window literal pins and exact15/6 body', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'),'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  windows.forEach(([name,lo,hi,count,hash],j)=>{
    const raw=rom.subarray(cpuToOffset(lo,rom.length),cpuToOffset(hi,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);assert.equal(instructions[j].length,count);
    assert.equal(report.windows[j].name,name);assert.equal(report.windows[j].machine_bytes,raw.toString('hex').toUpperCase());
  }); assert.equal(report.code_bytes,15);assert.equal(report.instruction_count,6);assert.equal(report.owner_excerpt_bytes,30);
});
test('9E0B contains WORD absolute poll, AND0001 and exact backwardBNE', () => {
  const [read,and,branch]=instructions[0];assert.equal(read.mnemonic,'LDA');assert.equal(read.value,0x4212);assert.equal(read.mode,'abs');
  assert.equal(and.mnemonic,'AND');assert.equal(and.value,1);assert.equal(and.length,3);
  assert.equal(branch.mnemonic,'BNE');assert.equal(branch.target,0x809E0B);
  for(let v=0;v<65536;v++)assert.equal((v&1)!==0,v%2===1);
});
test('9E0B capture read precedes sole01CA WORDstore, no registerwrite or filter', () => {
  assert.deepEqual(instructions[0].map(i=>[i.mnemonic,i.value]),[['LDA',0x4212],['AND',1],['BNE',0xF8],['LDA',0x4218],['STA',0x1CA],['RTS',0]]);
  for(const i of instructions[0])assert.equal(i.state.m,0);
  assert.match(report.contract.capture,/No01CC\/01CE updates/);assert.match(report.contract.poll,/high4213/);
});
test('9E0B structural WORDRTS has no calls or localpushes and leaves real termination unproved', () => {
  assert.deepEqual(proveWordStack(new Map(instructions[0].map(i=>[i.cpu,i])),0x809E0B,'RTS'),report.graph.proof);
  assert.deepEqual(report.graph.calls,[]);assert.equal(report.graph.actual_wait_termination_proven,false);
  assert.ok(!instructions[0].some(i=>['REP','SEP','CLC','SEC','ADC','PLB','PLD','PHP','PHA'].includes(i.mnemonic)));
});
test('9E0B flags come from final fullWORDLDA rather than masked poll, C/V preserved', () => {
  assert.match(report.contract.returns,/N frombit15,Z fromWORDzero/);assert.match(report.contract.returns,/C\/V\/I\/X\/Y\/DBR\/D preserved/);
  assert.equal(instructions[0].at(-3).cpu,0x809E13);assert.equal(instructions[0].at(-3).mnemonic,'LDA');
});
test('Selected consumers retain fresh01CA edge calculation and DPgetter ownership boundary', () => {
  assert.deepEqual(instructions[2].map(i=>[i.mnemonic,i.value]),[['LDA',0x1CA],['EOR',0x1CC],['AND',0x1CA],['STA',0x1CE],['LDA',0x1CA],['STA',0x1CC]]);
  assert.equal(instructions[3][1].mode,'dp');assert.equal(instructions[3][1].value,0);assert.equal(instructions[3][4].value,0);
  assert.match(report.owners.edge_excerpt,/not derived or implemented/);
});
test('Selected3byte JSR is pinned to priorcallback; rawpatterns remain qualified', async () => {
  assert.equal(instructions[1][0].target,0x809E0B);assert.equal(instructions[1][0].length,3);
  const previous=JSON.parse(await readFile(new URL('../analysis/render-a9e1.json',import.meta.url),'utf8'));
  assert.equal(previous.windows.find(w=>w.name==='callbackC152').machine_bytes.slice(0x27*2,0x2A*2),report.windows[1].machine_bytes);
  assert.deepEqual(report.owners.raw_patterns.jsr9E0B,['80:C179','80:F293']);assert.match(report.owners.qualification,/not a complete/);
});
test('Explicit chronology/physical bytes and two remaining callees are current bounded contract', () => {
  assert.match(report.contract.native_inputs,/unused samples are not consumed/);assert.match(report.contract.native_inputs,/No inferred hardware highbyte/);
  assert.deepEqual(report.caller.remaining_after,['80:C06B','81:B0D1']);assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
