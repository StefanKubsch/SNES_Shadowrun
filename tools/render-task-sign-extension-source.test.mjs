import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveSignExtensionToDispatch,
  describeSignExtensionByteOwners,
  signExtensionWordConsequence,
} from './render-task-sign-extension-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-sign-extension.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'sign0AF3F6',
    0x80f3f6,
    0x80f408,
    8,
    '574e4573b711850282e044cf735ed03cab3c8f93a908b97eec716a1b0c64bd08',
  ],
  [
    'sign0CF408',
    0x80f408,
    0x80f420,
    11,
    '9fc919c3178f245422d247b97445ee3e75dfd9d86eac24fdbd01ffb9390af3ed',
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
const entries = [0x80f3f6, 0x80f408],
  context = {
    d: 0x3d6,
    bank: 0x9d,
    s: 0x3f0,
    y: 4,
    pointerBefore: 0xa001,
    pointerAfter: 0xa001,
    operandWord: 1,
    localWord: 0xab80,
  };
const own = (entry, patch = {}) => describeSignExtensionByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) =>
  signExtensionWordConsequence({ ...context, entry, ...patch });
const addresses = (bs) => bs.map((b) => b.address),
  physical = (bs) => bs.map((b) => b.physical_address);
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  assert.deepEqual(i.state, { e: 0, m: 0, x: 0 });
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Independent ROM pins/edges, arithmetic/byte equations and synthetic hostfixtures.
test('sign-extension52/24 independently pins full ROM windows and identity', () => {
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
  assert.equal(map.size, 24);
  assert.equal(report.source_graph.code_bytes, 52);
  assert.equal(report.source_graph.instructions, 24);
});
test('0A/0C original table WORDs and separate sharedfetch source owners agree', async () => {
  for (const [opcode, pc, entry, hash] of [
    [
      0x0a,
      0x80f2be,
      entries[0],
      'ad0b29696ac69eef54b775558744a43139c2b21fc255d4a555dc2875ef905a00',
    ],
    [
      0x0c,
      0x80f2c0,
      entries[1],
      '0eb5e0fcd44c21b26aa317b858aa7ec372ce2dd42f9b722997ed5ae2444b85a8',
    ],
  ]) {
    const off = cpuToOffset(pc, rom.length),
      raw = rom.subarray(off, off + 2);
    assert.equal(raw.readUInt16LE(), entry & 65535);
    assert.equal(sha(raw), hash);
    assert.deepEqual(
      report.dispatch_entries.find((d) => d.opcode === opcode),
      {
        opcode,
        word_source: cpuLabel(pc),
        target: cpuLabel(entry),
        machine_bytes: raw.toString('hex').toUpperCase(),
        sha256: hash,
      },
    );
  }
  for (const d of report.dependencies) {
    const r = JSON.parse(await readFile(d.report, 'utf8'));
    assert.equal(r.rom_sha256, metadata.rom_sha256);
    assert.deepEqual(
      d.window,
      r.windows.find((w) => w.name === d.window.name),
    );
    if (d.opcode_source_sha256)
      assert.equal(d.opcode_source_sha256, r.dispatch.opcode_source.sha256);
  }
  assert.equal(report.dependencies[0].window.machine_bytes, report.windows.at(-1).machine_bytes);
  assert.equal(
    report.dependencies[1].window.machine_bytes.slice(34),
    report.windows.at(-1).machine_bytes,
  );
});
test('independent static ROM edge enumeration proves fourexactpaths12/13 and15/16', () => {
  for (const [n, entry] of entries.entries())
    for (const taken of [true, false]) {
      let pc = entry;
      const visited = [],
        pushes = [];
      while (true) {
        const i = map.get(pc);
        assert.ok(i);
        assert.ok(!visited.includes(cpuLabel(pc)));
        visited.push(cpuLabel(pc));
        assert.ok(visited.length <= 16);
        if (i.mnemonic === 'PHA') pushes.push(cpuLabel(pc));
        if (pc === 0x80f390) break;
        pc =
          i.mnemonic === 'BCC'
            ? taken
              ? i.target
              : i.next
            : i.mnemonic === 'JMP'
              ? i.target
              : i.next;
      }
      const p = report.sign_extensions[n].paths[taken ? 0 : 1];
      assert.deepEqual(p.visited, visited);
      assert.equal(p.executed_instructions, (n ? 15 : 12) + Number(!taken));
      assert.equal(pushes.length, 1);
      assert.ok(visited.indexOf(pushes[0]) < visited.indexOf('80:F389'));
      assert.equal(
        visited.filter((pc) => map.get(parseInt(pc.replace(':', ''), 16)).mnemonic === 'ORA')
          .length,
        Number(!taken),
      );
    }
  for (const [n, entry] of entries.entries())
    assert.deepEqual(proveSignExtensionToDispatch(map, entry), report.sign_extensions[n]);
});
test('0A fullWORD immediate/mask/CMP/BCC/optionalORA has no local/TAX beforePHA', () => {
  at(0x80f3f6, 'LDA', 0, 'diy');
  at(0x80f3f8, 'INY');
  at(0x80f3f9, 'AND', 255, 'immM');
  at(0x80f3fc, 'CMP', 128, 'immM');
  at(0x80f3ff, 'BCC', 0x80f404, 'rel8');
  at(0x80f401, 'ORA', 0xff00, 'immM');
  at(0x80f404, 'PHA');
  at(0x80f405, 'JMP', 0x80f389, 'abs');
  assert.deepEqual(
    report.sign_extensions[0].reads.map((r) => r.kind),
    ['immediate-operand', 'next-opcode'],
  );
  assert.equal(own(entries[0], { localWord: undefined }).local_sources, null);
  assert.equal(equation(entries[0]).index, null);
  assert.match(report.sign_extensions[0].x_before_next_fetch, /entry X unchanged/);
});
test('0C fullindexWORD/mask/TAX andfulllocalWORD/mask precede CMP0080/BCC/ORA', () => {
  at(0x80f408, 'LDA', 0, 'diy');
  at(0x80f40a, 'INY');
  at(0x80f40b, 'AND', 255, 'immM');
  at(0x80f40e, 'TAX');
  at(0x80f40f, 'LDA', 0x13, 'dpx');
  at(0x80f411, 'AND', 255, 'immM');
  at(0x80f414, 'CMP', 128, 'immM');
  at(0x80f417, 'BCC', 0x80f41c, 'rel8');
  at(0x80f419, 'ORA', 0xff00, 'immM');
  at(0x80f41c, 'PHA');
  at(0x80f41d, 'JMP', 0x80f389, 'abs');
  assert.deepEqual(
    report.sign_extensions[1].reads.map((r) => r.kind),
    ['index-operand', 'local', 'next-opcode'],
  );
});
test('all immediate/localWORDs select sign solelyfrom lowBYTE and fullCMP carries regardlessHigh', () => {
  for (let value = 0; value < 65536; value++)
    for (const entry of entries) {
      const p = equation(
          entry,
          entry === entries[0] ? { operandWord: value } : { localWord: value },
        ),
        low = value % 256;
      const signed = low >= 128 ? low - 256 : low;
      assert.equal(p.value, (signed + 65536) % 65536);
      assert.equal(p.data_low, low);
      assert.equal(p.carry, Number(signed < 0));
      assert.equal(p.ora_executed, signed < 0);
      assert.equal(p.cmp_result, (low + 65536 - 128) % 65536);
      assert.equal(p.cmp_n, Number(low < 128));
      assert.equal(p.cmp_z, Number(low === 128));
    }
});
test('all indexWORDs yield fullX0..255 without odd/FF clamps; 0A neverfabricateslocalowner', () => {
  for (let operandWord = 0; operandWord < 65536; operandWord++) {
    assert.equal(equation(entries[1], { operandWord }).index, operandWord % 256);
    assert.equal(equation(entries[0], { operandWord }).index, null);
  }
  for (let index = 0; index < 256; index++)
    for (const d of [0, 0xed, 0xffec, 65535]) {
      const p = own(entries[1], { d, operandWord: 0xff00 + index }),
        base = (d + 19 + index) % 65536;
      assert.deepEqual(
        addresses(p.local_sources.word_reads),
        [base, (base + 1) % 65536].map(cpuLabel),
      );
    }
  assert.ok(!('localWord' in own(entries[0], { localWord: undefined }).context));
});
test('positive-path CMP N1/Z0 preserved atPHA evenfor0000/007F; negativeORA replacesCMPflags', () => {
  for (const entry of entries)
    for (let low = 0; low < 256; low++) {
      const p = equation(entry, { operandWord: low, localWord: low });
      assert.equal(p.n_before_push, 1);
      assert.equal(p.z_before_push, 0);
      if (low < 128) {
        assert.ok(p.cmp_result >= 0xff80);
        assert.ok(p.value < 128);
        assert.equal(p.ora_executed, false);
      } else {
        assert.equal(p.cmp_n, 0);
        assert.equal(p.value, 0xff00 + low);
        assert.equal(p.ora_executed, true);
      }
    }
  for (const p of report.sign_extensions) {
    assert.equal(p.paths[0].n_before_push, 1);
    assert.equal(p.paths[0].z_before_push, 0);
    assert.equal(p.paths[1].n_before_push, 1);
    assert.equal(p.paths[1].z_before_push, 0);
  }
  assert.equal(equation(entries[0], { operandWord: 0x80 }).cmp_z, 1);
  assert.equal(equation(entries[0], { operandWord: 0 }).value, 0);
});
test('alllegalWORD statuses/lowbytes retainV/I/decimal andreplaceincomingC viaCMP, fetchreplacesNZ', () => {
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (let low = 0; low < 256; low++) {
        const cmpC = Number(low >= 128),
          pha = (status & ~0x83) | 0x80 | cmpC;
        assert.equal(pha & 0x4c, status & 0x4c);
        assert.equal(pha & 1, cmpC);
        assert.equal(pha & 0x82, 0x80);
        for (const opcode of [0, 1, 0x80, 255]) {
          const final = (pha & ~0x82) | (opcode === 0 ? 2 : 0);
          assert.equal(final & 0x4c, status & 0x4c);
          assert.equal(final & 1, cmpC);
          assert.equal(Boolean(final & 2), opcode === 0);
          assert.equal(final & 0x80, 0);
        }
      }
  assert.ok(
    ![...map.values()].some((i) =>
      ['CLD', 'SED', 'CLC', 'SEC', 'ADC', 'SBC', 'SEP', 'REP', 'XBA'].includes(i.mnemonic),
    ),
  );
  assert.ok(report.sign_extensions.every((p) => p.decimal_flag_required === null));
});
test('all D WORDvalues keepDL andbank00 localhighwrap acrossFFFF/0000 and00FF/0100', () => {
  for (let d = 0; d < 65536; d++) {
    const p = own(entries[1], { d, operandWord: 65535 }),
      base = (d + 19 + 255) % 65536;
    assert.deepEqual(
      addresses(p.local_sources.word_reads),
      [base, (base + 1) % 65536].map(cpuLabel),
    );
  }
  assert.deepEqual(addresses(own(entries[1], { d: 0xffeb }).local_sources.word_reads), [
    '00:FFFF',
    '00:0000',
  ]);
  assert.deepEqual(addresses(own(entries[1], { d: 0xeb }).local_sources.word_reads), [
    '00:00FF',
    '00:0100',
  ]);
});
test('all S values PHA high/low withsignHigh00/FF underS-2 withoutstackreads', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries) {
      const p = own(entry, { s });
      assert.deepEqual(addresses(p.stack_writes), [s, (s + 65535) % 65536].map(cpuLabel));
      assert.equal(p.output_operand_s, (s + 65534) % 65536);
    }
  for (const low of [0, 0x7f, 0x80, 255])
    for (const entry of entries) {
      const p = own(entry, { operandWord: low, localWord: low });
      assert.deepEqual(
        p.stack_writes.map((w) => [w.byte, w.value]),
        [
          ['high', low < 128 ? 0 : 255],
          ['low', low],
        ],
      );
    }
  assert.ok(
    report.sign_extensions.every(
      (p) =>
        p.required_readable_operand_stack_bytes === 0 &&
        p.required_writable_operand_stack_bytes === 2,
    ),
  );
});
test('all Y WORDvalues consumeoneBYTE afterfullWORDread thenfetchincrementonce', () => {
  for (let y = 0; y < 65536; y++)
    for (const entry of entries) {
      const p = own(entry, { y });
      assert.equal(p.next_opcode_y, (y + 1) % 65536);
      assert.equal(p.frontier_y, (y + 2) % 65536);
    }
  assert.equal(own(entries[0], { y: 65535 }).next_opcode_y, 0);
  assert.equal(own(entries[1], { y: 65535 }).frontier_y, 1);
});
test('256 DBRs affectindexedstream butDP/local/stackremainbank00 andwrapseparately', () => {
  for (let bank = 0; bank < 256; bank++)
    for (const entry of entries) {
      const p = own(entry, { bank, d: 65535, y: 0, pointerBefore: 65535, pointerAfter: 65535 });
      assert.deepEqual(addresses(p.stack_writes), addresses(own(entry).stack_writes));
      assert.deepEqual(addresses(p.operand_sources.pointer_reads), ['00:FFFF', '00:0000']);
      assert.deepEqual(addresses(p.operand_sources.word_reads), [
        cpuLabel(bank * 65536 + 65535),
        cpuLabel(((bank + 1) % 256) * 65536),
      ]);
      if (p.local_sources)
        assert.deepEqual(
          addresses(p.local_sources.word_reads),
          addresses(own(entry, { d: 65535 }).local_sources.word_reads),
        );
    }
  const p = own(entries[0], { bank: 255, y: 65535, pointerBefore: 65535, pointerAfter: 0 });
  assert.deepEqual(addresses(p.operand_sources.word_reads), ['00:FFFE', '00:FFFF']);
  assert.deepEqual(addresses(p.next_opcode_sources.word_reads), ['FF:0000', 'FF:0001']);
});
test('all ignoredWORD highbytes needactualreadowner despite mask/signextension', () => {
  const p = own(entries[1], { d: 0x1feb });
  assert.deepEqual(addresses(p.local_sources.word_reads), ['00:1FFF', '00:2000']);
  assert.deepEqual(physical(p.local_sources.word_reads), ['7E:1FFF', null]);
  for (const entry of entries) {
    assert.deepEqual(
      physical(own(entry, { bank: 0, y: 0, pointerBefore: 0x1fff }).operand_sources.word_reads),
      ['7E:1FFF', null],
    );
    assert.ok(
      report.sign_extensions
        .find((p) => p.entry === cpuLabel(entry))
        .reads.every((r) => r.bytes === 2 && r.highbyte_required),
    );
  }
});
test('PHA replacesownpointer/header/controls beforeactualfreshfetch, noautomaticframe7store', () => {
  for (const entry of entries)
    for (const low of [0, 0x7f, 0x80, 255]) {
      const value = low < 128 ? low : 0xff00 + low,
        p = own(entry, {
          bank: 0x80,
          s: 0x3d7,
          operandWord: low,
          localWord: low,
          pointerBefore: 0x1200,
          pointerAfter: value,
        });
      assert.deepEqual(
        physical(p.stack_writes),
        physical(p.next_opcode_sources.pointer_reads).reverse(),
      );
      assert.equal(p.next_opcode_sources.word_reads[0].address, cpuLabel(0x800000 + value + 5));
      assert.equal(p.operand_sources.word_reads[0].address, '80:1204');
      assert.deepEqual(addresses(own(entry, { s: 0x3de }).stack_writes), ['00:03DE', '00:03DD']);
    }
  assert.ok(report.sign_extensions.every((p) => p.saved_frame_cursor_write === false));
  assert.match(report.contract.aliases, /ownDP00pointer/);
});
test('0C PHA aliasesalreadylatchedlocalWORD; bothhandlersmayreplace nextopcode afterallreads', () => {
  const local = own(entries[1], { operandWord: 0, s: 0x3ea, localWord: 0xab80 });
  assert.deepEqual(
    physical(local.stack_writes),
    physical(local.local_sources.word_reads).reverse(),
  );
  assert.deepEqual(
    local.stack_writes.map((w) => w.value),
    [255, 128],
  );
  for (const entry of entries) {
    const p = own(entry, { d: 0x100, bank: 0x80, s: 0x3ea, y: 0, pointerAfter: 0x3e8 });
    assert.deepEqual(
      physical(p.stack_writes),
      physical(p.next_opcode_sources.word_reads).reverse(),
    );
    assert.deepEqual(
      p.ordered_accesses.slice(-4).map((a) => a.kind),
      ['PHA-high', 'PHA-low', 'next-pointer', 'next-opcode-WORD'],
    );
    const kinds = p.ordered_accesses.map((a) => a.kind);
    assert.ok(
      kinds.indexOf('PHA-high') >
        kinds.indexOf(entry === entries[0] ? 'immediate-WORD' : 'local-WORD'),
    );
  }
});
test('allmissing/raw/state/width/mode/branch/CMP/ORA mutationsreject evenunexecutedORA source', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(
      proveSignExtensionToDispatch(local, entry),
      proveSignExtensionToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveSignExtensionToDispatch(missing, entry));
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
        assert.throws(() => proveSignExtensionToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [entries[0], 0x80f3fc, { value: 0x8000 }],
    [entries[0], 0x80f3ff, { mnemonic: 'BMI' }],
    [entries[1], 0x80f419, { value: 255 }],
    [entries[1], 0x80f40f, { state: { e: 0, m: 1, x: 0 } }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveSignExtensionToDispatch(m, entry));
  }
});
test('invalid/missing fullWORD/context fails; 0A requiresno fabricatedlocalWORD and mappinggrantsnopermission', () => {
  for (const entry of entries) {
    for (const patch of [
      { d: -1 },
      { d: 65536 },
      { s: null },
      { y: undefined },
      { bank: -1 },
      { bank: 256 },
      { pointerBefore: undefined },
      { pointerAfter: undefined },
    ])
      assert.throws(() => own(entry, patch), /Explicit/);
    for (const value of [-1, 65536, null, undefined])
      assert.throws(() => equation(entry, { operandWord: value }), /WORD/);
  }
  for (const value of [-1, 65536, null, undefined]) {
    assert.throws(() => equation(entries[1], { localWord: value }), /WORD/);
    assert.doesNotThrow(() => equation(entries[0], { localWord: value }));
  }
  assert.throws(() => own(0x80f398), /Invalid/);
  assert.throws(() => equation(0x80f398), /Invalid/);
  assert.throws(() => proveSignExtensionToDispatch(map, 0x80f398), /Invalid/);
  assert.equal(own(entries[0], { s: 0x2000 }).stack_writes[0].physical_address, null);
  assert.equal(own(entries[1], { s: 0x8000 }).stack_writes[0].physical_address, '80:8000');
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('host0A/0C scalaragreement for allBYTEs doesnot supplyWORDhigh/Carry/prePHAflags/physicalrefetch', () => {
  for (let low = 0; low < 256; low++) {
    const expected = low < 128 ? low : 65536 + low - 256;
    assert.ok(executableOpcodes.includes(0x0a));
    assert.ok(executableOpcodes.includes(0x0c));
    const immediate = compileScriptFrame([0x0a, low, 0x56], { localBytes: 0, returnBytes: 2 })([]);
    immediate.step();
    assert.deepEqual(immediate.snapshot().stack, [expected]);
    assert.equal(immediate.snapshot().pc, 2);
    const local = compileScriptFrame([0x00, low, 0x2c, 0, 0x0c, 0, 0x56], {
      localBytes: 1,
      returnBytes: 2,
    })([]);
    local.step();
    local.step();
    local.step();
    assert.deepEqual(local.snapshot().stack, [expected]);
    assert.equal(local.snapshot().pc, 6);
  }
  const uninitialized = compileScriptFrame([0x0c, 0, 0x56], { localBytes: 1, returnBytes: 2 })([]);
  assert.throws(() => uninitialized.step(), /Uninitialized/);
  const outside = compileScriptFrame([0x0c, 255, 0x56], { localBytes: 1, returnBytes: 2 })([]);
  assert.throws(() => outside.step(), /outside frame/);
  assert.equal(own(entries[1], { operandWord: 255 }).index, 255);
  assert.match(report.contract.host_boundary, /noactualCMP-Carry\/prePHA-NZ/);
});
test('C1CA/9178/central retain dynamic/native/globalstack boundaries after signextension source', async () => {
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-sign-extension.json',
  );
  assert.deepEqual(supplied.entries, entries.map(cpuLabel));
  assert.deepEqual(supplied.operand_s_deltas, [-2, -2]);
  assert.equal(supplied.outer_return_frames_added, 0);
  assert.equal(report.source_graph.source_closed_to_dispatch, true);
  assert.equal(report.source_graph.full_graph_closed, false);
  assert.equal(report.source_graph.native_binding, false);
  assert.equal(report.source_graph.minimum_protected_stack_bytes, null);
  assert.equal(visit.full_graph.closed, false);
  assert.equal(visit.full_graph.minimum_protected_stack_bytes, null);
  assert.equal(text.full_graph.closed, false);
  const group = progress.work_groups.find((g) => g.id === 'task-f378-sign-extension');
  assert.equal(group.status, 'composition-required');
  assert.deepEqual(group.manual_native, {
    module: 'proof/task/sign-extension.mjs',
    report: 'analysis/render-task-sign-extension-native.json',
  });
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
