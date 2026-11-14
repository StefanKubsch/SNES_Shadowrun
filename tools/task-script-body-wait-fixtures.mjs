import assert from 'node:assert/strict';
import {
  prepareTaskScriptBody,
  prepareTaskScriptBodyResume,
} from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { scriptBodyFixture, bodyOuterS, bodyWord } from './task-script-body-fixtures.mjs';
import { taskHash } from './task-partial-source.mjs';
import { localWaitResumePatch } from './task-script-body-local-wait-fixtures.mjs';
import { recordAndProbeDetails } from './task-script-body-record-and-fixtures.mjs';

export function resumeBodyFixture(spec, f, continuation) {
  const pc = continuation.nextPC,
    following = spec.instructions.filter(
      (i) => i.pc >= pc && (!spec.directionBody || f.directionPCs.includes(i.pc)),
    );
  const nextWait = following.findIndex((i) => i.opcode === 0x58 && i.operand === 0x9f);
  const maxHandlers = nextWait < 0 ? following.length : nextWait + 1;
  const currentSegment = following.slice(0, maxHandlers);
  const countLow = f.data.readByte(0x800c04),
    countHigh = f.data.readByte(0x800c05),
    declaredAudioEntry =
      f.audioResumeAtCountdown === null ||
      (countLow.available &&
        countHigh.available &&
        (countLow.value | (countHigh.value << 8)) === f.audioResumeAtCountdown);
  return {
    ...f,
    entry: 0x80c1f9,
    continuation,
    maxHandlers,
    ...(spec.blastBody
      ? {
          ioObservations:
            spec.id === 0x136 &&
            countLow.available &&
            countHigh.available &&
            (countLow.value | (countHigh.value << 8)) === 1
              ? f.blastResumeObservations.ioObservations
              : Object.freeze([]),
          waitObservations: Object.freeze([]),
          inputObservations: Object.freeze([]),
        }
      : {}),
    ...(spec.c8Observations
      ? {
          ioObservations: Object.freeze([]),
          waitObservations: Object.freeze([]),
          ...(following.some((i) => i.opcode === 0x58 && i.operand === 0xc8)
            ? f.c8ResumeObservations
            : {}),
        }
      : {}),
    ...(spec.doubleClearWait
      ? {
          ioObservations: Object.freeze([]),
          waitObservations: Object.freeze([]),
          ...(currentSegment.some((i) => i.opcode === 0x58 && i.operand === 0xa7)
            ? f.a7ResumeObservations
            : {}),
          ...(currentSegment.some((i) => i.opcode === 0x58 && i.operand === 0xc8)
            ? f.c8ResumeObservations
            : {}),
        }
      : {}),
    ...(spec.native13Observations
      ? {
          ioObservations: Object.freeze([]),
          waitObservations: Object.freeze([]),
          inputObservations: Object.freeze([]),
          ...(currentSegment.some((i) => i.opcode === 0x58 && i.operand === 0xc8)
            ? f.c8ResumeObservations
            : {}),
        }
      : {}),
    ...(spec.nativeA3Observations ? { inputObservations: Object.freeze([]) } : {}),
    // Test-only observed sample arrangement. A count1 entry is declared with
    // future audio samples; the plan still proves readiness from all fresh
    // source bytes. Earlier blocked entries declare no audio observations.
    ...(spec.audioWait
      ? {
          ioObservations:
            following.some((i) => i.opcode === 0x58 && i.operand === 0x4c) && declaredAudioEntry
              ? f.audioResumeObservations
              : Object.freeze([]),
          waitObservations: Object.freeze([]),
          inputObservations: Object.freeze([]),
        }
      : {}),
    ...(spec.multiAudioWait
      ? {
          ioObservations:
            currentSegment.some((i) => i.opcode === 0x58 && i.operand === 0x4c) &&
            countLow.available &&
            countHigh.available &&
            (countLow.value | (countHigh.value << 8)) === 1
              ? f.audioResumeByPC[pc]
              : Object.freeze([]),
        }
      : {}),
    ...(spec.directionBody && spec.c8Observations
      ? {
          ioObservations:
            currentSegment.some((i) => i.opcode === 0x58 && i.operand === 0xc8) &&
            countLow.available &&
            countHigh.available &&
            (countLow.value | (countHigh.value << 8)) === 1
              ? f.c8ResumeObservations.ioObservations
              : Object.freeze([]),
          waitObservations:
            currentSegment.some((i) => i.opcode === 0x58 && i.operand === 0xc8) &&
            countLow.available &&
            countHigh.available &&
            (countLow.value | (countHigh.value << 8)) === 1
              ? f.c8ResumeObservations.waitObservations
              : Object.freeze([]),
        }
      : {}),
    ...(spec.localWaitBody ? localWaitResumePatch(spec, f, continuation) : {}),
    context: Object.freeze({
      ...continuation.outputContext,
      pc: 0xc1f9,
      s: bodyOuterS,
      d: 0,
      bank: 0x80,
      x: 2,
    }),
  };
}
export function runWaitBodyFixture(spec, variant = {}, { reportBoundary = false } = {}) {
  const f = scriptBodyFixture(spec, variant),
    segments = [],
    observations = [];
  let options = f,
    prepare = prepareTaskScriptBody;
  const observationBudget = spec.multiAudioWait ? 1500 : 1000;
  for (let n = 0; n < observationBudget; n++) {
    const before = JSON.stringify(f.data.snapshot()),
      p = prepare(options);
    if (!p.handled && reportBoundary) return { fixture: f, boundary: p, segments, observations };
    assert.equal(p.handled, true, `${spec.id.toString(16)} segment${n}: ${p.reason}`);
    assert.equal(JSON.stringify(f.data.snapshot()), before);
    assert.equal(commitTaskPlan(f.data, p).handled, true);
    segments.push(p);
    if (p.bodyComplete) return { fixture: f, plan: p, segments, observations };
    assert.equal(p.bodySuspended, true);
    options = resumeBodyFixture(spec, f, p);
    prepare = prepareTaskScriptBodyResume;
    // Original067 waits for mask8, B5 families for mask2 and D1 motion bodies for mask4. This is an explicit synthetic
    // event-byte observation at the later entry, not a timer/device value or
    // a claimed original writer/caller occurrence. Other bodies use real
    // C3C9 countdown decrements only; no countdown seeds after yield.
    const mask = bodyWord(f.data, 0x800ba4);
    if (spec.selectionBody && variant.event === 0x800) {
      f.data.seed(0x800c64, [0, 8]);
      observations.push({ kind: 'synthetic-provider-event-byte', address: 0x800c64, value: 0x800 });
    } else if (spec.audioWait && variant.event !== undefined) {
      const event = variant.event;
      f.data.seed(0x800c64, [event & 255, event >>> 8]);
      observations.push({ kind: 'synthetic-provider-event-byte', address: 0x800c64, value: event });
    } else if (spec.native13Wait && mask === 0x90) {
      const event = variant.event ?? 0x90;
      f.data.seed(0x800c64, [event, 0]);
      observations.push({ kind: 'synthetic-provider-event-byte', address: 0x800c64, value: event });
    } else if (
      [
        2,
        8,
        ...(spec.sourceRomGuards ? [4] : []),
        ...(spec.c8Observations && [0x116, 0x3a6].includes(spec.id) ? [16] : []),
      ].includes(mask)
    ) {
      f.data.seed(0x800c64, [mask, 0]);
      observations.push({ kind: 'synthetic-provider-event-byte', address: 0x800c64, value: mask });
    }
    observations.push({ kind: 'synthetic-observed-C1F9', context: options.context });
  }
  throw Error(`Body${spec.id.toString(16)} did not complete within its finite observation budget`);
}
export function waitBodyProbe(spec, variant) {
  const { fixture: f, plan: p, segments, observations } = runWaitBodyFixture(spec, variant);
  const groups = [];
  for (const s of segments) {
    const key = JSON.stringify([
      s.bodyComplete,
      s.bodySuspended ?? false,
      s.segmentHandlers ?? s.handlersExecuted,
      s.frontier,
    ]);
    const current = groups.at(-1),
      digest = taskHash(Buffer.from(JSON.stringify(s.accesses)));
    const countdown = s.accesses.find(
      (a) => a.kind === 'write' && a.address === 0x800c04 && a.label === 'visit-DBR-WORD-low',
    );
    const high = countdown
      ? s.accesses.find(
          (a) => a.kind === 'write' && a.address === 0x800c05 && a.label === 'visit-DBR-WORD-high',
        )
      : null;
    const count = countdown ? countdown.value | (high.value << 8) : null;
    if (current?.key === key) {
      current.repetitions++;
      current.work += s.work;
      current.output_bytes += s.outputBytes;
      current.last_access_sha256 = digest;
      current.last_countdown = count;
    } else
      groups.push({
        key,
        repetitions: 1,
        body_complete: s.bodyComplete,
        body_suspended: s.bodySuspended ?? false,
        segment_handlers: s.segmentHandlers ?? s.handlersExecuted,
        frontier: s.frontier,
        work: s.work,
        output_bytes: s.outputBytes,
        first_countdown: count,
        last_countdown: count,
        first_access_sha256: digest,
        last_access_sha256: digest,
      });
  }
  return {
    script_id: spec.id,
    case: variant.name,
    synthetic_context: true,
    original_body_bytes: true,
    body_complete: p.bodyComplete,
    body_pcs: p.bodyPCs,
    handlers: p.handlersExecuted,
    output_context: p.outputContext,
    work: segments.reduce((n, p) => n + p.work, 0),
    output_bytes: segments.reduce((n, p) => n + p.outputBytes, 0),
    result_word: p.resultWord,
    observed_readiness_entries: p.observedReadinessEntries ?? 0,
    observations: {
      entries: observations.filter((o) => o.kind === 'synthetic-observed-C1F9').length,
      event_bytes: observations.filter((o) => o.kind === 'synthetic-provider-event-byte'),
      sha256: taskHash(Buffer.from(JSON.stringify(observations))),
    },
    segments: groups.map(({ key, ...group }) => group),
    ...(spec.selectionBody
      ? {
          selection_root_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && [0x9a, 0x1a].includes(a.value)),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              selection_root_calls: s.accesses.filter(
                (a) => a.label === 'saved-ID-low' && [0x9a, 0x1a].includes(a.value),
              ).length,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
            })),
        }
      : {}),
    ...(spec.native7CObservations
      ? {
          native7c_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0x7c),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              native7c_calls: s.accesses.filter(
                (a) => a.label === 'saved-ID-low' && a.value === 0x7c,
              ).length,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: s.inputObservationsUsed,
            })),
        }
      : {}),
    ...(spec.nativeA3Observations
      ? {
          native_a3_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(
              ({ s }) =>
                s.steps.some((p) => p.calleeEntry === 0x80f953) && s.inputObservationsUsed > 0,
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              native_a3_calls: s.steps.filter((p) => p.calleeEntry === 0x80f953).length,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: s.inputObservationsUsed,
            })),
        }
      : {}),
    ...(spec.random63Observations
      ? {
          native63_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0x63),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              native63_calls: s.accesses.filter(
                (a) => a.label === 'saved-ID-low' && a.value === 0x63,
              ).length,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
            })),
        }
      : {}),
    ...(spec.audioObservations
      ? {
          native4c_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0x4c),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              native4c_calls: s.accesses.filter(
                (a) => a.label === 'saved-ID-low' && a.value === 0x4c,
              ).length,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: s.inputObservationsUsed,
            })),
        }
      : {}),
    ...(spec.nativeA7Observations
      ? {
          native_a7_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0xa7),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              native_a7_calls: s.accesses.filter(
                (a) => a.label === 'saved-ID-low' && a.value === 0xa7,
              ).length,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
            })),
        }
      : {}),
    ...(spec.c8Observations
      ? {
          c8_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0xc8),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              c8_calls: s.accesses.filter((a) => a.label === 'saved-ID-low' && a.value === 0xc8)
                .length,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
            })),
        }
      : {}),
    ...(spec.native13Observations
      ? {
          native13_observation_segments: segments
            .map((s, n) => ({ s, n }))
            .filter(({ s }) =>
              s.accesses.some((a) => a.label === 'saved-ID-low' && a.value === 0x13),
            )
            .map(({ s, n }) => ({
              segment: n,
              synthetic: true,
              native13_calls: s.accesses.filter(
                (a) => a.label === 'saved-ID-low' && a.value === 0x13,
              ).length,
              c8_calls: 0,
              io_records: (s.ioRequests ?? [])
                .filter((r) => r.kind === 'read')
                .map(({ kind, ...r }) => r),
              io_requests: s.ioRequests,
              io_observations_used: s.observationsUsed,
              wait_records: s.waitEvents,
              wait_observations_used: s.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: s.inputObservationsUsed,
            })),
        }
      : {}),
    ...(spec.localWaitBody
      ? {
          local_return_events: p.localReturnEvents,
          local_return_checkpoints: segments.map((s, segment) => ({
            segment,
            pending: s.pendingLocalReturns,
            events: s.localReturnEvents.length,
            body_handlers: s.handlersExecuted,
            readiness_entries: s.observedReadinessEntries ?? 0,
          })),
        }
      : {}),
    ...(spec.recordAndWaitBody ? recordAndProbeDetails(spec, variant, f, segments) : {}),
    access_sha256: taskHash(Buffer.from(JSON.stringify(segments.map((p) => p.accesses)))),
  };
}
