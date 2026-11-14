import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuLabel, cpuToOffset } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveCompareGatesToDispatch,
  describeCompareGateByteOwners,
  compareGateWordConsequence,
} from './render-task-compare-gates-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-task-compare-gates.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'acF852',
    0x80f852,
    0x80f86e,
    14,
    'e1a3453e4e3afc357275dde475c41d822bc70121bb5ebcd0eb1127c4fbe72b67',
  ],
  [
    'aeF86E',
    0x80f86e,
    0x80f87f,
    9,
    '206af776625b2a9c3d4f93f25138628f99bee7fc9d5cc7b8f86ef920c41fac50',
  ],
  [
    'b4F88E',
    0x80f88e,
    0x80f8aa,
    14,
    'd015380e05512d598de0df700975b7e8529ab6a91f004a136d197f250ca590d0',
  ],
  [
    'b6F8AA',
    0x80f8aa,
    0x80f8bb,
    9,
    'a3f3ece369c5f26a3e59dc058ba9f840e317c7051a7f80ef4d59bbe82854b5c1',
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
const entries = [0x80f852, 0x80f86e, 0x80f88e, 0x80f8aa];
const context = {
  d: 0x3d6,
  bank: 0x9d,
  s: 0x3f0,
  y: 4,
  pointerAfter: 0xa001,
  leftGateWord: 0,
  leftCompareWord: 1,
  right: 1,
  incomingCarry: 0,
};
const own = (entry, patch = {}) => describeCompareGateByteOwners({ ...context, entry, ...patch });
const equation = (entry, patch = {}) => compareGateWordConsequence({ ...context, entry, ...patch });
const addresses = (p) => p.stack_operations.map((o) => o.bytes.map((b) => b.address));
const at = (pc, op, value, mode) => {
  const i = map.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op);
  if (value !== undefined) assert.equal(i.target ?? i.value, value);
  if (mode !== undefined) assert.equal(i.mode, mode);
  return i;
};
// Independent ROM pins and synthetic consequences; no instruction/CPU runner.
test('compare gates100/51 independently pin ROM identity/fullwindows and twelve branch lemmas', () => {
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
  assert.equal(map.size, 51);
  assert.equal(report.source_graph.code_bytes, 100);
  assert.equal(report.source_graph.instructions, 51);
  assert.equal(report.compare_gates.flatMap((p) => p.paths).length, 12);
});
test('AC/AE/B4/B6 originaltable WORDtargets and actual sharedfetch owners agree independently', async () => {
  for (const [opcode, source, target, hash] of [
    [0xac, 0x80f360, 0x80f852, '28b0830bb632c43f0ab5226888616301d842091a022a35ef92ed582c2ccf6163'],
    [0xae, 0x80f362, 0x80f86e, '35854a726df3bebc6686ed17ec3ecf9a240b6df39a8c22ea4a69dd57ed5ebd91'],
    [0xb4, 0x80f368, 0x80f88e, 'b2f0e7c67f7d996585ca590f613730c3d4084483f1300519ac186147a1d01302'],
    [0xb6, 0x80f36a, 0x80f8aa, '7f22fd5911841fb9cea80c0145b9371d29da1d1b69795298e1b5891ffc9847b8'],
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
test('AC firstleftLDA drives BPL, negativepath consumesright/stores0000 withoutCMP, positivepath rereadsleft', () => {
  at(0x80f852, 'LDA', 3, 'sr');
  at(0x80f854, 'BPL', 0x80f85f, 'rel8');
  at(0x80f856, 'PLA');
  at(0x80f857, 'LDA', 0, 'immM');
  at(0x80f85a, 'STA', 1, 'sr');
  at(0x80f85c, 'JMP', 0x80f389);
  at(0x80f85f, 'LDX', 0, 'immX');
  at(0x80f862, 'PLA');
  at(0x80f863, 'CMP', 1, 'sr');
  at(0x80f865, 'BEQ', 0x80f868, 'rel8');
  at(0x80f867, 'DEX');
  at(0x80f868, 'TXA');
  at(0x80f869, 'STA', 1, 'sr');
  const p = proveCompareGatesToDispatch(map, 0x80f852);
  assert.deepEqual(p, report.compare_gates[0]);
  assert.equal(p.gates[0].flag_origin, '80:F852');
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 14, 15],
  );
  assert.deepEqual(
    p.paths.map((p) => p.result),
    ['0000', '0000', 'FFFF'],
  );
  assert.deepEqual(p.paths[0].visited.slice(0, 6), [
    '80:F852',
    '80:F854',
    '80:F856',
    '80:F857',
    '80:F85A',
    '80:F85C',
  ]);
  assert.deepEqual(
    p.paths.map((p) => p.readable_operand_byte_accesses),
    [4, 6, 6],
  );
  assert.ok(p.paths[1].visited.includes('80:F863'));
});
test('B4 actualnegativeleft producesFFFF with noCMP; positivepath has BNE and equalityINXFFFF->0000', () => {
  at(0x80f88e, 'LDA', 3, 'sr');
  at(0x80f890, 'BPL', 0x80f89b, 'rel8');
  at(0x80f892, 'PLA');
  at(0x80f893, 'LDA', 65535, 'immM');
  at(0x80f896, 'STA', 1, 'sr');
  at(0x80f89b, 'LDX', 65535, 'immX');
  at(0x80f89e, 'PLA');
  at(0x80f89f, 'CMP', 1, 'sr');
  at(0x80f8a1, 'BNE', 0x80f8a4, 'rel8');
  at(0x80f8a3, 'INX');
  at(0x80f8a4, 'TXA');
  at(0x80f8a5, 'STA', 1, 'sr');
  const p = proveCompareGatesToDispatch(map, 0x80f88e);
  assert.deepEqual(p, report.compare_gates[2]);
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 15, 14],
  );
  assert.deepEqual(
    p.paths.map((p) => p.result),
    ['FFFF', '0000', 'FFFF'],
  );
  assert.equal(p.gates[1].flag_origin, '80:F89F');
  assert.ok(p.paths[1].visited.includes('80:F8A3'));
  assert.ok(!p.paths[2].visited.includes('80:F8A3'));
});
test('AE exactBEQ00 taken/fallthrough both reachDEX; nonnegative right alwaysFFFF even0==0', () => {
  at(0x80f86e, 'LDX', 0, 'immX');
  at(0x80f871, 'PLA');
  at(0x80f872, 'BMI', 0x80f879, 'rel8');
  at(0x80f874, 'CMP', 1, 'sr');
  const branch = at(0x80f876, 'BEQ', 0x80f878, 'rel8');
  assert.equal(branch.raw.toString('hex'), 'f000');
  assert.equal(branch.value, 0);
  assert.equal(branch.next, branch.target);
  at(0x80f878, 'DEX');
  at(0x80f879, 'TXA');
  at(0x80f87a, 'STA', 1, 'sr');
  const p = proveCompareGatesToDispatch(map, 0x80f86e);
  assert.deepEqual(p, report.compare_gates[1]);
  assert.equal(p.gates[0].flag_origin, '80:F871');
  assert.equal(p.gates[1].taken_equals_fallthrough, true);
  assert.deepEqual(p.paths[1].visited, p.paths[2].visited);
  assert.deepEqual(p.paths[1].branch_taken, [false, true]);
  assert.deepEqual(p.paths[2].branch_taken, [false, false]);
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 14, 14],
  );
  assert.deepEqual(
    p.paths.map((p) => p.result),
    ['0000', 'FFFF', 'FFFF'],
  );
  assert.deepEqual(equation(0x80f86e, { right: 0, leftCompareWord: 0 }), {
    value: 65535,
    carry: 1,
    left_compare_word_read: true,
  });
});
test('B6 BMI fromPLA bypassesleftCMP but stillTXA/STA; nonnegative equality clearsFFFF withINX', () => {
  at(0x80f8aa, 'LDX', 65535, 'immX');
  at(0x80f8ad, 'PLA');
  at(0x80f8ae, 'BMI', 0x80f8b5, 'rel8');
  at(0x80f8b0, 'CMP', 1, 'sr');
  at(0x80f8b2, 'BNE', 0x80f8b5, 'rel8');
  at(0x80f8b4, 'INX');
  at(0x80f8b5, 'TXA');
  at(0x80f8b6, 'STA', 1, 'sr');
  const p = proveCompareGatesToDispatch(map, 0x80f8aa);
  assert.deepEqual(p, report.compare_gates[3]);
  assert.equal(p.gates[0].flag_origin, '80:F8AD');
  assert.deepEqual(
    p.paths.map((p) => p.executed_instructions),
    [11, 14, 13],
  );
  assert.deepEqual(
    p.paths.map((p) => p.result),
    ['FFFF', '0000', 'FFFF'],
  );
  assert.equal(p.paths[0].required_readable_operand_stack_bytes, 2);
  assert.equal(p.paths[0].required_writable_operand_stack_bytes, 2);
  assert.ok(!p.paths[0].visited.includes('80:F8B0'));
  assert.ok(p.paths[0].visited.includes('80:F8B6'));
});
test('allWORD signgates usebit15 includinghighbyte; noCMP paths preserve bothCarryseeds withoutleftcompare', () => {
  for (let value = 0; value < 65536; value++)
    for (const entry of entries) {
      const leftGate = [0x80f852, 0x80f88e].includes(entry);
      for (const incomingCarry of [0, 1]) {
        const p = equation(entry, {
          leftGateWord: value,
          right: leftGate ? 1 : value,
          leftCompareWord: 1,
          incomingCarry,
        });
        const skipped = Math.floor(value / 32768) === 1;
        assert.equal(p.left_compare_word_read, !skipped);
        if (skipped)
          assert.deepEqual(
            equation(entry, {
              leftGateWord: value,
              right: leftGate ? 1 : value,
              leftCompareWord: undefined,
              incomingCarry,
            }),
            {
              value: entry === 0x80f852 || entry === 0x80f86e ? 0 : 65535,
              carry: incomingCarry,
              left_compare_word_read: false,
            },
          );
      }
    }
  assert.equal(equation(0x80f86e, { right: 0x100 }).value, 65535);
  assert.equal(equation(0x80f86e, { right: 0x8000 }).value, 0);
  assert.equal(equation(0x80f8aa, { right: 0x8000 }).value, 65535);
});
test('independent byteborrow covers allfreshleftWORDs and boundary/neighbor rightvalues on realCMP paths', () => {
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
      const borrow = (right % 256) - (left % 256) < 0 ? 1 : 0,
        carry = Math.floor(right / 256) - Math.floor(left / 256) - borrow < 0 ? 0 : 1;
      const equal =
        right % 256 === left % 256 && Math.floor(right / 256) === Math.floor(left / 256);
      for (const entry of entries) {
        const leftGate = [0x80f852, 0x80f88e].includes(entry),
          skipped = !leftGate && right >= 32768;
        const p = equation(entry, {
          leftGateWord: 0,
          leftCompareWord: left,
          right,
          incomingCarry: 0,
        });
        if (!skipped)
          assert.deepEqual(p, {
            value: entry === 0x80f86e || !equal ? 65535 : 0,
            carry,
            left_compare_word_read: true,
          });
      }
    }
});
test('AC/B4 gateWORD and freshCMPWORD are independentobservations; positivegate cannot cacheleft', () => {
  for (const entry of [0x80f852, 0x80f88e])
    for (const leftGateWord of [0, 0x100, 0x7fff]) {
      assert.deepEqual(equation(entry, { leftGateWord, right: 0, leftCompareWord: 0 }), {
        value: 0,
        carry: 1,
        left_compare_word_read: true,
      });
      assert.deepEqual(equation(entry, { leftGateWord, right: 0, leftCompareWord: 65535 }), {
        value: 65535,
        carry: 0,
        left_compare_word_read: true,
      });
      const p = own(entry, { leftGateWord, right: 0, leftCompareWord: 65535 });
      assert.deepEqual(p.stack_operations[0].bytes, p.stack_operations[2].bytes);
      assert.equal(p.context.leftGateWord, leftGateWord);
      assert.equal(p.context.leftCompareWord, 65535);
      assert.deepEqual(
        p.stack_operations.map((o) => [o.kind, o.s_delta, o.offset]),
        [
          ['read', 0, 3],
          ['read', 0, 1],
          ['read', 2, 1],
          ['write', 2, 1],
        ],
      );
    }
  assert.match(report.contract.left_gate, /not necessarily leftGateWORD/);
});
test('AE/B6 negative right omitleftreadowner but mandatoryleftwrite remains evenwithunmappedleft', () => {
  for (const entry of [0x80f86e, 0x80f8aa]) {
    const p = own(entry, { s: 0x1ffd, right: 0x8000, leftCompareWord: undefined });
    assert.equal(p.left_compare_word_read, false);
    assert.equal(p.stack_operations.length, 2);
    assert.ok(p.stack_operations[0].bytes.every((b) => b.physical_address !== null));
    assert.ok(p.stack_operations[1].bytes.every((b) => b.physical_address === null));
    assert.equal(p.stack_operations[1].kind, 'write');
    assert.deepEqual(addresses(p), [
      ['00:1FFE', '00:1FFF'],
      ['00:2000', '00:2001'],
    ]);
    assert.ok(!('leftCompareWord' in p.context));
  }
  for (const entry of [0x80f852, 0x80f88e])
    assert.equal(
      own(entry, { leftGateWord: 0x8000, leftCompareWord: undefined }).stack_operations.length,
      3,
    );
});
test('allS values preserveleftgate/rightpull/freshleftCMP/store chronology and bank00 bytewrap', () => {
  for (let s = 0; s < 65536; s++)
    for (const entry of entries)
      for (const skipped of [false, true]) {
        const leftGate = [0x80f852, 0x80f88e].includes(entry),
          p = own(entry, {
            s,
            leftGateWord: skipped ? 0x8000 : 0,
            right: !leftGate && skipped ? 0x8000 : 1,
          });
        const top = [(s + 1) % 65536, (s + 2) % 65536],
          left = [(s + 3) % 65536, (s + 4) % 65536];
        const pairs = [...(leftGate ? [left] : []), top, ...(!skipped ? [left] : []), left];
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
  assert.deepEqual(addresses(own(0x80f8aa, { s: 0xfffc })).at(-1), ['00:FFFF', '00:0000']);
});
test('all256 DBRs cannotredirect stack; Dpointerwrap/WORDfetch24bitcarry/Ywrap remainfresh', () => {
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
    own(0x80f86e, { bank: 255, y: 0, pointerAfter: 65535 }).next_opcode_sources.word_reads.map(
      (b) => b.address,
    ),
    ['FF:FFFF', '00:0000'],
  );
  assert.equal(own(0x80f88e, { y: 65535 }).frontier_y, 0);
});
test('mandatoryleft stores aliaspointer/control/opcodebytes onlybefore freshF389, includingnoCMP paths', () => {
  for (const entry of entries)
    for (const skipped of [false, true]) {
      const data = {
        leftGateWord: skipped ? 0x8000 : 0,
        right: skipped ? 0x8000 : 1,
        leftCompareWord: 2,
      };
      const pointerAfter = equation(entry, data).value,
        p = own(entry, { bank: 0x80, s: 0x3d3, pointerAfter, ...data });
      assert.deepEqual(
        p.stack_operations.at(-1).bytes.map((b) => b.physical_address),
        p.next_opcode_sources.pointer_reads.map((b) => b.physical_address),
      );
      assert.deepEqual(
        p.next_opcode_sources.word_reads.map((b) => b.address),
        pointerAfter === 0 ? ['80:0004', '80:0005'] : ['81:0003', '81:0004'],
      );
      const opcode = own(entry, { bank: 0x80, s: 0x3d3, d: 0x100, y: 0, pointerAfter: 0x3d6 });
      assert.deepEqual(
        opcode.stack_operations.at(-1).bytes.map((b) => b.physical_address),
        opcode.next_opcode_sources.word_reads.map((b) => b.physical_address),
      );
    }
  assert.deepEqual(addresses(own(0x80f852, { s: 0x3da })).at(-1), ['00:03DD', '00:03DE']);
  assert.match(report.contract.aliases, /OmittedleftCMP isnot omittedleftwrite/);
});
test('alllegalWORD statuses keepV/I/decimal, Carryfromactualpath, finalN0/Zfreshopcode nottruth', () => {
  assert.ok(
    ![...map.values()].some((i) =>
      ['ADC', 'SBC', 'CLD', 'SED', 'CLC', 'SEC', 'CLV', 'PHA'].includes(i.mnemonic),
    ),
  );
  for (let status = 0; status < 256; status++)
    if (!(status & 0x30))
      for (const entry of entries)
        for (const skipped of [false, true])
          for (const right0 of [0, 1, 0x7fff])
            for (const left of [0, 1, 0x8000, 65535])
              for (const low of [0, 1, 0x80, 0xff]) {
                const leftGate = [0x80f852, 0x80f88e].includes(entry),
                  right = !leftGate && skipped ? 0x8000 : right0;
                const c = equation(entry, {
                  leftGateWord: skipped ? 0x8000 : 0,
                  right,
                  leftCompareWord: left,
                  incomingCarry: status & 1,
                }).carry;
                const final = (status & ~0x83) | c | (low === 0 ? 2 : 0);
                assert.equal(final & 0x4c, status & 0x4c);
                assert.equal(final & 1, skipped ? status & 1 : right < left ? 0 : 1);
                assert.equal(final & 0x80, 0);
                assert.equal(Boolean(final & 2), low === 0);
              }
  assert.ok(report.compare_gates.every((p) => p.decimal_flag_required === null));
});
test('everyfinite path has fulloperandreads thenbothstores thenfreshWORDfetch/INY/unscaledJMP', () => {
  at(0x80f389, 'LDA', 0, 'diy');
  at(0x80f38b, 'INY');
  at(0x80f38c, 'AND', 255, 'immM');
  at(0x80f38f, 'TAX');
  at(0x80f390, 'JMP', 0xf2b4, 'indx');
  for (const p of report.compare_gates)
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
      assert.equal(p.y_delta_before_next_opcode, 0);
      assert.equal(p.y_delta_at_frontier, 1);
      assert.equal(path.required_writable_operand_stack_bytes, 2);
      assert.equal(p.frontier.x, 'Fresh next-opcode lowbyte');
    }
  assert.match(report.contract.fetch, /includingignoredhigh/);
  assert.equal([...map.values()].filter((i) => i.mnemonic === 'INY').length, 1);
});
test('sourcelemmas rejectevery missing/raw/width/mode/value/target/stack/edge mutation includingBEQ00 correction', () => {
  for (const entry of entries) {
    const [, , end] = windows.find((w) => w[1] === entry),
      local = new Map(
        [...map].filter(([pc]) => (pc >= entry && pc < end) || (pc >= 0x80f389 && pc < 0x80f393)),
      );
    assert.deepEqual(
      proveCompareGatesToDispatch(local, entry),
      proveCompareGatesToDispatch(map, entry),
    );
    for (const [pc, i] of local) {
      const missing = new Map(local);
      missing.delete(pc);
      assert.throws(() => proveCompareGatesToDispatch(missing, entry));
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
        assert.throws(() => proveCompareGatesToDispatch(m, entry));
      }
    }
  }
  for (const [entry, pc, patch] of [
    [0x80f86e, 0x80f876, { raw: Buffer.from('F001', 'hex'), value: 1, target: 0x80f879 }],
    [0x80f852, 0x80f852, { value: 1 }],
    [0x80f88e, 0x80f890, { mnemonic: 'BMI' }],
    [0x80f8aa, 0x80f8ae, { mnemonic: 'BPL' }],
    [0x80f86e, 0x80f872, { target: 0x80f87a }],
    [0x80f852, 0x80f865, { mnemonic: 'BNE' }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveCompareGatesToDispatch(m, entry));
  }
  assert.throws(() => proveCompareGatesToDispatch(map, 0x80f843), /Invalid/);
});
test('missingread/address/gate/Carry values failclosed butunreadleftCMP isnot fabricated onnegativepaths', () => {
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
    assert.throws(() => own(0x80f852, patch), /Explicit/);
  for (const value of [-1, 65536, null, undefined]) {
    assert.throws(() => equation(0x80f852, { leftGateWord: value }), /WORD/);
    assert.throws(() => equation(0x80f86e, { right: value }), /WORD/);
    assert.throws(() => equation(0x80f8aa, { leftCompareWord: value }), /WORD/);
  }
  for (const entry of entries)
    for (const incomingCarry of [-1, 2, null, undefined])
      assert.throws(
        () =>
          equation(entry, {
            leftGateWord: 0x8000,
            right: 0x8000,
            incomingCarry,
            leftCompareWord: undefined,
          }),
        /Carry/,
      );
  for (const entry of entries)
    assert.equal(
      equation(entry, { leftGateWord: 0x8000, right: 0x8000, leftCompareWord: undefined })
        .left_compare_word_read,
      false,
    );
  assert.throws(() => equation(0x80f843), /Invalid/);
  assert.throws(() => own(0x80f843), /Invalid/);
  const b = own(0x80f852, { s: 0x7ffd }).stack_operations.at(-1).bytes[0];
  assert.equal(b.address, '00:8000');
  assert.equal(b.physical_address, '80:8000');
  assert.match(own(0x80f8aa).qualification, /not an owner/);
  assert.ok(
    report.synthetic_address_examples.every((p) =>
      p.qualification.includes('No memory read/write'),
    ),
  );
});
test('host opcodesremainunsupported/noeffect and C1CA/9178/central do notpromote native/globalstack', async () => {
  for (const op of [0xac, 0xae, 0xb4, 0xb6]) {
    assert.ok(!executableOpcodes.includes(op));
    const frame = compileScriptFrame([op, 0x56], { localBytes: 0, returnBytes: 2 })([0xcafe, 0, 1]);
    const before = frame.snapshot();
    assert.throws(() => frame.step(), /is not implemented/);
    assert.deepEqual(frame.snapshot(), before);
  }
  const [visit, text, progress] = await Promise.all(
    ['analysis/render-c1ca.json', 'analysis/render-9178.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  const supplied = visit.full_graph.supplied_opcode_sources.find(
    (s) => s.source === 'analysis/render-task-compare-gates.json',
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
  const group = progress.work_groups.find((g) => g.id === 'task-f378-compare-gates');
  assert.equal(group.status, 'composition-required');
  assert.deepEqual(group.manual_native, {
    module: 'proof/task/compare-gates.mjs',
    report: 'analysis/render-task-compare-gates-native.json',
  });
  assert.ok(
    !progress.supplied.some((r) =>
      [...entries.map(cpuLabel), '80:C1CA', '80:9178'].includes(r.entry),
    ),
  );
});
