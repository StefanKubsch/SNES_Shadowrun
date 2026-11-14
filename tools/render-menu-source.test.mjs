import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';
import { proveMenuStack } from './render-menu-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-a6a5.json', import.meta.url)));
const address = s => parseInt(s.replace(':',''),16);
const pins = [
  [0x80FA67,0x80FA89,16,'23fba8656c6da6c25b590f6e1ce1f9d5407439e1c762031deaf5a420db058ae2'],
  [0x81ACBD,0x81ACC3,3,'5e994a7e4330cd0a700c749ea167899d2c125cb442cb0b3c9b014d0752ce4104'],
  [0x809E1A,0x809E59,26,'947b5802e14cc8c39c08d9976b76f46dec1e8ca657e4a5a9e4ebec186578ad80'],
  [0x81B0A1,0x81B0AC,4,'376af3db14eef310efd1740299d9f2496c59cd205dbc14e15e2a9786bcd8f076'],
  [0x80C46E,0x80C4B3,28,'ce0aef528b83978bd42e83f7eca36565f48f0ee212846c2f42fd109ff3cc2e92'],
  [0x80C416,0x80C461,38,'7fb47acd393f216dfa9128685feddfe2a01cbd93f7c2814cd6841b264e703bc3'],
  [0x81F130,0x81F1E8,94,'50905b298f4518afafbf3df917de685631c0e9cd3788551efe018a8867987500'],
  [0x81F1E8,0x81F1FA,10,'6e9c5e0eb71b5ec1190da695a8c990dcaa0d342bfc9368a0a3f85d8ab043cb6a'],
  [0x81F100,0x81F10A,6,'50fd916170eed9b16dd6faa9c206304ced967e27ace85de9485a85c5995509c9'],
  [0x81F122,0x81F130,8,'abc30bd5cf09fa55e91d91977bb8ddff733d40121d40762f7b064e2e23391254'],
  [0x81F03A,0x81F067,21,'ffb4fab5ba66dd7c3b2d9a40891e6d169d1a4482beadfe9583a6e5a419f00d13'],
  [0x81F007,0x81F024,15,'ea46b86b724dbd5b6dbc861317cc51dbf4a39776940179f193f961e331110cb8'],
];
// Independent incoming widths by original address, including disjoint branch
// regions and the separate E1 reset tail; not the analyzer's linear state.
const byteRegions = [[0x80FAB6,0x80FAC6],[0x80FD91,0x80FDA7],[0x80FDBC,0x80FDCA],
  [0x80FE84,0x80FE89],[0x80FEA1,0x80FEBC],[0x80FB95,0x80FBC6],
  [0x80FC38,0x80FC5C],[0x80FC5F,0x80FC79],[0x80FC96,0x80FCEE],
  [0x80FD15,0x80FD37],[0x80FD56,0x80FD5B],[0x81ADCE,0x81ADD9],
  [0x81AE2E,0x81AE33],[0x81AE61,0x81AE8F],[0x80C447,0x80C45F],
  [0x81F13D,0x81F156],[0x81F18E,0x81F1B4],[0x81F1C6,0x81F1D1],
  [0x81F1EB,0x81F1F5],[0x81F125,0x81F12F],[0x81F03A,0x81F067],[0x81F00A,0x81F023]];
const map = new Map();
const windows = [...report.windows.slice(0,6),...report.dependencies[0].windows,
  ...report.menu_dependencies.flatMap(d => d.windows)];
for (const w of windows) for (let pc=address(w.entry);pc<address(w.end_exclusive);) {
  const reset = pc>=0x809E50 && pc<0x809E59;
  const i=decode(rom,pc,{e:Number(pc===0x809E55),m:Number(reset || byteRegions.some(([a,b])=>pc>=a&&pc<b)),x:Number(reset)});
  assert.ok(i.next<=address(w.end_exclusive));assert.ok(!map.has(pc));map.set(pc,i);pc=i.next;
}
const roots = [0x80A6A5,0x80A6AD,0x80A6B8,0x80A6C7];
const reached = (proof,pc) => proof.mode_windows.some(w=>address(pc)>=address(w.entry)&&address(pc)<address(w.end_exclusive));
const broken = (pc,patch) => { const result=new Map(map);result.set(pc,{...map.get(pc),...patch});return result; };

test('conditional menu independently pins all12 added source windows and entire immutable European ROM',()=>{
  assert.equal(createHash('sha256').update(rom).digest('hex'),'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.deepEqual(report.menu_dependencies.map(d=>d.windows.length),[2,1,1,8]);
  const dependencies=report.menu_dependencies.flatMap(d=>d.windows);
  for(const [lo,hi,n,hash] of pins) {
    const raw=rom.subarray(cpuToOffset(lo,rom.length),cpuToOffset(hi,rom.length));
    const w=dependencies.find(w=>w.entry===cpuLabel(lo));assert.ok(w);
    assert.equal(createHash('sha256').update(raw).digest('hex'),hash);
    assert.equal(w.sha256,hash);assert.equal(w.machine_bytes,raw.toString('hex').toUpperCase());
    assert.equal(w.covered_bytes,hi-lo);assert.equal(w.instruction_count,n);
    assert.equal([...map.keys()].filter(pc=>pc>=lo&&pc<hi).length,n);
  }
  assert.equal(map.size,1088);assert.equal([...map.values()].reduce((n,i)=>n+i.raw.length,0),2304);
});

test('all four roots close actual all-WORD callee graph with 20 stackbytes and no assumed external returns',()=>{
  roots.forEach((entry,j)=>{
    const proof=proveMenuStack(map,entry);assert.deepEqual(proof,report.conditional_menu_graph.proofs[j]);
    assert.equal(proof.minimum_protected_stack_bytes,20);assert.equal(proof.maximum_local_stack_bytes,18);
    assert.equal(proof.external_return_assumptions,0);assert.equal(proof.conditional_graph_closed,true);
    assert.equal(proof.actual_termination_proven,false);
    assert.ok(reached(proof,'81:F130'));
    assert.ok(reached(proof,'81:B0A1'));
    assert.ok(reached(proof,'80:9E1A'));
  });
  assert.deepEqual(report.conditional_menu_graph.proofs.map(p=>p.reachable_instructions),[1064,1064,1065,1062]);
  assert.equal(report.menu.conditional_normal_graph_closed,true);
  assert.equal(report.menu.conditional_minimum_protected_stack_bytes,20);
  assert.equal(report.menu.full_graph_closed,false);assert.equal(report.menu.minimum_protected_stack_bytes,null);
});

test('four separate immutable002D profiles skip actual F130 while retaining same dominating text stack',()=>{
  const raw=rom.subarray(cpuToOffset(0x80C4FF,rom.length),cpuToOffset(0x80C501,rom.length));
  assert.equal(raw.toString('hex'),'2d00');
  roots.forEach((entry,j)=>{
    const proof=proveMenuStack(map,entry,{sound:'original-002D'});
    assert.deepEqual(proof,report.conditional_menu_graph.original_sound_proofs[j]);
    assert.equal(proof.minimum_protected_stack_bytes,20);assert.ok(!reached(proof,'81:F130'));
    assert.match(proof.conditional_lemmas.join(' '),/no synthetic table override/);
  });
  assert.deepEqual(report.conditional_menu_graph.original_sound_proofs.map(p=>p.reachable_instructions),[923,923,924,921]);
});

test('compact mode intervals recover every reached instruction without holes or duplicate mode claims',()=>{
  for(const p of [...report.conditional_menu_graph.proofs,...report.conditional_menu_graph.original_sound_proofs]) {
    const visited=new Set(),modes=new Set();
    for(const w of p.mode_windows) {
      let pc=address(w.entry);
      while(pc<address(w.end_exclusive)) {
        const i=map.get(pc);assert.ok(i,cpuLabel(pc));assert.ok(i.next<=address(w.end_exclusive));
        const key=`${pc}/${w.m}/${w.x}`;assert.ok(!modes.has(key));modes.add(key);visited.add(pc);
        if(i.mode==='immM')assert.equal(i.raw.length,w.m?2:3);
        if(i.mode==='immX')assert.equal(i.raw.length,w.x?2:3);
        pc=i.next;
      }
      assert.equal(pc,address(w.end_exclusive));
    }
    assert.equal(visited.size,p.reachable_instructions);
  }
});
test('confirmation forces DBR80 and cancellation preserves entryDBR for all roots and sound profiles',()=>{
  for(const p of [...report.conditional_menu_graph.proofs,...report.conditional_menu_graph.original_sound_proofs])
    assert.deepEqual(p.returns,[{at:'80:A834',m:0,x:0,dbr:'entry'},{at:'80:A825',m:0,x:0,dbr:128}]);
  assert.equal(map.get(0x80C46E).mnemonic,'PHK');assert.equal(map.get(0x80C46F).mnemonic,'PLB');
  assert.equal(map.get(0x80A822).target,0x809E1A);assert.equal(map.get(0x80A831).target,0x809E1A);
});

test('20-byte witness retains callerPHY, childPHY, nested text/helper and true JSR/JSL return sizes',()=>{
  const witness=report.conditional_menu_graph.proofs[0].maximum_stack_witness;
  assert.equal(witness.at,'81:AEAA');assert.equal(map.get(0x81AEAA).mnemonic,'JSL');
  assert.deepEqual(witness.return_frames,[{kind:'RTS',to:'80:A7FD'},{kind:'RTS',to:'80:A640'},
    {kind:'RTS',to:'80:FEBF'},{kind:'RTL',to:'80:FBE7'},{kind:'RTL',to:'81:AEAE'}]);
  assert.equal(witness.data_bytes,6);assert.equal(witness.status_bytes,0);
  assert.equal(witness.return_frames.reduce((n,f)=>n+(f.kind==='RTS'?2:3),0)+witness.data_bytes+2,20);
});

test('every9E1A caller records reset exclusion at fresh exact3030 and never assumes reset returns',()=>{
  for(const p of report.conditional_menu_graph.proofs) {
    const reset=p.excluded_boundaries.filter(b=>b.at==='80:9E2F');
    assert.deepEqual(reset.map(b=>b.caller_return),['80:A6F0','80:A834','80:A825']);
    assert.ok(reset.every(b=>b.to==='80:9E3D'&&b.local_stack_bytes===2));
    assert.ok(!reached(p,'80:9E3D')&&!reached(p,'80:9E55'));
  }
  for(const [pc,patch] of [[0x809E26,{value:0x1CE}],[0x809E2C,{value:0x3031}],
    [0x809E2F,{mnemonic:'BNE'}],[0x809E2F,{target:0x809E3C}]])
    assert.throws(()=>proveMenuStack(broken(pc,patch),roots[0]),/Renew menu source lemma/);
});

test('original caller channel3 and full transitive fixed writers justify nonzero voice independently of DBR',()=>{
  for(const [pc,patch] of [[0x80A80F,{value:0}],[0x80A812,{value:4}],[0x80A817,{value:4}],
    [0x80C493,{value:4}],[0x80C495,{target:0x80C4A6}],[0x81F13D,{value:6}],
    [0x81F100,{value:6}],[0x81F1F5,{value:6}],[0x81F054,{value:6}]])
    assert.throws(()=>proveMenuStack(broken(pc,patch),roots[0]),/Renew/);
  assert.ok(report.conditional_menu_graph.proofs[0].excluded_boundaries.some(b=>b.at==='80:C495'&&b.to==='80:C4B2'));
});

test('PEI source offsets and paired WORD PLA stores are checked rather than silently generalized',()=>{
  for(const [pc,patch] of [[0x80A798,{value:2}],[0x80A79A,{value:4}],
    [0x80A798,{mode:'dp'}],[0x80A7B1,{value:0}],[0x80A7B4,{value:6}],
    [0x80A7B0,{mnemonic:'NOP'}]])
    assert.throws(()=>proveMenuStack(broken(pc,patch),roots[0]),/Renew menu source lemma/);
  const extra=broken(0x80A6D0,{mnemonic:'PEI',value:2});
  assert.throws(()=>proveMenuStack(extra,roots[0]),/Unproved menu PEI/);
});

test('mixed PHY to PLA hotkey path and normal PLY reject missing or mismatched saves',()=>{
  for(const pc of [0x80A77B,0x80A791,0x80A7CD,0x80A7D4])
    assert.throws(()=>proveMenuStack(broken(pc,{mnemonic:'NOP'}),roots[0]),/Renew menu source lemma/);
  for(const pc of [0x80A63C,0x80A640,0x80A658,0x80A65C])
    assert.throws(()=>proveMenuStack(broken(pc,{mnemonic:'NOP'}),roots[0]),/stack mismatch|Wrong menu call return/);
});

test('every directly called menu helper needs its real entry source; no externally returning shortcut',()=>{
  for(const target of [0x80A617,0x80A5F9,0x81B0A1,0x809E1A,0x80A5DB,0x80FA67,0x80C46E]) {
    const missing=new Map(map);missing.delete(target);
    assert.throws(()=>proveMenuStack(missing,roots[0]),/Uncovered|Renew/);
  }
  for(const [pc,patch] of [[0x81B0AB,{mnemonic:'RTS'}],[0x80A6E9,{mnemonic:'JSR'}],
    [0x81ACBD,{mnemonic:'STP'}],[0x80A6ED,{target:0x80E382}]])
    assert.throws(()=>proveMenuStack(broken(pc,patch),roots[0]),/Wrong menu call return|Unproved menu control|Uncovered/);
});

test('width, status restoration and raw byte-stack mutations fail before returning',()=>{
  for(const [pc,patch] of [[0x81F022,{mnemonic:'NOP'}],[0x80FAC4,{value:0}],
    [0x80A6D0,{mnemonic:'SEP',value:0x20}],[0x80A6D0,{mnemonic:'TCD'}]])
    assert.throws(()=>proveMenuStack(broken(pc,patch),roots[0]));
  for(const options of [{sound:'guess'},{sound:null}]) assert.throws(()=>proveMenuStack(map,roots[0],options),/Invalid/);
  assert.throws(()=>proveMenuStack(map,0x80A798),/Invalid menu proof entry/);
});

test('source report separates supplied native normal menu from full reset and termination claims',()=>{
  assert.equal(report.conditional_menu_graph.full_reset_graph_closed,false);
  assert.equal(report.conditional_menu_graph.native_binding,true);
  assert.deepEqual(report.conditional_menu_graph.native_entries,['80:A6A5','80:A6AD','80:A6B8','80:A6C7']);
  assert.equal(report.conditional_menu_graph.actual_termination_proven,false);
  assert.match(report.scope,/Conditional normal-return/);assert.match(report.scope,/No CPU\/device/);
  assert.ok(report.conditional_menu_graph.proofs.every(p=>p.conditional_lemmas.length===3));
});
