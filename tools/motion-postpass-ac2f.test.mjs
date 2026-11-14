import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotMotionPostpassData, isSlotMotionPostpassData } from '../proof/state/slot-motion-postpass-data.mjs';
import { prepareMotionPostpassAC2F } from '../proof/state/slot-motion-postpass-ac2f.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const asset = await load('motion-postpass-data'), streamAsset = await load('slot-action-data');
const original = await load('scripts'), profiles = createTaskFrameProfiles(await load('task-frame-profiles'));
const definitions = createSlotDefinitions(await load('slot-definitions'));
const rom = await readFile(new URL('../Shadowrun (E).smc', import.meta.url));
const pairs = [0x1234, 0x5678, 0x9ABC, 0xDEF0];
const initialLinks = Array.from({ length: 120 }, (_, i) => i * 2 + 2 + ((i * 2 + 2) & 0x10));
const fields = (overrides = {}) => ({ '1140': 0x100, '7E:4088': 128, '7E:4030': 0, '1090': 0x8000,
  '7E:3FD8': 2, '10E8': 0, '11F0': 0, '1198': 4, '1038': 5, '1350': 0xFFFF, ...overrides });
const frameAsset = ({ count = 2, raw = 0x100, tail = 0, signed = 0 } = {}) => {
  const fixture = { ...asset, bytes: [...asset.bytes] }, at = (raw >>> 15) * 0x8000 + (raw & 0x7FFF);
  fixture.bytes[at] = count;
  for (let j = 0; j < count * 2; j++) {
    const word = pairs[j % 4], address = at + 1 + j * 2;
    fixture.bytes[address] = word & 255; fixture.bytes[address + 1] = word >>> 8;
  }
  fixture.bytes[at + 1 + count * 4 + 3] = tail;
  fixture.bytes[at - 1] = signed;
  return fixture;
};
const stream = raw => {
  const fixture = { ...streamAsset, bytes: [...streamAsset.bytes] };
  fixture.bytes[0] = raw & 255; fixture.bytes[1] = raw >>> 8;
  fixture.bytes[4] = 0; fixture.bytes[5] = 0xF0; // WORD read; onlylowbyte choosesoffset0.
  return createSlotActionData(fixture);
};
const data = createSlotMotionPostpassData(frameAsset()), actionData = stream(0x100);
const context = (overrides = {}) => ({ offset: 0, fields: fields(), count: 0, head: 0, freeCount: 64,
  freeHead: 2, links: initialLinks, scratchBytes: [[0x82, 0], [0x83, 0], [0x40, 0x8C], [0x41, 0]],
  postpassData: data, actionData, tableBank: 0x80, ...overrides });
const make = ({ source = fields(), count = 0, head = 0, offset = 0, fixture = frameAsset(), provider = true,
  motionData = null, cursor = 0, streamData = actionData } = {}) => {
  const postpassData = provider ? createSlotMotionPostpassData(fixture) : null;
  const slots = createSlotState({ definitionData: definitions, motionPostpassData: postpassData, actionData: streamData, motionData });
  slots.seedSlot(offset, { definitionWord: 11, count, head, fields: source });
  if (cursor !== null) slots.seedMotionScratchWord('82', cursor);
  slots.seedMotionScratchWord40(0x8C);
  return { slots, postpassData, offset };
};
const capture = (slots, provider, allocator = null) => ({ slots: slots.snapshot(), scratch: slots.readMotionScratchBytes(),
  data: provider?.snapshot(), tasks: allocator?.snapshot() });
const run = setup => setup.slots.stepMotionPostpassAC2F(setup.offset, { tableBank: 0x80 });
const outputWord = (provider, address) => { const map = new Map(provider.snapshot().outputBytes); return map.get(address) | map.get(address + 1) << 8; };
const scratchPlan = plan => { const map = new Map(); for (const w of plan.scratchWrites) map.set(w.address, w.value); return map; };

test('Postpassasset pins65536 original9B/9C bytes and272 tablebytes with independent digests;every WORD read matchesROM', () => {
  assert.deepEqual(Buffer.from(asset.bytes), rom.subarray(0xD8000, 0xE8000));
  assert.equal(createHash('sha256').update(Buffer.from(asset.bytes)).digest('hex'), 'a0908b2b84853a7ea199ecc8dd1397477f9b0a3ca19459119d5a62db56d384ba');
  assert.equal(asset.dataSha256, 'a0908b2b84853a7ea199ecc8dd1397477f9b0a3ca19459119d5a62db56d384ba');
  assert.deepEqual(Buffer.from(asset.tableBytes), rom.subarray(0x2EB4, 0x2FC4));
  assert.equal(asset.tableSha256, 'aee4a74f6f574e0e6e52ac22b385abf91222479531e8f6b78c1d08dece3fe064');
  const originalData = createSlotMotionPostpassData(asset);
  for (const bank of [0x9B, 0x9C]) for (let word = 0x8000; word < 0xFFFF; word++) {
    assert.equal(originalData.readFrameWord(bank << 16 | word).value, rom.readUInt16LE(0xD8000 + (bank - 0x9B) * 0x8000 + word - 0x8000));
  }
});

test('Frame provider keeps full24-bit indexed addition,two readbytes,odd addresses and explicit holes/bank limits', () => {
  const d = createSlotMotionPostpassData(asset);
  for (const pointer of [0x9A8000, 0x9B7FFF, 0x9BFFFF, 0x9C0000, 0x9C7FFF, 0x9CFFFF, 0x9D8000, 0xFFFFFF]) assert.equal(d.readFrameWord(pointer).available, false);
  assert.equal(d.readFrameWord(0x9BFFFF, 1).available, false);
  assert.deepEqual(d.readFrameWord(0x9BFFFF, 0x8001), d.readFrameWord(0x9C8000));
  assert.equal(d.readFrameWord(0x9B7FFF, 1).available, true);
  for (const pointer of [-1, null, '9B8000', 0x1000000, 1.5]) assert.throws(() => d.readFrameWord(pointer), /Invalid/);
  for (const index of [-1, null, 65536, 1.5]) assert.throws(() => d.readFrameWord(0x9B8000, index), /Invalid/);
});

test('All table banks and every covered odd/even offset useoverlapping actualbytes;cross-window reads stayexplicit', () => {
  const d = createSlotMotionPostpassData(asset);
  for (let bank = 0; bank < 256; bank++) for (const second of [false, true]) for (const node of [0, 1, 2, 254, 255, 256, 270, 271, 65535]) {
    const at = node + (second ? 16 : 0), r = d.readTableWord(node, second, bank);
    if (![0, 0x80].includes(bank)) assert.equal(r.reason, 'slot_motion_postpass_table_bank_required');
    else if (at + 1 >= 272) assert.equal(r.reason, 'slot_motion_postpass_table_window_required');
    else assert.equal(r.value, rom.readUInt16LE(0x2EB4 + at));
  }
});

test('Output provider validates completebatch beforewrites,preserves overlapping oddbytes,snapshots and copied ROM data', () => {
  const fixture = frameAsset(), d = createSlotMotionPostpassData(fixture); fixture.bytes[0x100] = 0;
  assert.equal(d.readFrameWord(0x9B8100).value & 255, 2); assert.equal(d.snapshot().outputBytes.length, 0);
  assert.deepEqual(d.writeOutputWords([{ address: 0x1654, value: 0x1234 }, { address: 0x1655, value: 0xABCD }]), { handled: true });
  assert.deepEqual(d.snapshot().outputBytes, [[0x1654, 0x34], [0x1655, 0xCD], [0x1656, 0xAB]]);
  const before = d.snapshot(); assert.equal(d.writeOutputWords([{ address: 0x1654, value: 0 }, { address: 0x17D3, value: 2 }]).handled, false);
  assert.deepEqual(d.snapshot(), before); d.snapshot().outputBytes[0][1] = 0; assert.deepEqual(d.snapshot(), before);
  assert.throws(() => d.writeOutputWords([{}, { address: 0x1654, value: 2 }]), /Invalid/);
  assert.equal(isSlotMotionPostpassData(d), true); assert.equal(isSlotMotionPostpassData({}), false);
  for (const bad of [null, {}, { ...asset, sourceRomOffset: '060000' }, { ...asset, bytes: Array(65536) }, { ...asset, tableBytes: [0] }]) assert.throws(() => createSlotMotionPostpassData(bad), /Invalid/);
});

test('Every fractional word preserves overflowCarry and mathematical>=128 advancement,withonlyactuallyreached fieldreads', () => {
  for (let value = 0; value <= 0xFFFF; value++) for (const phase of [0, 0x7F, 0xFFFF]) {
    const total = BigInt(value) + BigInt(phase);
    const plan = prepareMotionPostpassAC2F(context({ fields: { '1140': 0, '7E:4088': value, '7E:4030': phase, '1090': 0 } }));
    assert.equal(plan.handled, true); assert.equal(plan.fields['7E:4030'], Number(total % 128n));
    assert.equal(scratchPlan(plan).get(0x20), Number(total % 65536n));
    assert.equal(plan.outcome, total < 128n ? 'fraction_only' : 'no_stream');
    assert.equal(plan.carry, total < 128n ? 1 : Number(total > 65535n));
    assert.deepEqual(Object.keys(plan.fields), ['7E:4030']);
  }
});

test('FFFF sentinel clears1140 before ordinaryprogress;pending requests bypass speed,timer,stream,cursor andbank40 reads', () => {
  const sentinel = make({ source: { '1140': 0xFFFF, '7E:4088': 0, '7E:4030': 0 }, provider: false });
  assert.equal(run(sentinel).outcome, 'fraction_only'); assert.equal(sentinel.slots.snapshot().columns['1140'][0], 0);
  const request = prepareMotionPostpassAC2F(context({ fields: { '1140': 0x100 }, actionData: null, scratchBytes: [[0x82, 0], [0x83, 0]] }));
  assert.equal(request.handled, true); assert.equal(request.outcome, 'output');
  assert.deepEqual(Object.keys(request.fields), ['1140', '7E:3F80', '0F88']);
  assert.equal(scratchPlan(request).has(0x3E), false);
});

test('Missing fraction/stream/countdown sources retain allstate, including planned sentinelclear andfractionwrites', () => {
  for (const key of ['1140', '7E:4088', '7E:4030', '1090', '7E:3FD8', '11F0']) {
    const source = fields({ '1140': 0, [key]: null });
    const s = make({ source: Object.fromEntries(Object.entries(source).filter(([, v]) => v !== null)) });
    const before = capture(s.slots, s.postpassData), result = run(s);
    assert.equal(result.handled, false); assert.equal(result.field, key); assert.deepEqual(capture(s.slots, s.postpassData), before);
  }
  const s = make({ source: { '1140': 0xFFFF } }); const before = capture(s.slots, s.postpassData);
  assert.equal(run(s).field, '7E:4088'); assert.deepEqual(capture(s.slots, s.postpassData), before);
});

test('Ordinary cursor requiresboth11F0 bytes;unknownbank40/highROMread and lowwordwrap fail atomically', () => {
  const s = make({ source: Object.fromEntries(Object.entries(fields({ '1140': 0 })).filter(([k]) => k !== '11F0')) });
  s.slots.seedSlotFieldByte(0, '11F0', 0, 0); const before = capture(s.slots, s.postpassData);
  assert.equal(run(s).field, '11F0'); assert.deepEqual(capture(s.slots, s.postpassData), before);
  for (const scratchBytes of [[[0x82, 0], [0x83, 0]], [[0x82, 0], [0x83, 0], [0x40, 0x7E]]]) {
    const plan = prepareMotionPostpassAC2F(context({ fields: fields({ '1140': 0 }), scratchBytes })); assert.equal(plan.handled, false);
  }
  const wrap = make({ source: fields({ '1140': 0, '11F0': 0xFFFF }) }), unchanged = capture(wrap.slots, wrap.postpassData);
  assert.equal(run(wrap).reason, 'slot_action_data_window_required'); assert.deepEqual(capture(wrap.slots, wrap.postpassData), unchanged);
});

test('All countdown words decrement moduloWORD;only1 expires,andzero becomesFFFF instead ofstop', () => {
  for (let timer = 0; timer <= 0xFFFF; timer++) {
    const plan = prepareMotionPostpassAC2F(context({ fields: fields({ '1140': 0, '7E:3FD8': timer }) }));
    assert.equal(plan.handled, true); assert.equal(plan.fields['7E:3FD8'], Number((BigInt(timer) + 65535n) % 65536n));
    assert.equal(plan.outcome, timer === 1 ? 'stopped' : 'output');
    if (timer !== 1) assert.equal(plan.fields['11F0'], 2);
  }
});

test('Expiry1..7F preserves10E8;>=80 masksandclearswholeWORD;1198 readsWORD thenlowoffset withordered writes', () => {
  for (const reload of [1, 2, 0x7F, 0x80, 0x81, 0x100, 0x8000, 0xFFFF]) {
    const s = make({ source: fields({ '1140': 0, '7E:3FD8': 1, '10E8': reload }) });
    assert.equal(run(s).outcome, 'output'); const snapshot = s.slots.snapshot();
    assert.equal(snapshot.columns['7E:3FD8'][0], reload >= 128 ? reload & 127 : reload);
    assert.equal(snapshot.columns['10E8'][0], reload >= 128 ? 0 : reload);
    assert.equal(snapshot.columns['11F0'][0], 2);
  }
  const plan = prepareMotionPostpassAC2F(context({ fields: fields({ '1140': 0, '7E:3FD8': 1, '10E8': 0x80 }) }));
  assert.deepEqual(plan.scratchWrites.filter(w => w.address === 0x13).map(w => w.value), [0x8C, 0x9B]);
});

test('Expiry nonzero needs1198/streamlookup beforecursor;lateoutside8C reads preservealltimer,slot,pool,scratch', () => {
  for (const source of [fields({ '1140': 0, '7E:3FD8': 1, '10E8': 1, '1198': null }), fields({ '1140': 0, '7E:3FD8': 1, '10E8': 1, '1198': 0xFFFF })]) {
    const s = make({ source: Object.fromEntries(Object.entries(source).filter(([, v]) => v !== null)) }); const before = capture(s.slots, s.postpassData);
    assert.equal(run(s).handled, false); assert.deepEqual(capture(s.slots, s.postpassData), before);
  }
});

test('Stopnegative1350 succeedswithoutROM,queueorallocator and changesonlystopfields/sharedscratch', () => {
  const s = make({ source: fields({ '1140': 0, '7E:3FD8': 1, '1350': 0x8000 }), provider: false, cursor: null });
  assert.deepEqual(run(s), { handled: true, outcome: 'stopped', carry: 0 }); const snapshot = s.slots.snapshot();
  assert.equal(snapshot.columns['7E:4088'][0], 0); assert.equal(snapshot.columns['1038'][0], 0x8005);
  assert.equal(snapshot.columns['11F0'][0], 0); assert.equal(snapshot.pool.freeCount, 64);
});

test('All48 taskoffsets preserveexistingeventbits and set0008 inrealallocator;blockedchain reachesfirstnonnegative only', () => {
  const allocator = createTaskFrameAllocator({ profileData: profiles });
  for (let task = 0; task <= 0x5E; task += 2) {
    allocator.seedMotionTaskWords(task, { statusWord: 1, eventWord: 0x8004 });
    const s = make({ source: fields({ '1140': 0, '7E:3FD8': 1, '1350': task }) });
    const before = allocator.snapshot();
    assert.deepEqual(s.slots.stepMotionPostpassAC2F(0, { frameAllocator: allocator }), { handled: true, outcome: 'stopped', carry: 0, terminalTaskOffset: task });
    const expected = structuredClone(before); expected.slots[task / 2].eventWord = 0x800C;
    assert.deepEqual(allocator.snapshot(), expected);
  }
  allocator.seedMotionTaskWords(0, { statusWord: 0xFFFF, successorWord: 2, eventWord: 3 });
  allocator.seedMotionTaskWords(2, { statusWord: 0xFFFF, successorWord: 4, eventWord: 5 });
  allocator.seedMotionTaskWords(4, { statusWord: 0, eventWord: 0x40 });
  const s = make({ source: fields({ '1140': 0, '7E:3FD8': 1, '1350': 0 }) });
  assert.equal(s.slots.stepMotionPostpassAC2F(0, { frameAllocator: allocator }).terminalTaskOffset, 4);
  assert.deepEqual(allocator.snapshot().slots.slice(0, 3).map(slot => slot.eventWord), [3, 5, 0x48]);
});

test('Taskmissingwords,lateinvalidlinks andcycles stopbeforeallplannedstopwrites and preserveheap/workspace/events', () => {
  for (const taskSource of [null, { statusWord: null }, { statusWord: 0, eventWord: null },
    { statusWord: 0xFFFF, successorWord: null }, { statusWord: 0xFFFF, successorWord: 0xFFFF },
    { statusWord: 0xFFFF, successorWord: 0 }]) {
    const allocator = taskSource ? createTaskFrameAllocator({ profileData: profiles }) : null;
    if (taskSource) allocator.seedMotionTaskWords(0, taskSource);
    const s = make({ source: fields({ '1140': 0, '7E:3FD8': 1, '1350': 0 }) });
    const before = capture(s.slots, s.postpassData, allocator);
    assert.equal(s.slots.stepMotionPostpassAC2F(0, { frameAllocator: allocator }).handled, false);
    assert.deepEqual(capture(s.slots, s.postpassData, allocator), before);
  }
});

test('Outputbudget>=50 retrieswithoutpoolreads,butADCoverflow bypassescomparison andretainsactualcursorWORDwrap', () => {
  const retry = prepareMotionPostpassAC2F(context({ count: null, head: null, scratchBytes: [[0x82, 0x48], [0x83, 0]] }));
  assert.equal(retry.outcome, 'retry_output'); assert.equal(retry.fields['1140'], 0x100); assert.equal(retry.outputWrites.length, 0);
  const fixture = createSlotMotionPostpassData(frameAsset({ count: 1 }));
  const overflow = prepareMotionPostpassAC2F(context({ postpassData: fixture, scratchBytes: [[0x82, 0xFE], [0x83, 0xFF]] }));
  assert.equal(overflow.outcome, 'output'); assert.equal(scratchPlan(overflow).get(0x82), 2);
  assert.equal(overflow.outputWrites[0].address, 0x16D4);
});

test('Outputbudget hasexact79/80 boundaries;pooldelta<free succeeds,equalityrequeueswithouthead/link reads', () => {
  const fixture = createSlotMotionPostpassData(frameAsset({ count: 1 }));
  for (const [cursor, outcome] of [[75, 'output'], [76, 'retry_output'], [77, 'retry_output']]) {
    const plan = prepareMotionPostpassAC2F(context({ postpassData: fixture, scratchBytes: [[0x82, cursor], [0x83, 0]] }));
    assert.equal(plan.outcome, outcome);
  }
  const equality = prepareMotionPostpassAC2F(context({ freeCount: 2, head: null }));
  assert.equal(equality.outcome, 'retry_pool'); assert.equal(equality.fields['1140'], 0x100); assert.deepEqual(equality.poolWrites, {});
  const shortage = prepareMotionPostpassAC2F(context({ freeCount: 1, head: null })); assert.equal(shortage.outcome, 'retry_pool');
});

test('Retries commit earlierfraction/countdown/cursor effects once androundtripraw9B/9C requestwithoutadvancingstreamagain', () => {
  for (const raw of [0x100, 0x8100]) {
    const s = make({ fixture: frameAsset({ raw }), source: fields({ '1140': 0 }), streamData: stream(raw), cursor: 0x48 });
    assert.equal(run(s).outcome, 'retry_output'); const first = s.slots.snapshot();
    assert.equal(first.columns['1140'][0], raw); assert.equal(first.columns['11F0'][0], 2); assert.equal(first.columns['7E:3FD8'][0], 1);
    s.slots.seedMotionScratchWord('82', 0); assert.equal(run(s).outcome, 'output');
    const second = s.slots.snapshot(); assert.equal(second.columns['11F0'][0], 2); assert.equal(second.columns['7E:3FD8'][0], 1);
  }
});

test('Growprependsnodesfromsameinitialpool and emitsindependentlyexpected pairs,lastnextread andallqueuecolumns', () => {
  const s = make(); assert.equal(run(s).outcome, 'output'); const snapshot = s.slots.snapshot();
  assert.equal(snapshot.counts[0], 2); assert.equal(snapshot.heads[0], 4); assert.equal(snapshot.pool.freeCount, 62); assert.equal(snapshot.pool.freeHead, 6);
  assert.equal(snapshot.pool.links[2], 2); assert.equal(snapshot.pool.links[1], 0);
  for (let i = 0; i < 4; i++) {
    const y = i * 2 + 2;
    assert.equal(outputWord(s.postpassData, 0x16D4 + y), pairs[i] & 0xFFC0);
    assert.equal(outputWord(s.postpassData, 0x1654 + y), (pairs[i] & 0x3F) + 0x8E);
    assert.equal(outputWord(s.postpassData, 0x1754 + y), [64, 320, 32, 288][i]);
  }
  assert.equal(snapshot.columns['7E:3F80'][0], 0x109); assert.equal(snapshot.columns['0F88'][0], 0);
  assert.equal(snapshot.motionSource.postpassScratchWords['82'], 8);
});

test('Shrinkmovesexactheadnodestofreepool,wrapsfreecountandkeepsactualfinalslothead;equalcountdoesnotmutatepool', () => {
  const s = make({ count: 3, head: 2 }); s.slots.seedPool({ count: 0xFFFF, head: 8, linkWords: [{ offset: 2, next: 4 }, { offset: 4, next: 6 }, { offset: 6, next: 0xBEEF }] });
  assert.equal(run(s).outcome, 'output'); const snapshot = s.slots.snapshot();
  assert.equal(snapshot.counts[0], 2); assert.equal(snapshot.heads[0], 4); assert.equal(snapshot.pool.freeCount, 0); assert.equal(snapshot.pool.freeHead, 2);
  assert.equal(snapshot.pool.links[1], 8); assert.equal(snapshot.pool.links[3], 0xBEEF);
  const equal = make({ count: 2, head: 2 }); const before = equal.slots.snapshot(); assert.equal(run(equal).outcome, 'output');
  const after = equal.slots.snapshot(); assert.deepEqual(after.pool, before.pool); assert.deepEqual(after.heads, before.heads); assert.deepEqual(after.counts, before.counts);
});

test('Lastnextlink ismandatoryevenwhennowunused, andlatepool/table/bank failuresretainallplannedresourceeffects', () => {
  const attempts = [
    context({ count: 2, head: 2, links: initialLinks.map((v, i) => i === 2 ? null : v) }),
    context({ count: 0, head: null }),
    context({ tableBank: null }), context({ tableBank: 0x7E }),
    context({ count: 2, head: 0x100 }), context({ count: 2, head: 3 }),
  ];
  for (const c of attempts) { const before = structuredClone({ fields: c.fields, links: c.links, scratch: c.scratchBytes }); assert.equal(prepareMotionPostpassAC2F(c).handled, false); assert.deepEqual({ fields: c.fields, links: c.links, scratch: c.scratchBytes }, before); }
  const s = make(), before = capture(s.slots, s.postpassData); assert.equal(s.slots.stepMotionPostpassAC2F(0).reason, 'slot_motion_postpass_table_bank_required');
  assert.deepEqual(capture(s.slots, s.postpassData), before);
});

test('Initial64versus63poolnodes remainunaltered;invalidfinalfreeLinkdoesnotgetnormalisedorpartiallyallocated', () => {
  const plan = prepareMotionPostpassAC2F(context({ postpassData: createSlotMotionPostpassData(frameAsset({ count: 17 })),
    scratchBytes: [[0x82, 0xFE], [0x83, 0xFF]], freeHead: 0xEE }));
  assert.equal(plan.handled, false); assert.equal(plan.reason, 'slot_pool_window_required'); assert.equal(plan.offset, 0x100);
  const s = make(); const before = capture(s.slots, s.postpassData); s.slots.seedPool({ count: 64, head: 0xEE }); const seeded = capture(s.slots, s.postpassData);
  assert.equal(run(s).offset, 0x100); assert.deepEqual(capture(s.slots, s.postpassData), seeded); assert.equal(before.slots.pool.freeCount, 64);
});

test('Zeroheader entersrealdo-loopandfailsatcoverageboundary;noempty-success,nopool/scratch/queue partialwrites', () => {
  const s = make({ count: 0, head: 2, fixture: frameAsset({ count: 0 }) }); const before = capture(s.slots, s.postpassData);
  const r = run(s); assert.equal(r.handled, false); assert.equal(r.reason, 'slot_motion_postpass_output_window_required');
  assert.deepEqual(capture(s.slots, s.postpassData), before);
});

test('Oddqueuecursorusesactualbytealiasesandbatchorder,withcopiedsnapshotsandlatefullWORDtail boundaries', () => {
  const s = make({ cursor: 1 }); assert.equal(run(s).outcome, 'output'); assert.equal(outputWord(s.postpassData, 0x16D7), pairs[0] & 0xFFC0);
  const late = make({ source: { '1140': 0x7FFA }, fixture: frameAsset() }); const before = capture(late.slots, late.postpassData);
  // Force a complete header atFFFA, then output reads reachFFFF and fail.
  const source = { ...asset, bytes: [...asset.bytes] }; source.bytes[0x7FFA] = 1;
  const fail = make({ source: { '1140': 0x7FFA }, fixture: source }); const snapshot = capture(fail.slots, fail.postpassData);
  assert.equal(run(fail).handled, false); assert.deepEqual(capture(fail.slots, fail.postpassData), snapshot);
  assert.deepEqual(capture(late.slots, late.postpassData), before);
});

test('Bothframebanksandtailable bits usechosenpointer;all256signedoffsetbytes scaleexactlyandCarrybit7 survives', () => {
  for (const raw of [0x100, 0x8100]) for (let signed = 0; signed < 256; signed++) {
    const d = createSlotMotionPostpassData(frameAsset({ raw, tail: 7, signed }));
    const plan = prepareMotionPostpassAC2F(context({ fields: { '1140': raw }, postpassData: d }));
    assert.equal(plan.handled, true); assert.equal(plan.fields['0F88'], 0x8007);
    assert.equal(plan.fields['0FE0'], Number((BigInt(signed >= 128 ? signed - 256 : signed) * 4n + 65536n) % 65536n));
    assert.equal(plan.carry, signed >>> 7); assert.equal(scratchPlan(plan).get(0x35), 0x80FF);
  }
  const zero = make(); zero.slots.seedSlotFields(0, { '0FE0': 0xABCD }); assert.equal(run(zero).carry, 0);
  assert.equal(zero.slots.snapshot().columns['0FE0'][0], 0xABCD); assert.equal(zero.slots.snapshot().motionSource.helperScratchWords['35'], 0x8100);
});

test('TailrequiresWORDbeforeheader evenwhenonlysignedlowbyteused;chosenbank doesnotdecrementwithlowpointer', () => {
  const source = { ...asset, bytes: [...asset.bytes] }; source.bytes[0x8000] = 1; source.bytes[0x8008] = 1;
  const s = make({ source: { '1140': 0x8000 }, fixture: source }); const before = capture(s.slots, s.postpassData);
  assert.equal(run(s).reason, 'slot_motion_postpass_data_window_required'); assert.deepEqual(capture(s.slots, s.postpassData), before);
});

test('Sharedscratch37/38 preservesunknownBYTE39 and13/14aliasesactualbytes,includingexplicitlaterwordhydration', () => {
  const s = make(); s.slots.seedMotionScratchWord('38', 0xABCD); s.slots.seedMotionScratchWord('41', 0x1234);
  assert.equal(run(s).outcome, 'output'); const snap = s.slots.snapshot();
  assert.equal(snap.motionSource.helperScratchWords['38'], 0xAB00); assert.equal(snap.motionSource.postpassScratchWords['37'], 0x9B);
  assert.equal(snap.motionSource.postpassScratchWords['13'], 0x9B); // Count depleted tozero.
  assert.equal(snap.motionSource.scratchWord40, 0x348C); assert.equal(snap.motionSource.preludeScratchWords['41'], 0x1234);
  s.slots.seedMotionScratchWord('14', 0xBEEF); assert.equal(s.slots.snapshot().motionSource.postpassScratchWords['13'], 0xEF9B);
  const partial = make(); run(partial); assert.equal(partial.slots.snapshot().motionSource.helperScratchWords['38'], null);
  assert.equal(new Map(partial.slots.readMotionScratchBytes()).get(0x38), 0); assert.equal(new Map(partial.slots.readMotionScratchBytes()).get(0x39), null);
});

test('All44slotsreusepoolownersandpreserveotherfields,coordinatewords,tasklists,D9scratch,6B,workspace andactiveentries', () => {
  for (let offset = 0; offset <= 0x56; offset += 2) {
    const s = make({ offset }), before = s.slots.snapshot(); assert.equal(run(s).outcome, 'output'); const after = s.slots.snapshot();
    assert.deepEqual(after.activeList, before.activeList); assert.deepEqual(after.definitions, before.definitions);
    assert.deepEqual(after.targetSource, before.targetSource); assert.equal(after.motionSource.scratchWord6B, before.motionSource.scratchWord6B);
    for (const [key, values] of Object.entries(before.columns)) {
      if (['1140', '7E:3F80', '0F88'].includes(key)) assert.deepEqual(after.columns[key].filter((_, i) => i !== offset / 2), values.filter((_, i) => i !== offset / 2));
      else assert.deepEqual(after.columns[key], values);
    }
  }
});

test('Existing8133 and8799 operations sharepostpass scratchbytes inbothdirectionswithoutpoolorqueuecopies', () => {
  const motionData = createSlotMotionData(); motionData.seed(0x7EDEAC, Array(512).fill(255)); motionData.seed(0x7EE0AC, Array(512).fill(255)); motionData.seed(0x7EDEAA, [0x20, 0]);
  const source = fields({ '0E28': 256, '0E80': 0, '0ED8': 0x100, '1458': 0x100,
    '7E:4240': 0, '7E:4298': 1, '7E:42F0': 0, '7E:4348': 0, '7E:43A0': 1 });
  const s = make({ source, motionData }); assert.equal(run(s).outcome, 'output');
  const queue = s.postpassData.snapshot(), pool = s.slots.snapshot().pool;
  assert.equal(s.slots.stepMotionHelper8133(0).handled, true);
  let snapshot = s.slots.snapshot(); assert.equal(snapshot.motionSource.helperScratchWords['14'], 65);
  assert.equal(snapshot.motionSource.postpassScratchWords['13'], 0x419B); // SharedBYTE14.
  assert.equal(snapshot.motionSource.helperScratchWords['38'], 2); assert.equal(snapshot.motionSource.postpassScratchWords['37'], 0x29B);
  s.slots.seedActiveList([0]); assert.equal(s.slots.stepMotionPrelude8799().handled, true);
  snapshot = s.slots.snapshot(); assert.equal(snapshot.motionSource.helperScratchWords['20'], 0xA80);
  s.slots.seedSlotFields(0, { '1140': 0x100 }); s.slots.seedMotionScratchWord('82', 0);
  assert.equal(run(s).handled, true); snapshot = s.slots.snapshot(); assert.equal(snapshot.motionSource.helperScratchWords['38'], 0);
  assert.equal(snapshot.motionSource.helperScratchWords['20'], 0xA80); // Pending path skips20.
  assert.deepEqual(s.postpassData.snapshot(), queue); assert.deepEqual(snapshot.pool, pool);
});

test('LatefullWORDtail read discardsalreadyplannedpool/queue/scratch effects,while plans remainindependentcopies', () => {
  const fixture = { ...asset, bytes: [...asset.bytes] }; fixture.bytes[0x7FF7] = 1;
  const s = make({ source: { '1140': 0x7FF7 }, fixture }); const before = capture(s.slots, s.postpassData);
  // HeaderFFF7 and pair readsFFF8/FFFA are covered; trailerreadFFFF isnot.
  assert.deepEqual(run(s), { handled: false, reason: 'slot_motion_postpass_data_window_required', address: 0x9BFFFF });
  assert.deepEqual(capture(s.slots, s.postpassData), before);
  const input = context(), plan = prepareMotionPostpassAC2F(input), repeat = prepareMotionPostpassAC2F(input);
  plan.scratchWrites[0].value = 0; plan.outputWrites[0].value = 0; plan.poolWrites.freeCount = 0;
  assert.deepEqual(prepareMotionPostpassAC2F(input), repeat);
});

test('AC2Fallocatednodes are releasedbyexistingB9,andlaterA9 creationretainsnewunknownorsourced0FE0 withoutnewpool', () => {
  const s = make(); s.slots.seedActiveList([0]); assert.equal(run(s).outcome, 'output');
  assert.equal(s.slots.applyNative({ nativeId: 0xB9, args: [0], returnBytes: 0 }).handled, true);
  const after = s.slots.snapshot(); assert.equal(after.pool.freeCount, 64); assert.equal(after.pool.freeHead, 2);
  assert.equal(after.pool.links[1], 4); assert.equal(after.pool.links[2], 6); assert.equal(after.counts[0], 0);
  s.slots.seedSlotFields(0x56, { '0FE0': 0x1234 });
  assert.equal(s.slots.applyNative({ nativeId: 0xA9, args: [11, 1, 2, 3, 0xFFFF], returnBytes: 2 }).value, 0x56);
  assert.equal(s.slots.snapshot().columns['0FE0'][43], 0x1234);
});

test('AC2Ftask8 isreadbyexistingheapbackedwaitwithoutcheckingorwakinguntilnextauthorised sweep', () => {
  const word = v => [0x14, v & 255, v >>> 8];
  const code = [...word(20), ...word(8), 0x58, 0x9F, 0x56];
  const bundle = { ...original, scripts: original.scripts.map(s => s.id === 2 ? { ...s, bytecode: code } : s) };
  const allocator = createTaskFrameAllocator({ profileData: profiles });
  const s = make({ source: fields({ '1140': 0, '7E:3FD8': 1, '1350': 0 }) });
  const scheduler = createScriptScheduler(bundle, { frameAllocator: allocator }); scheduler.addTask(2);
  const state = createScriptState({ byteLength: 0x32, slotState: s.slots }); visitTailWithState(scheduler, state);
  const before = scheduler.snapshot(); assert.equal(s.slots.stepMotionPostpassAC2F(0, { frameAllocator: allocator }).outcome, 'stopped');
  assert.equal(scheduler.snapshot().tasks[0].checks, before.tasks[0].checks);
  assert.equal(allocator.readWaitEvents(0), 8); sweepWithState(scheduler, state); const awake = sweepWithState(scheduler, state);
  assert.equal(awake.execution.visits.at(-1).status, 'ended'); assert.equal(awake.execution.visits.at(-1).checks, 1);
});

test('Malformedbrands,seeds,contexts,sparsearrays andunsupportedoffsets failbeforeeffects;manualsourcesbeginunknown', () => {
  for (const overrides of [{ offset: -1 }, { fields: { '1140': -1 } }, { links: Array(120) }, { scratchBytes: [undefined] },
    { postpassData: {} }, { actionData: {} }, { frameAllocator: {} }, { tableBank: 256 }, { head: -1 }]) assert.throws(() => prepareMotionPostpassAC2F(context(overrides)), /Invalid/);
  const s = make(), before = capture(s.slots, s.postpassData);
  for (const offset of [1, 0x58, 0xFFFF]) assert.equal(s.slots.stepMotionPostpassAC2F(offset).reason, 'slot_window_required');
  assert.throws(() => s.slots.seedMotionScratchWord('10', 0), /Invalid/); assert.throws(() => s.slots.seedMotionScratchWord('82', -1), /Invalid/);
  for (const options of [null, [], 'bank80', { tableBank: 256 }, { frameAllocator: {} }]) assert.throws(() => s.slots.stepMotionPostpassAC2F(0, options), /Invalid/);
  assert.deepEqual(capture(s.slots, s.postpassData), before);
  const unseeded = createSlotState(); assert.equal(unseeded.snapshot().columns['0FE0'][0], null);
  assert.equal(unseeded.snapshot().motionSource.postpassScratchWords['82'], null);
});

test('Original252/217 CLI separatesunsourcednormalAC2F andexplicitraw1/82/DBRprobe withsamewaitchecks andrealpool', () => {
  const base = ['tools/run-slot-action-ac.mjs', '--fixture-no-audio', '--visit-spawned', '--fixture-target-9d'];
  const command = (...flags) => JSON.parse(execFileSync(process.execPath, [...base, ...flags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const originalState = command(), missing = command('--step-motion-postpass');
  assert.deepEqual(missing.motionPostpassProbe.response, { handled: false, reason: 'slot_motion_postpass_scratch_source_required', address: 0x40 });
  assert.deepEqual(missing.motionPostpassProbe.before, missing.motionPostpassProbe.after);
  const output = command('--step-motion-postpass', '--fixture-motion-postpass');
  assert.deepEqual(output.motionPostpassProbe.response, { handled: true, outcome: 'output', carry: 0 });
  assert.equal(output.motionPostpassProbe.after.count, 2); assert.equal(output.motionPostpassProbe.after.head, 4);
  assert.equal(output.motionPostpassProbe.after.pool.freeCount, 62); assert.equal(output.motionPostpassProbe.after.pool.freeHead, 6);
  assert.equal(output.motionPostpassProbe.after.fields['7E:3F80'], 10); assert.equal(output.motionPostpassProbe.after.output.outputBytes.length, 24);
  for (const result of [missing, output]) { assert.deepEqual(result.tasks, originalState.tasks); assert.deepEqual(result.workspace, originalState.workspace); assert.deepEqual(result.activeOrder, originalState.activeOrder); }
  const withBody = command('--step-motion', '--fixture-motion-empty-heads', '--step-motion-postpass', '--fixture-motion-postpass');
  assert.equal(withBody.motionProbe.response.handled, true); assert.equal(withBody.motionPostpassProbe.response.handled, true);
  assert.deepEqual(['0E28', '0E80', '0ED8'].map(k => withBody.slots.columns[k][42]), [330, 1496, 1725]);
  assert.throws(() => command('--fixture-motion-postpass'), e => e.stderr.toString().includes('Usage:'));
});
