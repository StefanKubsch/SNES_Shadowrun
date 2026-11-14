import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { decode } from './disassemble.mjs';
import { cpuToOffset, cpuLabel } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/motion-postpass-ac2f.json', import.meta.url), 'utf8'));
const mode = { e: 0, m: 0, x: 0 };
const readWindow = (start, end) => {
  const result = new Map();
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, mode); assert.ok(i.next <= end); result.set(pc, i); pc = i.next;
  }
  assert.equal([...result.values()].at(-1).next, end); return result;
};
const body = readWindow(0x80AC2F, 0x80ADF4);
const caller = readWindow(0x80AFC4, 0x80AFFC);
const ins = (pc, mnemonic, value, target) => {
  const i = body.get(pc) ?? caller.get(pc); assert.ok(i); assert.equal(i.mnemonic, mnemonic);
  if (value !== undefined) assert.equal(i.value, value);
  if (target !== undefined) assert.equal(i.target, target);
  return i;
};
const checkWindow = (source, start, end, digest) => {
  const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), digest);
  assert.deepEqual(source, { entry: cpuLabel(start), end_exclusive: cpuLabel(end), covered_bytes: raw.length,
    sha256: digest, machine_bytes: raw.toString('hex').toUpperCase() });
};

test('AC2F pins the entire453-byte body,196 instructions,26 edges,zero direct/transitive calls and56 callerbytes', () => {
  assert.equal(createHash('sha256').update(rom).digest('hex'), report.rom_sha256);
  checkWindow(report.routines[0], 0x80AC2F, 0x80ADF4, '2a821135b2546e32d885a499f1403fd6a06e5f26c40f980031f2619f377cecff');
  checkWindow(report.caller_windows[0], 0x80AFC4, 0x80AFFC, '6b50cea385aeeb8e71d6dd79714bffa17930077aa70acfde2b580615bd5b2850');
  assert.equal(body.size, 196);
  const edges = [...body.values()].filter(i => i.target !== undefined);
  assert.equal(edges.length, 26);
  assert.deepEqual(report.edges, edges.map(i => ({ from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target) })));
  assert.deepEqual(report.calls, []);
  assert.equal([...body.values()].some(i => ['JSR', 'JSL', 'JML'].includes(i.mnemonic) || ['ind', 'indx'].includes(i.mode)), false);
  for (const i of body.values()) {
    if (i.target !== undefined) assert.ok(body.has(i.target));
    if (!['RTS', 'BRA', 'JMP'].includes(i.mnemonic)) assert.ok(body.has(i.next));
  }
  // The following routine is a different caller, not a transitively reached helper.
  assert.equal(rom.subarray(0x2DF4, 0x2DF9).toString('hex'), 'a98c008540');
});

test('All AC2F instructions are CFG reachable with balanced local WORD stack, restored callerY and fixed widths/D/DBR', () => {
  // Symbolic stack/control-flow proof, no CPU, data memory or instruction execution.
  const pending = [[0x80AC2F, []]], seen = new Map(), exits = [];
  while (pending.length) {
    const [pc, incoming] = pending.pop();
    if (seen.has(pc)) { assert.deepEqual(seen.get(pc), incoming); continue; }
    seen.set(pc, incoming); const i = body.get(pc); assert.ok(i); assert.deepEqual(i.state, mode);
    assert.equal(['REP', 'SEP', 'PLP', 'XCE', 'TCD', 'PLD', 'PHB', 'PLB', 'SED', 'RTL', 'RTI', 'BRK', 'COP'].includes(i.mnemonic), false);
    const stack = [...incoming];
    if (i.mnemonic === 'PHY') { assert.equal(pc, 0x80AC2F); stack.push('callerY'); }
    if (i.mnemonic === 'PHX') { assert.equal(pc, 0x80AD6D); stack.push('gameSlotX'); }
    if (i.mnemonic === 'PLX') { assert.equal(pc, 0x80ADC0); assert.equal(stack.pop(), 'gameSlotX'); }
    if (i.mnemonic === 'PLY') assert.equal(stack.pop(), 'callerY');
    if (i.mnemonic === 'RTS') { assert.deepEqual(stack, []); exits.push(pc); continue; }
    if (['JMP', 'BRA'].includes(i.mnemonic)) pending.push([i.target, stack]);
    else if (i.mode === 'rel8') pending.push([i.next, stack], [i.target, stack]);
    else pending.push([i.next, stack]);
  }
  assert.equal(seen.size, body.size);
  assert.deepEqual(exits.sort((a, b) => a - b), [0x80AC59, 0x80ACBF, 0x80AD1B, 0x80ADF3]);
  assert.deepEqual(report.returns.sites, exits.map(cpuLabel));
});

test('1140 distinguishes normalzero,FFFF sentinel and raw pending request without normal step reads', () => {
  ins(0x80AC30, 'LDA', 0x1140); ins(0x80AC33, 'BEQ', undefined, 0x80AC40);
  ins(0x80AC35, 'CMP', 0xFFFF); ins(0x80AC38, 'BEQ', undefined, 0x80AC3D);
  ins(0x80AC3A, 'JMP', undefined, 0x80ACC0); ins(0x80AC3D, 'STZ', 0x1140);
  ins(0x80ACC0, 'STZ', 0x1140); ins(0x80ACC3, 'BRA', undefined, 0x80ACD0);
  ins(0x80ACD0, 'STA', 0x11);
  const pending = [...body.values()].filter(i => i.cpu >= 0x80ACC0 && i.cpu < 0x80ACC5);
  assert.deepEqual(pending.map(i => i.mnemonic), ['STZ', 'BRA']);
  assert.match(report.request_1140.pending, /Bypass fractional step/);
  assert.match(report.request_1140.sentinel, /not a raw frame pointer/);
});

test('Fraction accumulator preserves ADC Carry, masks7bits, advances on mathematical sum>=128 and decrements fullWORD countdown', () => {
  for (const [pc, op, value] of [[0x80AC40, 'LDA', 0x7E4088], [0x80AC44, 'CLC'], [0x80AC45, 'ADC', 0x7E4030],
    [0x80AC49, 'STA', 0x20], [0x80AC4B, 'AND', 0x7F], [0x80AC4E, 'STA', 0x7E4030], [0x80AC54, 'CMP', 0x20],
    [0x80AC5A, 'LDA', 0x1090], [0x80AC5F, 'STA', 0x3E], [0x80AC61, 'LDA', 0x7E3FD8],
    [0x80AC65, 'DEC'], [0x80AC66, 'STA', 0x7E3FD8], [0x80ACC5, 'LDA', 0x11F0],
    [0x80ACC8, 'TAY'], [0x80ACC9, 'INC'], [0x80ACCA, 'INC'], [0x80ACCB, 'STA', 0x11F0], [0x80ACCE, 'LDA', 0x3E]]) ins(pc, op, value);
  ins(0x80AC52, 'BCS', undefined, 0x80AC5A); ins(0x80AC56, 'BNE', undefined, 0x80AC5A);
  ins(0x80AC5D, 'BEQ', undefined, 0x80AC58); ins(0x80AC6A, 'BNE', undefined, 0x80ACC5);
  assert.equal(body.get(0x80ACCE).mode, 'dily');
  for (let speed = 0; speed < 65536; speed++) for (const phase of [0, 1, 0x7F, 0x80, 0xFFFF]) {
    const full = speed + phase, reduced = full & 0xFFFF;
    assert.equal(full > 0xFFFF || (reduced & 0x7F) !== reduced, full >= 128);
  }
  assert.equal((0 - 1) & 0xFFFF, 0xFFFF);
  assert.match(report.fractional_step.ordinary, /whole11F0/);
});

test('Countdownexpiry reload thresholds,stream-byte offset and taskstop are ordered and useeventbit8 without restoringX', () => {
  ins(0x80AC6C, 'LDA', 0x10E8); ins(0x80AC6F, 'BEQ', undefined, 0x80AC94);
  ins(0x80AC71, 'CMP', 0x80); ins(0x80AC74, 'BCC', undefined, 0x80AC7C);
  ins(0x80AC76, 'AND', 0x7F); ins(0x80AC79, 'STZ', 0x10E8); ins(0x80AC7C, 'STA', 0x7E3FD8);
  ins(0x80AC80, 'LDA', 0x1090); ins(0x80AC83, 'STA', 0x11); ins(0x80AC85, 'LDA', 0x8C); ins(0x80AC88, 'STA', 0x13);
  ins(0x80AC8A, 'LDY', 0x1198); ins(0x80AC8D, 'LDA', 0x11); assert.equal(body.get(0x80AC8D).mode, 'dily');
  ins(0x80AC8F, 'AND', 0xFF); ins(0x80AC92, 'BRA', undefined, 0x80ACC8);
  ins(0x80AC94, 'LDA', 0); ins(0x80AC97, 'STA', 0x7E4088);
  ins(0x80AC9B, 'LDA', 0x1038); ins(0x80AC9E, 'ORA', 0x8000); ins(0x80ACA1, 'STA', 0x1038);
  ins(0x80ACA4, 'LDA', 0x1350); ins(0x80ACA7, 'BMI', undefined, 0x80ACBE); ins(0x80ACA9, 'TAX');
  ins(0x80ACAA, 'LDA', 0xBA2); ins(0x80ACAD, 'BPL', undefined, 0x80ACB5);
  ins(0x80ACAF, 'LDA', 0x372); ins(0x80ACB2, 'TAX'); ins(0x80ACB3, 'BRA', undefined, 0x80ACAA);
  ins(0x80ACB5, 'LDA', 0xC62); ins(0x80ACB8, 'ORA', 8); ins(0x80ACBB, 'STA', 0xC62);
  ins(0x80ACBE, 'PLY'); ins(0x80ACBF, 'RTS');
  assert.equal([...body.values()].filter(i => i.cpu >= 0x80AC94 && i.cpu <= 0x80ACBF).some(i => ['PHX', 'PLX', 'CMP', 'SEC', 'CLC'].includes(i.mnemonic)), false);
  for (const [word, reload, clear] of [[1, 1, false], [0x7F, 0x7F, false], [0x80, 0, true], [0x100, 0, true], [0xFFFF, 0x7F, true]]) {
    assert.equal(word >= 0x80, clear); assert.equal(clear ? word & 0x7F : word, reload);
  }
});

test('Frame9B/9C bank selection,raw retry roundtrip and actual WORD13/14 pointer aliases are pinned', () => {
  ins(0x80ACD2, 'AND', 0x8000); ins(0x80ACD5, 'EOR', 0x8000); ins(0x80ACD8, 'STA', 0x3B);
  ins(0x80ACDA, 'EOR', 0x8000); ins(0x80ACDD, 'ASL'); ins(0x80ACDE, 'LDA', 0x9B); ins(0x80ACE1, 'ADC', 0);
  ins(0x80ACE4, 'STA', 0x13); ins(0x80ACE6, 'STA', 0x37); ins(0x80ACE8, 'LDA', 0x8000); ins(0x80ACEB, 'TSB', 0x11);
  ins(0x80ACED, 'LDA', 0x11); ins(0x80ACEF, 'STA', 0x35); ins(0x80ACF1, 'LDA', 0x11);
  ins(0x80ACF3, 'AND', 0xFF); ins(0x80ACF6, 'STA', 0x14);
  ins(0x80AD13, 'LDA', 0x11); ins(0x80AD15, 'EOR', 0x3B); ins(0x80AD17, 'STA', 0x1140);
  assert.equal(body.get(0x80ACF1).mode, 'dil');
  for (let raw = 0; raw < 65536; raw++) {
    const complement = (raw & 0x8000) ^ 0x8000;
    assert.equal((raw | 0x8000) ^ complement, raw);
    const bank = 0x9B + (raw >>> 15);
    assert.equal(bank, raw < 0x8000 ? 0x9B : 0x9C);
    for (const count of [0, 1, 0xFF]) {
      const word13AfterWord14 = bank | count << 8;
      assert.equal(word13AfterWord14 & 255, bank);
    }
  }
  assert.match(report.frame_pointer.aliases, /overwrites high byte ofWORD13/);
  assert.match(report.frame_pointer.aliases, /zero highBYTE38 overwrites low byte of existing searchWORD38/);
});

test('Budget overflow goes to subtraction withCarry1;normal>=50 and positive delta==free retry;poolmutation order matches originalowner', () => {
  ins(0x80ACF8, 'ASL'); ins(0x80ACF9, 'ASL'); ins(0x80ACFA, 'CLC'); ins(0x80ACFB, 'ADC', 0x82);
  ins(0x80ACFD, 'BCS', undefined, 0x80AD05); ins(0x80ACFF, 'CMP', 0x50); ins(0x80AD02, 'BCS', undefined, 0x80AD13);
  ins(0x80AD04, 'SEC'); ins(0x80AD05, 'LDA', 0x14); ins(0x80AD07, 'SBC', 0x12A0);
  ins(0x80AD0A, 'BEQ', undefined, 0x80AD6D); ins(0x80AD0C, 'BCC', undefined, 0x80AD45);
  ins(0x80AD0E, 'CMP', 0xD1C); ins(0x80AD11, 'BCC', undefined, 0x80AD1C);
  for (const [start, end, expected] of [
    [0x80AD1C, 0x80AD43, [0x17, 0xD1C, 0xD1E, 0x1564, 0x12F8, 0x17, 0x12A0]],
    [0x80AD45, 0x80AD6D, [0x17, 0xD1C, 0x12F8, 0xD1E, 0x1564, 0x17, 0x12A0]],
  ]) assert.deepEqual([...body.values()].filter(i => i.cpu >= start && i.cpu < end && ['STA', 'STY', 'DEC'].includes(i.mnemonic)).map(i => i.value), expected);
  ins(0x80AD27, 'LDY', 0xD1E); ins(0x80AD2A, 'LDA', 0x1564); ins(0x80AD2D, 'STA', 0xD1E);
  ins(0x80AD30, 'LDA', 0x12F8); ins(0x80AD33, 'STA', 0x1564); ins(0x80AD37, 'STA', 0x12F8);
  ins(0x80AD3C, 'BNE', undefined, 0x80AD27); ins(0x80AD66, 'BNE', undefined, 0x80AD52);
  // Pin both routes' last Carry definition beforeSBC; only the overflow
  // edge reachesAD05 withoutCMP0050/SEC, carrying the ADC's1.
  assert.equal(body.get(0x80ACFD).target, body.get(0x80AD04).next);
  assert.deepEqual([...body.values()].filter(i => i.cpu > 0x80AD04 && i.cpu < 0x80AD07).map(i => i.mnemonic), ['LDA']);
  assert.equal(body.get(0x80AD11).next, 0x80AD13); // CMP equality falls through to retry.
  assert.match(report.resource_pool.owner, /Same0D1C/);
  assert.match(report.admission.output_budget, /Overflow is admitted/);
});

test('Output is an unconditional do-loop with two orderedWORD entries pernode and required lastnextread,includingzero-count wrap', () => {
  ins(0x80AD6D, 'PHX'); ins(0x80AD6E, 'INC', 0x11); ins(0x80AD70, 'LDY', 0x82);
  ins(0x80AD72, 'LDA', 0x12F8); ins(0x80AD75, 'TAX');
  for (const [base, masks, queue, tablePc, tableBase] of [[0x80AD76, 0x80AD7A, 0x80AD7D, 0x80AD8C, 0xAEB4], [0x80AD96, 0x80AD9A, 0x80AD9D, 0x80ADAC, 0xAEC4]]) {
    ins(base, 'INY'); ins(base + 1, 'INY'); ins(base + 2, 'LDA', 0x11); ins(masks, 'AND', 0xFFC0);
    ins(queue, 'STA', 0x16D4); ins(queue + 3, 'LDA', 0x11); ins(queue + 5, 'AND', 0x3F);
    ins(queue + 8, 'CLC'); ins(queue + 9, 'ADC', 0x8E); ins(queue + 12, 'STA', 0x1654);
    ins(tablePc, 'LDA', tableBase); ins(tablePc + 3, 'STA', 0x1754);
  }
  ins(0x80ADB2, 'LDA', 0x1564); ins(0x80ADB5, 'TAX');
  ins(0x80ADBA, 'DEC', 0x14); ins(0x80ADBC, 'BNE', undefined, 0x80AD76);
  ins(0x80ADBE, 'STY', 0x82); ins(0x80ADC0, 'PLX');
  assert.equal([...body.values()].filter(i => i.cpu >= 0x80AD6D && i.cpu < 0x80ADBA).some(i => i.target !== undefined), false);
  assert.match(report.output.zero_count, /65536 times/);
  for (const count of [0, 1, 2, 255]) {
    const nominalIterations = count || 65536;
    assert.equal((count - nominalIterations) & 0xFFFF, 0);
    assert.equal(((count - 1) & 0xFFFF) === 0, count === 1);
  }
});

test('Tail keeps exact XORpointer,fullWORD reads,conditional0FE0 preservation and signedBYTE*4 with final Carrybit7', () => {
  ins(0x80ADC1, 'LDA', 0x11); ins(0x80ADC3, 'EOR', 0x3B); ins(0x80ADC5, 'STA', 0x7E3F80);
  ins(0x80ADC9, 'LDY', 3); ins(0x80ADCC, 'LDA', 0x11); assert.equal(body.get(0x80ADCC).mode, 'dily');
  ins(0x80ADCE, 'AND', 7); ins(0x80ADD1, 'STA', 0xF88); ins(0x80ADD4, 'BEQ', undefined, 0x80ADF2);
  ins(0x80ADD6, 'ORA', 0x8000); ins(0x80ADD9, 'STA', 0xF88); ins(0x80ADDC, 'DEC', 0x35);
  ins(0x80ADDE, 'LDA', 0x35); ins(0x80ADE0, 'BIT', 0x80); ins(0x80ADE3, 'BNE', undefined, 0x80ADEA);
  ins(0x80ADE5, 'AND', 0xFF); ins(0x80ADE8, 'BRA', undefined, 0x80ADED); ins(0x80ADEA, 'ORA', 0xFF00);
  ins(0x80ADED, 'ASL'); ins(0x80ADEE, 'ASL'); ins(0x80ADEF, 'STA', 0xFE0); ins(0x80ADF2, 'PLY');
  for (let byte = 0; byte < 256; byte++) for (const high of [0, 0x23, 0xFF]) {
    const word = byte | high << 8, extended = byte & 0x80 ? word | 0xFF00 : word & 0xFF;
    const signed = byte >= 128 ? byte - 256 : byte;
    assert.equal((extended << 2) & 0xFFFF, (signed * 4) & 0xFFFF);
    assert.equal((extended >>> 14) & 1, byte >>> 7);
  }
  assert.match(report.returns.carry, /No universal boolean success/);
});

test('Pinned272-byte overlapping table,banks,allWORD accesses,shared scratch and AFC4 exact caller reactions stay distinct', () => {
  const table = report.data_windows[0];
  const { word_values, uses, ...window } = table;
  checkWindow(window, 0x80AEB4, 0x80AFC4, 'aee4a74f6f574e0e6e52ac22b385abf91222479531e8f6b78c1d08dece3fe064');
  assert.deepEqual(word_values, Array.from({ length: 136 }, (_, k) => k * 32));
  assert.match(uses, /second base\+0010/);
  assert.match(report.entry_contract, /DBR00\/80/);
  const memory = [...body.values()].filter(i => ['dp', 'abs', 'absx', 'absy', 'longx', 'dil', 'dily'].includes(i.mode) && i.mnemonic !== 'JMP');
  assert.deepEqual(report.accesses.map(a => [a.from, a.instruction, a.operand, a.width_bytes, a.operation]), memory.map(i => [cpuLabel(i.cpu), i.mnemonic, i.operand, 2,
    ['INC', 'DEC', 'TSB'].includes(i.mnemonic) ? 'read_modify_write' : ['STA', 'STY', 'STZ'].includes(i.mnemonic) ? 'write' : 'read']));
  const scratch = [...new Set(memory.filter(i => i.mode === 'dp' && ['STA', 'STY', 'INC', 'DEC', 'TSB'].includes(i.mnemonic)).map(i => i.value))];
  assert.deepEqual(scratch, [0x20, 0x3E, 0x11, 0x13, 0x3B, 0x37, 0x35, 0x14, 0x17, 0x82]);
  assert.deepEqual(report.side_effects.scratch_words, scratch.map(v => v.toString(16).toUpperCase()));
  ins(0x80AFE1, 'LDA', 0x8C); ins(0x80AFE4, 'STA', 0x40); ins(0x80AFE6, 'LDY', 0x14B0);
  ins(0x80AFE9, 'LDX', 0x14B2); ins(0x80AFEC, 'LDA', 0x1458); ins(0x80AFEF, 'BIT', 0x400);
  ins(0x80AFF2, 'BNE', undefined, 0x80AFF7); ins(0x80AFF4, 'JSR', undefined, 0x80AC2F);
  ins(0x80AFF7, 'DEY'); ins(0x80AFF8, 'DEY'); ins(0x80AFF9, 'BPL', undefined, 0x80AFE9);
  assert.equal(caller.get(0x80AFE6).next, 0x80AFE9); // No second empty-list guard.
  assert.equal([...caller.values()].filter(i => i.cpu >= 0x80AFF7).some(i => ['BCC', 'BCS', 'PHY', 'PLY', 'TAX', 'TAY'].includes(i.mnemonic)), false);
  assert.equal(rom.subarray(0x16C6, 0x16D3).toString('hex'), 'b0e3204bccb0de2094de20c4af');
});
