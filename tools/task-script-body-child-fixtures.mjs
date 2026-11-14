import { scriptBodySpecs } from '../proof/task/script-body-specs.mjs';
import { scriptBodyFixture, bodyWord } from './task-script-body-fixtures.mjs';
import { sampleWord } from './render-f130-fixtures.mjs';
import { menuRecords } from './task-native-menu-fixtures.mjs';
import { childBodySeedBytes } from './task-script-body-child-seeds.mjs';
import { childTextIO, childTextWait } from './task-script-body-child-observations.mjs';
import { taskSelectionFixture } from './task-native-selection-roots-fixtures.mjs';
import { inputWaitBodyPCs } from './task-script-body-input-wait-fixtures.mjs';
import {
  childMenuCases,
  expandMenuChildFixture,
  childMenuProbeDetails,
} from './task-script-body-child-menu-fixtures.mjs';
import {
  countdownChildIds,
  countdownChildCases,
  expandCountdownChildFixture,
  countdownChildProbeDetails,
} from './task-script-body-child-countdown-fixtures.mjs';
import {
  propertyParentCases,
  expandPropertyChildFixture,
  propertyParentProbeDetails,
  propertyParentSegmentDetails,
} from './task-script-body-child-property-fixtures.mjs';
import {
  parentWaitCases,
  expandParentWaitChildFixture,
  parentWaitPCs,
  parentWaitProbeDetails,
  parentWaitSegmentDetails,
} from './task-script-body-child-parent-wait-fixtures.mjs';
import {
  parentAliasCases,
  expandAliasParentFixture,
  aliasParentProbeDetails,
} from './task-script-body-child-parent-alias-fixtures.mjs';
import {
  parentAddCases,
  expandAddParentFixture,
  parentAddProbeDetails,
} from './task-script-body-child-parent-add-fixtures.mjs';
import {
  prepareTaskScriptBody as start,
  prepareTaskScriptBodyChildEnter as enter,
  prepareTaskScriptBodyChildPostrun as postrun,
  prepareTaskScriptBodyParentPostrun as parentPostrun,
  prepareTaskScriptBodyResume as resume,
  prepareTaskScriptBodyParentResume as parent,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskHash } from './task-partial-source.mjs';
export const childBodyCases = (s) =>
  s.parentWaitAddChild
    ? parentAddCases()
    : s.parentWaitAliasChild
      ? parentAliasCases()
      : s.parentWaitChild
        ? parentWaitCases()
        : s.recordPropertyChild
          ? propertyParentCases()
          : countdownChildIds.includes(s.childId)
            ? countdownChildCases(s)
            : s.childId === 0xc8
              ? childMenuCases(s)
              : s.childId === 0x10e
                ? [0, 1, 2, 3, 255].flatMap((state) =>
                    [false, true].flatMap((repeated) =>
                      [0x800, 0x400].map((heap) => ({
                        name: `state-${state}-${repeated ? 'repeat' : 'ready'}-heap-${heap.toString(16)}`,
                        state,
                        repeated,
                        heap,
                      })),
                    ),
                  )
                : s.id === 0x1bd
                  ? [
                      { name: 'property-match', property: 0x8b2 },
                      { name: 'property-change', property: 0 },
                      { name: 'full-property-high', property: 0x18b2 },
                      { name: 'smaller-heap-header', property: 65535, heap: 0x400 },
                    ]
                  : [
                      { name: 'original-child-path', motion: 0 },
                      { name: 'full-motion-smaller-heap', motion: 65535, heap: 0x400 },
                    ];
export function expandChildFixture(s, v, f) {
  if (s.parentWaitAddChild) return expandAddParentFixture(s, v, f);
  if (s.parentWaitAliasChild) return expandAliasParentFixture(s, v, f);
  if (s.parentWaitChild) return expandParentWaitChildFixture(s, v, f);
  if (s.recordPropertyChild) return expandPropertyChildFixture(s, v, f);
  if (countdownChildIds.includes(s.childId)) return expandCountdownChildFixture(s, v, f);
  if (s.childId === 0x10e) return expandInputChildFixture(s, v, f);
  if (s.childId === 0xc8) return expandMenuChildFixture(s, v, f);
  const base = f.data.snapshot().bytes,
    modal = scriptBodyFixture(
      scriptBodySpecs.find((s) => s.id === 0x0d7),
      { propertyMatch: true, low: 5000 },
    ),
    audio = scriptBodyFixture(scriptBodySpecs.find((s) => s.id === 0x4b)),
    childSource = scriptBodyFixture(scriptBodySpecs.find((c) => c.id === s.childId)),
    d2 = scriptBodyFixture(
      scriptBodySpecs.find((s) => s.id === 0x31),
      { selectionEqual: false, actionEqual: false },
    );
  for (const source of [modal, audio, d2, childSource])
    for (const [a, n] of source.data.snapshot().bytes) f.data.seed(a, [n]);
  for (const [a, n] of base) f.data.seed(a, [n]);
  for (const [a, n] of childBodySeedBytes[s.id] ?? []) f.data.seed(a, [n]);
  const word = (a, n) => sampleWord(f.data, a, n),
    pointer = s.romReads.find((r) => r.address === 0x8dc972)?.value;
  if (s.id === 0x1bd) {
    if (pointer === undefined) throw Error('Missing original1952 pointer');
    word(0x7e0003 + pointer, v.property);
  }
  const arg = s.argumentBytes ? 2 : 0;
  for (const [a, n] of [
    [0x800, 16],
    [0x800 + arg, 0xbeef],
    [0x801410, v.motion ?? 0],
    [0x8003d2, v.heap ?? 0x800],
    [0x8003d4, 0],
    [0x80024e, 4],
    [0x800316, 65535],
    [0x800250, 2],
    [0x800254, 0x600],
    [0x80024c, 2],
    [0x800374, 65535],
    [0x800314, 65535],
    [0x800ba4, 0],
    [0x8002b4, 0],
    [0xb06, 0x91d0],
  ])
    word(a, n);
  for (const r of s.romReads) word(r.address, r.value);
  return {
    ...f,
    entry: 0x80c1ca,
    context: Object.freeze({ ...f.context, pc: 0xc1ca, s: 0xb05, d: 0, bank: 0x80 }),
    protectedStackBytes: [0x7e0b06, 0x7e0b07],
    maxHandlers:
      s.id === 0x1bd
        ? v.property === 0x8b2
          ? 9
          : 8
        : s.instructions.findIndex((i) => i.opcode === 0x52) + 1,
    maxWork: 2000000,
    maxOutputBytes: 2000000,
    ioMode: 'record-requests',
    ioObservations: menuRecords(
      childTextIO[s.id + ':' + v.name] ??
        (s.id === 0x1bd ? taskSelectionFixture(0x9a).ioObservations : []),
    ),
    waitMode: 'record-observations',
    waitObservations: menuRecords(
      childTextWait[s.id + ':' + v.name] ??
        (s.id === 0x1bd ? taskSelectionFixture(0x9a).waitObservations : []),
    ),
    inputMode: 'record-observations',
    inputObservations: menuRecords([]),
    childAudioObservations: audio.audioResumeObservations,
  };
}
function expandInputChildFixture(s, v, f) {
  const base = f.data.snapshot().bytes,
    child = scriptBodySpecs.find((s) => s.id === 0x10e),
    source = scriptBodyFixture(child, {
      state: v.state,
      input: s.instructions[0].operand,
      repeated: v.repeated,
    });
  for (const [a, n] of source.data.snapshot().bytes) f.data.seed(a, [n]);
  for (const [a, n] of base) f.data.seed(a, [n]);
  for (const [a, n] of childBodySeedBytes[s.id] ?? []) f.data.seed(a, [n]);
  const word = (a, n) => sampleWord(f.data, a, n);
  for (const [a, n] of [
    [0x800, 0xbeef],
    [0x8003d2, v.heap],
    [0x8003d4, 0],
    [0x80024e, 4],
    [0x800316, 65535],
    [0x800250, 2],
    [0x800254, 0x600],
    [0x80024c, 2],
    [0x800374, 65535],
    [0x800314, 65535],
    [0x800ba4, 0],
    [0x8002b4, 0],
    [0xb06, 0x91d0],
  ])
    word(a, n);
  for (const r of s.romReads) word(r.address, r.value);
  return {
    ...f,
    entry: 0x80c1ca,
    context: Object.freeze({ ...f.context, pc: 0xc1ca, s: 0xb05, d: 0, bank: 0x80 }),
    protectedStackBytes: [0x7e0b06, 0x7e0b07],
    maxHandlers: 2,
    maxWork: 2000000,
    maxOutputBytes: 2000000,
    ioMode: 'record-requests',
    ioObservations: menuRecords([]),
    waitMode: 'record-observations',
    waitObservations: menuRecords([]),
    inputMode: 'record-observations',
    inputObservations: menuRecords([]),
    childIO: source.ioObservations,
    childWait: source.waitObservations,
    childInput: source.inputObservations,
    childHandlers: inputWaitBodyPCs(child, v).length,
  };
}
export function childNextOptions(s, f, p) {
  if (s.parentWaitChild && p.scriptId === s.id && p.bodySuspended) {
    const post =
        p.parentPostrunReturned || (p.segmentHandlers === 0 && p.observedReadinessEntries > 0),
      text = p.nextPC === 28,
      pcs = parentWaitPCs(s, f.parentWaitVariant),
      call = s.instructions.find((i) => i.opcode === 0x52).pc,
      maxHandlers = s.parentWaitAddChild
        ? pcs.indexOf(call) - pcs.indexOf(19) + 1
        : text
          ? pcs.indexOf(call) - pcs.indexOf(28) + 1
          : 6;
    return {
      ...f,
      entry: post ? 0x80c1ca : 0x80c20b,
      continuation: p,
      maxHandlers,
      ioObservations: text && post ? f.parentTextIO : menuRecords([]),
      waitObservations: text && post ? f.parentTextWait : menuRecords([]),
      inputObservations: menuRecords([]),
      context: Object.freeze({
        ...p.outputContext,
        pc: post ? 0xc1ca : 0xc20b,
        ...(post ? { s: 0xb05, d: 0, bank: 0x80 } : {}),
      }),
    };
  }
  if (p.childEntry && p.bodySuspended)
    return {
      ...f,
      scriptId: p.scriptId,
      entry: 0x80c20b,
      continuation: p,
      maxHandlers: 1,
      ioObservations: menuRecords([]),
      waitObservations: menuRecords([]),
      context: Object.freeze({ ...p.outputContext, pc: 0xc20b }),
    };
  if (p.scriptChildSuspended)
    return {
      ...f,
      entry: 0x80c20b,
      continuation: p,
      maxHandlers: [0x10e, 0xc8, ...countdownChildIds].includes(s.childId)
        ? f.childHandlers
        : s.childId === 0x4b
          ? 3
          : 4,
      ioObservations: [0x10e, 0xc8].includes(s.childId) ? f.childIO : menuRecords([]),
      waitObservations: [0x10e, 0xc8].includes(s.childId) ? f.childWait : menuRecords([]),
      inputObservations: [0x10e, 0xc8].includes(s.childId) ? f.childInput : menuRecords([]),
      context: Object.freeze({ ...p.outputContext, pc: 0xc20b }),
    };
  if (p.bodySuspended) {
    const count = bodyWord(f.data, 0x800c02 + p.waitSlot);
    return {
      ...f,
      scriptId: p.scriptId,
      entry: 0x80c1ca,
      continuation: p,
      maxHandlers: countdownChildIds.includes(s.childId) ? f.childRemainingHandlers : 7,
      ioObservations:
        count === 1 && !countdownChildIds.includes(s.childId)
          ? f.childAudioObservations
          : menuRecords([]),
      waitObservations: menuRecords([]),
      context: Object.freeze({ ...p.outputContext, pc: 0xc1ca, s: 0xb05, d: 0, bank: 0x80 }),
    };
  }
  return {
    ...f,
    entry: 0x80c20b,
    continuation: p,
    maxHandlers: f.parentSuffixHandlers ?? (s.id === 0x1bd ? 4 : 1),
    ioObservations: f.parentSuffixIO ?? menuRecords([]),
    waitObservations: f.parentSuffixWait ?? menuRecords([]),
    inputObservations: f.parentSuffixInput ?? menuRecords([]),
    context: Object.freeze({ ...p.outputContext, pc: 0xc20b }),
  };
}
export function runChildFixture(s, v, { reportBoundary = false } = {}) {
  const fixture = scriptBodyFixture(s, v),
    segments = [],
    observations = [],
    inputRecords = [];
  let options = fixture,
    prepare = start;
  const statusSamples = [];
  let eventEntries = 0;
  for (let n = 0; n < (s.parentWaitChild ? 20 : 10); n++) {
    if (
      s.parentWaitChild &&
      prepare === resume &&
      options.continuation.scriptId === s.id &&
      options.continuation.nextPC === (s.parentWaitAddChild ? 19 : 28)
    ) {
      const value = v.blocked && eventEntries++ === 0 ? 0 : s.parentWaitAddChild ? 0x80 : 0x10;
      // This independently declared external event observation is the only
      // between-commit seed. It never supplies cursor/countdown/frame/returns.
      sampleWord(fixture.data, 0x800c64, value);
      statusSamples.push({ segment: n, address: 0x800c64, width: 2, value, synthetic: true });
      options = {
        ...options,
        ioObservations: value && !s.parentWaitAddChild ? fixture.parentTextIO : menuRecords([]),
        waitObservations: value && !s.parentWaitAddChild ? fixture.parentTextWait : menuRecords([]),
      };
    }
    const before = JSON.stringify(fixture.data.snapshot()),
      plan = prepare(options);
    if (!plan.handled) {
      if (reportBoundary) return { fixture, segments, observations, boundary: plan };
      throw Error(`Parent${s.id.toString(16)} segment${n}: ${JSON.stringify(plan)}`);
    }
    if (before !== JSON.stringify(fixture.data.snapshot())) throw Error('Child prepare mutation');
    if (!commitTaskPlan(fixture.data, plan).handled) throw Error('Child commit failed');
    segments.push(plan);
    inputRecords.push(options.inputObservations ?? []);
    if (plan.bodyComplete && plan.scriptId === s.id)
      return { fixture, plan, segments, observations, inputRecords, statusSamples };
    options = childNextOptions(s, fixture, plan);
    prepare = plan.scriptChildSuspended
      ? enter
      : plan.childEntry && plan.bodySuspended
        ? postrun
        : s.parentWaitChild &&
            plan.scriptId === s.id &&
            plan.bodySuspended &&
            options.entry === 0x80c20b
          ? parentPostrun
          : plan.bodySuspended
            ? resume
            : parent;
    observations.push({ entry: options.entry, context: options.context, synthetic: true });
  }
  throw Error('Child finite source observation bound exceeded');
}
const segmentSteps = (p) =>
  (p.segmentHandlers ?? p.handlersExecuted) === 0
    ? []
    : p.steps.slice(-(p.segmentHandlers ?? p.handlersExecuted));
export function childBodyProbe(s, v) {
  const {
    fixture: f,
    plan: p,
    segments,
    observations,
    inputRecords,
    statusSamples,
  } = runChildFixture(s, v);
  return {
    script_id: s.id,
    case: v.name,
    synthetic_context: true,
    original_body_bytes: true,
    body_complete: p.bodyComplete,
    body_pcs: p.bodyPCs,
    handlers: p.handlersExecuted,
    output_context: p.outputContext,
    result_word: p.resultWord,
    work: segments.reduce((n, s) => n + s.work, 0),
    output_bytes: segments.reduce((n, s) => n + s.outputBytes, 0),
    byte_writes: p.byteWrites,
    access_sha256: taskHash(Buffer.from(JSON.stringify(segments.map((s) => s.accesses)))),
    child_segments: segments.map((s, n) => ({
      segment: n,
      script_id: s.scriptId,
      body_complete: s.bodyComplete,
      body_suspended: s.bodySuspended ?? false,
      script_child_suspended: s.scriptChildSuspended ?? false,
      body_pcs: s.bodyPCs,
      segment_handlers: s.segmentHandlers ?? s.handlersExecuted,
      result_word: s.resultWord ?? null,
      output_context: s.outputContext,
      work: s.work,
      output_bytes: s.outputBytes,
      observed_readiness_entries: s.observedReadinessEntries ?? 0,
      child_postrun_returned: s.childPostrunReturned ?? false,
      ...([0x15c, 0x15e, 0x15f, 0x164, 0x28c].includes(s.scriptId)
        ? {
            parent_postrun_returned: s.parentPostrunReturned ?? false,
            next_pc: s.nextPC ?? null,
            parent_readiness: s.parentReadiness ?? null,
            parent_wait_mask_write: s.accesses.flatMap((a, k) =>
              a.kind === 'write' && a.label === 'wait-mask-store-low'
                ? [a.value | (s.accesses[k + 1].value << 8)]
                : [],
            ),
            parent_wait_count_write: s.accesses.flatMap((a, k) =>
              a.kind === 'write' && a.label === 'wait-count-store-low'
                ? [a.value | (s.accesses[k + 1].value << 8)]
                : [],
            ),
            parent_status_reads: s.accesses.flatMap((a, k) =>
              a.kind === 'read' && a.address === 0x800c64 && a.label === 'visit-fresh-DBR-WORD-low'
                ? [a.value | (s.accesses[k + 1].value << 8)]
                : [],
            ),
            parent_mask:
              s.accesses
                .filter(
                  (a) =>
                    a.kind === 'read' &&
                    a.address === 0x800ba4 &&
                    a.label === 'visit-fresh-DBR-WORD-low',
                )
                .map((a) => a.value)
                .at(-1) ?? null,
            parent_countdown:
              s.accesses
                .filter(
                  (a) =>
                    a.kind === 'write' &&
                    a.address === 0x800c04 &&
                    a.label === 'visit-DBR-WORD-low',
                )
                .map((a) => a.value)
                .at(-1) ?? null,
          }
        : {}),
      child_slot: s.childSlot ?? null,
      child_frame: s.childFrame ?? null,
      parent_slot: s.parentSlot ?? null,
      parent_frame: s.frame ?? null,
      io_observations_used: s.observationsUsed ?? 0,
      countdown:
        s.accesses
          .filter(
            (a) => a.kind === 'write' && a.address === 0x800c06 && a.label === 'visit-DBR-WORD-low',
          )
          .map((a) => {
            const high = s.accesses.find(
              (x) =>
                x.kind === 'write' && x.address === 0x800c07 && x.label === 'visit-DBR-WORD-high',
            );
            return a.value | ((high?.value ?? 0) << 8);
          })
          .at(-1) ?? null,
      access_sha256: taskHash(Buffer.from(JSON.stringify(s.accesses))),
      byte_writes: s.byteWrites,
      io_records: (s.ioRequests ?? []).filter((r) => r.kind === 'read').map(({ kind, ...r }) => r),
      io_requests: s.ioRequests ?? [],
      wait_records: s.waitEvents ?? [],
      wait_observations_used: s.waitObservationsUsed ?? 0,
      input_records: inputRecords[n],
      input_observations_used: s.inputObservationsUsed ?? 0,
      ...(s.scriptId === 0xd1 ? propertyParentSegmentDetails(s) : {}),
      ...([0x15c, 0x15e, 0x15f, 0x164, 0x28c].includes(s.scriptId)
        ? parentWaitSegmentDetails(s)
        : {}),
      ...([
        0x10e,
        0xc8,
        0xd1,
        0x15c,
        0x15e,
        0x15f,
        0x164,
        0x28c,
        0x161,
        0x18b,
        0x1cf,
        0x1d2,
        ...countdownChildIds,
      ].includes(s.scriptId)
        ? {
            native_calls: s.steps
              .filter((p) => p.calleeEntry)
              .map((p) => ({
                target: p.calleeEntry,
                word_pops: p.arguments?.wordPops ?? p.wordPops ?? null,
                wait_observations_used: p.waitObservationsUsed ?? 0,
                input_observations_used: p.inputObservationsUsed ?? 0,
                iterations: p.callee?.iterations ?? null,
                glyphs: p.callee?.text?.glyphs ?? null,
                newlines: p.callee?.text?.newlines ?? null,
                callee_return_word: p.calleeReturnWord ?? null,
                result_pushed: p.resultPushed ?? null,
                ...([0x15c, 0x15e, 0x15f, 0x164, 0x28c, ...countdownChildIds].includes(s.scriptId)
                  ? {
                      saved_continuation_word: p.savedContinuationWord ?? null,
                      raw_return_word: p.rawReturnWord ?? null,
                    }
                  : {}),
              })),
          }
        : {}),
    })),
    child_observed_entries: observations,
    child_header_result: p.childCompletion ?? null,
    heap_observed_size: v.heap ?? 0x800,
    ...(s.childId === 0x10e
      ? {
          child_state: v.state,
          child_repeated: v.repeated,
          child_argument: s.instructions[0].operand,
          child_local: bodyWord(f.data, 0x3e9),
          child_native56_field: bodyWord(f.data, 0x7e2de2),
          child_native56_controls: bodyWord(f.data, 0x801ce9),
        }
      : {}),
    ...(s.childId === 0xc8 ? childMenuProbeDetails(s, v, f) : {}),
    ...(s.recordPropertyChild ? propertyParentProbeDetails(s, v, f) : {}),
    ...(s.parentWaitChild
      ? {
          ...(s.parentWaitAddChild
            ? parentAddProbeDetails(s, v, f)
            : parentWaitProbeDetails(s, v, f)),
          parent_status_samples: statusSamples,
        }
      : {}),
    ...(s.parentWaitAliasChild ? aliasParentProbeDetails(s, v, f) : {}),
    ...(countdownChildIds.includes(s.childId) ? countdownChildProbeDetails(s, v, f) : {}),
    ...(s.countdownBranchParent
      ? {
          parent_getter_results: segments[0].accesses.flatMap((a, n) =>
            a.kind === 'write' && a.label === 'resume-result-PHA-low'
              ? [a.value | (segments[0].accesses[n - 1].value << 8)]
              : [],
          ),
        }
      : {}),
    ...(s.random63Observations
      ? {
          native63_observation_segments: segments
            .filter((p) => p.scriptId === s.id)
            .map((p) => ({
              segment: segments.indexOf(p),
              synthetic: true,
              native63_calls: segmentSteps(p).filter((n) => n.calleeEntry === 0x80c560).length,
              io_records: (p.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: p.ioRequests ?? [],
              io_observations_used: p.observationsUsed ?? 0,
            })),
        }
      : {}),
    ...(s.nativeA3Observations
      ? {
          native_a3_observation_segments: segments
            .filter((p) => p.scriptId === s.id)
            .map((p) => ({
              segment: segments.indexOf(p),
              synthetic: true,
              native_a3_calls: segmentSteps(p).filter((n) => n.calleeEntry === 0x80f953).length,
              wait_records: p.waitEvents ?? [],
              wait_observations_used: p.waitObservationsUsed ?? 0,
              input_records: inputRecords[segments.indexOf(p)],
              input_observations_used: p.inputObservationsUsed ?? 0,
            })),
        }
      : {}),
    ...(s.c8Observations
      ? {
          c8_observation_segments: segments
            .filter((p) => p.scriptId === s.id)
            .map((p) => ({
              segment: segments.indexOf(p),
              synthetic: true,
              c8_calls: segmentSteps(p).filter((n) => n.calleeEntry === 0x80fec1).length,
              io_records: (p.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_observations_used: p.observationsUsed ?? 0,
              wait_records: p.waitEvents ?? [],
              wait_observations_used: p.waitObservationsUsed ?? 0,
            })),
        }
      : {}),
    final_links: {
      current: bodyWord(f.data, 0x800250),
      tail: bodyWord(f.data, 0x80024c),
      free: bodyWord(f.data, 0x80024e),
      parent_wait: bodyWord(f.data, 0x800ba4),
      parent_next: bodyWord(f.data, 0x800374),
      heap: bodyWord(f.data, 0x8003d2),
    },
  };
}
