import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveComplementSignGatesToDispatch,
  describeComplementSignGateByteOwners,
  complementSignGateWordConsequence,
} from './render-task-complement-sign-gates-source-proof.mjs';
import { carrySignGateWordConsequence } from './render-task-carry-sign-gates-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(
  await readFile('analysis/render-task-complement-sign-gates.json', 'utf8'),
);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'gate9cF7CB',
    0x80f7cb,
    0x80f7e7,
    14,
    '132102a8912e234c2a01bd1bc0abb000fec104f8a406ec051212504bf77567de',
  ],
  [
    'gate9eF7E7',
    0x80f7e7,
    0x80f7f8,
    9,
    'c88fdd6e4e6a4d35e4c7538cec6b7dfb7497fb6ec62a04f693e993d3bd68de43',
  ],
  [
    'gateA4F80E',
    0x80f80e,
    0x80f82b,
    15,
    '8e14ece56ba72ba9d3330bcca3886241145d0f76548a16343b30136cf4c2468d',
  ],
  [
    'gateA6F82B',
    0x80f82b,
    0x80f83d,
    10,
    '19a047ee2db68e2255520213e5ce640ec82227de4e6916349bae24ac3820e839',
  ],
  [
    'fetchF389',
    0x80f389,
    0x80f393,
    5,
    '4c3f34f823702042ca64c29aeb6edbae702c6dfe3735c436921cd418d83c81cf',
  ],
];
const map = new Map();
for (const [, start, end] of windows)
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, { e: 0, m: 0, x: 0 });
    assert.ok(i.next <= end);
    map.set(pc, i);
    pc = i.next;
  }
const entries = [0x80f7cb, 0x80f7e7, 0x80f80e, 0x80f82b];
const context = {
  d: 0x3d6,
  bank: 0x9d,
  s: 0x3f0,
  y: 4,
  pointerAfter: 0xa001,
  right: 1,
  leftGateWord: 0,
  leftCompareWord: 1,
  incomingCarry: 0,
};
const own = (entry, patch = {}) =>
  describeComplementSignGateByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) =>
  complementSignGateWordConsequence({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Independent raw pins, static edge enumeration and byteborrow equations. No CPU run.
test('complement sign gates102/53 independently pin ROM/windows and twelve finite paths', () => {
  assert.equal(
    metadata.rom_sha256,
    '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',
  );
  assert.equal(report.rom_sha256, metadata.rom_sha256);
  for (const [name, start, end, count, hash] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(sha(raw), hash);
    assert.equal([...map.keys()].filter((pc) => pc >= start && pc < end).length, count);
    assert.deepEqual(
      report.windows.find((w) => w.name === name),
      {
        name,
        entry: cpuLabel(start),
        end_exclusive: cpuLabel(end),
        covered_bytes: end - start,
        instruction_count: count,
        sha256: hash,
        machine_bytes: raw.toString('hex').toUpperCase(),
      },
    );
  }
  assert.equal(map.size, 53);
  assert.equal(report.source_graph.code_bytes, 102);
  assert.equal(report.source_graph.instructions, 53);
  assert.equal(report.complement_sign_gates.flatMap((p) => p.paths).length, 12);
  assert.ok(!map.has(0x80f7f8) && !map.has(0x80f83d));
});
test('9C/9E/A4/A6 original table WORDtargets and fresh fetch source owners agree independently', async () => {
  for (const [opcode, source, target, hash] of [
    [0x9c, 0x80f350, 0x80f7cb, '47a655f2da085c3578248ddc4ab857625725836fb31f6a6806649dda0d8bb738'],
    [0x9e, 0x80f352, 0x80f7e7, 'c9dce62fdc6e5c0a11589b1ac341d46c910966159f56ddcb4efe0cb9d43a0d73'],
    [0xa4, 0x80f358, 0x80f80e, 'cd47e2f693ae52b5706d9ace0913aa745d29e61a586ad8491ba2123267bef928'],
    [0xa6, 0x80f35a, 0x80f82b, '72c87aae3d16af6c4659d3e4c002ce50fcde07369dd250740c950df310def6e3'],
  ]) {
    const off = cpuToOffset(source, rom.length),
      raw = rom.subarray(off, off + 2);
    assert.equal(raw.readUInt16LE(), target & 65535);
    assert.equal(sha(raw), hash);
    assert.deepEqual(
      report.dispatch_entries.find((d) => d.opcode === opcode),
      {
        opcode,
        word_source: cpuLabel(source),
        target: cpuLabel(target),
        machine_bytes: raw.toString('hex').toUpperCase(),
        sha256: hash,
      },
    );
  }
  for (const d of report.dependencies) {
    const owner = JSON.parse(await readFile(d.report, 'utf8'));
    assert.equal(owner.rom_sha256, metadata.rom_sha256);
    assert.deepEqual(
      d.window,
      owner.windows.find((w) => w.name === d.window.name),
    );
    if (d.opcode_source_sha256)
      assert.equal(d.opcode_source_sha256, owner.dispatch.opcode_source.sha256);
  }
  assert.equal(report.dependencies[0].window.machine_bytes, report.windows.at(-1).machine_bytes);
  assert.equal(
    report.dependencies[1].window.machine_bytes.slice(34),
    report.windows.at(-1).machine_bytes,
  );
});
test('independent forward ROMedge enumeration matches all twelve sign/Carry paths and excludes later trampolines', () => {
  for (const entry of entries) {
    const pending = [{ pc: entry, visited: [], branch_taken: [] }],
      actual = [];
    while (pending.length) {
      const s = pending.pop(),
        i = map.get(s.pc);
      assert.ok(i);
      const p = { ...s, visited: [...s.visited, cpuLabel(i.cpu)] };
      assert.ok(p.visited.length <= 17);
      if (i.cpu === 0x80f390) {
        actual.push(p);
        continue;
      }
      if (i.mode === 'rel8')
        for (const taken of [false, true])
          pending.push({
            ...p,
            pc: taken ? i.target : i.next,
            branch_taken: [...p.branch_taken, taken],
          });
      else pending.push({ ...p, pc: i.mnemonic === 'JMP' ? i.target : i.next });
    }
    const normalize = (ps) =>
      ps.map((p) => JSON.stringify({ branch_taken: p.branch_taken, visited: p.visited })).sort();
    assert.equal(actual.length, 3);
    assert.deepEqual(
      normalize(actual),
      normalize(report.complement_sign_gates.find((p) => p.entry === cpuLabel(entry)).paths),
    );
  }
});
test('9C actual leftLDA/BPL negative gate stores0000 withoutCMP; freshCMP BCC C0 retainsFFFF', () => {
  at(0x80f7cb, 'LDA', 3, 'sr');
  at(0x80f7cd, 'BPL', 0x80f7d8, 'rel8');
  at(0x80f7cf, 'PLA');
  at(0x80f7d0, 'LDA', 0, 'immM');
  at(0x80f7d3, 'STA', 1, 'sr');
  at(0x80f7d5, 'JMP', 0x80f389);
  at(0x80f7d8, 'LDX', 65535, 'immX');
  at(0x80f7db, 'PLA');
  at(0x80f7dc, 'CMP', 1, 'sr');
  at(0x80f7de, 'BCC', 0x80f7e1, 'rel8');
  at(0x80f7e0, 'INX');
  at(0x80f7e2, 'STA', 1, 'sr');
  const p = proveComplementSignGatesToDispatch(map, 0x80f7cb);
  assert.deepEqual(p, report.complement_sign_gates[0]);
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 14, 15],
  );
  assert.deepEqual(
    p.paths.map((p) => p.result),
    ['0000', 'FFFF', '0000'],
  );
  assert.equal(p.paths[0].x_before_next_fetch, 'entry X unchanged');
  assert.equal(p.decrement, null);
});
test('A4 actualleft gate/PLA/DEC A/freshCMP/BCC uses wrappedright and skipsINX iffC0', () => {
  at(0x80f80e, 'LDA', 3, 'sr');
  at(0x80f810, 'BPL', 0x80f81b, 'rel8');
  at(0x80f812, 'PLA');
  at(0x80f813, 'LDA', 0, 'immM');
  at(0x80f816, 'STA', 1, 'sr');
  at(0x80f81b, 'LDX', 65535, 'immX');
  at(0x80f81e, 'PLA');
  at(0x80f81f, 'DEC', 0, 'A');
  at(0x80f820, 'CMP', 1, 'sr');
  at(0x80f822, 'BCC', 0x80f825, 'rel8');
  at(0x80f824, 'INX');
  at(0x80f826, 'STA', 1, 'sr');
  const p = proveComplementSignGatesToDispatch(map, 0x80f80e);
  assert.deepEqual(p, report.complement_sign_gates[2]);
  assert.equal(p.decrement.memory_write, false);
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 15, 16],
  );
  assert.deepEqual(
    p.paths.map((p) => p.readable_operand_byte_accesses),
    [4, 6, 6],
  );
});
test('9E BMI fromoriginalPLA N reachesTXA directly, retainsFFFF and omitsINX/CMP/leftreads', () => {
  at(0x80f7e7, 'LDX', 65535, 'immX');
  at(0x80f7ea, 'PLA');
  at(0x80f7eb, 'BMI', 0x80f7f2, 'rel8');
  at(0x80f7ed, 'CMP', 1, 'sr');
  at(0x80f7ef, 'BCC', 0x80f7f2, 'rel8');
  at(0x80f7f1, 'INX');
  at(0x80f7f2, 'TXA');
  at(0x80f7f3, 'STA', 1, 'sr');
  const p = proveComplementSignGatesToDispatch(map, 0x80f7e7);
  assert.deepEqual(p, report.complement_sign_gates[1]);
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 13, 14],
  );
  assert.deepEqual(
    p.paths.map((p) => p.result),
    ['FFFF', 'FFFF', '0000'],
  );
  assert.ok(p.paths[0].visited.includes('80:F7F2'));
  assert.ok(!p.paths[0].visited.includes('80:F7F1'));
  assert.equal(p.paths[0].required_readable_operand_stack_bytes, 2);
  assert.equal(p.paths[0].required_writable_operand_stack_bytes, 2);
  assert.equal(p.decrement, null);
});
test('A6 originalPLA BMI precedesDEC and jumpsTXA withoutDEC/CMP/INX; nonnegative usesactualBCC', () => {
  at(0x80f82b, 'LDX', 65535, 'immX');
  at(0x80f82e, 'PLA');
  at(0x80f82f, 'BMI', 0x80f837, 'rel8');
  at(0x80f831, 'DEC', 0, 'A');
  at(0x80f832, 'CMP', 1, 'sr');
  at(0x80f834, 'BCC', 0x80f837, 'rel8');
  at(0x80f836, 'INX');
  at(0x80f837, 'TXA');
  at(0x80f838, 'STA', 1, 'sr');
  const p = proveComplementSignGatesToDispatch(map, 0x80f82b);
  assert.deepEqual(p, report.complement_sign_gates[3]);
  assert.equal(p.gates[0].flag_origin, '80:F82E');
  assert.equal(p.decrement.at, '80:F831');
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 14, 15],
  );
  assert.ok(!p.paths[0].visited.includes('80:F831'));
  assert.ok(!p.paths[0].visited.includes('80:F832'));
  assert.ok(!p.paths[0].visited.includes('80:F836'));
});
test('allWORD signgates includehighbyte and noCMP paths preserve bothCarryseeds withoutfabricatingleft', () => {
  for (let value = 0; value < 65536; value++)
    for (const entry of entries) {
      const leftGate = entry === 0x80f7cb || entry === 0x80f80e;
      for (const incomingCarry of [0, 1]) {
        const p = equation(entry, {
          leftGateWord: value,
          right: leftGate ? 0 : value,
          incomingCarry,
        });
        const skipped = (value & 0x8000) !== 0;
        assert.equal(p.left_compare_word_read, !skipped);
        if (skipped)
          assert.deepEqual(
            equation(entry, {
              leftGateWord: value,
              right: leftGate ? 0 : value,
              leftCompareWord: undefined,
              incomingCarry,
            }),
            {
              value: leftGate ? 0 : 65535,
              carry: incomingCarry,
              left_compare_word_read: false,
              decrement_executed: false,
              compared_right_word: null,
            },
          );
      }
    }
});
test('allrightWORDs verifyDEC onlyoncompared A4/A6; rightzeroA6 comparesFFFF andreturns0000 forallleft', () => {
  for (let right = 0; right < 65536; right++) {
    const low = right % 256,
      high = Math.floor(right / 256),
      expected = low === 0 ? 255 + ((high + 255) % 256) * 256 : low - 1 + high * 256;
    assert.equal(equation(0x80f80e, { right }).compared_right_word, expected);
    assert.equal(
      equation(0x80f82b, { right }).compared_right_word,
      right < 32768 ? expected : null,
    );
  }
  for (let left = 0; left < 65536; left++)
    for (const entry of [0x80f80e, 0x80f82b])
      assert.deepEqual(equation(entry, { right: 0, leftCompareWord: left }), {
        value: 0,
        carry: 1,
        left_compare_word_read: true,
        decrement_executed: true,
        compared_right_word: 65535,
      });
  assert.equal(equation(0x80f80e, { right: 0x8000, leftCompareWord: 0x7fff }).value, 0);
  assert.equal(equation(0x80f80e, { right: 0x8000, leftCompareWord: 0x8000 }).value, 65535);
  assert.equal(
    equation(0x80f82b, { right: 0x8000, leftCompareWord: undefined, incomingCarry: 1 }).value,
    65535,
  );
  assert.equal(equation(0x80f80e, { right: 0, leftGateWord: 0x8000 }).decrement_executed, false);
});
test('independent byteborrow covers allfreshleft WORDs withboundary/neighbor rightpartners on actualCMP paths', () => {
  for (let left = 0; left < 65536; left++)
    for (const right of [
      0,
      1,
      255,
      256,
      0x7fff,
      0x8000,
      0xffff,
      left,
      (left + 1) % 65536,
      (left + 65535) % 65536,
    ])
      for (const entry of entries) {
        const negativeRight = (entry === 0x80f7e7 || entry === 0x80f82b) && right >= 32768;
        if (negativeRight) continue;
        const dec = entry === 0x80f80e || entry === 0x80f82b,
          low = right % 256,
          high = Math.floor(right / 256);
        const w = dec
          ? low === 0
            ? 255 + ((high + 255) % 256) * 256
            : low - 1 + high * 256
          : right;
        const borrow = (w % 256) - (left % 256) < 0 ? 1 : 0,
          carry = Math.floor(w / 256) - Math.floor(left / 256) - borrow < 0 ? 0 : 1;
        assert.deepEqual(equation(entry, { right, leftCompareWord: left }), {
          value: carry ? 0 : 65535,
          carry,
          left_compare_word_read: true,
          decrement_executed: dec,
          compared_right_word: w,
        });
      }
});
test('9C/A4 signgate andfreshCMP use samebytes withdistinctWORD observations', () => {
  for (const entry of [0x80f7cb, 0x80f80e])
    for (const leftGateWord of [0, 1, 0x7fff]) {
      const p = own(entry, { leftGateWord, right: 1, leftCompareWord: 0xffff });
      assert.deepEqual(p.stack_operations[0].bytes, p.stack_operations[2].bytes);
      assert.equal(p.context.leftGateWord, leftGateWord);
      assert.equal(p.context.leftCompareWord, 65535);
      assert.equal(p.value, 65535);
      assert.deepEqual(
        p.stack_operations.map((o) => [o.kind, o.s_delta, o.offset]),
        [
          ['read', 0, 3],
          ['read', 0, 1],
          ['read', 2, 1],
          ['write', 2, 1],
        ],
      );
      assert.equal(equation(entry, { leftGateWord, right: 1, leftCompareWord: 0 }).value, 0);
    }
});
test('rightnegative omitsleftread but mandatorywrite maystillrequire unmapped/ROM byteowners', () => {
  for (const entry of [0x80f7e7, 0x80f82b]) {
    const p = own(entry, { s: 0x1ffd, right: 0x8000, leftCompareWord: undefined });
    assert.equal(p.left_compare_word_read, false);
    assert.deepEqual(addresses(p), [
      ['00:1FFE', '00:1FFF'],
      ['00:2000', '00:2001'],
    ]);
    assert.ok(p.stack_operations[0].bytes.every((b) => b.physical_address !== null));
    assert.ok(p.stack_operations[1].bytes.every((b) => b.physical_address === null));
    assert.equal(p.stack_operations[1].kind, 'write');
    assert.ok(!('leftCompareWord' in p.context));
  }
  assert.equal(
    own(0x80f7cb, { s: 0x7ffd }).stack_operations.at(-1).bytes[0].physical_address,
    '80:8000',
  );
});
test('allS values/fourentries preserve actualread/store chronology and bank00/S WORDwrap', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries)
      for (const skipped of [false, true]) {
        const leftGate = entry === 0x80f7cb || entry === 0x80f80e,
          p = own(entry, {
            s,
            leftGateWord: skipped ? 0x8000 : 0,
            right: !leftGate && skipped ? 0x8000 : 1,
          });
        const top = [(s + 1) % 65536, (s + 2) % 65536],
          left = [(s + 3) % 65536, (s + 4) % 65536],
          pairs = [...(leftGate ? [left] : []), top, ...(!skipped ? [left] : []), left];
        assert.deepEqual(
          addresses(p),
          pairs.map((pair) => pair.map(cpuLabel)),
        );
        assert.equal(p.output_operand_s, (s + 2) % 65536);
        assert.equal(p.s_after_pla, (s + 2) % 65536);
        assert.ok(
          p.stack_operations.every((o) => o.bytes[0].byte === 'low' && o.bytes[1].byte === 'high'),
        );
      }
  assert.deepEqual(addresses(own(0x80f82b, { s: 0xfffc })).at(-1), ['00:FFFF', '00:0000']);
});
test('all256 DBRs keepoperands bank00 whilefreshDP pointer/WORDopcode/Y wrapindependently', () => {
  for (let bank = 0; bank < 256; bank++)
    for (const entry of entries) {
      const p = own(entry, { bank, d: 65535, y: 1, pointerAfter: 65535 });
      assert.deepEqual(addresses(p), addresses(own(entry)));
      assert.deepEqual(
        p.next_opcode_sources.pointer_reads.map((b) => b.address),
        ['00:FFFF', '00:0000'],
      );
      assert.deepEqual(
        p.next_opcode_sources.word_reads.map((b) => b.address),
        [cpuLabel(((bank + 1) & 255) * 65536), cpuLabel(((bank + 1) & 255) * 65536 + 1)],
      );
    }
  assert.deepEqual(
    own(0x80f7e7, { bank: 255, y: 0, pointerAfter: 65535 }).next_opcode_sources.word_reads.map(
      (b) => b.address,
    ),
    ['FF:FFFF', '00:0000'],
  );
  assert.equal(own(0x80f7cb, { y: 65535 }).frontier_y, 0);
});
test('legalWORD statuses preserveV/I/decimal with actualpath Carry and finalN0/Zfreshopcode', () => {
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLD', 'SED', 'CLC', 'SEC', 'CLV', 'PHA', 'STZ'].includes(i.mnemonic),
    ),
  );
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (const entry of entries)
        for (const skipped of [false, true])
          for (const right0 of [0, 1, 0x7fff])
            for (const left of [0, 1, 0x8000, 65535])
              for (const low of [0, 1, 0x80, 0xff]) {
                const leftGate = entry === 0x80f7cb || entry === 0x80f80e,
                  right = !leftGate && skipped ? 0x8000 : right0;
                const p = equation(entry, {
                    leftGateWord: skipped ? 0x8000 : 0,
                    right,
                    leftCompareWord: left,
                    incomingCarry: status & 1,
                  }),
                  final = (status & ~0x83) | p.carry | (low === 0 ? 2 : 0);
                assert.equal(final & 0x4c, status & 0x4c);
                assert.equal(
                  final & 1,
                  skipped ? status & 1 : p.compared_right_word < left ? 0 : 1,
                );
                assert.equal(final & 0x80, 0);
                assert.equal(Boolean(final & 2), low === 0);
              }
  assert.ok(report.complement_sign_gates.every((p) => p.decimal_flag_required === null));
});
test('leftstores canalias pointer/control/opcode beforefreshF389 evenon noCMP paths; DECneverwritesright', () => {
  for (const entry of entries)
    for (const skipped of [false, true]) {
      const data = {
          leftGateWord: skipped ? 0x8000 : 0,
          right: skipped ? 0x8000 : 1,
          leftCompareWord: 2,
        },
        pointerAfter = equation(entry, data).value;
      const p = own(entry, { bank: 0x80, s: 0x3d3, pointerAfter, ...data });
      assert.deepEqual(
        p.stack_operations.at(-1).bytes.map((b) => b.physical_address),
        p.next_opcode_sources.pointer_reads.map((b) => b.physical_address),
      );
      assert.deepEqual(
        p.next_opcode_sources.word_reads.map((b) => b.address),
        pointerAfter === 0 ? ['80:0004', '80:0005'] : ['81:0003', '81:0004'],
      );
      const opcode = own(entry, {
        bank: 0x80,
        s: 0x3d3,
        d: 0x100,
        y: 0,
        pointerAfter: 0x3d6,
        ...data,
      });
      assert.deepEqual(
        opcode.stack_operations.at(-1).bytes.map((b) => b.physical_address),
        opcode.next_opcode_sources.word_reads.map((b) => b.physical_address),
      );
      assert.equal(p.stack_operations.filter((o) => o.kind === 'write').length, 1);
    }
  assert.deepEqual(addresses(own(0x80f7cb, { s: 0x3da })).at(-1), ['00:03DD', '00:03DE']);
  assert.match(report.contract.addressing, /neverwrites poppedright/);
});
test('allfinite paths read operands beforebothleftstores thenfresh fullWORDfetch/INY/unscaledJMP', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (const p of report.complement_sign_gates)
    for (const path of p.paths) {
      assert.deepEqual(path.visited.slice(-5), [
        '80:F389',
        '80:F38B',
        '80:F38C',
        '80:F38F',
        '80:F390',
      ]);
      const store = path.stack_operations.at(-1).at;
      assert.ok(path.visited.indexOf(store) < path.visited.indexOf('80:F389'));
      for (const read of path.stack_operations.slice(0, -1))
        assert.ok(path.visited.indexOf(read.at) < path.visited.indexOf(store));
      assert.equal(p.operand_s_delta, 2);
      assert.equal(path.required_writable_operand_stack_bytes, 2);
      assert.equal(p.y_delta_before_next_opcode, 0);
      assert.equal(p.y_delta_at_frontier, 1);
    }
  assert.match(report.contract.fetch, /includingignoredhigh/);
});
test('allmissing/raw/width/mode/value/target/stack/edge mutations reject including BMItoINX or wrongDEC/Carry', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(
      proveComplementSignGatesToDispatch(local, entry),
      proveComplementSignGatesToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveComplementSignGatesToDispatch(missing, entry));
      for (const patch of [
        { length: i.length + 1 },
        { raw: Buffer.alloc(i.length) },
        { state: { e: 0, m: 1, x: 0 } },
        { state: { e: 0, m: 0, x: 1 } },
        { state: { e: 1, m: 1, x: 1 } },
        { state: {} },
        { next: i.next + 1 },
        { mode: 'long' },
        { cpu: pc + 1 },
        { mnemonic: 'NOP' },
        { value: i.value + 1 },
        { target: i.target === undefined ? pc : i.target + 1 },
        { opcode: i.opcode ^ 1 },
      ]) {
        const m = new Map(local);
        m.set(pc, { ...i, ...patch });
        assert.throws(() => proveComplementSignGatesToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f80e, 0x80f81f, { mode: 'sr' }],
    [0x80f7e7, 0x80f7eb, { target: 0x80f7f1 }],
    [0x80f82b, 0x80f82f, { target: 0x80f836 }],
    [0x80f7cb, 0x80f7cd, { mnemonic: 'BMI' }],
    [0x80f82b, 0x80f834, { mnemonic: 'BCS' }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveComplementSignGatesToDispatch(m, entry));
  }
});
test('equationsreject missing/invalid owners/WORD/Carry and do notfabricate skipped reads', () => {
  for (const patch of [
    { d: -1 },
    { d: 65536 },
    { s: null },
    { s: 65536 },
    { y: undefined },
    { bank: -1 },
    { bank: 256 },
    { pointerAfter: undefined },
  ])
    assert.throws(() => own(0x80f7cb, patch), /Explicit/);
  for (const value of [-1, 65536, null, undefined])
    for (const entry of entries) {
      assert.throws(() => equation(entry, { right: value }), /WORD/);
      assert.throws(() => equation(entry, { leftCompareWord: value }), /WORD/);
    }
  for (const entry of [0x80f7cb, 0x80f80e])
    for (const leftGateWord of [-1, 65536, null, undefined])
      assert.throws(() => equation(entry, { leftGateWord }), /WORD/);
  for (const entry of entries)
    for (const incomingCarry of [-1, 2, null, undefined])
      assert.throws(
        () =>
          equation(entry, {
            leftGateWord: 0x8000,
            right: 0x8000,
            leftCompareWord: undefined,
            incomingCarry,
          }),
        /Carry/,
      );
  for (const entry of entries)
    assert.equal(
      equation(entry, { leftGateWord: 0x8000, right: 0x8000, leftCompareWord: undefined })
        .left_compare_word_read,
      false,
    );
  assert.throws(() => equation(0x80f735), /Invalid/);
  assert.throws(() => own(0x80f735), /Invalid/);
  assert.throws(() => proveComplementSignGatesToDispatch(map, 0x80f735), /Invalid/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
  assert.match(own(0x80f7e7).qualification, /not an owner/);
});
test('hosthandlers unsupported/noeffect and C1CA/9178/central retain dynamic/native/globalstack boundaries', async () => {
  for (const op of [0x9c, 0x9e, 0xa4, 0xa6]) {
    assert.ok(!executableOpcodes.includes(op));
    const frame = compileScriptFrame([op, 0x56], { localBytes: 0, returnBytes: 2 })([0xcafe, 0, 1]),
      before = frame.snapshot();
    assert.throws(() => frame.step(), /is not implemented/);
    assert.deepEqual(frame.snapshot(), before);
  }
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-complement-sign-gates.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [2, 2, 2, 2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(report.source_graph.source_closed_to_dispatch, true);
  assert.equal(report.source_graph.full_graph_closed, false);
  assert.equal(report.source_graph.native_binding, false);
  assert.equal(report.source_graph.minimum_protected_stack_bytes, null);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  const group = progress.work_groups.find((g) => g.id === 'task-f378-complement-sign-gates');
  assert.equal(group.status, 'composition-required');
  assert.deepEqual(group.manual_native, {
    module: 'proof/task/complement-sign-gates.mjs',
    report: 'analysis/render-task-complement-sign-gates-native.json',
  });
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});

test('independent data consequences pair9C/94 9E/96 A4/8C A6/8E withoppositeresults andidenticalCarry', () => {
  for (const [entry, previous] of [
    [0x80f7cb, 0x80f789],
    [0x80f7e7, 0x80f7a5],
    [0x80f80e, 0x80f745],
    [0x80f82b, 0x80f762],
  ])
    for (const right of [0, 1, 255, 256, 0x7fff, 0x8000, 65535])
      for (const leftGateWord of [0, 1, 0x7fff, 0x8000, 65535])
        for (const leftCompareWord of [0, 1, 0x7fff, 0x8000, 65535])
          for (const incomingCarry of [0, 1]) {
            const data = { right, leftGateWord, leftCompareWord, incomingCarry },
              a = equation(entry, data),
              b = carrySignGateWordConsequence({ entry: previous, ...data });
            assert.equal(a.value + b.value, 65535);
            assert.equal(a.carry, b.carry);
            assert.equal(a.left_compare_word_read, b.left_compare_word_read);
            assert.equal(a.decrement_executed, b.decrement_executed);
            assert.equal(a.compared_right_word, b.compared_right_word);
          }
});
