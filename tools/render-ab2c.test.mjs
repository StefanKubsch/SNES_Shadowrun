import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRenderData } from '../src/render/data.mjs';
import { createOriginalRenderData } from '../proof/render/original-data.mjs';
import { seedOriginalAA9CData } from '../proof/render/original-aa9c-data.mjs';
import { seedOriginalAB2CData } from '../proof/render/original-ab2c-data.mjs';
import { seedOriginalAF1FData } from '../proof/render/original-af1f-data.mjs';
import { prepareRenderAB2C } from '../proof/render/ab2c.mjs';
import { decode } from './disassemble.mjs';
import { cpuToOffset } from './rom.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../${name}.json`, import.meta.url), 'utf8'));
const unpackAsset = await load('assets/render-unpack-data'), aaAsset = await load('assets/render-aa9c-data');
const abAsset = await load('assets/render-ab2c-data'), afAsset = await load('assets/render-af1f-data');
const report = await load('analysis/render-ab2c-native'), aaReport = await load('analysis/render-aa9c-native');
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const windows = [[0x7E01BE, 0x7E01BE], [0x7E01F4, 0x7E0205],
  [0x7E0212, 0x7E021D], [0x7E0226, 0x7E0245], [0x7E23A0, 0x7E2ADF]];
const entry = { bank: 0x80, status: 0, emulation: 0, directPage: 0,
  stackWindow: [0x1F00, 0x1FFF], ioMode: 'record-requests' };
const seedWord = (data, a, v) => data.seed(a, [v & 255, v >>> 8]);
const read = (data, a, n) => Array.from({ length: n }, (_, i) => {
  const r = data.readByte(a + i); assert.ok(r.available, (a + i).toString(16)); return r.value;
});
const word = (data, a) => read(data, a, 2).reduce((v, b, i) => v | b << (8 * i), 0);
const digest = bytes => createHash('sha256').update(Uint8Array.from(bytes)).digest('hex');
function fixture({ writeWindows = windows, gate = 0, bank = 0x80, byte01BE = 0xA1, channels = true } = {}) {
  const data = createOriginalRenderData(unpackAsset, { writeWindows }); seedOriginalAA9CData(data, aaAsset);
  if (channels) seedOriginalAB2CData(data, abAsset);
  if (byte01BE !== null) data.seed(bank * 0x10000 + 0x1BE, [byte01BE]);
  if (gate !== null) seedWord(data, 0x7E1D61, gate); return data;
}
const prepare = (data, options = {}) => prepareRenderAB2C({ ...entry, data, ...options });
const commit = (data, p) => { assert.ok(p.handled, JSON.stringify(p)); assert.deepEqual(data.commit(p), { handled: true }); };
function unchanged(data, options, reason, phase) {
  const before = data.snapshot(), p = prepare(data, options);
  assert.equal(p.handled, false); assert.equal(p.reason, reason);
  if (phase) assert.equal(p.phase, phase); assert.deepEqual(data.snapshot(), before);
  for (const key of ['byteWrites', 'ioWrites', 'operations', 'loader', 'requests']) assert.equal(p[key], undefined);
  return p;
}
const setup = [
  [0x2116, 0x5000, 2], [0x4305, 0x170, 2], [0x4302, 0xF160, 2],
  [0x4304, 0x95, 1], [0x4301, 0x18, 1], [0x2115, 0x80, 1], [0x4300, 1, 1], [0x420B, 1, 1],
  [0x4305, 0x30, 2], [0x4302, 0xF140, 2], [0x4304, 0x95, 1], [0x2121, 0, 1],
  [0x4301, 0x22, 1], [0x4300, 0, 1], [0x420B, 1, 1],
  [0x4370, 1, 1], [0x4360, 9, 1], [0x4350, 0x81, 1], [0x4371, 0x18, 1],
  [0x4361, 0x18, 1], [0x4351, 0x39, 1], [0x4374, 0x7E, 1], [0x4364, 0x81, 1],
  [0x4354, 0x7E, 1], [0x2130, 2, 1], [0x2131, 0x37, 1],
];

test('AB2C assets are two pinned original ROM windows with overlap16 and exactly400 unique ROMbytes', () => {
  assert.equal(digest(rom), abAsset.romSha256);
  const expected = [[0x95F160, 368, '76192164fce1dcd3e443bc3b931a4c1a1c55431eb9ccd55efb55501237b45161'],
    [0x95F140, 48, 'f2d478953f8229f8d8ede10d62379dfd87904b2bfae7dc3b65f819ea0302d179']];
  for (const [i, w] of abAsset.sources.entries()) {
    const [address, length, sha256] = expected[i]; assert.equal(w.address, address); assert.equal(w.bytes.length, length);
    assert.equal(w.sourceRomOffset, cpuToOffset(address, rom.length)); assert.equal(digest(w.bytes), sha256);
    assert.deepEqual(w.bytes, [...rom.subarray(w.sourceRomOffset, w.sourceRomOffset + length)]);
  }
  assert.deepEqual(abAsset.sources[0].bytes.slice(0, 16), abAsset.sources[1].bytes.slice(32));
  const data = createRenderData(); seedOriginalAB2CData(data, abAsset);
  assert.equal(data.snapshot().bytes.length, 400); assert.equal(data.readByte(0x1BE).available, false);
});

test('Malformed source assets including inconsistent overlap cannot partially hydrate the owner', () => {
  for (const mutate of [a => a.format = 'other', a => a.romSha256 = '', a => a.sources.pop(),
    a => a.sources[1].address++, a => a.sources[0].bytes.pop(), a => a.sources[1].bytes[32] ^= 1,
    a => a.sources[0].bytes[367] = 256, a => delete a.sources[0].bytes[0]]) {
    const data = fixture(), before = data.snapshot(), asset = structuredClone(abAsset); mutate(asset);
    assert.throws(() => seedOriginalAB2CData(data, asset), /Invalid original AB2C data/); assert.deepEqual(data.snapshot(), before);
  }
});

test('Independent original-byte decode confirms every setup constant/store width and the entire local body digest', () => {
  const raw = rom.subarray(cpuToOffset(0x81AB2C, rom.length), cpuToOffset(0x81AC0C, rom.length));
  assert.equal(digest(raw), '628b6c443d01591958186c775166ac9dd89b981dffb3dbcc1c11b02d08439279');
  const modes = { e: 0, m: 0, x: 0 }, stores = []; let loaded = null;
  for (let pc = 0x81AB2C; pc < 0x81ABB7;) {
    const i = decode(rom, pc, modes); pc = i.next;
    if (i.mnemonic === 'LDA') { assert.equal(i.mode, 'immM'); loaded = i.value; }
    if (i.mnemonic === 'STA') stores.push([i.value, loaded, modes.m ? 1 : 2]);
    if (i.mnemonic === 'SEP') modes.m = 1;
    if (i.mnemonic === 'REP') modes.m = 0;
  }
  assert.deepEqual(stores, setup);
});

test('Full initializer shares original loader output, creates unknown-owned state and finishes direct01F8 without preseed flags/cache', () => {
  const data = fixture(), before = data.snapshot(), p = prepare(data); assert.ok(p.handled);
  assert.deepEqual(data.snapshot(), before); assert.equal(p.outcome, 'initialized'); assert.equal(p.loader.outcome, 'loaded');
  assert.equal(p.loader.firstUnpack.outputBytes, 80); assert.equal(p.loader.second.unpack.outputBytes, 1856);
  assert.equal(p.a, 0); assert.equal(p.x, 0xFFFE); assert.equal(p.y, 0x2AE0); assert.equal(p.status, 2);
  commit(data, p); assert.equal(data.readByte(0x1BE).value, 0xA5); assert.equal(word(data, 0x214), 0);
  assert.equal(word(data, 0x212), 0x2027); assert.deepEqual(read(data, 0x216, 8), Array(8).fill(255));
  assert.deepEqual(read(data, 0x226, 32), Array(32).fill(0)); assert.deepEqual(read(data, 0x1F6, 8), Array(8).fill(0));
  assert.deepEqual(read(data, 0x200, 4), Array(4).fill(0)); assert.equal(word(data, 0x204), 0xFFFE);
  assert.equal(digest(read(data, 0x7E23A0, 1856)), 'fe45ff8ebeed0f91d25099a9837cb901b831853285e863232f6b101339e034d1');
  assert.equal(data.readByte(0x804370).available, false); assert.equal(data.readByte(0x4200).available, false);
});

test('Common I/O ledger pins setup26, firstloader12 and directrequest5 in original order, without transfer execution', () => {
  const p = prepare(fixture()); assert.ok(p.handled); assert.equal(p.ioWrites.length, 43);
  assert.deepEqual(p.ioWrites.slice(0, 26).map(r => [r.address & 0xFFFF, r.value, r.bytes]), setup);
  assert.deepEqual(p.ioWrites.slice(26, 38), aaReport.probes[0].ioWrites);
  assert.deepEqual(p.ioWrites.slice(38).map(r => [r.address & 0xFFFF, r.value, r.bytes]),
    [[0x4372, 0x23A0, 2], [0x4375, 0x740, 2], [0x2116, 0x7800, 2], [0x2115, 0x80, 1], [0x420B, 0x80, 1]]);
  assert.deepEqual(p.ioWrites.filter(r => (r.address & 0xFFFF) === 0x420B).map(r => r.value), [1, 1, 0x80, 0x80]);
  assert.ok(p.ioWrites.slice(38).every(r => r.phase === 'initial_request/01F8'));
  assert.equal(p.requests.ioRequests.some(r => r.kind === 'read'), false);
});

test('Descending table/cache writes retain BYTE01BE width and unconditional active request0 cachegate', () => {
  const data = fixture(); data.seed(0x1BF, [0xDE]); seedWord(data, 0x214, 0);
  const p = prepare(data); assert.ok(p.handled); const table = p.operations.filter(r => r.phase === 'tables');
  assert.deepEqual(table.slice(0, 2).map(r => [r.kind, r.address & 0xFFFF, r.bytes]),
    [['read', 0x1BE, 1], ['write', 0x1BE, 1]]);
  assert.deepEqual(table.slice(2).map(r => [r.address & 0xFFFF, r.value]),
    [...Array.from({ length: 16 }, (_, i) => [0x244 - i * 2, 0]), [0x214, 0xFFFF],
      [0x21C, 0xFFFF], [0x21A, 0xFFFF], [0x218, 0xFFFF], [0x216, 0xFFFF]]);
  assert.equal(p.loader.outcome, 'loaded'); commit(data, p); assert.equal(data.readByte(0x1BF).value, 0xDE);
});

test('Postloader clears and fresh INC01F8 follow the loader and directrequestreads see its actual bytes', () => {
  const data = fixture(); data.seed(0x1F6, Array(8).fill(255)); const p = prepare(data); assert.ok(p.handled);
  assert.deepEqual(p.operations.filter(r => r.phase === 'post_loader').map(r => [r.kind, r.address & 0xFFFF, r.value]), [
    ['write', 0x212, 0x2027], ['write', 0x1F8, 0], ['write', 0x1F6, 0], ['write', 0x1FA, 0],
    ['write', 0x1FC, 0], ['write', 0x200, 0], ['write', 0x202, 0], ['write', 0x204, 0xFFFE],
    ['read', 0x1F8, 0], ['write', 0x1F8, 1],
  ]);
  assert.deepEqual(p.requests.operations.filter(r => r.kind === 'read').map(r => [r.address & 0xFFFF, r.value]),
    [[0x1F6, 0], [0x1F8, 1], [0x1FA, 0], [0x1FC, 0]]);
});

test('Original channel0 sources are optional metadata assets and are never fabricated CPU reads or buffer copies', () => {
  const data = fixture({ channels: false }), p = prepare(data); commit(data, p);
  assert.equal(data.readByte(0x95F140).available, false);
  assert.equal(p.readAddresses.some(a => a >= 0x95F140 && a < 0x95F2D0), false);
  assert.deepEqual(p.ioWrites.slice(0, 26).map(r => [r.address & 0xFFFF, r.value, r.bytes]), setup);
});

test('Every local initialization write byte requires ownership and any late violation preserves the entire provider', () => {
  const p = prepare(fixture()); assert.ok(p.handled);
  const addresses = p.byteWrites.map(([a]) => a).filter(a => a < 0x7E2300 && a >= 0x7E01BE);
  for (const address of addresses) {
    const writeWindows = windows.flatMap(([lo, hi]) => address < lo || address > hi ? [[lo, hi]]
      : [[lo, address - 1], [address + 1, hi]].filter(([a, b]) => a <= b));
    const r = unchanged(fixture({ writeWindows }), {}, 'render_write_window_required'); assert.equal(r.address, address);
  }
});

test('Missing01BE early read and late1D61 gate preserve all setup requests/tables/loaderwrites', () => {
  const early = unchanged(fixture({ byte01BE: null }), {}, 'render_source_required', 'tables'); assert.equal(early.address, 0x7E01BE);
  const late = unchanged(fixture({ gate: null }), {}, 'render_source_required', 'loader');
  assert.equal(late.address, 0x7E1D61); assert.equal(late.innerPhase, 'second_a9b2'); assert.equal(late.helperPhase, 'af1f');
});

test('Every missing original loader/stream byte leaves the earlier initializer and its requests uncommitted', () => {
  for (const window of [aaAsset.record, aaAsset.palette, ...unpackAsset.sources]) for (let omitted = 0; omitted < window.bytes.length; omitted++) {
    const data = createRenderData({ writeWindows: windows });
    for (const w of [unpackAsset.table, aaAsset.record, aaAsset.palette, ...unpackAsset.sources])
      for (const [i, byte] of w.bytes.entries()) if (w !== window || i !== omitted) data.seed(w.address + i, [byte]);
    data.seed(0x1BE, [0xA1]); seedWord(data, 0x1D61, 0);
    const r = unchanged(data, {}, 'render_source_required', 'loader'); assert.equal(r.address, window.address + omitted);
  }
});

test('Active AF1F is atomic within the initializer and its C/X/Y survive the directrequest', () => {
  const data = fixture({ gate: 1 }); seedWord(data, 0x7E2DE6, 0);
  const r = unchanged(data, {}, 'render_division_context_required', 'loader'); assert.equal(r.helperPhase, 'af1f');
  seedOriginalAF1FData(data, afAsset); seedWord(data, 0x7E3C00, 60); seedWord(data, 0x7E33DE, 0);
  const p = prepare(data, { divisionMode: 'stable-native' }); commit(data, p);
  assert.equal(p.loader.second.outcome, 'af1f_active'); assert.equal(p.a, 0); assert.equal(p.x, 14); assert.equal(p.y, 0);
  assert.equal(p.status, 3); assert.equal(p.carry, 1);
  assert.equal(digest(read(data, 0x7E23A0, 1856)), '923a0ccabdcfe47fe6657107d71368391791c145093decfa19a385e788f0778d');
});

test('Shared work budget covers setup/tables/loader/postclears/requests and exact budget succeeds', () => {
  const p = prepare(fixture()); assert.ok(p.handled);
  assert.equal(p.work, p.loader.work + 20); assert.equal(p.requests.work, p.work);
  for (const maxWork of [1, 26, 27, 48, 49, 50, p.loader.work - 1, p.loader.work,
    p.loader.work + 1, p.loader.work + 9, p.loader.work + 10, p.work - 1])
    unchanged(fixture(), { maxWork }, 'render_work_budget_required');
  const data = fixture(); commit(data, prepare(data, { maxWork: p.work }));
});

test('Output limits and missing I/O context roll back initial setup and late loader equally', () => {
  unchanged(fixture(), { ioMode: null }, 'render_io_context_required', 'channel0_tiles');
  const r = unchanged(fixture(), { maxOutputBytes: 80 }, 'render_output_budget_required', 'loader');
  assert.equal(r.innerPhase, 'second_a9b2'); assert.equal(r.helperPhase, 'unpack');
  const data = fixture(); commit(data, prepare(data));
});

test('Conservative24-byte stack covers outer RTL and loader calls; all local/long/late accesses are protected', () => {
  unchanged(fixture(), { stackWindow: null }, 'render_stack_required');
  unchanged(fixture(), { stackWindow: [0x1FE9, 0x1FFF] }, 'render_stack_required');
  assert.ok(prepare(fixture(), { stackWindow: [0x1FE8, 0x1FFF] }).handled);
  for (const stackWindow of [[0x1BE, 0x1DD], [0x216, 0x22D], [0x23A0, 0x23BF], [0x1D61, 0x1D80]])
    unchanged(fixture(), { stackWindow }, 'render_stack_alias_required');
});

test('Physical bank7F writes local tables to7F but fixed long cachewords and loader buffer remain in7E', () => {
  const bank = 0x7F, writeWindows = [[0x7E0000, 0x7EFFFF], [0x7F0000, 0x7FFFFF]];
  const data = fixture({ bank, writeWindows });
  const r = unchanged(data, { bank }, 'render_source_required', 'loader'); assert.equal(r.address, 0x7E01F4);
  seedWord(data, 0x7E01F4, 0x81); const p = prepare(data, { bank }); commit(data, p);
  assert.equal(word(data, 0x7F0214), 0); assert.equal(word(data, 0x7F0212), 0x2027);
  assert.deepEqual(read(data, 0x7F0226, 32), Array(32).fill(0)); assert.equal(word(data, 0x7E0216), 0xFFFF);
  assert.equal(data.readByte(0x7F0216).available, false); assert.equal(data.readByte(0x7E0214).available, false);
  assert.equal(word(data, 0x7F4375), 0x740); assert.equal(word(data, 0x7F4372), 0x23A0);
  assert.equal(p.ioWrites.length, 7); assert.ok(p.ioWrites.every(r => r.address >>> 16 === 0x81));
  assert.equal(digest(read(data, 0x7E23A0, 1856)), 'fe45ff8ebeed0f91d25099a9837cb901b831853285e863232f6b101339e034d1');
});

test('Physical bank7E registerwrites use owned WRAM and the later directrequest overwrites channel0 setup target', () => {
  const bank = 0x7E, data = fixture({ bank, writeWindows: [[0x7E0000, 0x7EFFFF]] });
  const p = prepare(data, { bank }); commit(data, p);
  assert.equal(word(data, 0x7E2116), 0x7800); assert.equal(word(data, 0x7E4305), 0x30);
  assert.equal(word(data, 0x7E4302), 0xF140); assert.equal(data.readByte(0x7E4370).value, 1);
  assert.equal(data.readByte(0x7E4360).value, 9); assert.equal(data.readByte(0x7E4350).value, 0x81);
  assert.equal(word(data, 0x7E4375), 0x740); assert.equal(data.readByte(0x7E420B).value, 0x80);
  assert.equal(p.ioWrites.length, 7); assert.deepEqual(p.requests.ioRequests, []);
});

test('System DBR mirrors retain actual register addresses and final N/Z follow A9E1 rather than entryDBR', () => {
  for (const bank of [0, 0x3F, 0x80, 0xBF]) {
    const data = fixture({ bank }), p = prepare(data, { bank, status: 0xC7 }); commit(data, p);
    assert.equal(p.status, 6); assert.equal(p.bank, bank);
    assert.equal(p.ioWrites[0].address, bank * 0x10000 + 0x2116);
    assert.equal(p.ioWrites.at(-1).address, bank * 0x10000 + 0x420B);
  }
});

test('Frozen outer/inner metadata is revision-bound and inner/foreign/copied/replayed commits are rejected', () => {
  const data = fixture(), p = prepare(data);
  assert.ok(Object.isFrozen(p.loader)); assert.ok(Object.isFrozen(p.requests));
  assert.throws(() => { p.ioWrites[0].value = 0; }, TypeError);
  assert.throws(() => { p.operations[0].value = 0; }, TypeError);
  assert.throws(() => data.commit(p.loader), /Invalid render plan/); assert.throws(() => data.commit(p.requests), /Invalid render plan/);
  assert.throws(() => fixture().commit(p), /Invalid render plan/); assert.throws(() => data.commit({ ...p }), /Invalid render plan/);
  commit(data, p); assert.deepEqual(data.commit(p), { handled: false, reason: 'render_plan_stale' });
  const stale = prepare(data); data.seed(0x1BE, [0]); const before = data.snapshot();
  assert.deepEqual(data.commit(stale), { handled: false, reason: 'render_plan_stale' }); assert.deepEqual(data.snapshot(), before);
});

test('Unknown modes and invalid initializer contexts cannot mutate the owner or infer the entry bank', () => {
  for (const options of [{ bank: null }, { status: null }, { status: 8 }, { status: 16 }, { status: 32 },
    { directPage: 1 }, { emulation: 1 }]) unchanged(fixture(), options, 'render_entry_required');
  unchanged(fixture(), { bank: 0x40 }, 'render_address_required', 'channel0_tiles');
  for (const options of [{ bank: 256 }, { y: -1 }, { maxWork: 0 }, { maxOutputBytes: 0 },
    { ioMode: 'execute' }, { divisionMode: 'automatic' }]) assert.throws(() => prepare(fixture(), options), /Invalid render/);
});

test('Pinned zero/active probes reproduce complete initializer ledgers and independent loader digests', () => {
  for (const [i, probe] of report.probes.entries()) {
    const data = fixture({ gate: i });
    if (i) { seedOriginalAF1FData(data, afAsset); seedWord(data, 0x7E2DE6, 0); seedWord(data, 0x7E3C00, 60); seedWord(data, 0x7E33DE, 0); }
    const p = prepare(data, { divisionMode: i ? 'stable-native' : null }); commit(data, p);
    for (const key of ['a', 'x', 'y', 'bank', 'status', 'carry', 'overflow', 'work', 'loader', 'requests', 'operations', 'ioWrites'])
      assert.deepEqual(p[key], probe[key]);
    assert.equal(digest(read(data, 0x7E23A0, 1856)), aaReport.probes[i].outputSha256);
    assert.equal(probe.outputSha256, aaReport.probes[i].outputSha256);
  }
});
