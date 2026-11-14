import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const { bytes: rom, metadata } = inspectRom(await readFile(new URL('../Shadowrun (E).smc', import.meta.url)));
const report = JSON.parse(await readFile(new URL('../analysis/render-ff79.json', import.meta.url), 'utf8'));
// Literal boundaries, counts, hashes and mode regions independent of the analyzer.
const windows = [
  ['clearFF79',0x80FF79,0x80FF98,14,'c61ae4655aeb4f48ca5716d2ac0ddce5f63412c8c618262422e74288bcf261bc'],
  ['selectedDialogFF79',0x80937A,0x80939E,16,'8a7191f24bc994e50671d964ab7f6457512c49605b0deb9a6cceba92938fb540'],
  ['requestACB5',0x81ACB5,0x81ACBD,3,'560a3f66c5d46e47b85e687c5a63f482b3cd1e12f7591e9a79d3eca1ea1012be'],
  ['waitACAF',0x81ACAF,0x81ACB5,3,'abcd15f735893a9027750d6760a4ecefb5554f6e4ce37c3c78880bc2a24a70ee'],
  ['entryACCF',0x81ACCF,0x81AD92,97,'7b1e231f5be2f3e765f02d5b621fd40baa5b190448ab60a94464d32b6bb30d9e'],
  ['renderAD92',0x81AD92,0x81ADBA,16,'de7bc7c4cb91717e27a7b7b0eab421495a009b497cb012cf56ff6b0713c35b13'],
  ['renderA9B2',0x81A9B2,0x81A9E1,22,'2f61dd8539c9883340a1444cfab2dca45375271b6761cac3b29df7a263dc9736'],
  ['copy9F49',0x809F49,0x809F69,18,'5af926a50a9c79cf5ae3a099de4a099100aec12214362c4a66dee40578043db0'],
  ['unpack9E9B',0x809E9B,0x809F49,91,'c0544d0c8c3eec40a8e9bee5cd007a83316bf8f141f0d159c0a192ed1ffe3ea3'],
  ['bits9E65',0x809E65,0x809E7E,15,'c72d7b290430e738bb89d68f8cf33cdeb60367d827d0627a7caba6f4960daad5'],
  ['overlayAF1F',0x81AF1F,0x81B026,103,'286626c5b2d2faadcdaabdc1569d77a03f8c4ab79b1929a7fbd283257e5c744c'],
  ['removeFA3E',0x80FA3E,0x80FA67,19,'b327ff7f8ee14970bc39549326c7b88593ddb127caf07974f1f7940b4367a5d6'],
];
const byteA = [[0x80937C,0x809382],[0x809EE4,0x809EED],[0x809F00,0x809F12],
  [0x81AF37,0x81AF3E],[0x81AFB0,0x81AFB7],[0x81AFDE,0x81AFE5]];
const byteX = [[0x809F00,0x809F12]];
const inRegions = (pc, regions) => Number(regions.some(([lo,hi]) => pc >= lo && pc < hi));
const map = new Map(), callerMap = new Map();
for (const [name,start,end] of windows) for (let pc = start; pc < end;) {
  const i = decode(rom,pc,{e:0,m:inRegions(pc,byteA),x:inRegions(pc,byteX)});
  assert.ok(i.next <= end); (name === 'selectedDialogFF79' ? callerMap : map).set(pc,i); pc = i.next;
}
const range = (start,end) => [...map.values(),...callerMap.values()].filter(i => i.cpu >= start && i.cpu < end);
const at = (pc,op,value,target) => {
  const i = map.get(pc) ?? callerMap.get(pc); assert.ok(i,cpuLabel(pc)); assert.equal(i.mnemonic,op);
  if (value !== undefined) assert.equal(i.value,value); if (target !== undefined) assert.equal(i.target,target); return i;
};

test('FF79 independently pins complete root, selected caller and every transitive source window', () => {
  assert.equal(metadata.rom_sha256,'91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  assert.equal(report.rom_sha256,metadata.rom_sha256);
  const supplied = [...report.windows,...report.dependencies.flatMap(d => d.windows)];
  assert.equal(supplied.length,windows.length);
  for (const [name,start,end,count,sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(start,rom.length),cpuToOffset(end,rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'),sha256);
    assert.equal(range(start,end).length,count);
    assert.deepEqual(supplied.find(w => w.name === name),{name,entry:cpuLabel(start),end_exclusive:cpuLabel(end),
      covered_bytes:end-start,instruction_count:count,sha256,machine_bytes:raw.toString('hex').toUpperCase()});
  }
  assert.equal(report.full_graph.code_bytes,862); assert.equal(report.full_graph.instructions,401);
  assert.equal(report.windows[1].covered_bytes,36);
});

test('FF79 fresh fixed-long slotread skips all negative WORDs and accepts zero without an index clamp', () => {
  at(0x80FF79,'LDX',6); assert.equal(at(0x80FF7C,'LDA',0x7E0216).mode,'longx');
  at(0x80FF80,'BMI',undefined,0x80FF90); at(0x80FF82,'STA',0);
  assert.deepEqual(range(0x80FF79,0x80FF84).map(i => i.mnemonic),['LDX','LDA','BMI','STA']);
  for (let slot = 0; slot <= 65535; slot++) assert.equal(Boolean(slot & 0x8000),slot >= 32768);
  assert.match(report.contract.scan,/including0000/); assert.match(report.contract.scan,/unmasked/);
});

test('FF79 visits exactly6,4,2,0 with WORD decrements and fresh reads after each real release', () => {
  at(0x80FF90,'DEX'); at(0x80FF91,'DEX'); at(0x80FF92,'BPL',undefined,0x80FF7C);
  assert.deepEqual(report.local.indices,[6,4,2,0]); assert.equal(report.local.maximum_release_calls,4);
  assert.ok(range(0x80FF79,0x80FF98).every(i => i.state.m === 0 && i.state.x === 0));
  assert.deepEqual([6,4,2,0].map(x => (x - 2) & 65535),[4,2,0,65534]);
  assert.equal(0xFFFE & 0x8000,0x8000); assert.match(report.contract.marker,/no cached later slotreads/);
  assert.deepEqual(report.local.edges,[{from:'80:FF80',kind:'BMI',to:'80:FF90'},
    {from:'80:FF85',kind:'JSR',to:'80:FA3E'},{from:'80:FF92',kind:'BPL',to:'80:FF7C'}]);
});

test('FF79 protects only outer X and writes the marker only after FA3E actually returns', () => {
  at(0x80FF84,'PHX'); at(0x80FF85,'JSR',undefined,0x80FA3E); at(0x80FF88,'PLX');
  at(0x80FF89,'LDA',0xFFFF); assert.equal(at(0x80FF8C,'STA',0x7E0216).mode,'longx');
  assert.deepEqual(range(0x80FF82,0x80FF90).map(i => i.mnemonic),['STA','PHX','JSR','PLX','LDA','STA']);
  assert.ok(!range(0x80FF79,0x80FF98).some(i => ['PHY','PLY','PHP','PLP','PHA','PLA'].includes(i.mnemonic)));
  assert.match(report.contract.marker,/neither Y nor A nor flags/);
});

test('FF79 real FA3E clears flags before its endcheck, trims fresh words and always calls AD92', () => {
  at(0x80FA3E,'LDX',0); at(0x80FA40,'LDA',0); at(0x80FA43,'STA',0x226);
  at(0x80FA46,'CPX',0x204); at(0x80FA49,'BNE',undefined,0x80FA62);
  at(0x80FA4B,'DEX'); at(0x80FA4C,'DEX'); at(0x80FA4D,'BMI',undefined,0x80FA54);
  at(0x80FA4F,'LDA',0x226); at(0x80FA52,'BEQ',undefined,0x80FA4B);
  at(0x80FA56,'LDA',0x7E2060); at(0x80FA5A,'STA',0x212);
  at(0x80FA5D,'DEX'); at(0x80FA5E,'DEX'); at(0x80FA5F,'STX',0x204);
  at(0x80FA62,'JSL',undefined,0x81AD92); at(0x80FA66,'RTS');
  assert.deepEqual(range(0x80FA3E,0x80FA67).filter(i => ['JSR','JSL'].includes(i.mnemonic)).map(i => i.target),[0x81AD92]);
});

test('FF79 typed full graph reaches all401 actual instructions with28 protected bytes and original DBR', () => {
  assert.deepEqual(proveWordStack(map,0x80FF79,'RTS',{measureStack:true}),report.full_graph.proof);
  assert.equal(report.full_graph.proof.maximum_local_stack_bytes,26);
  assert.equal(report.full_graph.proof.minimum_protected_stack_bytes,28);
  assert.equal(report.full_graph.proof.external_return_assumptions,0);
  assert.deepEqual(report.full_graph.proof.returns,[{at:'80:FF97',m:0,x:0,dbr:'entry'}]);
  assert.equal(proveWordStack(map,0x80FA3E,'RTS',{measureStack:true}).minimum_protected_stack_bytes,24);
  assert.equal(proveWordStack(map,0x81AD92,'RTL',{measureStack:true}).minimum_protected_stack_bytes,22);
  assert.deepEqual(report.full_graph.calls,[...map.values()].filter(i => ['JSR','JSL'].includes(i.mnemonic))
    .map(i => ({from:cpuLabel(i.cpu),kind:i.mnemonic,to:cpuLabel(i.target)})));
});

test('FF79 source proof rejects missing actual callee, changed widths, lost PHX and wrong returns', () => {
  const missing = new Map(map); missing.delete(0x81AD92);
  assert.throws(() => proveWordStack(missing,0x80FF79,'RTS'),/Uncovered edge/);
  for (const [pc,change,pattern] of [
    [0x80FF84,{mnemonic:'NOP'},/Stack mismatch/],
    [0x80FF97,{mnemonic:'RTL'},/Wrong root return/],
    [0x80FA66,{mnemonic:'RTL'},/Wrong call return/],
    [0x80FF7C,{state:{e:0,m:1,x:0}},/Mode mismatch/],
  ]) {
    const mutant = new Map(map); mutant.set(pc,{...map.get(pc),...change});
    assert.throws(() => proveWordStack(mutant,0x80FF79,'RTS'),pattern);
  }
});

test('FF79 tail clears actualDBR0200 after every slot and preserves finalA with XFFFE/N1/Z0', () => {
  assert.equal(at(0x80FF94,'STZ',0x200).mode,'abs'); at(0x80FF97,'RTS');
  assert.deepEqual(range(0x80FF90,0x80FF98).map(i => i.mnemonic),['DEX','DEX','BPL','STZ','RTS']);
  for (let last = 0; last <= 65535; last++) {
    const a = last >= 32768 ? last : 65535;
    assert.ok(a >= 32768); assert.equal(a,last & 0x8000 ? last : 0xFFFF);
  }
  assert.match(report.contract.tail,/XFFFE\/N1\/Z0/); assert.match(report.contract.tail,/STZ does not loadA/);
  assert.match(report.contract.tail,/entry values if allskip/); assert.match(report.contract.tail,/finalI retained/);
});

test('FF79 selected936C caller constructs the pointer before call and rereads it afterward with newY3', () => {
  at(0x80937A,'SEP',32); at(0x80937C,'LDA',0x8D); at(0x80937E,'STA',0x13); at(0x809380,'REP',32);
  at(0x809382,'LDA',2); at(0x809384,'ASL'); at(0x809385,'TAY'); at(0x809386,'LDA',0x94F7);
  at(0x809389,'STA',0x11); at(0x80938B,'LDY',0x26); at(0x80938D,'JSR',undefined,0x80FF79);
  at(0x809390,'LDY',3); assert.equal(at(0x809393,'LDA',0x11).mode,'dily');
  at(0x809395,'AND',0xFF); at(0x809398,'STA',0x1BA); at(0x80939B,'AND',0x7F);
  assert.ok(report.caller.scan.raw_jsr_candidates.includes('80:938D'));
  assert.match(report.caller.scan.qualification,/No indirect\/reachability\/allcallsite proof/);
  assert.match(report.caller.pointer,/not saved/); assert.match(report.caller.pointer,/no automatic pointer preservation/);
});

test('FF79 source closure preserves explicit address, observation, initialization and caller boundaries', () => {
  const localStores = range(0x80FF79,0x80FF98).filter(i => ['STA','STZ'].includes(i.mnemonic));
  assert.deepEqual(localStores.map(i => [i.mode,i.value]),[['dp',0],['longx',0x7E0216],['abs',0x200]]);
  assert.match(report.contract.ownership,/does not explicitly clear0202 or021E/);
  assert.match(report.contract.ownership,/no whole-graph preservation/);
  assert.match(report.contract.observations,/neither wait progress nor data-loop termination/);
  assert.equal(report.full_graph.closed,true); assert.equal(report.full_graph.native_binding,true);
  assert.equal(report.full_graph.actual_termination_proven,false);
  assert.ok(![...map.values()].some(i => ['CLI','SEI','CLD','SED','TCD','PLD','TCS','TXS','XCE'].includes(i.mnemonic)));
  assert.match(report.caller.boundary,/no whole936C\/BF3B stackminimum/);
  assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
});
