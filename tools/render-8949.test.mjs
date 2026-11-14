import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData, prepareRenderView } from '../src/render/data.mjs';
import { prepareRender8949, render8949 } from '../proof/render/pretransfer-8949.mjs';
import { decode } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';

const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const report = JSON.parse(await readFile(new URL('../analysis/render-8949-native.json', import.meta.url), 'utf8'));
const windows = [[0x7E0CD0, 0x7E0CD1], [0x7E0CD6, 0x7E0CD7]];
const entry = { bank: 0x80, status: 0xC5, x: 0x1234, y: 0xBEEF,
  emulation: 0, directPage: 0, stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (data, a, v) => data.seed(a, [v & 255, v >>> 8]);
const word = (data, a) => data.readByte(a).value | data.readByte(a + 1).value << 8;
function fixture({ mask = 3, gate0CD8 = 0, gate1562 = 1, horizontal = 0x1234, vertical = 0xFFFF,
  writeWindows = windows, bank = 0x80, omit = null } = {}) {
  const data = createRenderData({ writeWindows });
  const words = [[0xCD8, gate0CD8], [0x1562, gate1562], [0xCD0, mask & 1 ? 0x8001 : 0],
    [0xCD6, mask & 2 ? 0xFFFF : 0], [0xCCC, 0x1111], [0xCCE, 0x2222],
    [0xCD2, 0x3333], [0xCD4, 0x4444], [0xCC4, horizontal], [0xCC6, vertical]];
  for (const [offset, value] of words) if (value !== null) for (let i = 0; i < 2; i++)
    if (offset + i !== omit) data.seed(bank * 0x10000 + offset + i, [(value >>> (8 * i)) & 255]);
  return data;
}
const prepare = (data, options = {}) => prepareRender8949({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase); assert.deepEqual(data.snapshot(), before);
  for (const k of ['operations', 'ioWrites', 'byteWrites']) assert.equal(p[k], undefined);
  return p;
}
const group0 = [[0x4332, 0x2D60, 2], [0x4335, 0x40, 2], [0x2116, 0x1111, 2], [0x2115, 0x81, 1], [0x420B, 8, 1],
  [0x4332, 0x2DA0, 2], [0x4335, 0x40, 2], [0x2116, 0x2222, 2], [0x420B, 8, 1]];
const group1 = [[0x4332, 0x2CE0, 2], [0x4335, 0x40, 2], [0x2116, 0x3333, 2], [0x2115, 0x80, 1], [0x420B, 8, 1],
  [0x4332, 0x2D20, 2], [0x4335, 0x40, 2], [0x2116, 0x4444, 2], [0x420B, 8, 1]];
const scroll = [[0x210D, 0x8D, 1], [0x210D, 0, 1], [0x210F, 0x8D, 1], [0x210F, 0, 1],
  [0x210E, 255, 1], [0x210E, 0, 1], [0x2110, 255, 1], [0x2110, 0, 1]];

test('8949 full original window and WORD shifts/BYTE scroll pair widths are independently pinned', () => {
  const raw = rom.subarray(cpuToOffset(0x818949, rom.length), cpuToOffset(0x818A05, rom.length));
  assert.equal(createHash('sha256').update(raw).digest('hex'), 'e19f94eeb8313bc33e4bb2c708b1b46ebb3190d7eaefd43a2ceae109b20376de');
  assert.equal(report.source.machine_bytes, raw.toString('hex').toUpperCase()); assert.equal(report.source.instruction_count, 74);
  const state = { e: 0, m: 0, x: 0 }, tail = [], shifts = [];
  for (let pc = 0x8189DA; pc < 0x818A05;) {
    const i = decode(rom, pc, state); pc = i.next;
    if (i.mnemonic === 'LSR') shifts.push(i.state.m);
    if (['STA', 'STZ'].includes(i.mnemonic)) tail.push([i.mnemonic, i.value, i.state.m]);
    if (i.mnemonic === 'SEP') state.m = 1;
    if (i.mnemonic === 'REP') state.m = 0;
  }
  assert.deepEqual(shifts, [0, 0, 0, 0]);
  assert.deepEqual(tail, [0x210D, 0x210F, 0x210E, 0x2110].flatMap(a => [['STA', a, 1], ['STZ', a, 1]]));
});

test('Nonzero first gate reads only its WORD, needs no I/O or other bytes, preserves C/V/I/X/Y', () => {
  for (const gate of [1, 0x7FFF, 0x8000, 0xFFFF]) for (const status of [0, 1, 4, 0x40, 0xC7]) {
    const data = createRenderData(); seedWord(data, 0xCD8, gate);
    const p = prepare(data, { status, ioMode: null }); commit(data, p);
    assert.equal(p.outcome, 'gate_0CD8_nonzero'); assert.equal(p.a, gate);
    assert.equal(p.status, (status & 0x7D) | (gate >= 0x8000 ? 0x80 : 0));
    assert.equal(p.x, 0x1234); assert.equal(p.y, 0xBEEF); assert.equal(p.work, 1);
    assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []); assert.deepEqual(p.readAddresses, [0x7E0CD8, 0x7E0CD9]);
  }
});

test('Second zero gate reads exactly two WORDs with no flag or scroll dependency and returns WORDzero', () => {
  const data = createRenderData(); seedWord(data, 0xCD8, 0); seedWord(data, 0x1562, 0);
  const p = prepare(data, { ioMode: null }); commit(data, p);
  assert.equal(p.outcome, 'gate_1562_zero'); assert.equal(p.a, 0); assert.equal(p.status, 0x47); assert.equal(p.work, 2);
  assert.deepEqual(p.operations.map(e => [e.kind, e.address]), [['read', 0x800CD8], ['read', 0x801562]]);
  assert.deepEqual(p.byteWrites, []); assert.deepEqual(p.ioWrites, []);
});

test('All four synthetic flag combinations pin exact reached request groups and unconditional paired scroll stores', () => {
  for (let mask = 0; mask < 4; mask++) {
    const data = fixture({ mask }), before = data.snapshot(), p = prepare(data); assert.ok(p.handled);
    assert.deepEqual(data.snapshot(), before); assert.deepEqual(p.ioWrites.map(e => [e.address & 0xFFFF, e.value, e.bytes]),
      [...(mask & 1 ? group0 : []), ...(mask & 2 ? group1 : []), ...scroll]);
    assert.equal(p.ioWrites.length, 8 + 9 * Number(Boolean(mask & 1)) + 9 * Number(Boolean(mask & 2)));
    assert.equal(p.a, 0x3FFF); assert.equal(p.status, 0x45); assert.equal(p.bank, 0x80);
    commit(data, p); assert.equal(word(data, 0xCD0), 0); assert.equal(word(data, 0xCD6), 0);
    assert.equal(data.readByte(0x80420B).available, false);
  }
});

test('Each group clears its flag only after two triggers; second transfer never rewrites2115', () => {
  const p = prepare(fixture()); assert.ok(p.handled);
  for (const [phase, flag] of [['0CD0', 0xCD0], ['0CD6', 0xCD6]]) {
    const events = p.operations.filter(e => e.phase === phase);
    assert.equal(events.filter(e => (e.address & 0xFFFF) === 0x2115).length, 1);
    assert.deepEqual(events.slice(-2).map(e => [e.kind, e.address & 0xFFFF, e.value, e.bytes]),
      [['write', 0x420B, 8, 1], ['write', flag, 0, 2]]);
    assert.equal(events.filter(e => (e.address & 0xFFFF) === 0x420B).length, 2);
  }
});

test('Flags and all four destination reads occur freshly at their exact sequence positions', () => {
  const p = prepare(fixture()); assert.ok(p.handled);
  assert.deepEqual(p.operations.filter(e => e.kind === 'read').map(e => e.address & 0xFFFF),
    [0xCD8, 0x1562, 0xCD0, 0xCCC, 0xCCE, 0xCD6, 0xCD2, 0xCD4, 0xCC4, 0xCC6]);
  for (const destination of [0xCCC, 0xCCE, 0xCD2, 0xCD4]) {
    const i = p.operations.findIndex(e => e.kind === 'read' && (e.address & 0xFFFF) === destination);
    assert.equal(p.operations[i - 1].address & 0xFFFF, 0x4335); assert.equal(p.operations[i + 1].address & 0xFFFF, 0x2116);
    assert.equal(p.operations[i + 1].value, p.operations[i].value);
  }
});

test('Scroll stores pair actual lowBYTE with zero and preserve full WORD A/N/Z after SEP and REP', () => {
  for (const vertical of [0, 1, 2, 3, 4, 0x200, 0x400, 0x8000, 0xFFFF]) {
    const p = prepare(fixture({ mask: 0, vertical })); assert.ok(p.handled);
    assert.equal(p.a, Math.floor(vertical / 4)); assert.equal(p.status,
      0x44 | (Math.floor(vertical / 2) % 2) | (vertical < 4 ? 2 : 0));
    assert.deepEqual(p.ioWrites.slice(-4).map(e => [e.address & 0xFFFF, e.value, e.bytes]),
      [[0x210E, Math.floor(vertical / 4) % 256, 1], [0x210E, 0, 1], [0x2110, Math.floor(vertical / 4) % 256, 1], [0x2110, 0, 1]]);
  }
});

test('All65536 final scroll WORDs agree with independent unsigned division and sourcebit1 carry', () => {
  const data = fixture({ mask: 0 });
  for (let value = 0; value < 65536; value++) {
    seedWord(data, 0xCC6, value); const p = prepare(data);
    assert.ok(p.handled); assert.equal(p.a, Math.floor(value / 4));
    assert.equal(p.carry, Math.floor(value / 2) % 2); assert.equal(p.status, 0x44 | p.carry | (value < 4 ? 2 : 0));
    assert.equal(p.ioWrites.at(-2).value, Math.floor(value / 4) % 256);
  }
});

test('Skipped group parameters and channel configuration/sourcebufferbytes are never required or read', () => {
  const data = createRenderData();
  for (const [a, v] of [[0xCD8, 0], [0x1562, 1], [0xCD0, 0], [0xCD6, 0], [0xCC4, 0], [0xCC6, 0]]) seedWord(data, a, v);
  const p = prepare(data); commit(data, p); assert.equal(p.ioWrites.length, 8);
  assert.equal(p.operations.some(e => [0x4330, 0x4331, 0x4334].includes(e.address & 0xFFFF)), false);
  assert.equal(p.readAddresses.some(a => a >= 0x7E2CE0 && a < 0x7E2DE0), false);
});

test('Every individually missing reached source byte preserves both prior clears and all recorded requests', () => {
  for (const offset of [0xCD8, 0x1562, 0xCD0, 0xCCC, 0xCCE, 0xCD6, 0xCD2, 0xCD4, 0xCC4, 0xCC6]) for (let i = 0; i < 2; i++) {
    const p = unchanged(fixture({ omit: offset + i }), {}, 'render_source_required'); assert.equal(p.address, 0x7E0000 + offset + i);
  }
});

test('Late scroll parameter failure rolls back completed groups with phase-specific boundary', () => {
  const p = unchanged(fixture({ vertical: null }), {}, 'render_source_required', 'scroll_0CC6');
  assert.equal(p.address, 0x7E0CC6);
});

test('Missing flag ownership at either byte keeps all reached effects unchanged; skipped flags need no rights', () => {
  for (const address of [0x7E0CD0, 0x7E0CD1, 0x7E0CD6, 0x7E0CD7]) {
    const writeWindows = windows.flatMap(([lo, hi]) => address < lo || address > hi ? [[lo, hi]]
      : [[lo, address - 1], [address + 1, hi]].filter(([a, b]) => a <= b));
    assert.equal(unchanged(fixture({ writeWindows }), {}, 'render_write_window_required').address, address);
  }
  assert.ok(prepare(fixture({ mask: 0, writeWindows: [] })).handled);
});

test('I/O metadata permission is required even without transferflags because active scroll stores remain reached', () => {
  for (const mask of [0, 1, 2, 3]) {
    const p = unchanged(fixture({ mask }), { ioMode: null }, 'render_io_context_required');
    assert.equal(p.address, mask === 0 ? 0x80210D : 0x804332);
  }
});

test('Every work budget boundary rolls back the whole plan and exact complete budget succeeds', () => {
  const p = prepare(fixture()); assert.ok(p.handled); assert.equal(p.work, 38); assert.equal(p.work, p.operations.length);
  for (let maxWork = 1; maxWork < p.work; maxWork++) unchanged(fixture(), { maxWork }, 'render_work_budget_required');
  const data = fixture(); commit(data, prepare(data, { maxWork: 38 }));
});

test('Three-byte returnframe and reached read/write addresses are stack-protected on early and active paths', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1FFE, 0x1FFF] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FFD, 0x1FFF] }).handled);
  unchanged(fixture({ gate0CD8: 1 }), { stackWindow: [0xCD8, 0xCDA] }, 'render_stack_alias_required', 'gates');
  unchanged(fixture(), { stackWindow: [0xCD4, 0xCD7] }, 'render_stack_alias_required', '0CD6');
});

test('All128 systembank mirrors retain actual I/O addresses, common WRAM flagbytes and input X/Y', () => {
  for (let bank = 0; bank <= 255; bank++) {
    if (bank & 0x40) continue;
    const data = fixture({ bank }), p = prepare(data, { bank }); commit(data, p);
    assert.equal(p.ioWrites[0].address, bank * 0x10000 + 0x4332); assert.equal(p.ioWrites.at(-1).address, bank * 0x10000 + 0x2110);
    assert.equal(p.x, entry.x); assert.equal(p.y, entry.y); assert.equal(word(data, 0x800CD6), 0);
  }
});

test('Physical7E/7F retains every ordered scroll pair as WRAM writes and preserves BYTEneighbors', () => {
  for (const bank of [0x7E, 0x7F]) {
    const base = bank * 0x10000, data = fixture({ bank, writeWindows: [[base, base + 0xFFFF]] });
    data.seed(base + 0x210C, [0xA5]); data.seed(base + 0x2111, [0x5A]);
    const p = prepare(data, { bank, ioMode: null }); commit(data, p);
    assert.deepEqual(p.ioWrites, []); assert.equal(word(data, base + 0x4332), 0x2D20);
    assert.equal(word(data, base + 0x4335), 0x40); assert.equal(word(data, base + 0x2116), 0x4444);
    for (const offset of [0x210D, 0x210F, 0x210E, 0x2110]) assert.equal(data.readByte(base + offset).value, 0);
    assert.equal(data.readByte(base + 0x210C).value, 0xA5); assert.equal(data.readByte(base + 0x2111).value, 0x5A);
    assert.equal(p.operations.filter(e => e.phase.startsWith('scroll_') && e.kind === 'write').length, 8);
    if (bank === 0x7F) assert.equal(data.readByte(0x7E0CD8).available, false);
  }
});

test('Physical WRAM register ownership and scroll aliases of stack remain explicit boundaries', () => {
  unchanged(fixture({ bank: 0x7E }), { bank: 0x7E }, 'render_write_window_required', '0CD0');
  const data = fixture({ bank: 0x7E, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  unchanged(data, { bank: 0x7E, stackWindow: [0x210D, 0x2110] }, 'render_stack_alias_required', 'scroll_0CC4');
});

test('Outer shared view sees prior bytewrites while only the finished owner plan is committable', () => {
  const data = fixture({ mask: 0, writeWindows: [...windows, [0x7E0CCC, 0x7E0CCD]] });
  const view = prepareRenderView(data, [0x7E1F00, 0x7E1FFF]); view.write(0xCD0, 1); view.write(0xCCC, 0xA5);
  const inner = render8949(view, entry, { work: 0, maxWork: 1000 });
  assert.equal(inner.ioWrites[2].value, 0x11A5); assert.throws(() => data.commit(inner), /Invalid render plan/);
  assert.equal(word(data, 0xCCC), 0x1111); commit(data, view.finish(inner)); assert.equal(word(data, 0xCCC), 0x11A5);
});

test('Invalid contexts and stale/foreign/copied plans cannot mutate provider or immutable request metadata', () => {
  const data = fixture();
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 16 }, { status: 32 },
    { emulation: 1 }, { directPage: 1 }]) unchanged(data, options, 'render_entry_required');
  unchanged(data, { bank: 0x40 }, 'render_address_required', 'gates');
  for (const options of [{ bank: 256 }, { status: -1 }, { x: 65536 }, { y: -1 }, { maxWork: 0 }, { ioMode: 'execute' }])
    assert.throws(() => prepare(data, options), /Invalid render/);
  const p = prepare(data); assert.throws(() => { p.ioWrites[0].value = 0; }, TypeError);
  assert.throws(() => { p.operations.push({}); }, TypeError); assert.throws(() => fixture().commit(p), /Invalid render plan/);
  assert.throws(() => data.commit({ ...p }), /Invalid render plan/); seedWord(data, 0xCC6, 0);
  const before = data.snapshot(); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('Six pinned synthetic probes reproduce both earlygates and all complete flag/request combinations', () => {
  assert.match(report.scope, /synthetic/); assert.match(report.scope, /no device/); assert.equal(report.probes.length, 6);
  for (const probe of report.probes) {
    const p = prepare(fixture({ mask: probe.mask, gate0CD8: probe.gate0CD8, gate1562: probe.gate1562 }));
    for (const key of ['outcome', 'a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'work', 'operations', 'ioWrites', 'byteWrites'])
      assert.deepEqual(p[key], probe[key]);
  }
});
