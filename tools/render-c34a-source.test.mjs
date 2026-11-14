import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { proveAppendC34AStack } from './render-c34a-stack-proof.mjs';
import { createTaskHeap, scriptAllocationBytes } from '../proof/script/task-heap.mjs';
import { createTaskFrameProfiles, createTaskFrameAllocator } from '../proof/script/task-frames.mjs';
const { bytes: rom, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
const report = JSON.parse(await readFile('analysis/render-c34a.json', 'utf8'));
const asset = JSON.parse(await readFile('assets/task-frame-profiles.json', 'utf8'));
const sha = (b) => createHash('sha256').update(b).digest('hex');
const windows = [
  [
    'appendC34A',
    0x80c34a,
    0x80c366,
    11,
    '9956f7144b0b6c29202dfa6667fac828e926c950132c1b4522d09c1d59b0265f',
  ],
  [
    'frameC2C8',
    0x80c2c8,
    0x80c34a,
    60,
    'e9f2a9a5a4b317ea2d076eee17e6883b35a05d966bcf4f7f9907530baff8344e',
  ],
  [
    'heapC242',
    0x80c242,
    0x80c2bd,
    53,
    '6bf1fae9c69fbab5cb597544d4efd385798e067f04d013fe4fd1e2ea259b47e5',
  ],
  [
    'caller9178',
    0x8091ca,
    0x8091d7,
    6,
    'd4dca53217b1ba30172076bbd8998c7b23c7b960aa151f4103114b3f3cac970c',
  ],
  [
    'initializeC1A6',
    0x80c1a6,
    0x80c1ca,
    15,
    '996febbca5528e9c3647defb69337680f7de8649876ec834ee5af7a47b5510f3',
  ],
];
const all = new Map(),
  map = new Map();
// Fixed independent BYTE incoming interval, rather than report/proof modes.
for (const [name, start, end] of windows)
  for (let pc = start; pc < end;) {
    const i = decode(rom, pc, { e: 0, m: Number(pc >= 0x80c2e6 && pc < 0x80c2f2), x: 0 });
    assert.ok(i.next <= end);
    all.set(pc, i);
    if (!['caller9178', 'initializeC1A6'].includes(name)) map.set(pc, i);
    pc = i.next;
  }
const at = (pc, op, value, mode) => {
  const i = all.get(pc);
  assert.ok(i, cpuLabel(pc));
  assert.equal(i.mnemonic, op, cpuLabel(pc));
  if (value !== undefined) assert.equal(i.target ?? i.value, value, cpuLabel(pc));
  if (mode !== undefined) assert.equal(i.mode, mode, cpuLabel(pc));
  return i;
};
const abs = (bank, base, index = 0) => (bank * 65536 + base + index) & 0xffffff;
const word = (pc) => rom.readUInt16LE(cpuToOffset(pc, rom.length));
// Numeric examples are static arithmetic consequences or explicit host data;
// no machine executor, real9178 fixture, scene or device observation.

test('C34A complete281/124 graph, caller and initialization have independent ROM hashes and decode boundaries', () => {
  assert.equal(
    metadata.rom_sha256,
    '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',
  );
  assert.equal(report.rom_sha256, metadata.rom_sha256);
  for (const [name, start, end, count, hash] of windows) {
    const raw = rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(end, rom.length));
    assert.equal(sha(raw), hash);
    assert.equal([...all.keys()].filter((pc) => pc >= start && pc < end).length, count);
    assert.deepEqual(
      [...report.windows, ...report.excerpts].find((w) => w.name === name),
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
  assert.equal(map.size, 124);
  assert.equal(
    [...map.values()].reduce((n, i) => n + i.raw.length, 0),
    281,
  );
  assert.equal(report.full_graph.code_bytes, 281);
  assert.equal(report.full_graph.instructions, 124);
});

test('complete graph agrees with every separately owned older task/heap slice without assumed after-call returns', async () => {
  for (const d of report.dependencies) {
    const owner = JSON.parse(await readFile(d.report, 'utf8'));
    assert.equal(owner.rom_sha256, metadata.rom_sha256);
    for (const w of d.source_blocks) {
      assert.ok(owner.source_blocks.some((v) => JSON.stringify(v) === JSON.stringify(w)));
      let pc = parseInt(w.entry, 16),
        raw = '';
      while (raw.length < w.machine_bytes.length) {
        const i = all.get(pc);
        assert.ok(i);
        raw += i.raw.toString('hex').toUpperCase();
        pc = i.next;
      }
      assert.equal(raw, w.machine_bytes);
    }
  }
  assert.deepEqual(
    report.local.map((w) => w.calls),
    [[{ from: '80:C34A', to: '80:C2C8' }], [{ from: '80:C2F5', to: '80:C242' }], []],
  );
});

test('all937 original WORD bank/argument sources include last highbyte; exact pointers and BYTE headers match host profiles', () => {
  for (const [name, start, length, hash] of [
    [
      'bankWordSource',
      0x82db28,
      938,
      '3feef7f7fc072d9095201ac7a4d46505f4dd64b4ab3aabd14a234f457aeb1dc3',
    ],
    [
      'pointerWords',
      0x82ded1,
      1874,
      'd3e1eace6d49a9b2c9e993c8a38c03625f91637b3c66929ea65af647b5b114ea',
    ],
    [
      'argumentWordSource',
      0x82e9cc,
      938,
      'da5a511fc78b9b3dd10a686104d03222a46124857fb2200d3269e637022c599b',
    ],
  ]) {
    const off = cpuToOffset(start, rom.length),
      raw = rom.subarray(off, off + length);
    assert.equal(sha(raw), hash);
    assert.deepEqual(
      report.profile_source.tables.find((t) => t.name === name),
      {
        name,
        entry: cpuLabel(start),
        covered_bytes: length,
        sha256: hash,
        machine_bytes: raw.toString('hex').toUpperCase(),
      },
    );
  }
  const headers = [];
  assert.equal(asset.profiles.length, 937);
  for (let id = 0; id < 937; id++) {
    const p = asset.profiles[id],
      bankWord = word(0x82db28 + id),
      headerAddress = word(0x82ded1 + id * 2),
      argumentBytes = word(0x82e9cc + id) & 255;
    const cpu = (bankWord & 255) * 65536 + headerAddress,
      off = cpuToOffset(cpu, rom.length);
    assert.deepEqual(p, {
      id,
      headerAddress,
      bankWord,
      localBytes: rom[off],
      stackHeaderBytes: rom[off + 1],
      argumentBytes,
    });
    headers.push({
      id,
      entry: cpuLabel(cpu),
      machine_bytes: rom
        .subarray(off, off + 2)
        .toString('hex')
        .toUpperCase(),
    });
  }
  assert.equal(
    sha(JSON.stringify(headers)),
    'f4ce917203d1fc314c3f4ef1f8b6ea0322557ad08a22fd4f1ef96515538685bc',
  );
  assert.equal(report.profile_source.headers_sha256, sha(JSON.stringify(headers)));
});

test('actual9178 caller reloads actionWORD and only first workspaceWORD before append then dynamicvisit', () => {
  for (const [pc, op, value, mode] of [
    [0x8091ca, 'LDA', 0x11, 'dily'],
    [0x8091cc, 'TAX'],
    [0x8091cd, 'LDA', 0x26, 'dp'],
    [0x8091cf, 'STA', 0, 'dp'],
    [0x8091d1, 'JSR', 0x80c34a],
    [0x8091d4, 'JSR', 0x80c1ca],
  ])
    at(pc, op, value, mode);
  assert.deepEqual(
    [...all.values()]
      .filter((i) => i.cpu >= 0x8091ca && i.cpu < 0x8091d7 && i.mnemonic === 'STA')
      .map((i) => i.value),
    [0],
  );
  assert.ok(![...map.values()].some((i) => i.target === 0x80c1ca));
});

test('C2C8 uses full incomingX for WORD table reads, full doubledWORD pointerindex and fresh long headerpointer', () => {
  for (const [pc, op, value, mode] of [
    [0x80c2c8, 'LDA', 0x82db28, 'longx'],
    [0x80c2cc, 'STA', 0x73, 'dp'],
    [0x80c2ce, 'LDA', 0x82e9cc, 'longx'],
    [0x80c2d2, 'AND', 255],
    [0x80c2d5, 'STA', 0x248, 'abs'],
    [0x80c2d8, 'TXA'],
    [0x80c2d9, 'ASL'],
    [0x80c2da, 'TAX'],
    [0x80c2db, 'LDA', 0x82ded1, 'longx'],
    [0x80c2df, 'STA', 0x71, 'dp'],
    [0x80c2e7, 'LDA', 0x71, 'dil'],
    [0x80c2ec, 'ADC', 0x71, 'dily'],
  ])
    at(pc, op, value, mode);
  for (let x = 0; x < 65536; x++) {
    assert.equal((x << 1) & 65535, (x * 2) % 65536);
    assert.equal(abs(0x82, 0xdb28, x), 0x82db28 + x);
  }
  assert.equal(abs(0x82, 0xdb28, 65535), 0x83db27);
  assert.equal((0x8000 * 2) & 65535, 0);
  assert.equal(at(0x80c2ce, 'LDA').state.m, 0);
  assert.equal(at(0x80c2ec, 'ADC').state.m, 1);
});

test('all65536 header pairs retain first BYTE carry and zero HighA across REP; no WORD-size inference', () => {
  at(0x80c2e1, 'LDA', 0);
  at(0x80c2e4, 'SEP', 32);
  at(0x80c2e6, 'CLC');
  at(0x80c2e9, 'LDY', 1);
  at(0x80c2ee, 'ADC', 0x17);
  at(0x80c2f0, 'REP', 32);
  at(0x80c2f2, 'STA', 0x246);
  at(0x80c2f5, 'JSR', 0x80c242);
  for (let first = 0; first < 256; first++)
    for (let second = 0; second < 256; second++) {
      const sum = first + second,
        low = sum % 256,
        carry = Number(sum >= 256);
      assert.equal(
        scriptAllocationBytes({ localBytes: first, stackHeaderBytes: second }),
        (low + 23 + carry) % 256,
      );
    }
  assert.equal(scriptAllocationBytes({ localBytes: 255, stackHeaderBytes: 1 }), 24);
  assert.equal(scriptAllocationBytes({ localBytes: 232, stackHeaderBytes: 1 }), 0);
});

test('C242 real signed block scan, unsigned fit and exact splitthreshold have no slot or request clamp', () => {
  for (const [pc, op, value] of [
    [0x80c242, 'STA', 0x24a],
    [0x80c245, 'LDX', 0],
    [0x80c248, 'LDA', 0x3d2],
    [0x80c24b, 'BPL', 0x80c255],
    [0x80c24d, 'LDA', 0x3d4],
    [0x80c250, 'BEQ', 0x80c2bc],
    [0x80c255, 'SEC'],
    [0x80c256, 'SBC', 0x24a],
    [0x80c259, 'BCS', 0x80c279],
    [0x80c279, 'CMP', 5],
    [0x80c27c, 'BCC', 0x80c2ae],
    [0x80c2ae, 'LDA', 0x3d2],
    [0x80c2b1, 'ORA', 0x8000],
    [0x80c2b7, 'CLC'],
    [0x80c2b9, 'ADC', 0x3d6],
  ])
    at(pc, op, value);
  for (let size = 0; size < 32768; size++)
    for (const request of [0, 1, size, size + 1, 65535]) {
      const carry = size >= request;
      assert.equal(carry, size - request >= 0);
      if (carry) assert.equal(size - request < 5, size - request <= 4);
    }
  assert.deepEqual(report.local[2].returns, ['80:C2AD', '80:C2BC']);
});

test('heap coalescing consumes failedSBC carry0, split saves/restores actual nextWORD and keeps sequential carry', () => {
  for (const [pc, op, value] of [
    [0x80c25b, 'LDY', 0x3d4],
    [0x80c25e, 'BEQ', 0x80c2bc],
    [0x80c260, 'LDA', 0x3d2],
    [0x80c263, 'BMI', 0x80c24d],
    [0x80c265, 'ADC', 0x3d2],
    [0x80c268, 'ADC', 4],
    [0x80c26b, 'STA', 0x3d2],
    [0x80c26e, 'LDA', 0x3d4],
    [0x80c271, 'STA', 0x3d4],
    [0x80c277, 'BRA', 0x80c255],
    [0x80c27e, 'LDA', 0x3d4],
    [0x80c281, 'PHA'],
    [0x80c282, 'CLC'],
    [0x80c284, 'ADC', 0x24a],
    [0x80c287, 'ADC', 4],
    [0x80c28a, 'STA', 0x3d4],
    [0x80c28f, 'LDA', 0x3d2],
    [0x80c292, 'SBC', 0x24a],
    [0x80c295, 'SBC', 4],
    [0x80c298, 'STA', 0x3d2],
    [0x80c29b, 'PLA'],
    [0x80c29c, 'STA', 0x3d4],
  ])
    at(pc, op, value);
  assert.equal((100 + 300 + 4) & 65535, 404);
  for (let base = 0; base < 65536; base++)
    for (const request of [0, 1, 255]) {
      const first = base + request,
        next = ((first & 65535) + 4 + Number(first > 65535)) & 65535;
      assert.equal(next, ((first % 65536) + 4 + Math.floor(first / 65536)) % 65536);
    }
});

test('both actual allocator failureAs continue at C2F8 without successguard; prior merges remain in host boundary', () => {
  at(0x80c2f8, 'STA', 0x74, 'dp');
  at(0x80c2fa, 'CLC');
  at(0x80c2fb, 'ADC', 17);
  at(0x80c301, 'STA', 0x74, 'diy');
  assert.equal(map.get(0x80c2f5).next, 0x80c2f8);
  const heap = createTaskHeap();
  heap.allocate(0x07cc);
  assert.deepEqual(heap.allocate(1), { allocated: false, accumulatorWord: 0, blockOffset: 0 });
  const fresh = createTaskHeap();
  assert.equal(fresh.allocate(0x07cd).accumulatorWord, 65535);
  const merged = createTaskHeap();
  const a = merged.allocate(30),
    b = merged.allocate(40);
  merged.allocate(0x077e);
  merged.release(a.blockOffset);
  merged.release(b.blockOffset);
  const failed = merged.allocate(0x07cc);
  assert.equal(failed.allocated, false);
  assert.equal(merged.snapshot().headers[0].sizeWord, 74);
  assert.match(report.contract.exhaustion, /does not exit/);
});

test('frame metadata uses fresh pointers, retained C305 carry and real overlapping DP73/74 and payload3/4', () => {
  for (const [pc, op, value, mode] of [
    [0x80c2f8, 'STA', 0x74, 'dp'],
    [0x80c2fe, 'LDY', 5],
    [0x80c301, 'STA', 0x74, 'diy'],
    [0x80c303, 'LDA', 0x74, 'dp'],
    [0x80c305, 'ADC', 0x246, 'abs'],
    [0x80c308, 'DEC'],
    [0x80c309, 'LDY', 0x248],
    [0x80c31b, 'LDY', 7],
    [0x80c31e, 'STA', 0x74, 'diy'],
    [0x80c320, 'LDA', 0x71],
    [0x80c322, 'INC'],
    [0x80c323, 'INC'],
    [0x80c324, 'STA', 0x74, 'di'],
    [0x80c326, 'LDY', 2],
    [0x80c329, 'LDA', 0x73],
    [0x80c32b, 'STA', 0x74, 'diy'],
    [0x80c32d, 'INY'],
    [0x80c32e, 'LDA', 0],
    [0x80c331, 'STA', 0x74, 'diy'],
  ])
    at(pc, op, value, mode);
  const bytes = new Map([
    [0x73, 0x9d],
    [0x74, 0x9e],
  ]);
  bytes.set(0x74, 0xd6);
  bytes.set(0x75, 3);
  assert.equal(bytes.get(0x73) | (bytes.get(0x74) << 8), 0xd69d);
  const frame = new Map([
    [2, 0x9d],
    [3, 0xd6],
  ]);
  frame.set(3, 0);
  frame.set(4, 0);
  assert.equal(frame.get(2), 0x9d);
  assert.equal(frame.get(3), 0);
  assert.equal(((0xffff + 23 + 1) & 65535) - 1, 22); // fresh B plus size with carry from B+17, then DEC
});

test('argument loop has fullWORD X/Y, evencount/2 copies and all odd BYTE counts never reachzero', () => {
  for (const [pc, op, value, mode] of [
    [0x80c30c, 'BEQ', 0x80c31b],
    [0x80c30e, 'TAX'],
    [0x80c30f, 'LDA', 0xfffe, 'absy'],
    [0x80c312, 'DEX'],
    [0x80c313, 'STA', 0, 'dpx'],
    [0x80c315, 'DEX'],
    [0x80c316, 'DEY'],
    [0x80c317, 'DEY'],
    [0x80c318, 'BNE', 0x80c30f],
    [0x80c31a, 'TXA'],
  ])
    at(pc, op, value, mode);
  for (let count = 0; count < 256; count++) {
    if (count & 1) {
      for (let n = 0; n < 32768; n++) assert.notEqual((count - 2 * n) & 65535, 0);
    } else for (let n = 0; n < count / 2; n++) assert.equal((count - 2 * n) & 65535, count - 2 * n);
  }
  for (let bank = 0; bank < 256; bank++) {
    assert.equal(abs(bank, 0xfffe, 2), ((bank + 1) & 255) * 65536);
    assert.equal(abs(bank, 0xfffe, 16), ((bank + 1) & 255) * 65536 + 14);
  }
  assert.equal(abs(0x7e, 0xfffe, 2), 0x7f0000);
  assert.equal(abs(0x80, 0xfffe, 2), 0x810000);
  assert.equal((0xffff + 0) & 65535, 65535); // STA dp00,X stays bank00, unlike DBR argument read
  assert.match(report.contract.host_boundary, /only oneWORD/);
});

test('free-slot guard is after framewrites and accepts any nonnegative WORD without parity/cap checks', () => {
  for (const [pc, op, value] of [
    [0x80c333, 'LDX', 0x24e],
    [0x80c336, 'BMI', 0x80c349],
    [0x80c338, 'STZ', 0x2b2],
    [0x80c33b, 'STZ', 0xba2],
    [0x80c33e, 'LDA', 0x312],
    [0x80c341, 'STA', 0x24e],
    [0x80c344, 'LDA', 0x74],
    [0x80c346, 'STA', 0x252],
  ])
    at(pc, op, value);
  assert.ok(map.get(0x80c331).next === 0x80c333);
  for (let head = 0; head < 65536; head++) assert.equal(Boolean(head & 0x8000), head >= 32768);
  assert.equal(report.frame_graph.proof.returns[0].at, '80:C349');
});

test('C34A always appends actual returnedX including negativehead with fresh tail and bank carry', () => {
  for (const [pc, op, value] of [
    [0x80c34a, 'JSR', 0x80c2c8],
    [0x80c34d, 'LDA', 0x24c],
    [0x80c350, 'STA', 0x312],
    [0x80c353, 'LDA', 65535],
    [0x80c356, 'STA', 0x372],
    [0x80c359, 'TXA'],
    [0x80c35a, 'LDX', 0x24c],
    [0x80c35d, 'BMI', 0x80c362],
    [0x80c35f, 'STA', 0x372],
    [0x80c362, 'STA', 0x24c],
    [0x80c365, 'RTS'],
  ])
    at(pc, op, value);
  for (let bank = 0; bank < 256; bank++)
    for (const offset of [0, 0x5e, 0x8000, 0xffff])
      for (const col of [0x312, 0x372])
        assert.equal(abs(bank, col, offset), (bank * 65536 + col + offset) % 0x1000000);
  assert.equal(abs(0x80, 0x312, 0xffff), 0x810311);
  assert.equal(abs(0x7e, 0x372, 0xffff), 0x7f0371);
  assert.ok(
    ![...map.values()]
      .filter((i) => i.cpu >= 0x80c34a)
      .some((i) => i.mnemonic === 'STA' && [0, 0x250, 0xc62].includes(i.value)),
  );
});

test('existing host allocator keeps explicit heap/slot/missingargument boundaries and no implicit9178 machine call', () => {
  const profileData = createTaskFrameProfiles(asset),
    heap = createTaskHeap();
  heap.allocate(0x07cc);
  const zero = asset.profiles.find((p) => p.argumentBytes === 0).id;
  const failed = createTaskFrameAllocator({ profileData, heap }).createFrame(zero, []);
  assert.equal(failed.reason, 'task_heap_failure_continuation_required');
  const allocator = createTaskFrameAllocator({ profileData });
  for (let n = 0; n < 48; n++) {
    const created = allocator.createFrame(zero, []);
    assert.equal(created.created, true);
    assert.equal(created.taskOffset, n * 2);
    allocator.appendRoot(created.taskOffset);
  }
  const slotFailed = allocator.createFrame(zero, []);
  assert.equal(slotFailed.reason, 'task_slot_failure_continuation_required');
  assert.deepEqual(slotFailed.originalReturn, { accumulatorWord: 0, indexWord: 65535 });
  assert.ok(slotFailed.frame.payload.available);
  assert.equal(allocator.snapshot().activeOrder.length, 48);
  const empty = createTaskFrameAllocator({ profileData });
  assert.equal(empty.createFrame(0x197, []).reason, 'task_argument_source_required');
  assert.equal(empty.createFrame(937, []).reason, 'task_profile_source_required');
});

test('actual fixed-callee proof visits124 instructions and needs8/6/4 stackbytes with WORDPHA split witness', () => {
  for (const [entry, key, stack, visited] of [
    [0x80c34a, 'full_graph', 8, 124],
    [0x80c2c8, 'frame_graph', 6, 113],
    [0x80c242, 'heap_graph', 4, 53],
  ]) {
    const p = proveAppendC34AStack(map, entry);
    assert.deepEqual(p, report[key].proof);
    assert.equal(p.minimum_protected_stack_bytes, stack);
    assert.equal(p.reachable_instructions, visited);
    assert.equal(p.external_return_assumptions, 0);
    assert.deepEqual(p.excluded_boundaries, []);
    assert.equal(p.maximum_stack_witness.at, '80:C281');
    assert.equal(p.maximum_stack_witness.data_bytes, 2);
    for (const w of p.mode_windows)
      for (
        let pc = parseInt(w.entry.replace(':', ''), 16);
        pc < parseInt(w.end_exclusive.replace(':', ''), 16);
      ) {
        const i = map.get(pc);
        assert.equal(i.state.m, w.m);
        assert.equal(i.state.x, 0);
        pc = i.next;
      }
  }
});

test('proof rejects missing actual helpers and every stack/status/DBR/control/width mutation at the boundary', () => {
  for (const pc of [0x80c2c8, 0x80c242, 0x80c281, 0x80c29b, 0x80c2f8, 0x80c349, 0x80c365]) {
    const m = new Map(map);
    m.delete(pc);
    assert.throws(() => proveAppendC34AStack(m));
  }
  for (const [pc, patch] of [
    [0x80c34a, { target: 0x80c1ca }],
    [0x80c2e1, { value: 1 }],
    [0x80c2e4, { value: 16 }],
    [0x80c2f0, { mnemonic: 'NOP' }],
    [0x80c281, { mnemonic: 'PHP' }],
    [0x80c29b, { mnemonic: 'NOP' }],
    [0x80c2c8, { state: { e: 0, m: 1, x: 0 } }],
    [0x80c2e9, { length: 2 }],
    [0x80c2bc, { mnemonic: 'RTL' }],
    [0x80c365, { mnemonic: 'RTI' }],
    [0x80c350, { mnemonic: 'PLB' }],
    [0x80c24b, { target: 0x80c1ca }],
  ]) {
    const m = new Map(map);
    m.set(pc, { ...m.get(pc), ...patch });
    assert.throws(() => proveAppendC34AStack(m));
  }
  assert.throws(() => proveAppendC34AStack(map, 0x809178), /Invalid/);
});

test('central native C34A append evidence stays separate from unfinished dynamicvisit and full9178 stack/native', async () => {
  const [text, parent, progress] = await Promise.all(
    ['analysis/render-9178.json', 'analysis/render-bf3b.json', 'docs/PORTIERUNGSSTAND.json'].map(
      async (p) => JSON.parse(await readFile(p, 'utf8')),
    ),
  );
  assert.equal(report.full_graph.closed, true);
  assert.equal(report.full_graph.native_binding, false);
  assert.equal(report.full_graph.actual_termination_proven, false);
  assert.equal(text.full_graph.closed, false);
  assert.equal(text.full_graph.minimum_protected_stack_bytes, null);
  assert.deepEqual(text.full_graph.unresolved_nested_callees, ['80:C1CA']);
  assert.deepEqual(
    text.full_graph.supplied_source_nested_callees.map((c) => c.entry),
    ['80:C34A'],
  );
  assert.ok(parent.full_graph.unresolved_nested_callees.includes('80:9178'));
  assert.ok(!parent.full_graph.supplied_source_nested_callees.some((c) => c.entry === '80:9178'));
  const append = progress.work_groups.find((g) => g.id === 'task-c34a-9178');
  assert.equal(append.status, 'composition-required');
  assert.equal(append.source_contract, 'analysis/render-task-append-c34a.json');
  assert.equal(append.manual_native.module, 'proof/task/append-c34a.mjs');
  const source = JSON.parse(await readFile(append.source_contract, 'utf8')),
    native = JSON.parse(await readFile(append.manual_native.report, 'utf8'));
  assert.equal(source.source_graph.full_graph_closed, true);
  assert.equal(source.source_graph.code_bytes, report.full_graph.code_bytes);
  assert.equal(source.proofs[0].entry, '80:C34A');
  assert.equal(source.proofs[0].minimum_protected_stack_bytes, 8);
  assert.equal(source.proofs[0].external_return_assumptions, 0);
  assert.equal(native.native_binding, true);
  assert.equal(native.full_task_binding, false);
  assert.equal(native.bindings[0].source_contract, append.source_contract);
  assert.deepEqual(native.bindings[0].source_proof, source.proofs[0]);
  const visit = progress.work_groups.find((g) => g.id === 'task-visit-c1ca');
  assert.equal(visit.status, 'composition-required');
  assert.equal(visit.source_contract, 'analysis/render-task-visit.json');
  assert.equal(visit.manual_native.module, 'proof/task/visit-c1ca.mjs');
  assert.ok(!progress.supplied.some((r) => r.entry === '80:C34A' || r.entry === '80:9178'));
});
