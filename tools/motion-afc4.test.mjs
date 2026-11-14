import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotMotionData, prepareMotionDataView } from '../proof/state/slot-motion-data.mjs';
import { createSlotMotionPostpassData } from '../proof/state/slot-motion-postpass-data.mjs';
import { createSlotMotionDirectionData } from '../proof/state/slot-motion-direction-data.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { prepareMotionAFC4 } from '../proof/state/slot-motion-afc4.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles, isTaskFrameAllocator } from '../proof/script/task-frames.mjs';
import { createMotionTaskPlan, isMotionTaskSource } from '../proof/script/motion-task-plan.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const postAsset = await load('motion-postpass-data'), actionAsset = await load('slot-action-data');
const directionData = createSlotMotionDirectionData(await load('slot-motion-direction-data'));
const profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const memory = () => createTaskFrameAllocator({ profileData: profiles });
const source = overrides => ({ '1458': 0, '7E:40E0': 0, '0E28': 100, '0E80': 200, '0ED8': 300,
  '0D20': 4, '0D78': 0, '0DD0': 0, '1140': 0, '7E:4088': 0, '7E:4030': 128,
  '1090': 0, '7E:3FD8': 2, '10E8': 0, '1198': 0, '11F0': 0, '1350': 0xFFFF, '1038': 0,
  '7E:4240': 0, '7E:4298': 0, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 0, ...overrides });
const frameFixture = () => {
  const fixture = { ...postAsset, bytes: [...postAsset.bytes] };
  for (const raw of [0x100, 0x200]) {
    fixture.bytes[raw] = raw === 0x200 ? 20 : 2;
    for (let i = 1; i <= 8; i++) fixture.bytes[raw + i] = i;
    fixture.bytes[raw + 12] = 0;
  }
  return fixture;
};
const make = ({ offsets = [0], sources = {}, base = 0x20, fixture = frameFixture(), actionData = null, firstHeads = false } = {}) => {
  const data = createSlotMotionData(), postpass = createSlotMotionPostpassData(fixture);
  if (base !== null) data.seed(0x7EDEAA, [base & 255, base >>> 8]);
  if (firstHeads) data.seed(0x7EDEAC, Array(512).fill(255));
  const slots = createSlotState({ motionData: data, motionPostpassData: postpass, motionDirectionData: directionData, actionData });
  for (const offset of new Set(offsets)) slots.seedSlot(offset, { definitionWord: 0, count: 0, head: 0,
    fields: Object.fromEntries(Object.entries(source(sources[offset])).filter(([, value]) => value !== null)) });
  slots.seedActiveList(offsets); return { slots, data, postpass };
};
const capture = (s, allocator = null) => ({ slots: s.slots.snapshot(), scratch: s.slots.readMotionScratchBytes(),
  data: s.data.snapshot(), output: s.postpass.snapshot(), memory: allocator?.snapshot() });
const run = (s, options = {}) => s.slots.stepMotionAFC4({ bank: 0x80, ...options });
const pure = (s, options = {}) => prepareMotionAFC4({ snapshot: s.slots.snapshot(), scratchBytes: s.slots.readMotionScratchBytes(),
  motionData: s.data, postpassData: s.postpass, directionData, bank: 0x80, ...options });
const queueWord = (data, address) => { const bytes = new Map(data.snapshot().outputBytes); return bytes.get(address) | bytes.get(address + 1) << 8; };

test('AFC4 caller source pins every originalbyte,exact callee order,40 write,andtwo descending passes', async () => {
  const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
  const report = JSON.parse(await readFile(new URL('../analysis/motion-postpass-ac2f.json', import.meta.url), 'utf8'));
  const raw = rom.subarray(0x2FC4, 0x2FFC), caller = report.caller_windows[0];
  assert.equal(raw.length, 56); assert.equal(createHash('sha256').update(raw).digest('hex'), caller.sha256);
  assert.equal(raw.toString('hex').toUpperCase(), caller.machine_bytes);
  assert.equal(raw.toString('hex'), '22998781acb014302ebeb214bd5814890004d0055a2026ab7a888810eca98c008540acb014beb214bd5814890004d003202fac888810ee60');
});

test('Motiondata planning view preservesunknowns andordered oddaliases withouttouchingoriginal owner', () => {
  const s = make(), before = s.data.snapshot();
  const r = prepareMotionDataView(s.data, [{ address: 0x7EE0AC, value: 0x1234 }, { address: 0x7EE0AD, value: 0xABCD }]);
  assert.equal(r.data.readHead(1, 0).value, 0xCD34); assert.equal(r.data.readHead(1, 1).value, 0xABCD);
  assert.equal(r.data.readHead(0, 0).available, false); assert.deepEqual(s.data.snapshot(), before);
  assert.equal(prepareMotionDataView(s.data, [{ address: 0x7EE0AC, value: 1 }, { address: 0x7EDEAA, value: 0 }]).handled, false);
  assert.deepEqual(s.data.snapshot(), before); assert.throws(() => prepareMotionDataView({}, []), /Invalid/);
});

test('Taskplanning view brands onlythemotionreadcontract andmergesstaged flags withoutheap orlivewrites', () => {
  const allocator = memory(); allocator.seedMotionTaskWords(0, { statusWord: 1, eventWord: 0x100 });
  const before = allocator.snapshot(), plan = createMotionTaskPlan(allocator);
  assert.equal(isMotionTaskSource(plan.source), true); assert.equal(isTaskFrameAllocator(plan.source), false);
  assert.equal(isMotionTaskSource({}), false); plan.stageEvent({ offset: 0, value: 0x104 });
  const flags = plan.source.readMotionTaskWord(0, 'eventWord').value; plan.stageEvent({ offset: 0, value: flags | 8 });
  assert.equal(plan.source.readMotionTaskWord(0, 'eventWord').value, 0x10C);
  assert.deepEqual(allocator.snapshot(), before); assert.equal(plan.source.readMotionTaskWord(2, 'eventWord').available, false);
  assert.throws(() => plan.stageEvent({ offset: 2, value: 0 }), /Uncovered/); assert.throws(() => createMotionTaskPlan({}), /Invalid/);
});

test('Empty AFC4 stillrequiresDEAA andresets256 secondheads,butneverwritescaller40 orreadsfields', () => {
  const missing = make({ offsets: [], base: null }), before = capture(missing);
  assert.deepEqual(run(missing), { handled: false, reason: 'slot_motion_data_source_required', address: 0x7EDEAA, phase: 'prelude' });
  assert.deepEqual(capture(missing), before);
  const s = make({ offsets: [] }); assert.deepEqual(run(s), { handled: true, outcome: 'empty', visits: [] });
  assert.equal(s.data.readHead(1, 510).value, 0xFFFF); assert.equal(s.data.readHead(0, 0).available, false);
  assert.equal(s.slots.snapshot().motionSource.scratchWord40, null);
});

test('Every supported negative emptycursor respectsfirstguard andrestoresnoinvented neighboringbytes', () => {
  const s = make({ offsets: [] }), context = s.slots.snapshot();
  for (const lastOffset of [0x8000, 0x8001, 0x8056, 0xFFFD, 0xFFFE, 0xFFFF]) {
    const plan = pure(s, { snapshot: { ...context, activeList: { ...context.activeList, lastOffset } } });
    assert.equal(plan.outcome, 'empty'); assert.equal(plan.operations.length, 1);
  }
});

test('All44 slots and0400/0100/lowflags combinations preserveexact two-pass skips andconditional Prelude reads', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) for (const flags of [0, 8, 0x20, 0x40, 0x100, 0x400, 0x500, 0xFFFF]) {
    const s = make({ offsets: [offset], sources: { [offset]: { '1458': flags, '0D20': 0, '0DD0': 0, '7E:43A0': 0 } } });
    const before = capture(s), r = run(s); assert.equal(r.handled, true);
    assert.deepEqual(r.visits.map(v => [v.phase, v.cursor, v.slotOffset, v.skipped]), [['body', 0, offset, !!(flags & 0x400)], ['postpass', 0, offset, !!(flags & 0x400)]]);
    if (flags & 0x400) assert.deepEqual(s.slots.snapshot().columns, before.slots.columns);
    assert.equal(s.slots.snapshot().motionSource.scratchWord40, 0x8C);
  }
});

test('Bothpasses descendactualentries includingduplicates;eachbody seesearliercoordinatewrites', () => {
  const s = make({ offsets: [0, 2, 0] }); const r = run(s);
  assert.deepEqual(r.visits.map(v => v.slotOffset), [0, 2, 0, 0, 2, 0]);
  assert.equal(s.slots.snapshot().columns['0E28'][0], 108); assert.equal(s.slots.snapshot().columns['0E28'][1], 104);
  assert.equal(s.slots.snapshot().columns['7E:4030'][0], 0); assert.equal(s.slots.snapshot().motionSource.scratchWord6B, 300);
});

test('FreshPrelude record is consumedbyreal80B2 inthe sameplan,includingmetadata andspecialslotread', () => {
  const s = make({ offsets: [0, 2], firstHeads: true, sources: {
    0: { '1458': 0x40, '0E28': 256, '0E80': 0, '7E:43A0': 1 },
    2: { '1458': 0x500, '0E28': 260, '0E80': 0, '7E:43A0': 10, '7E:4298': 4, '7E:4348': 4 },
  } }); s.data.seed(0x7E0CC2, [0xFF, 0xFF]);
  assert.equal(run(s).handled, true); const snap = s.slots.snapshot();
  assert.equal(snap.columns['0E28'][0], 256); assert.equal(snap.columns['1458'][0], 0x48);
  assert.equal(s.data.readRecordField(0xA74, 5).value, 85); assert.equal(s.data.readMetadata(0xA74).value, 2);
});

test('Latebody sourcefailure retainsPrelude heads andall earlierbody slotsandscratch', () => {
  const s = make({ offsets: [0, 2], sources: { 0: { '0E80': null } } }), before = capture(s);
  const r = run(s); assert.equal(r.phase, 'body'); assert.equal(r.slotOffset, 0); assert.equal(r.field, '0E80');
  assert.deepEqual(capture(s), before);
});

test('LastpostpassfullWORD failure discardsPrelude,bothbodies,earlierpool/output writes andcaller40', () => {
  const fixture = frameFixture(); fixture.bytes[0x7FF7] = 1;
  const s = make({ offsets: [0, 2], fixture, sources: { 0: { '1140': 0x7FF7 }, 2: { '1140': 0x100 } } });
  s.slots.seedMotionScratchWord('82', 0); const before = capture(s), r = run(s);
  assert.equal(r.phase, 'postpass'); assert.equal(r.slotOffset, 0); assert.equal(r.address, 0x9BFFFF);
  assert.deepEqual(capture(s), before);
});

test('Sharedpool/cursor reuse acrosspostpasses prependsfourrealnodes andemitscorrect tablewords', () => {
  const s = make({ offsets: [0, 2], sources: { 0: { '1140': 0x100 }, 2: { '1140': 0x100 } } });
  s.slots.seedMotionScratchWord('82', 0); assert.equal(run(s).handled, true); const snap = s.slots.snapshot();
  assert.deepEqual(snap.counts.slice(0, 2), [2, 2]); assert.deepEqual(snap.heads.slice(0, 2), [8, 4]);
  assert.equal(snap.pool.freeCount, 60); assert.equal(snap.pool.freeHead, 10);
  assert.equal(snap.pool.links[4], 6); assert.equal(snap.pool.links[3], 0); assert.equal(snap.motionSource.postpassScratchWords['82'], 16);
  assert.equal(queueWord(s.postpass, 0x1756), 0x40); assert.equal(queueWord(s.postpass, 0x175E), 0x80);
});

test('BudgetretryCarry1 doesnotabortcaller,nextslot emitsafterearlierbody updates', () => {
  const s = make({ offsets: [0, 2], sources: { 0: { '1140': 0x100 }, 2: { '1140': 0x200 } } });
  s.slots.seedMotionScratchWord('82', 0); assert.equal(run(s).handled, true); const snap = s.slots.snapshot();
  assert.equal(snap.columns['1140'][1], 0x200); assert.equal(snap.columns['1140'][0], 0);
  assert.deepEqual(snap.counts.slice(0, 2), [2, 0]); assert.deepEqual(snap.columns['0E28'].slice(0, 2), [104, 104]);
  assert.equal(snap.motionSource.postpassScratchWords['82'], 8);
});

test('Strictpool equalityretry doesnotabortcaller;equal-size later slotusesexistingnodes', () => {
  const s = make({ offsets: [0, 2], sources: { 0: { '1140': 0x100 }, 2: { '1140': 0x100 } } });
  s.slots.seedSlot(0, { definitionWord: 0, count: 2, head: 2 });
  s.slots.seedPool({ count: 2, head: 6, linkWords: [{ offset: 2, next: 4 }, { offset: 4, next: 0 }] });
  s.slots.seedMotionScratchWord('82', 0); assert.equal(run(s).handled, true); const snap = s.slots.snapshot();
  assert.equal(snap.columns['1140'][1], 0x100); assert.deepEqual(snap.counts.slice(0, 2), [2, 0]); assert.equal(snap.pool.freeCount, 2);
});

test('C9E0flag4 andAC2Fflag8 mergethe sameactualtask eventword,withoutanywaitcheck', () => {
  const allocator = memory(); allocator.seedMotionTaskWords(0, { statusWord: 1, eventWord: 0x100 });
  const s = make({ sources: { 0: { '7E:40E0': 1, '7E:4138': 0, '7E:4190': 100, '7E:41E8': 200,
    '1350': 0, '1140': 0, '1090': 0x8000, '7E:3FD8': 1, '10E8': 0 } } });
  const before = allocator.snapshot(); assert.equal(run(s, { frameAllocator: allocator }).handled, true);
  const after = allocator.snapshot(); assert.equal(after.slots[0].eventWord, 0x10C); assert.equal(after.slots[0].statusWord, 1);
  assert.deepEqual(after.heap, before.heap); assert.deepEqual(after.workspace, before.workspace);
});

test('Terminaltask X fromearlyAC2F stop doesnotreplacecallerlistcursor ornextslot', () => {
  const allocator = memory(); allocator.seedMotionTaskWords(0x5E, { statusWord: 1, eventWord: 0 });
  const s = make({ offsets: [0, 2], sources: { 0: { '1140': 0x100 }, 2: { '1350': 0x5E, '1090': 0x8000, '7E:3FD8': 1 } } });
  s.slots.seedMotionScratchWord('82', 0); const r = run(s, { frameAllocator: allocator });
  assert.equal(r.handled, true); assert.equal(r.visits.at(-1).slotOffset, 0); assert.equal(allocator.readMotionTaskWord(0x5E, 'eventWord').value, 8);
  assert.equal(s.slots.snapshot().counts[0], 2);
});

test('C9E0 targetread seesearlierbody movement ofanothertargetslot', () => {
  const allocator = memory(); const s = make({ offsets: [0, 2], sources: {
    0: { '7E:40E0': 1, '7E:4138': 2, '7E:4190': 0, '7E:41E8': 2, '1198': 2 },
    2: { '0E28': 80, '0D20': 60 },
  } }); assert.equal(run(s, { frameAllocator: allocator }).handled, true); const snap = s.slots.snapshot();
  assert.equal(snap.columns['0E28'][1], 140); assert.equal(snap.columns['0D20'][0], 2); assert.equal(snap.columns['0E28'][0], 102);
  assert.equal(snap.targetSource.scratchWords.A2, 40); assert.deepEqual(allocator.snapshot().workspace.slice(0, 2), [0, 2]);
});

test('C9E0/6A lowbytewrite feedswhole11F0 streamcursor underactualcallerBYTE40', () => {
  const asset = { ...actionAsset, bytes: [...actionAsset.bytes] }; asset.bytes[2] = 5; asset.bytes[3] = 4;
  asset.bytes[0x101] = 0; asset.bytes[0x102] = 1;
  const actionData = createSlotActionData(asset), allocator = memory();
  const s = make({ actionData, sources: { 0: { '7E:40E0': 1, '7E:4138': 0, '7E:4190': 132, '7E:41E8': 200,
    '1198': 3, '10E8': 1, '1090': 0x8000, '11F0': 0x100 } } }); s.slots.seedMotionScratchWord('82', 0);
  assert.equal(run(s, { frameAllocator: allocator }).handled, true); const snap = s.slots.snapshot();
  assert.equal(snap.columns['11F0'][0], 0x103); assert.equal(snap.counts[0], 2); assert.deepEqual(snap.fieldBytes['11F0'][0], [3, 1]);
  assert.deepEqual(allocator.snapshot().workspace.slice(4, 6), [0x8000, 0x8C]);
});

test('Lateunknownqueuecursor retainsC9E0workspace,taskflags andallpriorplanned writes', () => {
  const allocator = memory(); allocator.seedMotionTaskWords(0, { statusWord: 1, eventWord: 0x100 });
  const s = make({ offsets: [0, 2, 4], sources: {
    4: { '7E:40E0': 1, '7E:4138': 0, '7E:4190': 132, '7E:41E8': 200, '1198': 2 },
    2: { '7E:40E0': 1, '7E:4138': 0, '7E:4190': 100, '7E:41E8': 200, '1350': 0 },
    0: { '1140': 0x100 },
  } }); const before = capture(s, allocator), r = run(s, { frameAllocator: allocator });
  assert.equal(r.phase, 'postpass'); assert.equal(r.slotOffset, 0); assert.equal(r.reason, 'slot_motion_postpass_scratch_source_required'); assert.equal(r.address, 0x82);
  assert.deepEqual(capture(s, allocator), before);
});

test('Missingworkspaceowner failsbeforeanyAFC4write evenwhendirection andallfields areknown', () => {
  const s = make({ sources: { 0: { '7E:40E0': 1, '7E:4138': 2, '7E:4190': 132, '7E:41E8': 200, '1198': 2 } } });
  const before = capture(s), r = run(s); assert.equal(r.reason, 'slot_motion_workspace_required'); assert.equal(r.phase, 'body');
  assert.deepEqual(capture(s), before);
});

test('Oneinherited DBR servesbothC9E0 andAC2F tables; unsupportedbank failsatactual readonly', () => {
  const allocator = memory(); const s = make({ sources: { 0: { '7E:40E0': 1, '7E:4138': 2, '7E:4190': 132, '7E:41E8': 200, '1198': 2 } } });
  const before = capture(s, allocator); assert.equal(run(s, { bank: 0x81, frameAllocator: allocator }).reason, 'slot_motion_direction_bank_required'); assert.deepEqual(capture(s, allocator), before);
  const output = make({ sources: { 0: { '1140': 0x100 } } }); output.slots.seedMotionScratchWord('82', 0);
  assert.equal(run(output, { bank: 0x81 }).reason, 'slot_motion_postpass_table_bank_required');
  assert.equal(run(make(), { bank: null }).handled, true);
});

test('Caller40 writesexactsharedbytes afterPrelude41,whileunknownBYTE42 isneverinvented', () => {
  const s = make({ offsets: [0, 2], sources: { 2: { '1458': 0x500, '7E:43A0': 1, '0E28': 256 } } });
  assert.equal(run(s).handled, true); assert.equal(s.slots.snapshot().motionSource.preludeScratchWords['41'], 0);
  assert.equal(s.slots.snapshot().motionSource.scratchWord40, 0x8C);
  const partial = make(); assert.equal(run(partial).handled, true);
  assert.equal(partial.slots.snapshot().motionSource.preludeScratchWords['41'], null);
  assert.equal(new Map(partial.slots.readMotionScratchBytes()).get(0x42), null);
});

test('CoveredoddPrelude nodes keepactualbytealiases visible insharedMotionData', () => {
  const s = make({ base: 0x21, sources: { 0: { '1458': 0x500, '7E:43A0': 1 } } });
  assert.equal(run(s).handled, true); assert.equal(s.data.readNodeRecord(0x21).value, 0xA74);
  assert.equal(s.data.readNextNode(0x21).value, 0xFFFF); assert.equal(s.data.readMetadata(0xA74).value, 0);
});

test('PureAFC4 plans remainindependent ofmutatedreturnedwrites andretainallinput/liveowners', () => {
  const s = make({ sources: { 0: { '1140': 0x100 } } }); s.slots.seedMotionScratchWord('82', 0);
  const before = capture(s), first = pure(s), expected = pure(s);
  first.operations[0].plan.dataWrites[0].value = 1; first.operations.at(-1).plan.outputWrites[0].value = 0;
  assert.deepEqual(pure(s), expected); assert.deepEqual(capture(s), before);
});

test('MalformedAFC4 contextandpartialinvalidsources failbeforeliveeffects', () => {
  const s = make(), before = capture(s);
  for (const options of [null, [], 'bank80', { bank: -1 }, { bank: 256 }, { frameAllocator: {} }]) assert.throws(() => s.slots.stepMotionAFC4(options), /Invalid/);
  for (const options of [{ snapshot: {} }, { snapshot: { ...s.slots.snapshot(), columns: {} } }, { scratchBytes: [undefined] }, { motionData: {} }, { postpassData: {} }, { actionData: {} }, { directionData: {} }]) assert.throws(() => pure(s, options), /Invalid/);
  assert.deepEqual(capture(s), before);
});

test('Original252/217 AFC4 CLI buildsrecord,movesoriginalslots andemitsbothpostpasses withsamewaitchecks', () => {
  const base = ['tools/run-slot-action-ac.mjs', '--fixture-no-audio', '--visit-spawned', '--fixture-target-9d'];
  const command = (...flags) => JSON.parse(execFileSync(process.execPath, [...base, ...flags], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }));
  const baseline = command(), missing = command('--step-motion-afc4');
  assert.equal(missing.motionAFC4Probe.response.phase, 'prelude'); assert.deepEqual(missing.motionAFC4Probe.before, missing.motionAFC4Probe.after);
  const r = command('--step-motion-afc4', '--fixture-motion-afc4'); assert.equal(r.motionAFC4Probe.response.handled, true);
  assert.deepEqual(r.motionAFC4Probe.response.visits.map(v => v.slotOffset), [0x54, 0x56, 0x54, 0x56]);
  assert.deepEqual(['0E28', '0E80', '0ED8'].map(key => r.slots.columns[key][42]), [330, 1496, 1725]);
  assert.deepEqual(r.slots.counts.slice(42), [2, 2]); assert.equal(r.slots.pool.freeCount, 60); assert.equal(r.slots.motionSource.postpassScratchWords['82'], 16);
  assert.equal(r.motionAFC4Probe.after.output.outputBytes.length, 48);
  for (const key of ['tasks', 'workspace', 'activeOrder', 'ac']) assert.deepEqual(r[key], baseline[key]);
  assert.deepEqual(r.motionAFC4Probe.after.memory, r.motionAFC4Probe.before.memory);
  for (const flags of [['--fixture-motion-afc4'], ['--step-motion-afc4', '--step-motion'], ['--step-motion-afc4', '--step-motion-postpass']]) assert.throws(() => command(...flags), e => e.stderr.includes('Usage:'));
});
