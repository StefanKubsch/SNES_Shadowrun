import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveAudioStack } from './render-audio-stack-proof.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-audio.json', import.meta.url)));
const windows = [
  [0x80C46E, 0x80C4B3, 28, 'ce0aef528b83978bd42e83f7eca36565f48f0ee212846c2f42fd109ff3cc2e92'],
  [0x80C416, 0x80C461, 38, '7fb47acd393f216dfa9128685feddfe2a01cbd93f7c2814cd6841b264e703bc3'],
  [0x81F130, 0x81F1E8, 94, '50905b298f4518afafbf3df917de685631c0e9cd3788551efe018a8867987500'],
  [0x81F1E8, 0x81F1FA, 10, '6e9c5e0eb71b5ec1190da695a8c990dcaa0d342bfc9368a0a3f85d8ab043cb6a'],
  [0x81F100, 0x81F10A, 6, '50fd916170eed9b16dd6faa9c206304ced967e27ace85de9485a85c5995509c9'],
  [0x81F122, 0x81F130, 8, 'abc30bd5cf09fa55e91d91977bb8ddff733d40121d40762f7b064e2e23391254'],
  [0x81F03A, 0x81F067, 21, 'ffb4fab5ba66dd7c3b2d9a40891e6d169d1a4482beadfe9583a6e5a419f00d13'],
  [0x81F007, 0x81F024, 15, 'ea46b86b724dbd5b6dbc861317cc51dbf4a39776940179f193f961e331110cb8'],
  [0x81F092, 0x81F100, 57, 'c262f6ce4794644b6a9e31e5a86ba7e1a564934604f8aad422929402713e3952'],
  [0x81F10A, 0x81F122, 13, 'f3176585d81f6f1f2878cc3fd4d543cc76b25de1064a7a30ce828ab2926e3322'],
  [0x81F024, 0x81F03A, 11, 'bece85061fdae889ae772a6d2fe1f4658e5c937a3b14113c223a850520e84540'],
  [0x81F067, 0x81F07F, 10, 'ec6a98a94de8ef2796cda87a30343f653426523264f5f83ede356598d5ae7e9c'],
  [0x80A805, 0x80A81C, 9, 'eef4d27abdf128759f6f551e4153a9d15898b4c2c7c5face8c3ae6e0bef144f0'],
  [0x81EF26, 0x81EF36, 6, '3808e412e8c919cd2266f3026ba80164d67699d0846f8b08c043b191dc093ad1'],
  [0x81EF63, 0x81EF94, 17, '4f2feb486619c9d21ccb86e68615b6d105b795938e76b6853d18f4b5fc009711'],
  [0x81CF5E, 0x81CF69, 5, '82a63246009c64fcf3894470de45fb7031bc07c61b0194f57f55a57269d88ef6'],
];
// Independent explicit BYTE regions, not inferred from report/listing modes.
const byteRegions = [[0x80C447, 0x80C45F], [0x81F13D, 0x81F156], [0x81F18E, 0x81F1B4],
  [0x81F1C6, 0x81F1D1], [0x81F1EB, 0x81F1F5], [0x81F125, 0x81F12F],
  [0x81F03A, 0x81F067], [0x81F00A, 0x81F023], [0x81F0BA, 0x81F0C5],
  [0x81F0EA, 0x81F0F6], [0x81F0FB, 0x81F0FF], [0x81F024, 0x81F03A], [0x81F067, 0x81F07F]];
const map = new Map();
for (const [lo, hi] of windows) for (let pc = lo; pc < hi;) {
  const i = decode(rom, pc, { e: 0, m: Number(byteRegions.some(([a, b]) => pc >= a && pc < b)), x: 0 });
  assert.ok(i.next <= hi); assert.ok(!map.has(pc)); map.set(pc, i); pc = i.next;
}
const at = (pc, op, value) => {
  const i = map.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op, cpuLabel(pc));
  if (value !== undefined) assert.equal(i.target ?? i.value, value, cpuLabel(pc)); return i;
};
test('audio source independently pins all16 original code windows, hashes and exact decoder bounds', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  assert.equal(report.windows.length, 16); assert.equal(map.size, 348);
  for (const [lo, hi, count, hash] of windows) {
    const w = report.windows.find(w => w.entry === cpuLabel(lo));
    const raw = rom.subarray(cpuToOffset(lo, rom.length), cpuToOffset(hi, rom.length));
    assert.equal(w.covered_bytes, hi - lo); assert.equal(w.instruction_count, count); assert.equal(w.sha256, hash);
    assert.equal(createHash('sha256').update(raw).digest('hex'), hash); assert.equal(w.machine_bytes, raw.toString('hex').toUpperCase());
    assert.equal([...map.keys()].filter(pc => pc >= lo && pc < hi).length, count);
  }
  assert.equal(report.graph.code_bytes, 444); assert.equal(report.graph.instructions, 220);
});
test('selected menu sound and actual three overlapping directory pointer bytes are independently original', () => {
  const tables = [[0x80C4FF, 2, '2d00', '24ea1ebd0bafd39482db46ec2d8959e61353a90efc072719e1308f86c3a106ba'],
    [0x98FFFA, 3, 'acfe9f', '253224875d64bc03ead47c41e2a96435b452c258bfe547ba35ff79aab80c512c'],
    [0x9FFEAC, 94, null, 'bfed7bc5195ab8234d0e86beccc94a486bbed647072c56abdd3b3c5f51081821']];
  assert.equal(report.tables.length, 3);
  for (const [entry, size, literal, hash] of tables) {
    const raw = rom.subarray(cpuToOffset(entry, rom.length), cpuToOffset(entry, rom.length) + size);
    const t = report.tables.find(t => t.entry === cpuLabel(entry));
    assert.equal(t.covered_bytes, size); assert.equal(t.sha256, hash); assert.equal(createHash('sha256').update(raw).digest('hex'), hash);
    assert.equal(t.machine_bytes, raw.toString('hex').toUpperCase()); if (literal) assert.equal(raw.toString('hex'), literal);
  }
  const directory = Buffer.from(report.tables[2].machine_bytes, 'hex');
  assert.equal(directory.readUInt16LE(0), 94); assert.equal(directory.readUIntLE(2, 3), 0x99FED5);
  assert.deepEqual(Array.from({ length: 22 }, (_, n) => directory[5 + n * 4]),
    [254,253,252,251,250,249,248,247,246,245,244,243,47,48,49,50,51,52,53,54,55,56]);
  assert.equal(directory[93], 255); // Only the terminator BYTE, no inferred following record.
});
test('all eleven helper proofs close real BYTE/WORD frames with no external return assumptions', () => {
  const entries = [[0x80C416,'RTS',0,3], [0x81F130,'RTL',0,10], [0x81F092,'RTL',0,10],
    [0x81F122,'RTS',0,6], [0x81F1E8,'RTS',0,6], [0x81F03A,'RTS',1,3],
    [0x81F024,'RTS',1,2], [0x81F067,'RTL',1,3], [0x81F007,'RTL',0,4], [0x81F007,'RTL',1,4], [0x81F100,'RTS',0,2]];
  for (const [n, [entry, ret, entryM, minimum]] of entries.entries()) {
    const proof = proveAudioStack(map, entry, ret, { entryM }); assert.deepEqual(proof, report.graph.proofs[n]);
    assert.equal(proof.minimum_protected_stack_bytes, minimum); assert.equal(proof.external_return_assumptions, 0);
    assert.ok(proof.returns.every(v => v.m === entryM && v.x === 0 && v.dbr === 'entry'));
  }
  const f130 = report.graph.proofs[1];
  assert.equal(f130.reachable_instructions, 154);
  assert.deepEqual(f130.modes.filter(v => v.at === '81:F1B7').map(v => v.m), [0, 1]);
  assert.deepEqual(f130.modes.filter(v => v.at === '81:F007').map(v => v.m), [1]);
});
test('selected menu proves8 protected bytes with DBR80 while general zero-voice path fails explicitly', () => {
  assert.throws(() => proveAudioStack(map, 0x80C46E, 'RTS'), /Audio stack mismatch 80:C4B2/);
  assert.equal(report.graph.general_c46e_return_proven, false); assert.match(report.graph.general_c46e_failure, /C4B2/);
  const p = proveAudioStack(map, 0x80C46E, 'RTS', { menuSound: 45 });
  assert.deepEqual(p, report.graph.selected_menu_proof); assert.equal(p.minimum_protected_stack_bytes, 8);
  assert.deepEqual(p.returns, [{ at: '80:C4B2', m: 0, x: 0, dbr: 128 }]);
  assert.ok(!p.modes.some(v => v.at === '81:F130'));
  assert.equal(p.actual_device_termination_proven, false);
});
test('menu lemmas reject changed original sound, voice literal and callee DP06 writer', () => {
  assert.throws(() => proveAudioStack(map, 0x80C46E, 'RTS', { menuSound: 0x8000 }), /Renew selected menu sound lemma/);
  const bad = new Map(map); bad.set(0x80A80F, { ...map.get(0x80A80F), value: 0 });
  assert.throws(() => proveAudioStack(bad, 0x80C46E, 'RTS', { menuSound: 45 }), /Renew selected menu caller lemma/);
  const writer = new Map(map); writer.set(0x80C416, { ...map.get(0x80C416), value: 6 });
  assert.throws(() => proveAudioStack(writer, 0x80C46E, 'RTS', { menuSound: 45 }), /DP06 preservation/);
});
test('mixed BYTE pops and WORD index restores require original widths and balanced source stack', () => {
  const bad = new Map(map); bad.set(0x81F125, { ...map.get(0x81F125), mnemonic: 'NOP' });
  assert.throws(() => proveAudioStack(bad, 0x81F122, 'RTS'), /Audio stack mismatch/);
  const index = new Map(map); index.set(0x81F1C3, { ...map.get(0x81F1C3), mnemonic: 'NOP' });
  assert.throws(() => proveAudioStack(index, 0x81F130), /Audio stack mismatch|Unbounded audio source proof/);
  const width = new Map(map); width.set(0x81F13B, { ...map.get(0x81F13B), value: 0 });
  assert.throws(() => proveAudioStack(width, 0x81F130), /Audio immediate width mismatch/);
});
test('C416 retains initial WORD multiply operand, signed slot gate and ordered two BYTE4217 reads', () => {
  at(0x80C416, 'STA', 0x4202); at(0x80C419, 'LDA', 128); at(0x80C41C, 'LDX', 0);
  at(0x80C41E, 'BMI', 0x80C445); at(0x80C420, 'LDA', 0x0E80);
  at(0x80C423, 'SEC'); at(0x80C424, 'SBC', 0x0E28); at(0x80C427, 'CLC'); at(0x80C428, 'ADC', 0x600);
  at(0x80C42B, 'BPL', 0x80C430); at(0x80C42D, 'LDA', 0);
  at(0x80C430, 'SEC'); at(0x80C431, 'SBC', 0x0CC4); at(0x80C434, 'BCC', 0x80C442);
  at(0x80C436, 'LSR'); at(0x80C437, 'LSR'); at(0x80C438, 'CMP', 255);
  at(0x80C43B, 'BCC', 0x80C445); at(0x80C43D, 'LDA', 255);
  at(0x80C445, 'SEP', 32); at(0x80C447, 'LSR'); at(0x80C448, 'STA', 0x4203);
  at(0x80C44B, 'EOR', 127); at(0x80C44D, 'PHA'); at(0x80C44F, 'LDA', 0x4217);
  at(0x80C452, 'XBA'); at(0x80C453, 'PLA'); at(0x80C454, 'STA', 0x4203);
  at(0x80C45A, 'LDA', 0x4217); at(0x80C45D, 'REP', 32); at(0x80C45F, 'TAX'); at(0x80C460, 'RTS');
  assert.equal(map.get(0x80C416).state.m, 0); assert.equal(map.get(0x80C44F).state.m, 1);
});
test('C46E fresh cache/voice gates keep sound PHA and generic zero voice before PLA', () => {
  at(0x80C46E, 'PHK'); at(0x80C46F, 'PLB'); at(0x80C475, 'PHA'); at(0x80C476, 'CMP', 0x1CE0);
  at(0x80C479, 'BEQ', 0x80C487); at(0x80C47E, 'BCC', 0x80C487); at(0x80C480, 'STA', 0x1CE0);
  at(0x80C483, 'JSL', 0x81F130); at(0x80C489, 'JSR', 0x80C416); at(0x80C48F, 'JSL', 0x81F007);
  at(0x80C493, 'LDX', 6); at(0x80C495, 'BEQ', 0x80C4B2); at(0x80C497, 'CPX', 0x1CE2);
  at(0x80C49C, 'STX', 0x1CE2); at(0x80C4A6, 'PLA'); at(0x80C4A7, 'ORA', 0xFF00);
  at(0x80C4AB, 'LDA', 5); at(0x80C4AE, 'JSL', 0x81F007); at(0x80C4B2, 'RTS');
});
test('F130 directory scans BYTE IDs with original step4, overlapping pointer reads and FF terminator', () => {
  at(0x81F130, 'PHP'); at(0x81F131, 'BIT', 0x8000); at(0x81F136, 'BRL', 0x81F1B7);
  at(0x81F13D, 'STA', 0x98); at(0x81F13F, 'LDY', 5); at(0x81F142, 'LDA', 0x8C);
  at(0x81F144, 'CMP', 255); at(0x81F146, 'BEQ', 0x81F1B7); at(0x81F148, 'CMP', 0x98);
  for (const pc of [0x81F14C,0x81F14D,0x81F14E,0x81F14F]) at(pc, 'INY');
  at(0x81F150, 'JMP', 0x81F142); at(0x81F153, 'INY'); at(0x81F156, 'LDA', 0x8C);
  at(0x81F158, 'STA', 0x89); at(0x81F15A, 'INY'); at(0x81F15B, 'LDA', 0x8C); at(0x81F15D, 'STA', 0x8A);
  assert.equal(map.get(0x81F142).mode, 'dily'); assert.equal(map.get(0x81F142).state.m, 1);
  assert.equal(map.get(0x81F156).state.m, 0);
});
test('F130 raw transfer retains BYTE address increment and an unconditional final pair call', () => {
  at(0x81F166, 'STA', 0x92); at(0x81F16C, 'STA', 0x96); at(0x81F170, 'LDA', 0x92);
  at(0x81F174, 'LDA', 0x89); at(0x81F176, 'BMI', 0x81F1B9); at(0x81F178, 'STA', 0x94);
  at(0x81F17A, 'JSR', 0x81F100); at(0x81F188, 'PHY'); at(0x81F18E, 'LDA', 16);
  at(0x81F190, 'LDX', 0x98); at(0x81F192, 'JSL', 0x81F007); at(0x81F196, 'STZ', 0x1CE6);
  at(0x81F199, 'LDA', 0x96); at(0x81F19E, 'LDA', 0x97);
  at(0x81F1A3, 'LDA', 0x8F); at(0x81F1A5, 'JSR', 0x81F03A); at(0x81F1A8, 'INC', 0x96);
  at(0x81F1AA, 'INY'); at(0x81F1AB, 'CPY', 0x94); at(0x81F1AD, 'BNE', 0x81F1A3);
  at(0x81F1AF, 'JSR', 0x81F03A); at(0x81F1B4, 'PLY');
  assert.equal(map.get(0x81F1A8).state.m, 1); assert.equal(map.get(0x81F1AB).state.x, 0);
});
test('F130 repeat transfer retains original WORD length arithmetic, reinterpretation and do-loop', () => {
  at(0x81F1B9, 'AND', 0x7FFF); at(0x81F1BC, 'STA', 0x94); at(0x81F1BE, 'ASL'); at(0x81F1BF, 'PHA');
  at(0x81F1C0, 'JSR', 0x81F100); at(0x81F1C3, 'PLX'); at(0x81F1C8, 'JSL', 0x81F007);
  at(0x81F1D1, 'LDA', 0x96); at(0x81F1D3, 'JSR', 0x81F122); at(0x81F1D8, 'LDA', 0x89);
  at(0x81F1DA, 'STA', 0x98); at(0x81F1DC, 'LDA', 0x98); at(0x81F1DE, 'JSR', 0x81F1E8);
  at(0x81F1E1, 'DEC', 0x94); at(0x81F1E3, 'BNE', 0x81F1DC); at(0x81F1E5, 'BRL', 0x81F16E);
  at(0x81F100, 'STA', 0x98); at(0x81F102, 'LDA', 0x92); at(0x81F104, 'SEC'); at(0x81F105, 'SBC', 0x98);
});
test('stacked word senders preserve low-before-high BYTE sends and only F1E8 increments WORD address', () => {
  for (const entry of [0x81F122, 0x81F1E8]) {
    const instructions = [...map.values()].filter(i => i.cpu >= entry && i.cpu < entry + (entry === 0x81F122 ? 14 : 18));
    assert.deepEqual(instructions.slice(0, 7).map(i => i.mnemonic), ['PHA','SEP','PLA','JSR','PLA','JSR','REP']);
    assert.equal(instructions[0].state.m, 0); assert.equal(instructions[2].state.m, 1);
    assert.equal(instructions[3].target, 0x81F03A); assert.equal(instructions[5].target, 0x81F03A);
  }
  at(0x81F1F5, 'INC', 0x96); at(0x81F1F7, 'INC', 0x96); assert.equal(map.get(0x81F1F5).state.m, 0);
});
test('F122/F1E8 six-byte stack proofs close WORD returns through actual BYTE callees', () => {
  for(const [entry,ret] of [[0x81F122,'81:F12F'],[0x81F1E8,'81:F1F9']]) {
    const proof=proveAudioStack(map,entry,'RTS');
    assert.equal(proof.minimum_protected_stack_bytes,6);assert.equal(proof.external_return_assumptions,0);
    assert.deepEqual(proof.returns,[{at:ret,m:0,x:0,dbr:'entry'}]);
    assert.deepEqual(proof.modes.filter(m=>m.at==='81:F03A').map(m=>m.m),[1]);
  }
  at(0x81F12D,'REP',32);at(0x81F1F3,'REP',32);
  assert.equal(map.get(0x81F1F5).mode,'dp');assert.equal(map.get(0x81F1F7).mode,'dp');
});
test('F122/F1E8 proofs reject missing savedWORD/secondPLA and wrong initial BYTE switch', () => {
  for(const [entry,push,sep,second] of [[0x81F122,0x81F122,0x81F123,0x81F129],
    [0x81F1E8,0x81F1E8,0x81F1E9,0x81F1EF]])for(const pc of [push,sep,second]) {
    const changed=new Map(map);changed.set(pc,{...map.get(pc),mnemonic:'NOP'});
    assert.throws(()=>proveAudioStack(changed,entry,'RTS'),/Audio stack mismatch/);
  }
});
test('F100 independently closes2-byte WORD RTS with fresh original98/92 subtraction order',()=>{
  const proof=proveAudioStack(map,0x81F100,'RTS');assert.equal(proof.minimum_protected_stack_bytes,2);
  assert.equal(proof.external_return_assumptions,0);assert.deepEqual(proof.returns,[{at:'81:F109',m:0,x:0,dbr:'entry'}]);
  at(0x81F100,'STA',0x98);at(0x81F102,'LDA',0x92);at(0x81F104,'SEC');
  at(0x81F105,'SBC',0x98);at(0x81F107,'STA',0x92);at(0x81F109,'RTS');
});
test('F130 full300-byte/154-instruction graph closes10 bytes with BYTE and WORD native callees and real PHP/PLP',()=>{
  const proof=proveAudioStack(map,0x81F130,'RTL');assert.equal(proof.reachable_instructions,154);
  assert.equal(proof.minimum_protected_stack_bytes,10);assert.equal(proof.external_return_assumptions,0);
  const ranges=[[0x81F130,0x81F1E8],[0x81F1E8,0x81F1FA],[0x81F122,0x81F130],
    [0x81F100,0x81F10A],[0x81F03A,0x81F067],[0x81F007,0x81F024]];
  assert.equal(ranges.reduce((n,[lo,hi])=>n+hi-lo,0),300);
  for(const [at,m]of [['81:F007',1],['81:F03A',1],['81:F122',0],['81:F1E8',0],['81:F100',0]])
    assert.deepEqual(proof.modes.filter(v=>v.at===at).map(v=>v.m),[m]);
  assert.ok(proof.returns.every(r=>r.m===0&&r.x===0&&r.dbr==='entry'));
  for(const pc of [0x81F130,0x81F1B7]){const changed=new Map(map);changed.set(pc,{...map.get(pc),mnemonic:'NOP'});
    assert.throws(()=>proveAudioStack(changed,0x81F130,'RTL'),/Audio stack mismatch/);}
});
test('F03A pairs preserve BYTE flag/first-token/fresh-buffer order and original fixed device writes', () => {
  at(0x81F03A, 'PHA'); at(0x81F03B, 'LDA', 0x1CE6); at(0x81F03E, 'BEQ', 0x81F05F);
  at(0x81F040, 'STZ', 0x1CE6); at(0x81F043, 'LDA', 0x1CE4); at(0x81F046, 'CMP', 0x2140);
  at(0x81F049, 'BNE', 0x81F046); at(0x81F04D, 'LDA', 0x1CE7); at(0x81F050, 'STA', 0x2141);
  at(0x81F053, 'PLA'); at(0x81F054, 'STA', 0x2142); at(0x81F058, 'STA', 0x2140); at(0x81F05B, 'STA', 0x1CE4);
  at(0x81F05F, 'PLA'); at(0x81F060, 'STA', 0x1CE7); at(0x81F063, 'DEC', 0x1CE6);
  assert.ok([...map.values()].filter(i => i.cpu >= 0x81F03A && i.cpu < 0x81F067).every(i => i.state.m === 1));
});
test('F03A BYTE entry closes both RTS paths with3 protected bytes and unchanged DBR/index modes', () => {
  const proof = proveAudioStack(map,0x81F03A,'RTS',{entryM:1});
  assert.equal(proof.minimum_protected_stack_bytes,3); assert.equal(proof.external_return_assumptions,0);
  assert.deepEqual(proof.returns.map(r=>[r.at,r.m,r.x,r.dbr]).sort(),
    [['81:F05E',1,0,'entry'],['81:F066',1,0,'entry']]);
  at(0x81F04B,'INC'); at(0x81F04C,'XBA'); at(0x81F057,'XBA');
  assert.equal(map.get(0x81F04B).mode,'A');
  assert.ok(proof.modes.every(m=>m.m===1 && m.x===0));
});
test('F03A stack proof rejects missing BYTE PHA or either original BYTE PLA', () => {
  for (const pc of [0x81F03A,0x81F053,0x81F05F]) {
    const changed = new Map(map); changed.set(pc,{...map.get(pc),mnemonic:'NOP'});
    assert.throws(()=>proveAudioStack(changed,0x81F03A,'RTS',{entryM:1}),/Audio stack mismatch/);
  }
});
test('directory pointer owner and selected cache/bootstrap excerpts remain separate from actual initialization', () => {
  at(0x81F095, 'TAX'); at(0x81F096, 'LDA', 0x98FFFA); at(0x81F09A, 'STA', 0x8C);
  at(0x81F09C, 'LDA', 0x98FFFB); at(0x81F0A0, 'STA', 0x8D);
  at(0x81EF2F, 'STA', 0x1CE0); at(0x81EF32, 'STA', 0x1CE2);
  at(0x81EF71, 'JSL', 0x81F229); at(0x81EF78, 'JSL', 0x81F092); at(0x81EF7F, 'STX', 0x1CE2);
  assert.equal(report.graph.native_binding, false); assert.equal(report.graph.actual_device_termination_proven, false);
  assert.deepEqual(report.graph.native_entries,['80:C416', '80:C46E', '81:F03A', '81:F122', '81:F1E8', '81:F100', '81:F130']);
  assert.match(report.scope, /full boot\/interrupt lifecycle/);
});
test('BYTE reply waits on both original token and actual new echo before reading2141', () => {
  at(0x81F067, 'LDA', 0x1CE4); at(0x81F06A, 'CMP', 0x2140); at(0x81F06D, 'BNE', 0x81F06A);
  at(0x81F06F, 'INC'); at(0x81F070, 'STA', 0x2140); at(0x81F073, 'CMP', 0x2140);
  at(0x81F076, 'BNE', 0x81F073); at(0x81F078, 'STA', 0x1CE4); at(0x81F07B, 'LDA', 0x2141);
  assert.equal(map.get(0x81F070).state.m, 1); assert.equal(map.get(0x81F07B).state.m, 1);
});

test('bounded low-sound/nonzero-voice proof is conditional, closes8 bytes and never assumes F130 return', () => {
  const p = proveAudioStack(map, 0x80C46E, 'RTS', { lowSoundNonzeroVoice: true });
  assert.deepEqual(p, report.graph.bounded_c46e_proof); assert.equal(p.minimum_protected_stack_bytes, 8);
  assert.deepEqual(p.returns, [{ at: '80:C4B2', m: 0, x: 0, dbr: 128 }]);
  assert.equal(p.external_return_assumptions, 0); assert.equal(p.conditional_lemmas.length, 3);
  assert.ok(!p.modes.some(v => v.at === '81:F130')); assert.equal(p.actual_device_termination_proven, false);
  assert.throws(() => proveAudioStack(map, 0x80C46E, 'RTS'), /Audio stack mismatch 80:C4B2/);
});
test('bounded proof rejects changed cache branch, DBR force, voice gate, stack pop and helper alias', () => {
  for (const [pc, change] of [[0x80C479, { target: 0x80C483 }], [0x80C46E, { mnemonic: 'PHB' }],
    [0x80C495, { target: 0x80C4A6 }], [0x80C4A6, { mnemonic: 'NOP' }], [0x80C416, { value: 6 }]]) {
    const bad = new Map(map); bad.set(pc, { ...map.get(pc), ...change });
    assert.throws(() => proveAudioStack(bad, 0x80C46E, 'RTS', { lowSoundNonzeroVoice: true }), /Renew/);
  }
  assert.throws(() => proveAudioStack(map, 0x80C46E, 'RTL', { lowSoundNonzeroVoice: true }), /Renew/);
});
test('all-sound/nonzero-voice C46E proof closes entire444/220 graph with14 bytes and both F007 modes',()=>{
  const p=proveAudioStack(map,0x80C46E,'RTS',{anySoundNonzeroVoice:true});
  assert.deepEqual(p,report.graph.nonzero_voice_c46e_proof);assert.equal(p.minimum_protected_stack_bytes,14);
  assert.equal(p.reachable_instructions,220);assert.equal(p.external_return_assumptions,0);
  assert.deepEqual(p.returns,[{at:'80:C4B2',m:0,x:0,dbr:128}]);
  assert.deepEqual(p.modes.filter(v=>v.at==='81:F007').map(v=>v.m),[0,1]);
  assert.ok(p.modes.some(v=>v.at==='81:F130'));assert.equal(p.actual_device_termination_proven,false);
  assert.throws(()=>proveAudioStack(map,0x80C46E,'RTS'),/Audio stack mismatch/);
});
test('cache-hit/nonzero-voice C46E proof needs8 bytes for arbitrary WORD sound without loader assumptions',()=>{
  const p=proveAudioStack(map,0x80C46E,'RTS',{cacheHitNonzeroVoice:true});
  assert.deepEqual(p,report.graph.cache_hit_c46e_proof);assert.equal(p.minimum_protected_stack_bytes,8);
  assert.equal(p.external_return_assumptions,0);assert.equal(p.reachable_instructions,77);
  assert.ok(!p.modes.some(v=>v.at==='81:F130'||v.at==='80:C47B'));
  assert.deepEqual(p.returns,[{at:'80:C4B2',m:0,x:0,dbr:128}]);
});
test('all-sound proof rejects loader/cache/control mutations and every helper DP06 write before fresh channel read',()=>{
  for(const [pc,change]of [[0x80C480,{value:0x1CE2}],[0x80C483,{target:0x81F092}],
    [0x80C46E,{mnemonic:'PHB'}],[0x80C495,{target:0x80C4A6}],[0x80C4A6,{mnemonic:'NOP'}],
    [0x81F13D,{value:6}],[0x81F100,{value:6}],[0x81F1F5,{value:6}],[0x81F054,{value:6}]]){
    const changed=new Map(map);changed.set(pc,{...map.get(pc),...change});
    assert.throws(()=>proveAudioStack(changed,0x80C46E,'RTS',{anySoundNonzeroVoice:true}),/Renew/);
  }
  for(const options of [{anySoundNonzeroVoice:true,lowSoundNonzeroVoice:true},
    {anySoundNonzeroVoice:true,cacheHitNonzeroVoice:true}])
    assert.throws(()=>proveAudioStack(map,0x80C46E,'RTS',options),/Invalid audio proof selection/);
  assert.throws(()=>proveAudioStack(map,0x80C46E,'RTL',{anySoundNonzeroVoice:true}),/Renew/);
  assert.throws(()=>proveAudioStack(map,0x80C46E,'RTS',{entryM:1,cacheHitNonzeroVoice:true}),/Renew/);
});
