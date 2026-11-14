import { readFile } from 'node:fs/promises';
import { createACState } from '../proof/state/ac-state.mjs';
import { createSlotState } from '../proof/state/slots.mjs';
import { createSlotDefinitions } from '../proof/state/slot-definitions.mjs';
import { createSlotTargetData } from '../proof/state/slot-target-data.mjs';
import { createSlotActionData } from '../proof/state/slot-action-data.mjs';
import { createSlotMotionData } from '../proof/state/slot-motion-data.mjs';
import { createSlotMotionDirectionData } from '../proof/state/slot-motion-direction-data.mjs';
import { createSlotMotionPostpassData } from '../proof/state/slot-motion-postpass-data.mjs';
import { createScriptState } from '../proof/state/script-state.mjs';
import { createScriptScheduler } from '../proof/script/scheduler.mjs';
import { createTaskFrameAllocator, createTaskFrameProfiles } from '../proof/script/task-frames.mjs';
import { visitTailWithState, sweepWithState } from '../proof/state/host.mjs';

const args = process.argv.slice(2);
const allowed = ['--fixture-no-audio', '--visit-spawned', '--fixture-target-9d', '--step-motion', '--fixture-motion-no-helpers', '--probe-motion-helper-8133', '--fixture-motion-empty-heads', '--fixture-motion-rest-unchanged', '--fixture-motion-height-unchanged', '--fixture-motion-first-no-carry', '--fixture-motion-second-no-carry', '--fixture-motion-c9e0', '--fixture-motion-c9e0-stop'];
allowed.push('--step-motion-prelude', '--fixture-motion-prelude-node-base', '--fixture-motion-prelude-record');
allowed.push('--step-motion-postpass', '--fixture-motion-postpass');
allowed.push('--step-motion-afc4', '--fixture-motion-afc4');
allowed.push('--step-motion-de94-afc4', '--fixture-motion-de94-afc4');
const combinedMotion = args.includes('--step-motion-de94-afc4');
const fullMotion = args.includes('--step-motion-afc4') || combinedMotion;
const dependencies = [['--visit-spawned', '--fixture-no-audio'], ['--fixture-target-9d', '--visit-spawned'], ['--step-motion', '--fixture-target-9d'], ['--fixture-motion-no-helpers', '--step-motion'], ['--probe-motion-helper-8133', '--fixture-target-9d'], ['--fixture-motion-rest-unchanged', '--step-motion'], ['--fixture-motion-rest-unchanged', '--fixture-motion-empty-heads'], ['--fixture-motion-height-unchanged', '--step-motion'], ['--fixture-motion-height-unchanged', '--fixture-motion-empty-heads']];
const headsWithoutProbe = args.includes('--fixture-motion-empty-heads') && !args.includes('--step-motion') && !args.includes('--probe-motion-helper-8133') && !args.includes('--step-motion-prelude');
dependencies.push(['--fixture-motion-first-no-carry', '--step-motion'], ['--fixture-motion-second-no-carry', '--step-motion']);
dependencies.push(['--fixture-motion-c9e0', '--step-motion'], ['--fixture-motion-c9e0-stop', '--step-motion']);
dependencies.push(['--step-motion-prelude', '--fixture-target-9d'], ['--fixture-motion-prelude-node-base', '--step-motion-prelude'], ['--fixture-motion-prelude-record', '--fixture-motion-prelude-node-base']);
dependencies.push(['--step-motion-postpass', '--fixture-target-9d'], ['--fixture-motion-postpass', '--step-motion-postpass']);
dependencies.push(['--step-motion-afc4', '--fixture-target-9d'], ['--fixture-motion-afc4', '--step-motion-afc4']);
dependencies.push(['--step-motion-de94-afc4', '--fixture-target-9d'], ['--fixture-motion-de94-afc4', '--step-motion-de94-afc4']);
const c9e0Flags = ['--fixture-motion-c9e0', '--fixture-motion-c9e0-stop'].filter(flag => args.includes(flag));
const conflictingMotionFixtures = fullMotion && ['--step-motion', '--step-motion-prelude', '--step-motion-postpass', '--probe-motion-helper-8133'].some(flag => args.includes(flag))
  || combinedMotion && args.includes('--step-motion-afc4')
  || (args.includes('--fixture-motion-rest-unchanged') && args.includes('--fixture-motion-height-unchanged')) || (['--fixture-motion-first-no-carry', '--fixture-motion-second-no-carry'].some(flag => args.includes(flag)) && ['--fixture-motion-no-helpers', '--fixture-motion-rest-unchanged', '--fixture-motion-height-unchanged'].some(flag => args.includes(flag)))
  || c9e0Flags.length > 1 || c9e0Flags.length && ['--fixture-motion-no-helpers', '--fixture-motion-rest-unchanged', '--fixture-motion-height-unchanged', '--fixture-motion-first-no-carry', '--fixture-motion-second-no-carry'].some(flag => args.includes(flag));
if (args.some(arg => !allowed.includes(arg)) || new Set(args).size !== args.length || dependencies.some(([flag, required]) => args.includes(flag) && !args.includes(required)) || headsWithoutProbe || conflictingMotionFixtures) throw new Error('Usage: node tools/run-slot-action-ac.mjs [--fixture-no-audio [--visit-spawned [--fixture-target-9d [--step-motion-de94-afc4 [--fixture-motion-de94-afc4] | --step-motion-afc4 [--fixture-motion-afc4]] | [--step-motion-prelude [--fixture-motion-prelude-node-base [--fixture-motion-prelude-record]]] [--step-motion-postpass [--fixture-motion-postpass]] [--step-motion [--fixture-motion-no-helpers] [--fixture-motion-first-no-carry] [--fixture-motion-second-no-carry] [--fixture-motion-c9e0 | --fixture-motion-c9e0-stop] [--fixture-motion-empty-heads [--fixture-motion-rest-unchanged | --fixture-motion-height-unchanged]]] [--probe-motion-helper-8133 [--fixture-motion-empty-heads]]]]]');
const load = async name => JSON.parse(await readFile(new URL(`../assets/${name}.json`, import.meta.url), 'utf8'));
const targetData = createSlotTargetData(await load('slot-target-data'));
const targetFixture = args.includes('--fixture-target-9d') ? targetData.deriveF3From9D(0x99807E) : null;
if (targetFixture && !targetFixture.available) throw new Error('Target fixture unavailable');
const motionData = args.includes('--probe-motion-helper-8133') || args.includes('--step-motion') || args.includes('--step-motion-prelude') || fullMotion ? createSlotMotionData() : null;
const motionPostpassData = args.includes('--step-motion-postpass') || fullMotion ? createSlotMotionPostpassData(await load('motion-postpass-data')) : null;
const slots = createSlotState({ definitionData: createSlotDefinitions(await load('slot-definitions')), actionData: createSlotActionData(await load('slot-action-data')), targetData, motionData,
  motionPostpassData,
  motionDirectionData: c9e0Flags.length ? createSlotMotionDirectionData(await load('slot-motion-direction-data')) : null });
if (targetFixture) slots.seedTargetPointer(targetFixture.pointer);
const created = slots.applyNative({ nativeId: 0xA9, args: [11, 123, 456, 64, 0xFFFF], returnBytes: 2 });
const ac = createACState();
const state = createScriptState({ byteLength: 0x58, slotState: slots, acState: ac });
if (args[0]) { state.seed(0x56, [0x38, 0x12]); ac.seed(0x26, [0, 0]); }
const memory = createTaskFrameAllocator({ profileData: createTaskFrameProfiles(await load('task-frame-profiles')) });
const scheduler = createScriptScheduler(await load('scripts'), { frameAllocator: memory });
scheduler.addTask(0x252, [0, 0, 0, 0, created.value]);
let result = visitTailWithState(scheduler, state);
const initialActions = result.actions;
if (args.includes('--visit-spawned')) { sweepWithState(scheduler, state); result = sweepWithState(scheduler, state); }
let motionProbe = null;
let motionHelperProbe = null;
let motionPreludeProbe = null;
let motionPostpassProbe = null;
let motionAFC4Probe = null;
let motionDE94AFC4Probe = null;
if (motionData) {
  if (result.boundary || !result.execution.tasks.some(task => task.scriptId === 0x217 && task.status === 'waiting')) throw new Error('Helper probe requires original217 to reach its D9-derived wait');
  const fixture = args.includes('--fixture-motion-empty-heads');
  if (fixture) { motionData.seed(0x7EDEAC, Array(512).fill(255)); motionData.seed(0x7EE0AC, Array(512).fill(255)); }
  if (args.includes('--probe-motion-helper-8133')) motionHelperProbe = { scope: 'Explicit standalone8133 call on current slot coordinates, without the preceding AB26 coordinate addition or caller continuation. No scene/frame/collision claim.',
    fixture: fixture ? { scope: 'Synthetic negative WORD heads for both256-entry tables; not original scene data.', headWord: 0xFFFF } : null,
    response: slots.stepMotionHelper8133(0x54), scratchWords: slots.snapshot().motionSource.helperScratchWords };
}
if (args.includes('--step-motion-prelude')) {
  const nodeFixture = args.includes('--fixture-motion-prelude-node-base') ? { address: '7E:DEAA', value: 0x20, scope: 'Synthetic node base WORD; original initializer is not established.' } : null;
  if (nodeFixture) motionData.seed(0x7EDEAA, [0x20, 0]);
  const flags = slots.snapshot().columns['1458'][0x54 / 2];
  const recordFixture = args.includes('--fixture-motion-prelude-record') ? {
    scope: 'Synthetic0100 selection flag and height extent1 for slot54; remaining record fields use the original script-derived values.',
    fields: { '1458': flags | 0x100, '7E:43A0': 1 },
  } : null;
  if (recordFixture) slots.seedSlotFields(0x54, recordFixture.fields);
  const readProbe = () => {
    const heads = Array.from({ length: 256 }, (_, i) => ({ index: i * 2, ...motionData.readHead(1, i * 2) }));
    return { source: slots.snapshot().motionSource, nodeBase: motionData.readPreludeNodeBase(),
      knownSecondHeads: heads.filter(h => h.available).length,
      occupiedSecondHeads: heads.filter(h => h.available && !(h.value & 0x8000)),
      firstHead: motionData.readHead(0, 0xE2),
      record: Array.from({ length: 6 }, (_, i) => motionData.readRecordField(0xA74, i)),
      metadata: motionData.readMetadata(0xA74),
      nodes: nodeFixture ? Array.from({ length: 4 }, (_, i) => ({ offset: 0x20 + i * 2,
        record: motionData.readNodeRecord(0x20 + i * 2), next: motionData.readNextNode(0x20 + i * 2) })) : null };
  };
  const before = readProbe(), response = slots.stepMotionPrelude8799(), after = readProbe();
  motionPreludeProbe = { scope: 'Explicit standalone8799 data operation before optional separate motion body. No automatic AFC4/AC2F/frame or scheduler call.', nodeFixture, recordFixture, before, response, after };
}
if (args.includes('--step-motion')) {
  if (result.boundary || !result.execution.tasks.some(task => task.scriptId === 0x217 && task.status === 'waiting')) throw new Error('Motion probe requires original 217 to reach its D9-derived wait');
  const currentFlags = slots.snapshot().columns['1458'][0x54 / 2];
  const fixture = args.includes('--fixture-motion-no-helpers') ? { offset: 0x54, field: '1458', sourceWord: currentFlags, value: currentFlags & 0xFFBF } : null;
  if (fixture) slots.seedSlotFields(0x54, { '1458': fixture.value });
  const restFixture = args.includes('--fixture-motion-rest-unchanged') ? {
    scope: 'Synthetic second/third motion words skip their remaining helper calls; not original scene data.', offset: 0x54,
    sourceWords: Object.fromEntries(['0D78', '0DD0'].map(key => [key, slots.snapshot().columns[key][0x54 / 2]])),
    fields: { '0D78': 0, '0DD0': currentFlags & 0x20 ? 1 : 0 },
  } : null;
  if (restFixture) slots.seedSlotFields(0x54, restFixture.fields);
  const heightFixture = args.includes('--fixture-motion-height-unchanged') ? {
    scope: 'Synthetic third motion word skips the82BC call; both original first/second motion words are retained. Not original scene data.', offset: 0x54,
    sourceWord: slots.snapshot().columns['0DD0'][0x54 / 2], fields: { '0DD0': currentFlags & 0x20 ? 1 : 0 },
  } : null;
  if (heightFixture) slots.seedSlotFields(0x54, heightFixture.fields);
  const firstMotionFixture = args.includes('--fixture-motion-first-no-carry') ? {
    scope: 'Synthetic0D20=4 selects80B2 at the current first coordinate with unchanged0061 flags; optional second-motion fixture is reported separately. Not original scene data.', offset: 0x54,
    sourceWord: slots.snapshot().columns['0D20'][0x54 / 2], fields: { '0D20': 4 },
  } : null;
  if (firstMotionFixture) slots.seedSlotFields(0x54, firstMotionFixture.fields);
  const secondMotionFixture = args.includes('--fixture-motion-second-no-carry') ? {
    scope: 'Synthetic0D78=4 selects81B4 at the current second coordinate with unchanged0061 flags; optional first-motion fixture is reported separately. Not original scene data.', offset: 0x54,
    sourceWord: slots.snapshot().columns['0D78'][0x54 / 2], fields: { '0D78': 4 },
  } : null;
  if (secondMotionFixture) slots.seedSlotFields(0x54, secondMotionFixture.fields);
  const current = slots.snapshot(), index = 0x54 / 2;
  const c9e0Fixture = c9e0Flags.length ? {
    scope: 'Synthetic timer1,mode0 and direct target coordinates; explicit DBR80 contract for original direction tables. No original scene/frame/bank initialization established.',
    stop: args.includes('--fixture-motion-c9e0-stop'), directionBank: 0x80,
    fields: { '7E:40E0': 1, '7E:4138': 0,
      '7E:4190': (current.columns['0E28'][index] + (args.includes('--fixture-motion-c9e0-stop') ? 0 : 32)) & 0xFFFF,
      '7E:41E8': (current.columns['0E80'][index] + (args.includes('--fixture-motion-c9e0-stop') ? 0 : 32)) & 0xFFFF },
  } : null;
  if (c9e0Fixture) slots.seedSlotFields(0x54, c9e0Fixture.fields);
  const readProbe = () => {
    const snapshot = slots.snapshot();
    return { fields: Object.fromEntries(['7E:40E0', '7E:4138', '7E:4190', '7E:41E8', '1458', '0E28', '0E80', '0ED8', '0D20', '0D78', '0DD0', '0F30'].map(key => [key, snapshot.columns[key][0x54 / 2]])), scratchWord6B: snapshot.motionSource.scratchWord6B, helperScratchWords: snapshot.motionSource.helperScratchWords,
      ...(c9e0Fixture ? { targetScratchWords: snapshot.targetSource.scratchWords, workspace: memory.snapshot().workspace, taskEventWords: memory.snapshot().slots.map(slot => slot.eventWord) } : {}) };
  };
  const before = readProbe();const response = slots.stepMotion(0x54, c9e0Fixture ? { directionBank: c9e0Fixture.directionBank, frameAllocator: memory } : {});
  motionProbe = { scope: 'Explicit manual AB26 body call with optional sourced C9E0/80B2/8133/81B4/8238/82BC continuations; no main-loop gates, prelude, second pass, scene or frame execution. Optional flags/head/motion/target/bank fixtures are synthetic, not original collision results.', fixture, headFixture: args.includes('--fixture-motion-empty-heads') ? { headWord: 0xFFFF, wordsPerTable: 256 } : null, restFixture, heightFixture, firstMotionFixture, secondMotionFixture, c9e0Fixture, before, response, after: readProbe() };
}
if (args.includes('--step-motion-postpass')) {
  if (result.boundary || !result.execution.tasks.some(task => task.scriptId === 0x217 && task.status === 'waiting')) throw Error('Postpass probe requires original217 to reach its D9-derived wait');
  const fixture = args.includes('--fixture-motion-postpass') ? {
    scope: 'Synthetic pending1140=1,outputcursor82=0 and explicit DBR80; original9B:8001 data, existing slot/pool owners. No original pointer lifecycle, rendering or frame established.',
    fields: { '1140': 1 }, scratchWord82: 0, tableBank: 0x80,
  } : null;
  if (fixture) { slots.seedSlotFields(0x54, fixture.fields); slots.seedMotionScratchWord('82', fixture.scratchWord82); }
  const readProbe = () => {
    const snapshot = slots.snapshot(), index = 0x54 / 2;
    return { fields: Object.fromEntries(['1140', '7E:4088', '7E:4030', '7E:3FD8', '11F0', '7E:3F80', '0F88', '0FE0'].map(key => [key, snapshot.columns[key][index]])),
      count: snapshot.counts[index], head: snapshot.heads[index], pool: snapshot.pool,
      scratch: snapshot.motionSource, output: motionPostpassData.snapshot() };
  };
  const before = readProbe(), response = slots.stepMotionPostpassAC2F(0x54, { tableBank: fixture?.tableBank ?? null, frameAllocator: memory });
  motionPostpassProbe = { scope: 'Explicit separate manualAC2F data operation after optional8799/AB26 calls. No automatic AFC4/scheduler/frame or DMA.', fixture, before, response, after: readProbe() };
}
if (fullMotion) {
  const fixture = args.includes(combinedMotion ? '--fixture-motion-de94-afc4' : '--fixture-motion-afc4') ? {
    scope: 'Synthetic DEAA nodebase20,negative first-list heads,pending1140=1 for both active slots,outputcursor82=0 and DBR80. Original scripts and framebytes; no original scene/timing initialization.',
    nodeBase: 0x20, firstHeadWord: 0xFFFF, pendingRaw: 1, scratchWord82: 0, bank: 0x80,
    ...(combinedMotion ? { prefixSlot: 0x54, prefixCounter: 3,
      prefixScope: 'Synthetic0CC2=54,odd counterWORD1D65=3. No original writer or elapsed time claim.' } : {}),
  } : null;
  if (fixture) {
    motionData.seed(0x7EDEAA, [0x20, 0]); motionData.seed(0x7EDEAC, Array(512).fill(255));
    for (const offset of [0x54, 0x56]) slots.seedSlotFields(offset, { '1140': fixture.pendingRaw });
    slots.seedMotionScratchWord('82', fixture.scratchWord82);
    if (combinedMotion) { motionData.seed(0x7E0CC2, [fixture.prefixSlot, 0]); motionData.seed(0x7E1D65, [fixture.prefixCounter, 0]); }
  }
  const capture = () => ({ slots: slots.snapshot(), scratchBytes: slots.readMotionScratchBytes(),
    motionData: motionData.snapshot(), output: motionPostpassData.snapshot(), memory: memory.snapshot() });
  const before = capture(), response = combinedMotion
    ? slots.stepMotionDE94AFC4({ bank: fixture?.bank ?? null, frameAllocator: memory })
    : slots.stepMotionAFC4({ bank: fixture?.bank ?? null, frameAllocator: memory });
  const probe = { scope: combinedMotion
    ? 'Explicit atomic manual DE94 then AFC4 data operation. No8000/CC4B gates,scheduler sweep,main-loop/frame or DMA execution.'
    : 'Explicit complete atomic manual AFC4 data operation:8799,all AB26 visits,callerWORD40 and all AC2F visits. No scheduler sweep or main-loop/frame/DMA execution.',
    fixture, before, response, after: capture() };
  if (combinedMotion) motionDE94AFC4Probe = probe; else motionAFC4Probe = probe;
}
console.log(JSON.stringify({
  scope: 'Synthetic orchestration: source-derived A9 creation and selected original AC data initialization, then unmodified original 252 with explicit root arguments. Optional 3C11/1FD6 fixtures do not imply scene initialization or audio execution. Optional explicit 9D=99:807E target-data probe is not a scene-derived pointer.',
  suppliedFixture: args[0] ? { '7E:3C11': 0x1238, '1FD6': 0 } : null,
  targetFixture, motionProbe, motionHelperProbe, motionPreludeProbe, motionPostpassProbe, motionAFC4Probe, motionDE94AFC4Probe, slots: slots.snapshot(),
  created, status: result.execution.status, actions: result.actions, boundary: result.boundary, pending: result.execution.pending,
  initialActions: args.includes('--visit-spawned') ? initialActions : null,
  tasks: scheduler.snapshot().tasks.map(task => ({ taskId: task.taskId, scriptId: task.scriptId, status: task.status, steps: task.steps, checks: task.checks, wait: task.wait, frames: task.frames.map(frame => ({ id: frame.id, pc: frame.pc, taskOffset: frame.memory.taskOffset })) })),
  activeOrder: memory.snapshot().activeOrder,
  ac: ac.snapshot(), workspace: memory.snapshot().workspace,
}, null, 2));
