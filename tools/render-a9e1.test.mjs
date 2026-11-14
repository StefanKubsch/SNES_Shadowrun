import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRenderA9E1, renderA9E1 } from '../proof/render/a9e1.mjs';

const flags = [0x1F6, 0x1F8, 0x1FA, 0x1FC];
const windows = [[0x7E01F6, 0x7E01FD], [0x7E020A, 0x7E020D]];
const entry = { bank: 0x80, status: 0, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests', ioRead213A: 0xC7 };
const word = (data, address, value) => data.seed(address, [value & 255, value >>> 8]);
const readWord = (data, address) => data.readByte(address).value | data.readByte(address + 1).value << 8;
function fixture({ mask = 15, size = 0x1401, destination = 0xF800, bank = 0x80,
  writeWindows = windows, omit = null } = {}) {
  const data = createRenderData({ writeWindows });
  const values = [...flags.map((f, i) => [f, mask & (1 << i) ? 0x8001 : 0]),
    [0x20C, size], [0x20A, destination], [0x20E, 0xABCD], [0x210, 0x1234]];
  for (const [offset, value] of values) for (let i = 0; i < 2; i++) {
    const address = bank * 0x10000 + offset + i;
    if (offset + i !== omit) data.seed(address, [(value >>> (8 * i)) & 255]);
  }
  return data;
}
const prepare = (data, options = {}) => prepareRenderA9E1({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase);
  assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'ioWrites', 'ioRequests', 'operations']) assert.equal(p[key], undefined);
  return p;
}
const writesByFlag = [
  [[0x4362, 0xAC8C, 2], [0x4365, 0x1400, 2], [0x2116, 0xF800, 2], [0x2115, 0x80, 1], [0x420B, 0x40, 1]],
  [[0x4372, 0x23A0, 2], [0x4375, 0x740, 2], [0x2116, 0x7800, 2], [0x2115, 0x80, 1], [0x420B, 0x80, 1]],
  [[0x4372, 0x2AE0, 2], [0x4375, 0x1234, 2], [0x2116, 0xABCD, 2], [0x2115, 0x80, 1], [0x420B, 0x80, 1]],
  [[0x2116, 0xABCD, 2], [0x4355, 0x10, 2], [0x4352, 0x2AE0, 2], [0x2115, 0x80, 1], [0x420B, 0x20, 1]],
];

test('A9E1 all sixteen synthetic flag combinations retain exact request order and only reached writes', () => {
  for (let mask = 0; mask < 16; mask++) {
    const data = fixture({ mask }), before = data.snapshot(), p = prepare(data);
    assert.ok(p.handled); assert.deepEqual(data.snapshot(), before);
    assert.deepEqual(p.ioWrites.map(r => [r.address & 0xFFFF, r.value, r.bytes]),
      writesByFlag.flatMap((ws, i) => mask & (1 << i) ? ws : []));
    assert.deepEqual(p.ioRequests.filter(r => r.kind === 'read').map(r => [r.address, r.value, r.bytes]),
      mask & 8 ? [[0x80213A, 0xC7, 1]] : []);
    assert.equal(p.a, mask & 8 ? 0x2A20 : 0); assert.equal(p.status, (mask & 1 ? 1 : 0) | (mask & 8 ? 0 : 2));
    commit(data, p);
    for (let i = 0; i < 4; i++) assert.equal(readWord(data, flags[i]), i === 0 && mask & 1 ? 0x8001 : 0);
    assert.equal(readWord(data, 0x20C), mask & 1 ? 1 : 0x1401);
    assert.equal(readWord(data, 0x20A), mask & 1 ? 0x200 : 0xF800);
    assert.equal(data.readByte(0x80420B).available, false);
  }
});

test('All-zero flags require only eight flag bytes and preserve C/V/I/X/Y without I/O', () => {
  const data = createRenderData(); data.seed(0x1F6, Array(8).fill(0));
  const p = prepare(data, { status: 0xC5, x: 0xFFFF, y: 0xBEEF, ioMode: null, ioRead213A: null });
  assert.ok(p.handled); assert.equal(p.a, 0); assert.equal(p.status, 0x47);
  assert.equal(p.x, 0xFFFF); assert.equal(p.y, 0xBEEF); assert.equal(p.bank, 0x80);
  assert.equal(p.work, 4); assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioRequests, []);
  assert.deepEqual(p.operations.map(r => [r.kind, r.address, r.bytes]), flags.map(f => ['read', 0x800000 + f, 2]));
  commit(data, p);
});

test('Unsigned 1401 threshold preserves or clears 01F6 and retains zero-size trigger', () => {
  for (const size of [0, 1, 0x1400, 0x1401, 0x8000, 0xFFFF]) {
    const data = fixture({ mask: 1, size }), p = prepare(data); commit(data, p);
    const large = size > 0x1400;
    assert.equal(readWord(data, 0x1F6), large ? 0x8001 : 0);
    assert.equal(readWord(data, 0x20C), large ? size - 0x1400 : size);
    assert.equal(p.ioWrites.find(r => r.address === 0x804365).value, large ? 0x1400 : size);
    assert.equal(p.ioWrites.at(-1).value, 0x40); assert.equal(readWord(data, 0x20A), 0x200);
  }
});

test('Small 01F6 clears after sourceoffset but before size/destination/trigger requests', () => {
  const data = fixture({ size: 0x1400 }), p = prepare(data); assert.ok(p.handled);
  const events = p.operations.filter(r => r.phase === '01F6');
  assert.deepEqual(events.map(r => [r.kind, r.address & 0xFFFF]), [
    ['read', 0x1F6], ['write', 0x4362], ['read', 0x20C], ['write', 0x1F6], ['write', 0x4365],
    ['read', 0x20A], ['write', 0x2116], ['write', 0x20A], ['write', 0x2115], ['write', 0x420B],
  ]);
});

test('01F8/01FA/01FC clears follow their triggers while pending 01F6 still permits all later visits', () => {
  const data = fixture(), p = prepare(data); assert.ok(p.handled);
  assert.equal(p.operations.some(r => r.kind === 'write' && (r.address & 0xFFFF) === 0x1F6), false);
  for (const flag of flags.slice(1)) {
    const phase = flag.toString(16).toUpperCase().padStart(4, '0');
    const events = p.operations.filter(r => r.phase === phase);
    assert.equal(events.at(-2).address, 0x80420B); assert.equal(events.at(-2).space, 'io');
    assert.deepEqual([events.at(-1).kind, events.at(-1).address, events.at(-1).value, events.at(-1).bytes],
      ['write', 0x800000 + flag, 0, 2]);
  }
});

test('020A advances by 0A00 independently of size with correct unsigned carry and signed overflow', () => {
  for (const destination of [0, 0x75FF, 0x7600, 0x7FFF, 0x8000, 0xF5FF, 0xF600, 0xFFFF]) {
    const data = fixture({ mask: 1, destination, size: 0 }), p = prepare(data, { status: 0xC5 }); commit(data, p);
    const unsigned = BigInt(destination) + 2560n;
    const signed = BigInt(destination < 32768 ? destination : destination - 65536) + 2560n;
    assert.equal(readWord(data, 0x20A), Number(unsigned % 65536n));
    assert.equal(p.carry, Number(unsigned >= 65536n));
    assert.equal(p.overflow, Number(signed < -32768n || signed > 32767n));
    assert.equal(p.status, 6 | p.carry | (p.overflow << 6));
    assert.equal(p.ioWrites.find(r => r.address === 0x802116).value, destination);
  }
});

test('Final 01FC path retains WORD high2A and BYTE-LDA20 N/Z while skipped 01FC returns WORDzero', () => {
  for (const status of [0, 1, 4, 0x40, 0x41, 0xC7]) for (const ioRead213A of [0, 0x80, 255]) {
    const p = prepare(fixture({ mask: 8 }), { status, ioRead213A });
    assert.ok(p.handled); assert.equal(p.a, 0x2A20); assert.equal(p.status, status & 0x7D);
    assert.equal(p.ioRequests.at(-2).value, ioRead213A);
  }
  const p = prepare(fixture({ mask: 4 }), { status: 0xC5 }); assert.equal(p.a, 0); assert.equal(p.status, 0x47);
});

test('Parameter reads occur between the actual request writes and 020E is read afresh twice', () => {
  const p = prepare(fixture()); assert.ok(p.handled);
  assert.deepEqual(p.operations.filter(r => r.kind === 'read').map(r => [r.phase, r.address & 0xFFFF]), [
    ['01F6', 0x1F6], ['01F6', 0x20C], ['01F6', 0x20A], ['01F8', 0x1F8],
    ['01FA', 0x1FA], ['01FA', 0x210], ['01FA', 0x20E], ['01FC', 0x1FC], ['01FC', 0x20E], ['01FC', 0x213A],
  ]);
  const fc = p.operations.filter(r => r.phase === '01FC');
  assert.deepEqual(fc.slice(-4).map(r => [r.kind, r.address & 0xFFFF]),
    [['write', 0x2115], ['read', 0x213A], ['write', 0x420B], ['write', 0x1FC]]);
});

test('Required 213A contract is explicit even though its result is overwritten; inactive flag needs none', () => {
  const data = fixture(); const p = unchanged(data, { ioRead213A: null }, 'render_io_read_required', '01FC');
  assert.equal(p.address, 0x80213A);
  assert.ok(prepare(fixture({ mask: 7 }), { ioRead213A: null }).handled);
});

test('Missing I/O permission rejects all writes and later flags despite early 01F6 clear', () => {
  for (const mask of [1, 2, 4, 8]) {
    const i = Math.log2(mask), phase = flags[i].toString(16).toUpperCase().padStart(4, '0');
    unchanged(fixture({ mask, size: 0 }), { ioMode: null }, 'render_io_context_required', phase);
  }
});

test('Every individually missing reached byte prevents the entire plan including all earlier clears', () => {
  for (const offset of [...flags.flatMap(f => [f, f + 1]), ...Array.from({ length: 8 }, (_, i) => 0x20A + i)]) {
    const data = fixture({ omit: offset }), p = unchanged(data, {}, 'render_source_required');
    assert.equal(p.address, 0x7E0000 + offset);
  }
});

test('Unreached parameters are not required and active 01F8 has no buffer/configuration reads', () => {
  const data = createRenderData({ writeWindows: windows });
  for (const flag of flags) word(data, flag, flag === 0x1F8 ? 1 : 0);
  const p = prepare(data); commit(data, p);
  assert.deepEqual(p.readAddresses, Array.from({ length: 8 }, (_, i) => 0x7E01F6 + i));
  assert.equal(data.readByte(0x7E23A0).available, false);
});

test('Missing late writable flag highbyte rolls back earlier pending sizes/destinations and I/O ledger', () => {
  const data = fixture({ size: 0, writeWindows: [[0x7E01F6, 0x7E01FC], windows[1]] });
  const p = unchanged(data, {}, 'render_write_window_required', '01FC'); assert.equal(p.address, 0x7E01FD);
});

test('Kept 01F6 requires no flagwrite permission; remainder and 020A still require explicit owners', () => {
  const data = fixture({ mask: 1, writeWindows: [windows[1]] }); commit(data, prepare(data));
  assert.equal(readWord(data, 0x1F6), 0x8001);
  unchanged(fixture({ mask: 1, size: 0, writeWindows: [windows[1]] }), {}, 'render_write_window_required', '01F6');
  unchanged(fixture({ mask: 1, writeWindows: [windows[0]] }), {}, 'render_write_window_required', '01F6');
});

test('Stack contract protects returnframe and every data address; no synthetic stackbytes are seeded', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFD, 0x1FFF] }).handled);
  unchanged(fixture(), { stackWindow: [0x1F6, 0x1FD] }, 'render_stack_alias_required', '01F6');
  unchanged(fixture(), { stackWindow: [0x20E, 0x213] }, 'render_stack_alias_required', '01FA');
});

test('All work budget boundaries withhold partial clears and metadata; exact budget succeeds', () => {
  const complete = prepare(fixture({ size: 0 })); assert.ok(complete.handled);
  assert.equal(complete.work, complete.operations.length);
  for (let maxWork = 1; maxWork < complete.work; maxWork++)
    unchanged(fixture({ size: 0 }), { maxWork }, 'render_work_budget_required');
  assert.ok(prepare(fixture({ size: 0 }), { maxWork: complete.work }).handled);
});

test('Every system-bank mirror uses its actual DBR I/O address while WRAM mirrors share flagbytes', () => {
  for (let bank = 0; bank <= 255; bank++) {
    if (bank & 0x40) continue;
    const data = fixture({ mask: 2, bank }), p = prepare(data, { bank }); commit(data, p);
    assert.equal(p.bank, bank); assert.equal(p.ioWrites[0].address, bank * 0x10000 + 0x4372);
    assert.equal(readWord(data, 0x1F8), 0); assert.equal(readWord(data, 0x8001F8), 0);
  }
});

test('Bank7E/7F register addresses are owned physical WRAM, including actual BYTE213A read', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 0x10000;
    const data = fixture({ bank, writeWindows: [[base, base + 0xFFFF]] }); data.seed(base + 0x213A, [0xF1]);
    const p = prepare(data, { bank, ioMode: null, ioRead213A: null }); commit(data, p);
    assert.deepEqual(p.ioRequests, []); assert.deepEqual(p.ioWrites, []); assert.equal(p.a, 0x2A20);
    assert.equal(readWord(data, base + 0x4372), 0x2AE0); assert.equal(readWord(data, base + 0x4375), 0x1234);
    assert.equal(readWord(data, base + 0x2116), 0xABCD); assert.equal(data.readByte(base + 0x420B).value, 0x20);
    assert.equal(data.readByte(base + 0x213A).value, 0xF1); assert.equal(readWord(data, base + 0x1FC), 0);
    if (bank === 0x7F) assert.equal(data.readByte(0x7E01FC).available, false);
  }
});

test('WRAM register ownership and missing WRAM213A remain boundaries without substituting I/O snapshots', () => {
  const bank = 0x7E;
  unchanged(fixture({ bank }), { bank }, 'render_write_window_required', '01F6');
  const data = fixture({ bank, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  const p = unchanged(data, { bank, ioRead213A: 7 }, 'render_source_required', '01FC'); assert.equal(p.address, 0x7E213A);
});

test('Unsupported mapping and unknown/nonbinary/byte-width entry context fail before mutation', () => {
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 16 }, { status: 32 },
    { emulation: null }, { emulation: 1 }, { directPage: null }, { directPage: 1 }])
    unchanged(fixture(), options, 'render_entry_required');
  const data = fixture(); const p = unchanged(data, { bank: 0x40 }, 'render_address_required', '01F6');
  assert.equal(p.address, 0x4001F6);
  for (const options of [{ bank: 256 }, { status: -1 }, { x: -1 }, { y: 65536 }, { ioMode: 'execute' },
    { ioRead213A: 256 }, { ioRead213A: '0' }, { maxWork: 0 }, { maxWork: 1.5 }])
    assert.throws(() => prepare(data, options), /Invalid render/);
});

test('Shared outer byteview sees earlier owner writes and only the outer finished plan can commit', () => {
  const data = fixture({ mask: 0, writeWindows: [...windows, [0x7E020E, 0x7E020F]] });
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]);
  view.write(0x1FA, 1); view.write(0x20E, 0x42); view.write(0x20F, 0x13);
  const inner = renderA9E1(view, entry, { work: 0, maxWork: 1000 });
  assert.equal(inner.ioWrites.find(r => (r.address & 0xFFFF) === 0x2116).value, 0x1342);
  assert.throws(() => data.commit(inner), /Invalid render plan/); assert.equal(readWord(data, 0x20E), 0xABCD);
  commit(data, view.finish(inner)); assert.equal(readWord(data, 0x20E), 0x1342); assert.equal(readWord(data, 0x1FA), 0);
});

test('Frozen ledgers and revision checks prevent foreign/mutated/stale/replayed commits; neighbors survive', () => {
  const data = fixture(); data.seed(0x1F5, [0xA5]); data.seed(0x1FE, [0x5A]); const p = prepare(data);
  assert.throws(() => { p.ioRequests[0].value = 0; }, TypeError);
  assert.throws(() => { p.operations.push({}); }, TypeError);
  assert.throws(() => { p.byteWrites[0][1] = 0; }, TypeError);
  assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => data.commit({ ...p }), /Invalid render plan/);
  commit(data, p); assert.equal(data.readByte(0x1F5).value, 0xA5); assert.equal(data.readByte(0x1FE).value, 0x5A);
  assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const other = fixture(), stale = prepare(other); word(other, 0x20E, 0xBEEF);
  const before = other.snapshot(); assert.deepEqual(other.commit(stale), { handled: false, reason: 'render_plan_stale' });
  assert.deepEqual(other.snapshot(), before);
});

test('Pinned synthetic probe reports reproduce all fourflag masks and the explicit non-device read contract', async () => {
  const report = JSON.parse(await readFile(new URL('../analysis/render-a9e1-native.json', import.meta.url), 'utf8'));
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device/);
  assert.equal(report.probes.length, 16);
  for (const probe of report.probes) {
    const p = prepare(fixture({ mask: probe.mask }));
    for (const key of ['a', 'status', 'carry', 'overflow', 'work', 'operations', 'ioRequests']) assert.deepEqual(p[key], probe[key]);
  }
});
