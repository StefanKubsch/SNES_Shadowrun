import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';
import { inspectScriptTables } from './scripts.mjs';
import { proveInputWrapper } from './input-wrapper-proof.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-input-flow.json', import.meta.url), 'utf8'));
const pins = [
  [0x8096AB,0x8096F3,25,'063ddd235d9c193da8f4544f4ffd6028b0ae9c17478a39a1541299ff8fa4008f'],
  [0x81B0A1,0x81B0AC,4,'376af3db14eef310efd1740299d9f2496c59cd205dbc14e15e2a9786bcd8f076'],
  [0x80F290,0x80F298,5,'1c305fa553554aed29925b876a5ce859243e515262b5af13ab3196a9134b5fe7'],
  [0x80F298,0x80F2A0,5,'be6aae08b4cfac3aa3872769e26e894697a5c22343d3fe6b17e09264a2834628'],
  [0x80C131,0x80C13B,5,'de1f9ac864f825933287219b92839d7bb9df853f4ccb8022c54fad14b66b4877'],
  [0x8096A1,0x8096AB,3,'9c38413862729d123216f6b97460391b3115b5ddfe6e04c3aa0174b060a1a298'],
  [0x818877,0x81888C,9,'737c40a73740b7500f14c2f7408342f1113038935a1204ef9c314d3c279ef4d5'],
  [0x80BE6D,0x80BE7E,8,'76cad8a83459996312061d85e8198ec8fb8d948cb69baea487b3b5ca29b13cb0'],
  [0x80BF3B,0x80BF53,9,'b92b59c0115c19f567a1c10b59318ce45e73ea0ef45bc94c1612a43c22403783'],
];
function instructions(lo,hi,initialState={e:0,m:0,x:0}) {
  let state={...initialState};const result=[],saved=[];
  for(let pc=lo;pc<hi;) {
    const i=decode(rom,pc,state);assert.ok(i.next<=hi);result.push(i);pc=i.next;
    if(i.mnemonic==='PHP')saved.push({...state});if(i.mnemonic==='PLP')state=saved.pop();
    if(['REP','SEP'].includes(i.mnemonic)){if(i.value&32)state.m=Number(i.mnemonic==='SEP');if(i.value&16)state.x=Number(i.mnemonic==='SEP');}
    if(i.cpu===0x809E54)state.e=1;
  }return result;
}
const blocks=pins.map(([lo,hi])=>instructions(lo,hi));
test('Inputflow originalROM and nine independent codewindow hashes are literalpinned',()=>{
  assert.equal(createHash('sha256').update(rom).digest('hex'),'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  pins.forEach(([lo,hi,n,hash],j)=>{const raw=rom.subarray(cpuToOffset(lo,rom.length),cpuToOffset(hi,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);assert.equal(blocks[j].length,n);
    assert.equal(report.windows[j].machine_bytes,raw.toString('hex').toUpperCase());assert.equal(report.windows[j].sha256,hash);});
});
test('Main72/25 local preserves all17 callsites and two interveningcalls beforeconsume',()=>{
  const expected=[0x81B0A1,0x818877,0x818076,0x809E1A,0x80BE6D,0x80BF3B,0x80C1E3,0x808000,0x80CC4B,
    0x80DE94,0x80AFC4,0x80BAD5,0x818C2E,0x818A91,0x80B8DE,0x80FF14,0x80E270];
  assert.deepEqual(blocks[0].filter(i=>['JSR','JSL'].includes(i.mnemonic)).map(i=>i.target),expected);
  assert.equal(report.main.code_bytes,72);assert.equal(report.main.reachable_local_instructions,25);assert.equal(report.main.external_return_boundaries,17);
  assert.ok(!blocks[0].some(i=>i.target===0x809E0B));assert.match(report.main.qualification,/no fullcallgraph/);
});
test('Main carrygates and exitwords preserveexactbranch order without impliedframes',()=>{
  assert.deepEqual(blocks[0].filter(i=>i.mode==='rel8').map(i=>[i.cpu,i.mnemonic,i.target]),
    [[0x8096C6,'BCS',0x8096AB],[0x8096CB,'BCS',0x8096AB],[0x8096EA,'BEQ',0x8096ED],[0x8096F0,'BEQ',0x8096AB]]);
  assert.deepEqual(blocks[0].filter(i=>i.mnemonic==='LDA').map(i=>i.value),[0x1FDA,0x1FD8]);
  assert.deepEqual(report.main.returns,['80:96EC','80:96F2']);assert.match(report.main.chronology,/No direct9E0B capture/);
});
test('B0A1 reads fixedlongWORDbaselineonce, comparesfreshsameword and branches onlytoequalitypoll',()=>{
  assert.deepEqual(blocks[1].map(i=>[i.mnemonic,i.mode,i.value]),[['LDA','long',0x7E1C76],['CMP','long',0x7E1C76],['BEQ','rel8',0xFA],['RTL','i',0]]);
  assert.equal(blocks[1][2].target,0x81B0A5);assert.ok(blocks[1].every(i=>i.state.m===0));
  assert.equal(report.wait.proof.external_return_assumptions,0);assert.match(report.wait.contract,/A remains originalbaseline/);
  assert.match(report.wait.contract,/no baseline reload, delta computation/);assert.match(report.wait.contract,/no syntheticcounterupdate/);assert.match(report.wait.contract,/Manual nativeB0A1 supplied/);
});
test('B0A1 original closed WORD RTL graph needs exactly three protected bytes and no external return',()=>{
  const map=new Map(blocks[1].map(i=>[i.cpu,i]));
  const proof=proveWordStack(map,0x81B0A1,'RTL',{measureStack:true});
  assert.equal(proof.reachable_instructions,4);assert.equal(proof.minimum_protected_stack_bytes,3);
  assert.equal(proof.maximum_local_stack_bytes,0);assert.equal(proof.external_return_assumptions,0);
  assert.deepEqual(proof.returns,[{at:'81:B0AB',m:0,x:0,dbr:'entry'}]);
});
test('B0A1 stack proof rejects changed width, return and uncovered poll edge',()=>{
  for(const [pc,patch]of [[0x81B0A5,{state:{e:0,m:1,x:0}}],
    [0x81B0AB,{mnemonic:'RTS'}],[0x81B0A9,{target:0x81B0A6}]]){
    const map=new Map(blocks[1].map(i=>[i.cpu,i]));map.set(pc,{...map.get(pc),...patch});
    assert.throws(()=>proveWordStack(map,0x81B0A1,'RTL',{measureStack:true}));
  }
});
test('Actualbank00 NMI increment precedescallback, selected80mirror doesnotprove PHK80 runtime',()=>{
  assert.deepEqual(blocks[4].map(i=>i.mnemonic),['PHK','PLB','INC','PHP','JSL']);assert.equal(blocks[4][2].value,0x1C76);assert.equal(blocks[4][4].target,0x80C14F);
  const actual=instructions(0x00C131,0x00C13B);assert.deepEqual(actual.map(i=>i.raw),blocks[4].map(i=>i.raw));
  assert.equal(actual[0].cpu>>>16,0);assert.equal(blocks[4][0].cpu>>>16,0x80);
  assert.match(report.wait.owners,/Increment is before9E0B capture/);assert.match(report.wait.owners,/bank-sensitivePHK matters/);
});
test('All eight wrapper widthproofs close childgraph and restoreentryRTL, resetabandonsouterframes',()=>{
  let j=0;
  for(const entry of [0x80F290,0x80F298])for(const m of [0,1])for(const x of [0,1]){
    const state={e:0,m,x},wrapper=instructions(entry,entry+8,state);
    const child=entry===0x80F290?instructions(0x809E0B,0x809E1A):[...instructions(0x809E1A,0x809E59),...instructions(0x81F007,0x81F024)];
    const map=new Map([...wrapper,...child].map(i=>[i.cpu,i])),p=proveInputWrapper(map,entry,state);
    assert.deepEqual(p,report.wrappers.proofs[j++]);assert.equal(p.returning_protected_bytes,6);assert.equal(p.all_paths_protected_bytes,entry===0x80F290?6:10);
    assert.equal(p.reachable_instructions,entry===0x80F290?11:46);assert.equal(p.external_return_assumptions,0);
    assert.deepEqual(p.returns[0],{at:entry===0x80F290?'80:F297':'80:F29F',e:0,m,x,dbr:'entry',carry:'entry'});
    assert.equal(p.terminals.length,entry===0x80F290?0:1);if(p.terminals.length)assert.equal(p.terminals[0].abandoned_local_bytes,3);
  }
});
test('Wrapperproof rejects missingstatusrestore, incorrectREPmask and mismatchedchildRTS',()=>{
  const state={e:0,m:1,x:1},all=[...instructions(0x80F290,0x80F298,state),...instructions(0x809E0B,0x809E1A)];
  for(const [pc,patch]of [[0x80F296,{mnemonic:'NOP'}],[0x80F291,{value:0x20}],[0x809E19,{mnemonic:'RTL'}]]){
    const map=new Map(all.map(i=>[i.cpu,i]));map.set(pc,{...map.get(pc),...patch});assert.throws(()=>proveInputWrapper(map,0x80F290,state));
  }
});
test('Wrappersnotnative tableentries, held/edge excerptsand8076 source are boundedowners',()=>{
  const native=inspectScriptTables(rom).native_functions;assert.equal(native.length,220);assert.ok(!native.some(n=>['80:F290','80:F298'].includes(n.cpu_address)));
  assert.deepEqual(report.wrappers.native_table.getter_entries.map(n=>[n.id,n.cpu_address,n.return_bytes]),[['61','80:9E5F',2],['D3','80:9E59',2]]);
  assert.equal(blocks[7][3].value,0x1CA);assert.equal(blocks[8][6].value,0x1CE);
  const raw=rom.subarray(cpuToOffset(0x818076,rom.length),cpuToOffset(0x8180C4,rom.length));
  assert.equal(report.selected_owners.request8076.machine_bytes,raw.toString('hex').toUpperCase());assert.match(report.selected_owners.heldBE6D,/full localBE6D/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
