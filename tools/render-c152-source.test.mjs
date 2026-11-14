import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-c152.json', import.meta.url), 'utf8'));
const pins = [
  [0x80C152, 0x80C1A6, 28, '0a5abd0966147a44db1eb25e0cdd75850ecd8319a865e9c092f031fdcf7ac6af'],
  [0x818949, 0x818A05, 74, 'e19f94eeb8313bc33e4bb2c708b1b46ebb3190d7eaefd43a2ceae109b20376de'],
  [0x81A9E1, 0x81AA9C, 71, 'ecc6ffbce77e7b8b8a31fa016053b6efdc82682daf4246fcf72c5b110f2bf46f'],
  [0x80999A, 0x8099EB, 40, 'c90a0be74ae4dbcc7c22e80cfa125f5d2ff78f9e38d975c93af68832d4bb1643'],
  [0x8180C4, 0x8180F7, 20, 'c2dee31d0f818564457d0cda4708d7ae4eb29bfad2e585604168f6d23ffebc74'],
  [0x81A919, 0x81A954, 31, '866063e7ac09857126708488a5643656ebae5d957fe9909c2fe4eeaf594e2de4'],
  [0x81A958, 0x81A98E, 23, 'be5e955766edc1794cf7409cbf4d8b041d9b071f4033d8be6ed65051412878e3'],
  [0x81A98E, 0x81A9B2, 14, '1268df78438cbeb285651bdc83ab3a77f3fcc71e3ec52ef179edcf217fce9b11'],
  [0x808FBA, 0x808FF5, 24, '18655de4a121db47dcfeba902f2669aaf96cd7e6278346678cef3845029487fb'],
  [0x809E0B, 0x809E1A, 6, '5f9981eb736ef5ecdf0b2b1ee8a1c696f7903bab08c0c9a0a62ce6d03058cecb'],
  [0x80C06B, 0x80C0F7, 55, 'f4c3a3a2381323c8b8c19479807c7bd14f6096f09abd2ddad686411189554af7'],
  [0x81B0D1, 0x81B11A, 33, '811110aca0601f2335cdf40a7e876bf3e56020e25f205a9cfc675ff8dbf757af'],
];
const map = new Map();
for (const [lo, hi] of pins) {
  const state = { e: 0, m: 0, x: 0 };
  for (let pc = lo; pc < hi;) {
    if (pc === 0x81B114) state.m = 1;
    const i = decode(rom, pc, state); assert.ok(i.next <= hi); map.set(pc, i); pc = i.next;
    if (i.mnemonic === 'SEP' || i.mnemonic === 'REP') {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
}
const range = (lo, hi) => [...map.values()].filter(i => i.cpu >= lo && i.cpu < hi);
const at = (pc, op, value) => { const i = map.get(pc); assert.equal(i?.mnemonic, op, cpuLabel(pc));
  if (value !== undefined) assert.equal(i.value, value); return i; };

test('C152 twelve independent ROM windows pin1027 bytes/419 instructions and original revision', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690');
  pins.forEach(([lo, hi, count, hash], n) => {
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length)), w = report.windows[n];
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(range(lo, hi).length, count);
    assert.equal(w.entry, cpuLabel(lo)); assert.equal(w.end_exclusive, cpuLabel(hi)); assert.equal(w.covered_bytes, hi - lo);
    assert.equal(w.sha256, hash); assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(w.instruction_count, count);
  });
  assert.equal(report.code_bytes, 1027); assert.equal(report.callee_bytes, 943); assert.equal(report.instruction_count, 419);
});
test('Eleven real JSL/JSR calls have exact order and returnframe widths', () => {
  const expected = [[0x80C15B,'JSL',0x818949],[0x80C15F,'JSL',0x81A9E1],[0x80C163,'JSR',0x80999A],
    [0x80C166,'JSL',0x8180C4],[0x80C16A,'JSL',0x81A919],[0x80C16E,'JSL',0x81A958],
    [0x80C172,'JSL',0x81A98E],[0x80C176,'JSR',0x808FBA],[0x80C179,'JSR',0x809E0B],
    [0x80C17C,'JSR',0x80C06B],[0x80C17F,'JSL',0x81B0D1]];
  assert.deepEqual(range(0x80C152,0x80C1A6).filter(i => ['JSR','JSL'].includes(i.mnemonic)).map(i => [i.cpu,i.mnemonic,i.target]), expected);
  assert.deepEqual(report.graph.calls, expected.map(([pc,kind,target]) => ({ at:cpuLabel(pc),kind,target:cpuLabel(target),return_bytes:kind==='JSL'?3:2 })));
});
test('Whole callback proof visits all419 instructions with sole WORD RTL and no external assumptions', () => {
  assert.deepEqual(proveWordStack(map,0x80C152), report.graph.proof);
  assert.equal(report.graph.proof.reachable_instructions,419); assert.equal(report.graph.proof.external_return_assumptions,0);
  assert.deepEqual(report.graph.proof.returns,[{at:'80:C1A5',m:0,x:0,dbr:'entry'}]);
});
test('Return proof rejects wrong nested return kind, BYTE join mode and absent child body', () => {
  const wrong = new Map(map); wrong.set(0x818953,{...map.get(0x818953),mnemonic:'RTS'});
  assert.throws(()=>proveWordStack(wrong,0x80C152),/Wrong call return/);
  const mode = new Map(map); mode.set(0x81B114,{...map.get(0x81B114),state:{e:0,m:0,x:0}});
  assert.throws(()=>proveWordStack(mode,0x80C152),/Mode mismatch/);
  const missing = new Map(map); missing.delete(0x809E0B); assert.throws(()=>proveWordStack(missing,0x80C152),/Uncovered edge/);
});
test('No child calls or pushes: deepest JSL requires root3 plus child3 protected bytes', () => {
  for (const [lo,hi] of pins.slice(1)) assert.ok(!range(lo,hi).some(i=>['JSL','JSR','PHP','PHA','PHX','PHY','PHB','PHD','PEA','PER','PEI'].includes(i.mnemonic)));
  assert.equal(report.graph.root_return_bytes,3); assert.equal(report.graph.maximum_nested_return_bytes,3); assert.equal(report.graph.required_stack_bytes,6);
});
test('Initial BYTE forcedblank preserves C/V/I and first child replaces unknown highA', () => {
  at(0x80C152,'SEP',32); at(0x80C154,'LDA',128); assert.equal(at(0x80C156,'STA',0x2100).state.m,1);
  at(0x80C159,'REP',32); assert.equal(at(0x818949,'LDA',0xCD8).state.m,0);
  assert.match(report.contract.prologue,/InitialHighA is unobserved/);
});
test('Five fresh BYTE loads interleave stores; final REP/RTL does not recompute WORD NZ', () => {
  const tail = range(0x80C185,0x80C1A3);
  assert.deepEqual(tail.map(i=>[i.mnemonic,i.value,i.state.m]), [[0x1BC,0x2100],[0x1BE,0x212C],[0x1C0,0x212D],[0x1C2,0x212E],[0x1C4,0x420C]].flatMap(([r,w])=>[['LDA',r,1],['STA',w,1]]));
  at(0x80C1A3,'REP',32); assert.equal(at(0x80C1A5,'RTL').state.m,0);
  assert.match(report.contract.returns,/evenwhenHighA nonzero/);
});
test('Both B0D1 stopping edges reach BYTE join; 9E0B polling remains structural, not termination proof', () => {
  assert.equal(map.get(0x81B0EE).target,0x81B114); assert.equal(map.get(0x81B106).target,0x81B114);
  assert.equal(map.get(0x81B114).state.m,1); assert.equal(map.get(0x809E11).target,0x809E0B);
  assert.equal(report.graph.actual_poll_termination_proven,false); assert.equal(report.graph.actual_nmi_rti_return_proven,false);
  assert.match(report.boundaries[0],/postwait81:8877/); assert.match(report.scope,/no CPU\/device\/interrupt execution/);
});
