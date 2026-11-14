import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inspectRom, cpuToOffset, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import {
  proveStateSignToDispatch,
  stateSignConsequence,
  describeStateSignOwners,
} from './render-task-state-sign-extension-source-proof.mjs';
import { compileScriptFrame, executableOpcodes } from '../proof/script/runtime.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc')),
  r = JSON.parse(await readFile('analysis/render-task-state-sign-extension.json', 'utf8')),
  map = new Map();
for (const [start, end] of [
  [0x80f90f, 0x80f927],
  [0x80f389, 0x80f393],
])
  for (let pc = start; pc < end;) {
    const i = decode(bytes, pc, { e: 0, m: 0, x: 0 });
    map.set(pc, i);
    pc = i.next;
  }
const ctx = {
  d: 0x3d6,
  bank: 0x80,
  s: 0x3f0,
  y: 4,
  pointerBefore: 0x1200,
  pointerAfter: 0x1200,
  offsetWord: 1,
  stateWord: 0xab80,
};
test('0E independently pins ROM/body/table/fetch andno native/globalstack promotion', () => {
  assert.equal(
    metadata.rom_sha256,
    '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690',
  );
  for (const [pc, size, hash] of [
    [0x80f90f, 24, '6a814b87cb34b4e59bf3afc696020d3e62f1b790c7f29dac90f979d6de8c112e'],
    [0x80f389, 10, '4c3f34f823702042ca64c29aeb6edbae702c6dfe3735c436921cd418d83c81cf'],
  ]) {
    const off = cpuToOffset(pc, bytes.length);
    assert.equal(
      createHash('sha256')
        .update(bytes.subarray(off, off + size))
        .digest('hex'),
      hash,
    );
  }
  assert.equal(bytes.readUInt16LE(cpuToOffset(0x80f2c2, bytes.length)), 0xf90f);
  assert.deepEqual(proveStateSignToDispatch(map), r.proofs[0]);
  assert.equal(r.source_graph.full_graph_closed, false);
  assert.equal(r.source_graph.native_binding, false);
});
test('independent taken/fallthrough ROMpaths skiponlyORA anddeliver15/16 instructions', () => {
  for (const take of [true, false]) {
    let pc = 0x80f90f;
    const path = [];
    while (true) {
      const i = map.get(pc);
      assert.ok(i);
      assert.ok(!path.includes(pc));
      path.push(pc);
      if (pc === 0x80f390) break;
      pc =
        i.mnemonic === 'BCC'
          ? take
            ? i.target
            : i.next
          : i.mnemonic === 'JMP'
            ? i.target
            : i.next;
    }
    assert.deepEqual(path.map(cpuLabel), r.proofs[0].paths[take ? 0 : 1].visited);
    assert.equal(path.includes(0x80f920), !take);
    assert.equal(path.length, take ? 15 : 16);
  }
});
test('allStateWORDs maskHigh thenCMP low, Carry/NZ independentofentryCarry/decimal', () => {
  for (let v = 0; v < 65536; v++) {
    const c = stateSignConsequence({ offsetWord: 65535, stateWord: v }),
      low = v % 256,
      signed = low < 128 ? low : low - 256;
    assert.equal(c.value, (signed + 65536) % 65536);
    assert.equal(c.carry, Number(signed < 0));
    assert.equal(c.n_before_push, 1);
    assert.equal(c.z_before_push, 0);
    assert.equal(c.index, 65535);
  }
  assert.equal(stateSignConsequence({ offsetWord: 1, stateWord: 0 }).value, 0);
});
test('alloffsetWORDs retainfullStateindex andHigh7F0000, signPHA bytes usefullsourceLow', () => {
  for (let offsetWord = 0; offsetWord < 65536; offsetWord++) {
    const p = describeStateSignOwners({ ...ctx, offsetWord });
    assert.equal(p.index, offsetWord);
    assert.deepEqual(
      p.state_sources.word_reads.map((b) => b.address),
      [cpuLabel(0x7e0000 + offsetWord), cpuLabel(0x7e0001 + offsetWord)],
    );
    assert.deepEqual(
      p.stack_writes.map((b) => b.value),
      [255, 128],
    );
  }
  const p = describeStateSignOwners({ ...ctx, offsetWord: 65535, stateWord: 0xab7f });
  assert.deepEqual(
    p.state_sources.word_reads.map((b) => b.address),
    ['7E:FFFF', '7F:0000'],
  );
  assert.deepEqual(
    p.stack_writes.map((b) => b.value),
    [0, 127],
  );
});
test('allS/Y andboundaryDP/DBR values retainPHA/fetch chronology andwrap', () => {
  for (let v = 0; v < 65536; v++) {
    const p = describeStateSignOwners({ ...ctx, s: v, y: v });
    assert.equal(p.output_operand_s, (v + 65534) % 65536);
    assert.equal(p.next_opcode_y, (v + 2) % 65536);
    assert.equal(p.frontier_y, (v + 3) % 65536);
  }
  for (const d of [255, 65535])
    for (let bank = 0; bank < 256; bank++) {
      const p = describeStateSignOwners({ ...ctx, d, bank });
      assert.deepEqual(
        p.next_opcode_sources.pointer_reads.map((b) => b.address),
        [cpuLabel(d), cpuLabel((d + 1) % 65536)],
      );
    }
});
test('0E PHA replacesownpointer andlatchedState beforefreshopcode; noStatewrites', () => {
  const p = describeStateSignOwners({ ...ctx, s: 0x3d7, pointerAfter: 0xff80 });
  assert.deepEqual(
    p.stack_writes.map((b) => b.physical_address),
    p.next_opcode_sources.pointer_reads.map((b) => b.physical_address).reverse(),
  );
  assert.equal(p.next_opcode_sources.word_reads[0].address, '80:FF86');
  assert.deepEqual(
    p.ordered_accesses.slice(-4).map((a) => a.kind),
    ['PHA-high', 'PHA-low', 'next-pointer', 'next-opcode-WORD'],
  );
});
test('allraw/body/width/mode/target/mask/edges mutationsfail includingunexecutedORA', () => {
  for (const [pc, i] of map) {
    const missing = new Map(map);
    missing.delete(pc);
    assert.throws(() => proveStateSignToDispatch(missing));
    for (const patch of [
      { raw: Buffer.alloc(i.length) },
      { state: { e: 0, m: 1, x: 0 } },
      { state: { e: 0, m: 0, x: 1 } },
      { state: {} },
      { mode: 'absx' },
      { mnemonic: 'NOP' },
      { length: i.length + 1 },
      { value: i.value + 1 },
      { next: i.next + 1 },
      { target: i.target === undefined ? pc : i.target + 1 },
      { opcode: i.opcode ^ 1 },
    ]) {
      const m = new Map(map);
      m.set(pc, { ...i, ...patch });
      assert.throws(() => proveStateSignToDispatch(m));
    }
  }
});
test('missingfullWORD rejects andunsupportedHost0E hasnoeffects; dependencies/openC1CA preserved', async () => {
  for (const v of [-1, 65536, null, undefined]) {
    assert.throws(() => stateSignConsequence({ offsetWord: v, stateWord: 0 }));
    assert.throws(() => stateSignConsequence({ offsetWord: 0, stateWord: v }));
  }
  assert.ok(!executableOpcodes.includes(14));
  const f = compileScriptFrame([14, 255, 255, 0x56], { localBytes: 0, returnBytes: 2 })([]),
    before = f.snapshot();
  assert.throws(() => f.step(), /not implemented/);
  assert.deepEqual(f.snapshot(), before);
  for (const d of r.dependencies) {
    const dep = JSON.parse(await readFile(d.source, 'utf8'));
    assert.equal(dep.rom_sha256, metadata.rom_sha256);
  }
  const visit = JSON.parse(await readFile('analysis/render-c1ca.json', 'utf8'));
  assert.ok(
    visit.full_graph.supplied_opcode_sources.some(
      (p) => p.source === 'analysis/render-task-state-sign-extension.json',
    ),
  );
  assert.equal(visit.full_graph.closed, false);
});
