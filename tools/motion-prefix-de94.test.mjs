import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotMotionData, prepareMotionDataView } from '../proof/state/slot-motion-data.mjs';
import { prepareMotionPrefixDE94, prepareMotionDE94AFC4 } from '../proof/state/slot-motion-prefix-de94.mjs';
import { createSlotMotionPostpassData } from '../proof/state/slot-motion-postpass-data.mjs';
import { createSlotMotionDirectionData } from '../proof/state/slot-motion-direction-data.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const postAsset = await load('motion-postpass-data');
const direction = createSlotMotionDirectionData(await load('slot-motion-direction-data'));
const profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const word = (data, at, value) => data.seed(at, [value & 255, value >>> 8]);
const fields = { '1458': 0, '7E:40E0': 0, '0E28': 100, '0E80': 200, '0ED8': 300,
  '0D20': 0, '0D78': 0, '0DD0': 0, '1140': 0, '7E:4088': 0, '7E:4030': 128,
  '1090': 0, '7E:3FD8': 2, '10E8': 0, '1198': 0, '11F0': 0, '1350': 0xFFFF, '1038': 0,
  '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0 };
const fixture = ({ offsets = [0], selected = 0, counter = 3, base = 0x20, sources = {}, asset = postAsset } = {}) => {
  const data = createSlotMotionData(), output = createSlotMotionPostpassData(asset);
  if (selected !== null) word(data, 0x7E0CC2, selected);
  if (counter !== null) word(data, 0x7E1D65, counter);
  if (base !== null) word(data, 0x7EDEAA, base);
  const slots = createSlotState({ motionData: data, motionPostpassData: output, motionDirectionData: direction });
  for (const offset of new Set(offsets)) slots.seedSlot(offset, { definitionWord: 0, count: 0, head: 0,
    fields: Object.fromEntries(Object.entries({ ...fields, ...sources[offset] }).filter(([, v]) => v !== null)) });
  slots.seedActiveList(offsets); return { slots, data, output };
};
const capture = (s, allocator = null) => ({ slots: s.slots.snapshot(), scratch: s.slots.readMotionScratchBytes(),
  data: s.data.snapshot(), output: s.output.snapshot(), memory: allocator?.snapshot() });
const run = (s, options = {}) => s.slots.stepMotionDE94AFC4({ bank: 0x80, ...options });
const prefix = (data, bank = 0x80) => prepareMotionPrefixDE94({ motionData: data, bank });
const movements = (slots, offset = 0) => ['0D20', '0D78'].map(key => slots.snapshot().columns[key][offset / 2]);

test('DE94 requires an explicit mapped DBR and actual shared0CC2 bytes before any counter reads', () => {
  assert.equal(prepareMotionPrefixDE94().reason, 'slot_motion_prefix_bank_required');
  assert.deepEqual(prepareMotionPrefixDE94({ bank: 0x80 }), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7E0CC2 });
  const s = fixture({ selected: null }), before = capture(s);
  assert.equal(run(s).address, 0x7E0CC2); assert.deepEqual(capture(s), before);
});

test('All256 DBRs use only real lowWRAM mirrors or direct7E; no7F or ROM fallback', () => {
  const data = createSlotMotionData(); word(data, 0x7E0CC2, 0xFFFF);
  for (let bank = 0; bank < 256; bank++) {
    const r = prefix(data, bank), mapped = bank <= 0x3F || bank >= 0x80 && bank <= 0xBF || bank === 0x7E;
    assert.equal(r.handled, mapped); if (!mapped) assert.equal(r.reason, 'slot_motion_prefix_bank_required');
  }
});

test('Every negative0CC2 returns without counter knowledge and without data or slot effects', () => {
  const data = createSlotMotionData();
  for (let offset = 0x8000; offset <= 0xFFFF; offset++) {
    word(data, 0x7E0CC2, offset); const r = prefix(data);
    assert.deepEqual(r, { handled: true, outcome: 'inactive', offset, fields: {} });
  }
  assert.equal(data.readPrefixCounter().available, false);
  const s = fixture({ selected: 0xFFFF, counter: null }), before = capture(s);
  assert.equal(s.slots.stepMotionPrefixDE94({ bank: 0x80 }).outcome, 'inactive'); assert.deepEqual(capture(s), before);
});

test('Every65536 counter value follows oldA parity, WORD decrement, expiry and initialzero guard', () => {
  const data = createSlotMotionData(); word(data, 0x7E0CC2, 0);
  for (let old = 0; old <= 0xFFFF; old++) {
    word(data, 0x7E1D65, old); const r = prefix(data); assert.equal(r.handled, true);
    if (!old) { assert.equal(Object.hasOwn(r, 'counterWrite'), false); assert.deepEqual(r.fields, {}); }
    else {
      const expected = Number(BigInt(old) - 1n); assert.equal(r.counterWrite, expected);
      const first = old === 1 ? 0 : BigInt(old) % 2n === 0n ? 4 : 65532;
      const second = old === 1 ? 0 : first === 4 ? 65532 : 4;
      assert.deepEqual(r.fields, { '0D20': first, '0D78': second });
    }
    assert.equal(data.readPrefixCounter().value, old); // Pure plan never decrements the owner.
  }
});

test('Every positive0CC2 with initialzero skips movement bounds, including odd and hostile aliases', () => {
  const data = createSlotMotionData(); word(data, 0x7E1D65, 0);
  for (let offset = 0; offset < 0x8000; offset++) {
    word(data, 0x7E0CC2, offset); assert.equal(prefix(data).outcome, 'counter_zero');
  }
});

test('Reached positiveX movement writes require exactly44 even slots; hostile aliases stop before DEC commit', () => {
  const data = createSlotMotionData(); word(data, 0x7E1D65, 1);
  for (let offset = 0; offset < 0x8000; offset++) {
    word(data, 0x7E0CC2, offset); const r = prefix(data);
    assert.equal(r.handled, offset <= 0x56 && offset % 2 === 0);
    if (!r.handled) assert.deepEqual(r, { handled: false, reason: 'slot_window_required', offset });
  }
  for (const selected of [1, 0x58, 0x1044, 0x1045, 0x1046, 0xFEC, 0xFED, 0xFEE]) {
    const s = fixture({ selected }), before = capture(s); assert.equal(run(s).phase, 'prefix'); assert.deepEqual(capture(s), before);
  }
});

test('Odd counter needs both explicit bytes and dedicated writes cannot touch adjacent unknowns', () => {
  for (const known of [0x7E1D65, 0x7E1D66]) {
    const s = fixture({ counter: null }); s.data.seed(known, [1]); const before = capture(s);
    assert.equal(run(s).address, 0x7E1D65); assert.deepEqual(capture(s), before);
  }
  const data = createSlotMotionData(); data.seed(0x7E1D66, [0xAB]);
  data.writePrefixCounter(0x1234); assert.deepEqual(data.snapshot().bytes, [[0x7E1D65, 0x34], [0x7E1D66, 0x12]]);
  for (const at of [0x7E1D64, 0x7E1D67]) data.seed(at, [0xCD]);
  data.writePrefixCounter(0x5678);
  assert.deepEqual(data.snapshot().bytes, [[0x7E1D64, 0xCD], [0x7E1D65, 0x78], [0x7E1D66, 0x56], [0x7E1D67, 0xCD]]);
  assert.equal(data.writePreludeWords([{ address: 0x7E1D65, value: 0 }]).handled, false);
});

test('Standalone expiry writes unknown movement columns for all44 slots without flags or prior WORD reads', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const data = createSlotMotionData(), slots = createSlotState({ motionData: data });
    word(data, 0x7E0CC2, offset); word(data, 0x7E1D65, 1);
    const before = slots.snapshot(); assert.equal(slots.stepMotionPrefixDE94({ bank: 0x80 }).outcome, 'expired');
    assert.deepEqual(movements(slots, offset), [0, 0]); assert.equal(data.readPrefixCounter().value, 0);
    const expected = structuredClone(before); expected.columns['0D20'][offset / 2] = 0; expected.columns['0D78'][offset / 2] = 0;
    assert.deepEqual(slots.snapshot(), expected);
  }
});

test('Explicit repeated calls alternate oldcounter3/2,expire1,andkeepzero stopped without clock or waits', () => {
  const s = fixture();
  for (const [counter, expected] of [[2, [0xFFFC, 4]], [1, [4, 0xFFFC]], [0, [0, 0]], [0, [0, 0]]]) {
    s.slots.stepMotionPrefixDE94({ bank: 0x80 }); assert.equal(s.data.readPrefixCounter().value, counter);
    assert.deepEqual(movements(s.slots), expected);
  }
});

test('MotionData shares existing specialslot and preserves counter bytes in independent AFC4 plan views', () => {
  const s = fixture(), before = s.data.snapshot(), view = prepareMotionDataView(s.data, []);
  assert.equal(view.data.readSpecialSlot().value, 0); assert.equal(view.data.readPrefixCounter().value, 3);
  view.data.writePrefixCounter(0xABCD); assert.deepEqual(s.data.snapshot(), before);
  const copy = s.data.snapshot(); copy.bytes.at(-1)[1] = 0; assert.deepEqual(s.data.snapshot(), before);
});

test('Composed pure plan sees fresh movement WORDs but touches no live owner or supplied snapshot', () => {
  const s = fixture(), before = capture(s), snapshot = s.slots.snapshot(), saved = structuredClone(snapshot);
  const r = prepareMotionDE94AFC4({ snapshot, scratchBytes: s.slots.readMotionScratchBytes(), motionData: s.data,
    postpassData: s.output, bank: 0x80 });
  assert.equal(r.handled, true); assert.equal(r.afc4.operations.find(op => op.kind === 'body').plan.fields['0E28'], 96);
  assert.deepEqual(snapshot, saved); assert.deepEqual(capture(s), before);
});

test('Invalid public contexts, provider brands, DBRs and counter writes fault without any live effects', () => {
  const s = fixture(), before = capture(s);
  for (const options of [null, [], 'bank80', { bank: -1 }, { bank: 256 }, { bank: 1.5 }, { bank: NaN }]) {
    assert.throws(() => s.slots.stepMotionPrefixDE94(options), /Invalid/);
    assert.throws(() => s.slots.stepMotionDE94AFC4(options), /Invalid/);
  }
  assert.throws(() => run(s, { frameAllocator: {} }), /Invalid/);
  assert.throws(() => prepareMotionPrefixDE94({ motionData: {}, bank: 0x80 }), /Invalid/);
  for (const v of [-1, 65536, null, undefined, 1.5]) assert.throws(() => s.data.writePrefixCounter(v), /Invalid/);
  assert.deepEqual(capture(s), before);
});

test('Inactive or zerocounter DE94 always continues to AFC4,including empty headreset and noCarry gate', () => {
  for (const [selected, counter, outcome] of [[0xFFFF, null, 'inactive'], [0x1045, 0, 'counter_zero']]) {
    const s = fixture({ offsets: [], selected, counter }), r = run(s);
    assert.equal(r.prefix.outcome, outcome); assert.equal(r.outcome, 'empty');
    assert.equal(s.data.readHead(1, 510).value, 0xFFFF); assert.equal(s.slots.snapshot().motionSource.scratchWord40, null);
  }
});

test('Missing prefix counter stops before missingDEAA; shared0CC2 remains unchanged', () => {
  const s = fixture({ counter: null, base: null }), before = capture(s), r = run(s);
  assert.equal(r.phase, 'prefix'); assert.equal(r.address, 0x7E1D65); assert.deepEqual(capture(s), before);
});

test('Missing AFC4 nodebase rolls back both alternating and expiry prefix writes', () => {
  for (const counter of [1, 3]) {
    const s = fixture({ counter, base: null }), before = capture(s), r = run(s);
    assert.equal(r.phase, 'prelude'); assert.equal(r.address, 0x7EDEAA); assert.deepEqual(capture(s), before);
  }
});

test('A late body read failure rolls back prefix counter, earlier slot, Prelude and scratch', () => {
  const s = fixture({ offsets: [0, 2], selected: 2, sources: { 0: { '0E80': null } } }), before = capture(s), r = run(s);
  assert.equal(r.phase, 'body'); assert.equal(r.slotOffset, 0); assert.deepEqual(capture(s), before);
});

test('Late postpass bank crossing rolls back prefix, all bodies, queue,pool,task and scratch owners', () => {
  const asset = { ...postAsset, bytes: [...postAsset.bytes] };
  asset.bytes[0x100] = 2; asset.bytes[0x10C] = 0; asset.bytes[0x7FF7] = 1;
  const allocator = createTaskFrameAllocator({ profileData: profiles });
  const s = fixture({ offsets: [0, 2], selected: 2, asset, sources: { 0: { '1140': 0x7FF7 }, 2: { '1140': 0x100 } } });
  s.slots.seedMotionScratchWord('82', 0); const before = capture(s, allocator), r = run(s, { frameAllocator: allocator });
  assert.equal(r.phase, 'postpass'); assert.equal(r.slotOffset, 0); assert.equal(r.address, 0x9BFFFF);
  assert.deepEqual(capture(s, allocator), before);
});

test('Prefix executes once despite duplicate AFC4 entries; each body adds its planned fullsigned WORDs', () => {
  const s = fixture({ offsets: [0, 2, 0], counter: 2 }); const r = run(s);
  assert.equal(r.handled, true); assert.equal(s.data.readPrefixCounter().value, 1);
  assert.deepEqual(movements(s.slots), [4, 0xFFFC]);
  assert.deepEqual(['0E28', '0E80'].map(key => s.slots.snapshot().columns[key][0]), [108, 192]);
  assert.deepEqual(r.visits.map(v => v.slotOffset), [0, 2, 0, 0, 2, 0]);
});

test('Selected slot outside active list still gets DE94 writes before empty AFC4', () => {
  const s = fixture({ offsets: [], selected: 0x56, counter: 3 });
  assert.equal(run(s).outcome, 'empty'); assert.deepEqual(movements(s.slots, 0x56), [0xFFFC, 4]);
  assert.equal(s.data.readPrefixCounter().value, 2);
});

test('Expiry supplies previously unknown motion columns before AFC4 reads,without reading old movement', () => {
  const s = fixture({ counter: 1, sources: { 0: { '0D20': null, '0D78': null } } });
  assert.equal(run(s).handled, true); assert.deepEqual(movements(s.slots), [0, 0]);
  assert.deepEqual(['0E28', '0E80'].map(key => s.slots.snapshot().columns[key][0]), [100, 200]);
});

test('C9E0 may overwrite DE94 motion while same plan merges0004/0008 in existing task memory', () => {
  const allocator = createTaskFrameAllocator({ profileData: profiles });
  allocator.seedMotionTaskWords(0, { statusWord: 1, eventWord: 0x100 });
  const s = fixture({ counter: 2, sources: { 0: { '7E:40E0': 1, '7E:4138': 0, '7E:4190': 100, '7E:41E8': 200,
    '1350': 0, '1090': 0x8000, '7E:3FD8': 1, '10E8': 0 } } });
  const before = allocator.snapshot(); assert.equal(run(s, { frameAllocator: allocator }).handled, true);
  assert.deepEqual(movements(s.slots), [0, 0]); assert.equal(s.data.readPrefixCounter().value, 1);
  assert.equal(allocator.readMotionTaskWord(0, 'eventWord').value, 0x10C);
  assert.deepEqual(allocator.snapshot().workspace, before.workspace);
});

test('Supported DE94 bank7E stays explicit if later C9E0 needs actual ROMbank00/80;failure rolls prefix back', () => {
  const s = fixture({ sources: { 0: { '7E:40E0': 1, '7E:4138': 2, '7E:4190': 132, '7E:41E8': 232, '1198': 2 } } });
  const before = capture(s), r = run(s, { bank: 0x7E });
  assert.equal(r.reason, 'slot_motion_direction_bank_required'); assert.deepEqual(capture(s), before);
});

test('Late unknown queue cursor also retains earlier C9E0 workspace, taskflags and DE94 counter', () => {
  const allocator = createTaskFrameAllocator({ profileData: profiles });
  allocator.seedMotionTaskWords(0, { statusWord: 1, eventWord: 0x100 });
  const s = fixture({ offsets: [0, 2, 4], selected: 4, sources: {
    4: { '7E:40E0': 1, '7E:4138': 2, '7E:4190': 132, '7E:41E8': 200, '1198': 2 },
    2: { '7E:40E0': 1, '7E:4138': 0, '7E:4190': 100, '7E:41E8': 200, '1350': 0 },
    0: { '1140': 0x100 },
  } });
  const before = capture(s, allocator), r = run(s, { frameAllocator: allocator });
  assert.equal(r.phase, 'postpass'); assert.equal(r.slotOffset, 0);
  assert.equal(r.reason, 'slot_motion_postpass_scratch_source_required'); assert.equal(r.address, 0x82);
  assert.deepEqual(capture(s, allocator), before);
});

test('Original252/217 CLI separates missing prefix bank from explicit syntheticDE94/AFC4 fixture and preserves waits', () => {
  const command = (...flags) => JSON.parse(execFileSync(process.execPath, ['tools/run-slot-action-ac.mjs', '--fixture-no-audio', '--visit-spawned', '--fixture-target-9d', ...flags], { encoding: 'utf8' }));
  const baseline = command(), missing = command('--step-motion-de94-afc4');
  assert.equal(missing.motionDE94AFC4Probe.response.reason, 'slot_motion_prefix_bank_required');
  assert.deepEqual(missing.motionDE94AFC4Probe.after, missing.motionDE94AFC4Probe.before);
  const r = command('--step-motion-de94-afc4', '--fixture-motion-de94-afc4');
  assert.equal(r.motionDE94AFC4Probe.response.handled, true);
  assert.equal(new Map(r.motionDE94AFC4Probe.after.motionData.bytes).get(0x7E1D65), 2);
  assert.deepEqual(['0E28', '0E80', '0ED8'].map(key => r.slots.columns[key][42]), [484, 1824, 1725]);
  assert.deepEqual(['0E28', '0E80', '0ED8'].map(key => r.slots.columns[key][43]), [492, 1824, 256]);
  assert.deepEqual(['0D20', '0D78'].map(key => r.slots.columns[key][42]), [0xFFFC, 4]);
  assert.equal(r.slots.columns['1458'][42], 0x69);
  assert.deepEqual(r.slots.counts.slice(42, 44), [2, 2]); assert.deepEqual(r.slots.heads.slice(42, 44), [4, 8]);
  assert.equal(r.slots.motionSource.postpassScratchWords['82'], 16);
  assert.deepEqual(r.tasks, baseline.tasks); assert.deepEqual(r.workspace, baseline.workspace); assert.deepEqual(r.ac, baseline.ac);
  for (const flags of [['--fixture-motion-de94-afc4'], ['--step-motion-de94-afc4', '--step-motion-afc4'], ['--step-motion-de94-afc4', '--step-motion']]) {
    assert.throws(() => command(...flags), e => e.stderr.includes('Usage:'));
  }
});
