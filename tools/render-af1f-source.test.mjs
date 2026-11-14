import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuLabel, cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-af1f.json', import.meta.url), 'utf8'));
const windows = [['overlayAF1F', 0x81AF1F, 0x81B026, 103, '286626c5b2d2faadcdaabdc1569d77a03f8c4ab79b1929a7fbd283257e5c744c'],
  ['callerA9B2', 0x81A9D6, 0x81A9E1, 6, '21c98a9eb23eef59a857c250dcbfef2b68a42855899a5c92615647e6d6a03292']];
// Independently fixed BYTE regions; all indices remain WORD throughout.
const instructions = new Map();
for (const [, start, end] of windows) for (let pc = start; pc < end;) {
  const m = [[0x81AF37, 0x81AF3C], [0x81AFB0, 0x81AFB5], [0x81AFDE, 0x81AFE3]].some(([a,b]) => pc >= a && pc <= b) ? 1 : 0;
  const i = decode(rom, pc, { e: 0, m, x: 0 }); assert.ok(i.next <= end); instructions.set(pc, i); pc = i.next;
}
const at = (pc, op, value, target) => {
  const i = instructions.get(pc); assert.ok(i, cpuLabel(pc)); assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const range = (start, end) => [...instructions.values()].filter(i => i.cpu >= start && i.cpu < end);

test('AF1F pins complete body, table, real ROM pointer and DBR80 caller with independent digests', () => {
  for (const [name, start, end, count, sha256] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256); assert.equal(range(start, end).length, count);
    assert.deepEqual(report.windows.find(w => w.name === name), { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end),
      covered_bytes: end - start, instruction_count: count, sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  for (const [key, name, start, end, sha256] of [
    ['table', 'overlayWords', 0x81B026, 0x81B064, '4cafea23b5ab8e1f0968d6e19c31fab442a799da84633bb3e687cc843d1c738c'],
    ['pointer', 'valuePointer', 0x8DB8D2, 0x8DB8D4, 'd328f42314be9bf1b011ba58c7d0325de0416e23fe2506f76236d27c7296bd1c'],
  ]) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(createHash('sha256').update(raw).digest('hex'), sha256);
    assert.deepEqual(report[key], { name, entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: end - start,
      sha256, machine_bytes: raw.toString('hex').toUpperCase() });
  }
  assert.equal(rom.readUInt16LE(0x6B8D2), 0x33DC); assert.equal(report.code_bytes, 263); assert.equal(report.caller_bytes, 11);
  at(0x81A9D6, 'PEA', 0x8080); at(0x81A9D9, 'PLB'); at(0x81A9DA, 'PLB');
  at(0x81A9DB, 'JSL', undefined, 0x81AF1F); at(0x81A9DF, 'PLB'); at(0x81A9E0, 'RTL');
});

test('AF1F zero1D61 and negative2DE6 gates return before all device and output writes', () => {
  at(0x81AF1F, 'LDA', 0x1D61); at(0x81AF22, 'BNE', undefined, 0x81AF25); at(0x81AF24, 'RTL');
  assert.equal(at(0x81AF25, 'LDA', 0x7E2DE6).mode, 'long'); at(0x81AF29, 'BMI', undefined, 0x81AF24);
  assert.equal(at(0x81AF2B, 'LDA', 0x7E3C00).state.m, 0); at(0x81AF2F, 'AND', 255);
  assert.ok(range(0x81AF1F, 0x81AF32).every(i => !['STA','STY','STX','STZ'].includes(i.mnemonic)));
  assert.match(report.gates.first, /Zero reads no2DE6/); assert.match(report.gates.second, /Nonnegative includingzero/);
});

test('AF1F uses WORD dividend and BYTE divisor14; all three first-result reads meet manufacturer delay', () => {
  for (const [dividend, sep, load, divisor, rep] of [[0x81AF32,0x81AF35,0x81AF37,0x81AF39,0x81AF3C],
    [0x81AFAB,0x81AFAE,0x81AFB0,0x81AFB2,0x81AFB5], [0x81AFD9,0x81AFDC,0x81AFDE,0x81AFE0,0x81AFE3]]) {
    assert.equal(at(dividend, 'STA', 0x4204).state.m, 0); at(sep, 'SEP', 32);
    assert.equal(at(load, 'LDA', 20).length, 2); assert.equal(at(divisor, 'STA', 0x4206).state.m, 1); at(rep, 'REP', 32);
  }
  const bounds = [[0x81AF39,0x81AF56,33], [0x81AFB2,0x81AFC9,29], [0x81AFE0,0x81AFEC,14]];
  // Independently selected timings for these fixed source sequences, D0/WORD.
  const cycles = i => ({ REP:3, NOP:2, TAX:2, CLC:2, SEC:2 }[i.mnemonic]
    ?? { immM:3, immX:3, dp:4, long:6, longx:6 }[i.mode]);
  for (const [write, read, count] of bounds) {
    assert.equal(range(at(write,'STA',0x4206).next,read).reduce((n,i) => n + cycles(i), 0), count);
    assert.equal(at(read, read === 0x81AFEC ? 'SBC' : 'LDY', 0x4214).mode, 'abs');
    assert.ok(count + 3 >= 16);
    assert.deepEqual(report.division.completed_read_bounds.find(b => b.divisor_write === cpuLabel(write)),
      { divisor_write:cpuLabel(write),first_read:cpuLabel(read),full_cycles_before_read_instruction:count,
        fetch_cycles_before_low_byte:3,minimum_cycles_before_low_byte:count+3 });
  }
  assert.equal(rom[0x639F], 0xD8); assert.match(report.entry, /binary arithmetic/);
});

test('First output loop is unconditional even for quotient zero, with real long indexed writes and ordered caps', () => {
  for (const [load, store, value, address] of [[0x81AF3E,0x81AF41,0x6C04,0x7E241C],
    [0x81AF45,0x81AF48,0x6C07,0x7E245C], [0x81AF4C,0x81AF4F,0xEC04,0x7E249C],
    [0x81AF59,0x81AF5C,0x2C05,0x7E2406], [0x81AF60,0x81AF63,0x2C10,0x7E2446], [0x81AF67,0x81AF6A,0xAC05,0x7E2486]]) {
    at(load,'LDA',value);at(store,'STA',address);
  }
  at(0x81AF53,'LDX',20);at(0x81AF56,'LDY',0x4214);
  at(0x81AF6E,'DEX');at(0x81AF6F,'DEX');at(0x81AF70,'DEY');at(0x81AF71,'BNE',undefined,0x81AF59);
  assert.deepEqual(range(0x81AF53,0x81AF59).map(i=>i.mnemonic),['LDX','LDY']);
  at(0x81AF73,'LDA',0x4216);at(0x81AF76,'BEQ',undefined,0x81AF8F);
  assert.deepEqual(range(0x81AF78,0x81AFA4).filter(i=>i.mnemonic==='LDA').map(i=>i.value),[0x2C06,0x2C15,0xAC06,0x2C04,0x2C07,0xAC04]);
  assert.equal((0x7E2406+0xFFFE),0x7F2404); assert.equal((20-2*65536)&65535,20);
  assert.match(report.writes.first_loop,/Quotient0 nominally65536 bodies,notzero/);
});

test('Second division reads fresh source and real pointer WORD then writes shared A8/A2/A5 in order', () => {
  at(0x81AFA4,'LDA',0x7E3C00);at(0x81AFA8,'AND',255);at(0x81AFB7,'LDA',0x8DB8D2);at(0x81AFBB,'TAX');
  assert.equal(at(0x81AFBC,'LDA',0x7E0002).mode,'longx');at(0x81AFC0,'AND',255);at(0x81AFC3,'STA',0xA8);
  at(0x81AFC5,'CLC');at(0x81AFC6,'ADC',19);at(0x81AFC9,'LDY',0x4214);at(0x81AFCC,'STY',0xA2);
  at(0x81AFCE,'LDY',0x4216);at(0x81AFD1,'STY',0xA5);at(0x81AFD3,'BEQ',undefined,0x81AFD9);
  assert.deepEqual(range(0x81AFCE,0x81AFD5).map(i=>i.mnemonic),['LDY','STY','BEQ']);
  at(0x81AFD5,'SEC');at(0x81AFD6,'SBC',10);
  assert.match(report.division.second,/BEQ usesLDY flags afterSTY,notA/);assert.match(report.writes.scratch,/existing D9\/motion byte owner/);
});

test('Middle loop uses wrapped subtraction and skips only zero, with no signed clamp', () => {
  at(0x81AFE6,'LDX',20);at(0x81AFE9,'SEC');at(0x81AFEA,'LDA',0xA2);at(0x81AFEC,'SBC',0x4214);
  at(0x81AFEF,'BEQ',undefined,0x81AFFE);at(0x81AFF1,'TAY');at(0x81AFF2,'LDA',0x2C08);
  assert.equal(at(0x81AFF5,'STA',0x7E2446).mode,'longx');at(0x81AFF9,'DEX');at(0x81AFFA,'DEX');at(0x81AFFB,'DEY');at(0x81AFFC,'BNE',undefined,0x81AFF2);
  assert.ok(range(0x81AFE9,0x81AFFE).every(i=>!['BMI','BPL','BCC','BCS'].includes(i.mnemonic)));
  // Algebraic examples of the pinned unsigned quotient difference, no instruction execution.
  assert.equal((Math.floor(0/20)-Math.floor((255+19)/20))&65535,0xFFF3);
  assert.equal((Math.floor(255/20)-Math.floor((0+9)/20))&65535,12);
  assert.match(report.writes.middle,/NegativeWORDdifference is a large unsigned countdown/);
});

test('Final selector retains two gates, inclusive threshold11, fresh remainder and 31 WORD table entries', () => {
  at(0x81AFFE,'LDY',0xA5);at(0x81B000,'BEQ',undefined,0x81B012);at(0x81B002,'LDA',0xA8);at(0x81B004,'CMP',11);
  at(0x81B007,'BCS',undefined,0x81B016);at(0x81B009,'LDA',0x4216);at(0x81B00C,'CLC');at(0x81B00D,'ADC',11);
  at(0x81B010,'BRA',undefined,0x81B019);at(0x81B012,'LDA',0xA8);at(0x81B014,'BEQ',undefined,0x81B025);at(0x81B016,'LDA',0x4216);
  at(0x81B019,'ASL');at(0x81B01A,'PHX');at(0x81B01B,'TAX');at(0x81B01C,'LDA',0x81B026);at(0x81B020,'PLX');at(0x81B021,'STA',0x7E2446);
  assert.deepEqual(Array.from({length:31},(_,n)=>rom.readUInt16LE(0xB026+2*n)),
    [0x2C08,0x2C08,0x2C09,0x2C09,0x2C0A,0x2C0A,0x2C0A,0x2C0B,0x2C0B,0x2C0C,0x2C0C,0x2C0D,0x2C0D,0x2C0D,0x2C0E,0x2C0E,0x2C0E,0x2C0F,0x2C0F,0x2C10,0x2C11,0x2C11,0x2C12,0x2C12,0x2C13,0x2C13,0x2C13,0x2C14,0x2C14,0x2C15,0x2C15]);
  assert.match(report.writes.last,/skipslastwrite onlywhenA8zero/);
});

test('AF1F graph covers all103 instructions with no calls, two balanced WORD returns and explicit unresolved render boundaries', () => {
  const body=range(0x81AF1F,0x81B026);
  assert.equal(report.graph.reachable_instructions,103);assert.equal(report.graph.calls,0);
  assert.deepEqual(report.graph.return_sites,['81:AF24','81:B025']);
  assert.deepEqual(report.graph.edges,body.filter(i=>i.target!==undefined).map(i=>({from:cpuLabel(i.cpu),kind:i.mnemonic,to:cpuLabel(i.target)})));
  assert.ok(body.every(i=>!['JSR','JSL','PHB','PLB','PHP','PLP','SED','CLD','XCE'].includes(i.mnemonic)));
  assert.deepEqual(body.filter(i=>['PHX','PLX'].includes(i.mnemonic)).map(i=>[i.mnemonic,i.state.x]),[['PHX',0],['PLX',0]]);
  assert.equal(report.graph.actual_memory_termination_proven,false);assert.equal(report.progress_reference, 'docs/PORTIERUNGSSTAND.json');
  assert.match(report.boundaries[1],/no CPU\/device execution/);
});
