import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveCarryCompareToDispatch,
  describeCarryCompareByteOwners,
  carryCompareWordConsequence,
} from './render-task-carry-compare-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-carry-compare.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'compare8aF735',
    0x80f735,
    0x80f745,
    9,
    'e458c7a483778498d60a0ce3d1efcdec9d1eb9bad8daafbd1e1c057c3fb39869',
  ],
  [
    'compare92F77A',
    0x80f77a,
    0x80f789,
    8,
    '0d8bf782922469eb3bc310fe1794931373be01adecee8d6cea04ff2cb8feb35f',
  ],
  [
    'compare9aF7BC',
    0x80f7bc,
    0x80f7cb,
    8,
    'ae2439c0746b90355d2c171cdb32e256ab5140de594935d48b554d1e402f1ec2',
  ],
  [
    'compareA2F7FE',
    0x80f7fe,
    0x80f80e,
    9,
    '9d9e0d5cf6a85605dcfdf6eef97dfc0c0bf82459100312e7ff35c97f8866b61a',
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
const entries = [0x80f735, 0x80f77a, 0x80f7bc, 0x80f7fe];
const context = { d: 0x3d6, bank: 0x9d, s: 0x3f0, y: 4, pointerAfter: 0xa001, right: 1, left: 1 };
const own = (entry, patch = {}) => describeCarryCompareByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) =>
  carryCompareWordConsequence({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Source graph enumeration and pure WORD/address consequences, no CPU run.
test('carry compare72/39 independently pins ROM identity and complete windows', () => {
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
  assert.equal(map.size, 39);
  assert.equal(report.source_graph.code_bytes, 72);
  assert.equal(report.source_graph.instructions, 39);
});
test('8A/92/9A/A2 original tabletargets and actualsharedfetch owners independently pinned', async () => {
  for (const [opcode, source, target, hash] of [
    [0x8a, 0x80f33e, 0x80f735, '2845533bec78e7d91ad582cabc0d67aab81fd66764f828be2559aff2a62a24bf'],
    [0x92, 0x80f346, 0x80f77a, '0ee6ad31c545a548014decda117d393fc0c372551ec16dbeca903bd56398439b'],
    [0x9a, 0x80f34e, 0x80f7bc, '63d31ada2c9271fc237a91796bd11e587f2b4968792ac40a14ba5b37c34b26ea'],
    [0xa2, 0x80f356, 0x80f7fe, '487ee9c9932fbc3ab0b6b4bcd0896523b4bc1ebd4ae8dc7fa2a6409929b5ea0d'],
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
test('independent forward source-edge enumeration proves exacteight paths through realbranch targets/fetch', () => {
  for (const entry of entries) {
    const pending = [{ pc: entry, visited: [], branch_taken: null }],
      actual = [];
    while (pending.length) {
      const state = pending.pop(),
        i = map.get(state.pc);
      assert.ok(i);
      const path = { ...state, visited: [...state.visited, cpuLabel(i.cpu)] };
      assert.ok(path.visited.length <= 14);
      if (i.cpu === 0x80f390) {
        actual.push({ branch_taken: path.branch_taken, visited: path.visited });
        continue;
      }
      if (i.mode === 'rel8')
        for (const taken of [false, true])
          pending.push({ ...path, pc: taken ? i.target : i.next, branch_taken: taken });
      else pending.push({ ...path, pc: i.mnemonic === 'JMP' ? i.target : i.next });
    }
    const normalize = (paths) =>
      paths.map((p) => JSON.stringify({ branch_taken: p.branch_taken, visited: p.visited })).sort();
    assert.equal(actual.length, 2);
    assert.deepEqual(
      normalize(actual),
      normalize(report.carry_compare.find((p) => p.entry === cpuLabel(entry)).paths),
    );
  }
});
test('8A actualPLA/DEC A/CMP/BCS skipINX producesFFFF iff transformedright Carry1 withoutmemoryDEC', () => {
  at(0x80f735, 'LDX', 65535, 'immX');
  at(0x80f738, 'PLA');
  at(0x80f739, 'DEC', 0, 'A');
  at(0x80f73a, 'CMP', 1, 'sr');
  at(0x80f73c, 'BCS', 0x80f73f, 'rel8');
  at(0x80f73e, 'INX');
  at(0x80f73f, 'TXA');
  at(0x80f740, 'STA', 1, 'sr');
  const p = proveCarryCompareToDispatch(map, 0x80f735);
  assert.deepEqual(p, report.carry_compare[0]);
  assert.equal(p.branch.flag_origin, '80:F73A');
  assert.equal(p.decrement.memory_write, false);
  assert.deepEqual(
    p.paths.map((p) => [p.executed_instructions, p.carry, p.result]),
    [
      [13, 1, 'FFFF'],
      [14, 0, '0000'],
    ],
  );
  assert.ok(!p.paths[0].visited.includes('80:F73E'));
  assert.ok(p.paths[1].visited.includes('80:F73E'));
});
test('92 BCS and9A BCC shareoriginalright CMP but complementaryresults whileactualCMP Carry remains same', () => {
  at(0x80f77d, 'PLA');
  at(0x80f77e, 'CMP', 1, 'sr');
  at(0x80f780, 'BCS', 0x80f783, 'rel8');
  at(0x80f782, 'INX');
  at(0x80f784, 'STA', 1, 'sr');
  at(0x80f7bf, 'PLA');
  at(0x80f7c0, 'CMP', 1, 'sr');
  at(0x80f7c2, 'BCC', 0x80f7c5, 'rel8');
  at(0x80f7c4, 'INX');
  at(0x80f7c6, 'STA', 1, 'sr');
  for (const entry of [0x80f77a, 0x80f7bc]) {
    const p = proveCarryCompareToDispatch(map, entry);
    assert.deepEqual(
      p,
      report.carry_compare.find((p) => p.entry === cpuLabel(entry)),
    );
    assert.equal(p.decrement, null);
    assert.deepEqual(
      p.paths.map((p) => p.executed_instructions),
      [12, 13],
    );
  }
  assert.deepEqual(
    report.carry_compare[1].paths.map((p) => p.carry),
    [1, 0],
  );
  assert.deepEqual(
    report.carry_compare[2].paths.map((p) => p.carry),
    [0, 1],
  );
  assert.deepEqual(equation(0x80f77a, { right: 0, left: 0 }), {
    compared_right_word: 0,
    carry: 1,
    value: 65535,
  });
  assert.deepEqual(equation(0x80f7bc, { right: 0, left: 0 }), {
    compared_right_word: 0,
    carry: 1,
    value: 0,
  });
});
test('A2 LDX0000/DEC A/BCC and WORDDEX selectsamevalueas8A withoppositebranch anddifferentindexupdate', () => {
  at(0x80f7fe, 'LDX', 0, 'immX');
  at(0x80f801, 'PLA');
  at(0x80f802, 'DEC', 0, 'A');
  at(0x80f803, 'CMP', 1, 'sr');
  at(0x80f805, 'BCC', 0x80f808, 'rel8');
  at(0x80f807, 'DEX');
  at(0x80f808, 'TXA');
  at(0x80f809, 'STA', 1, 'sr');
  const p = proveCarryCompareToDispatch(map, 0x80f7fe);
  assert.deepEqual(p, report.carry_compare[3]);
  assert.deepEqual(
    p.paths.map((p) => [p.executed_instructions, p.carry, p.result]),
    [
      [13, 0, '0000'],
      [14, 1, 'FFFF'],
    ],
  );
  assert.deepEqual(
    p.paths.map((p) => p.x_before_next_fetch),
    [0, 65535],
  );
  assert.equal(p.branch.flag_origin, '80:F803');
});
test('alloriginalrightWORDs haveindependent byteDEC wrap; zero becomesFFFF andCarry1 forallleftWORDs', () => {
  for (let right = 0; right < 65536; right++) {
    const low = right % 256,
      high = Math.floor(right / 256),
      expected = low === 0 ? 255 + ((high + 255) % 256) * 256 : low - 1 + high * 256;
    for (const entry of [0x80f735, 0x80f7fe])
      assert.equal(equation(entry, { right, left: 0 }).compared_right_word, expected);
  }
  for (let left = 0; left < 65536; left++)
    for (const entry of [0x80f735, 0x80f7fe])
      assert.deepEqual(equation(entry, { right: 0, left }), {
        compared_right_word: 65535,
        carry: 1,
        value: 65535,
      });
  assert.equal(equation(0x80f735, { right: 0x8000, left: 0x8000 }).value, 0);
  assert.equal(equation(0x80f735, { right: 0x8000, left: 0x7fff }).value, 65535);
});
test('independent byteborrow covers allleftWORDs and boundary/neighbor partners, no signed/rightgreater simplification', () => {
  for (let left = 0; left < 65536; left++)
    for (const right of [
      0,
      1,
      0xff,
      0x100,
      0x7fff,
      0x8000,
      0xffff,
      left,
      (left + 1) % 65536,
      (left + 65535) % 65536,
    ]) {
      for (const entry of entries) {
        const dec = entry === 0x80f735 || entry === 0x80f7fe,
          low = right % 256,
          high = Math.floor(right / 256);
        const w = dec
          ? low === 0
            ? 255 + ((high + 255) % 256) * 256
            : low - 1 + high * 256
          : right;
        const borrow = (w % 256) - (left % 256) < 0 ? 1 : 0,
          carry = Math.floor(w / 256) - Math.floor(left / 256) - borrow < 0 ? 0 : 1;
        const result = entry === 0x80f7bc ? (carry ? 0 : 65535) : carry ? 65535 : 0;
        assert.deepEqual(equation(entry, { right, left }), {
          compared_right_word: w,
          carry,
          value: result,
        });
      }
    }
});
test('alllegalWORD statuses preserveV/I/decimal even8000DEC; CMP replacesentryCarry and finalNZ fromfreshopcode', () => {
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLD', 'SED', 'CLC', 'SEC', 'CLV', 'PHA'].includes(i.mnemonic),
    ),
  );
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (const entry of entries)
        for (const [right, left] of [
          [0, 65535],
          [1, 1],
          [0x8000, 0x7fff],
          [0x8000, 0x8000],
          [0x7fff, 0x8000],
        ])
          for (const low of [0, 1, 0x80, 0xff]) {
            const c = equation(entry, { right, left }).carry,
              final = (status & ~0x83) | c | (low === 0 ? 2 : 0);
            assert.equal(final & 0x4c, status & 0x4c);
            assert.equal(final & 1, c);
            assert.equal(final & 0x80, 0);
            assert.equal(Boolean(final & 2), low === 0);
          }
  assert.ok(report.carry_compare.every((p) => p.decimal_flag_required === null));
  assert.match(report.contract.values_flags, /withoutVchange/);
});
test('allS values/allfourentries usebank00 rightpull thenfreshleftCMP/store atactualS+2 with16bitwrap', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries) {
      const p = own(entry, { s }),
        top = [(s + 1) % 65536, (s + 2) % 65536],
        left = [(s + 3) % 65536, (s + 4) % 65536];
      assert.deepEqual(
        addresses(p),
        [top, left, left].map((pair) => pair.map(cpuLabel)),
      );
      assert.equal(p.s_after_pla, (s + 2) % 65536);
      assert.equal(p.output_operand_s, (s + 2) % 65536);
      assert.ok(
        p.stack_operations.every((o) => o.bytes[0].byte === 'low' && o.bytes[1].byte === 'high'),
      );
      assert.equal(p.stack_operations.filter((o) => o.kind === 'write').length, 1);
    }
  assert.deepEqual(addresses(own(0x80f735, { s: 0xfffc })).at(-1), ['00:FFFF', '00:0000']);
  assert.deepEqual(addresses(own(0x80f7fe, { s: 0xfffe }))[0], ['00:FFFF', '00:0000']);
});
test('all256 DBRs keepoperandstack bank00 whileDpointer/freshopcodeWORD/Y wrapindependently', () => {
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
    own(0x80f7bc, { bank: 255, y: 0, pointerAfter: 65535 }).next_opcode_sources.word_reads.map(
      (b) => b.address,
    ),
    ['FF:FFFF', '00:0000'],
  );
  assert.equal(own(0x80f735, { y: 65535 }).frontier_y, 0);
});
test('leftstores mayalias freshpointer/control/opcode, DEC A doesnotwritepoppedright orauthorizealiases', () => {
  for (const entry of entries)
    for (const [right, left] of [
      [0, 1],
      [1, 0],
    ]) {
      const value = equation(entry, { right, left }).value,
        p = own(entry, { s: 0x3d3, bank: 0x80, pointerAfter: value, right, left });
      assert.deepEqual(
        p.stack_operations.at(-1).bytes.map((b) => b.physical_address),
        p.next_opcode_sources.pointer_reads.map((b) => b.physical_address),
      );
      assert.deepEqual(
        p.next_opcode_sources.word_reads.map((b) => b.address),
        value === 0 ? ['80:0004', '80:0005'] : ['81:0003', '81:0004'],
      );
      const opcode = own(entry, { s: 0x3d3, bank: 0x80, d: 0x100, y: 0, pointerAfter: 0x3d6 });
      assert.deepEqual(
        opcode.stack_operations.at(-1).bytes.map((b) => b.physical_address),
        opcode.next_opcode_sources.word_reads.map((b) => b.physical_address),
      );
    }
  assert.deepEqual(addresses(own(0x80f77a, { s: 0x3da })).at(-1), ['00:03DD', '00:03DE']);
  assert.match(report.contract.aliases, /neverwrites poppedright/);
});
test('everyCarrypath hasfulloperandreads/bothleftstores thenfresh fullWORDfetch/INY/unscaledJMP', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (const p of report.carry_compare)
    for (const path of p.paths) {
      assert.deepEqual(path.visited.slice(-5), [
        '80:F389',
        '80:F38B',
        '80:F38C',
        '80:F38F',
        '80:F390',
      ]);
      const store = path.stack_operations.at(-1).at;
      for (const read of path.stack_operations.slice(0, -1))
        assert.ok(path.visited.indexOf(read.at) < path.visited.indexOf(store));
      assert.ok(path.visited.indexOf(store) < path.visited.indexOf('80:F389'));
      assert.equal(p.operand_s_delta, 2);
      assert.equal(p.required_readable_operand_stack_bytes, 4);
      assert.equal(p.required_writable_operand_stack_bytes, 2);
      assert.equal(p.y_delta_before_next_opcode, 0);
      assert.equal(p.y_delta_at_frontier, 1);
      assert.equal(p.frontier.x, 'Fresh next-opcode lowbyte');
    }
  assert.match(report.contract.fetch, /includingignoredhigh/);
  assert.equal([...map.values()].filter((i) => i.mnemonic === 'INY').length, 1);
});
test('allsource missing/raw/width/mode/value/target/stack/edge mutations andwrongDEC/Carrybranch failclosed', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(
      proveCarryCompareToDispatch(local, entry),
      proveCarryCompareToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveCarryCompareToDispatch(missing, entry));
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
        assert.throws(() => proveCarryCompareToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f735, 0x80f739, { mnemonic: 'DEC', mode: 'sr' }],
    [0x80f735, 0x80f73c, { mnemonic: 'BCC' }],
    [0x80f77a, 0x80f780, { mnemonic: 'BEQ' }],
    [0x80f7bc, 0x80f7c2, { mnemonic: 'BCS' }],
    [0x80f7fe, 0x80f807, { mnemonic: 'INX' }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveCarryCompareToDispatch(m, entry));
  }
  assert.throws(() => proveCarryCompareToDispatch(map, 0x80f843), /Invalid/);
});
test('equationsrejectinvalid/missing originalWORDs/context anddo notauthorizeunmapped/ROMwrites', () => {
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
    assert.throws(() => own(0x80f735, patch), /Explicit/);
  for (const value of [-1, 65536, null, undefined])
    for (const entry of entries) {
      assert.throws(() => equation(entry, { right: value }), /WORD/);
      assert.throws(() => equation(entry, { left: value }), /WORD/);
    }
  assert.throws(() => equation(0x80f843), /Invalid/);
  assert.throws(() => own(0x80f843), /Invalid/);
  assert.equal(
    own(0x80f735, { s: 0x1ffd }).stack_operations.at(-1).bytes[0].physical_address,
    null,
  );
  const b = own(0x80f7fe, { s: 0x7ffd }).stack_operations.at(-1).bytes[0];
  assert.equal(b.address, '00:8000');
  assert.equal(b.physical_address, '80:8000');
  assert.match(own(0x80f735).qualification, /not an owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('hosthandlersremainunsupported/noeffect and C1CA/9178/central donotpromote fullnative/globalstack', async () => {
  for (const op of [0x8a, 0x92, 0x9a, 0xa2]) {
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
    (s) => s.source === 'analysis/render-task-carry-compare.json',
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
  const group = progress.work_groups.find((g) => g.id === 'task-f378-carry-compare');
  assert.equal(group.status, 'composition-required');
  assert.deepEqual(group.manual_native, {
    module: 'proof/task/carry-compare.mjs',
    report: 'analysis/render-task-carry-compare-native.json',
  });
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
