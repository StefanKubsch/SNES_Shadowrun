import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan, isLatestCommittedTaskPlan } from './plan.mjs';
import { renderAddress } from '../../src/render/data.mjs';
import { runTaskOpcodeSequence } from './opcode-sequence.mjs';
import { scriptBodySpecs, scriptBodyNativeSources } from './script-body-specs.mjs';
import { runTaskNativeWaitOpcode, runTaskNativeWaitResume } from './native-wait.mjs';
import { runTaskNativeC8Opcode } from './native-c8-opcode.mjs';
import { runTaskNativeClearOpcode } from './native-clear-opcode.mjs';
import { runTaskNativeInputWaitOpcode } from './native-input-wait-opcode.mjs';
import { fec1Registers, validateNoticeOptions } from '../../src/task/native-notice.mjs';
import { runTaskNative13Opcode } from './native13-opcode.mjs';
import { taskActionsDevices, validateTaskActionsOptions } from '../../src/task/native-actions.mjs';
import { runTaskNativeAudioOpcode } from './native-audio-opcode.mjs';
import { taskAudioDevices } from '../../src/task/native-audio-compose.mjs';
import { runTaskNativeRandomOpcode } from './native-random-opcode.mjs';
import { taskRandomDevices } from '../../src/task/native-random.mjs';
import { runTaskNative7COpcode } from './native-8e36-opcode.mjs';
import { hitObjectsInBlastDevices } from '../../src/task/native-object-hit.mjs';
import { runTaskSelectionOpcode } from './native-selection-root-opcode.mjs';
import { selectionDevices } from '../../src/task/native-selection.mjs';
import { runTaskModalOpcode } from './native-modal-opcode.mjs';
import { modalDevices } from '../../src/task/native-modal.mjs';
import { runTaskVisit } from './visit-c1ca.mjs';
import { runTaskVisitEpilogue } from './visit-epilogue.mjs';
const mixedDevices = Object.freeze({
  writes: taskAudioDevices.writes,
  reads: Object.freeze([...new Set([...taskAudioDevices.reads, ...taskRandomDevices.reads])]),
  observationPcs: Object.freeze([
    ...new Set([...taskAudioDevices.observationPcs, ...taskRandomDevices.observationPcs]),
  ]),
});
const parentWaitDevices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([...new Set([...fec1Registers[key], ...taskRandomDevices[key]])]),
    ]),
  ),
);

const suspendedBodies = new WeakMap();
const suspendedParents = new WeakMap(),
  childOwners = new WeakMap();
const parentWaitOwners = new WeakMap();
function nativeWord(a, native, address, wrap, label, outer) {
  const index = [
    'fresh-native-pointer',
    'native-argument-metadata-WORD',
    'resume-return-metadata-WORD',
  ].indexOf(label);
  const anchor = index < 0 ? null : native.anchors[index];
  if (anchor && (address !== anchor.address || wrap !== 24))
    taskStop('task_script_body_native_metadata_required', { address });
  const value = a.readWord(address, wrap, label, outer);
  if (anchor && value !== (anchor.bytes[0] | (anchor.bytes[1] << 8)))
    taskStop('task_script_body_native_metadata_required', { address });
  return value;
}
function integrity(a, spec) {
  const bytes = [
    ...spec.header,
    ...spec.bytecode,
    ...(spec.fetchTail === null ? [] : [spec.fetchTail]),
  ];
  for (let n = 0; n < bytes.length; n++)
    if (a.read(spec.scriptEntry + n, 'original-body-source') !== bytes[n])
      taskStop('task_script_body_bytes_required', {
        scriptId: spec.id,
        address: spec.scriptEntry + n,
      });
  for (const r of spec.romReads)
    if (a.readWord(r.address, 24, 'original-body-ROM-table') !== r.value)
      taskStop('task_script_body_bytes_required', { scriptId: spec.id, address: r.address });
}
function localReturnOwners(a, spec, frame, returns) {
  if (!returns.length) return;
  if (
    a.readWord((frame + 5) & 65535, 16, 'body-local-return-admission-pointer') !==
    returns.at(-1).newPointer
  )
    taskStop('task_script_body_local_owner_required');
  const bank = spec.scriptEntry >>> 16;
  for (const r of returns)
    if (
      a.readWord(bank * 65536 + r.destination, 24, 'body-local-return-admission-WORD') !==
      r.returnPC
    )
      taskStop('task_script_body_local_return_required');
}

// Bounded original bodies over the existing physical overlay. Entry is an
// independently observed first F390, not inferred Script52/F378/readiness.
export function runTaskScriptBody(a, options, continuation = null, allocatedChild = false) {
  const spec = scriptBodySpecs.find((s) => s.id === options.scriptId);
  if (!spec) taskStop('task_script_body_source_required');
  if (!Number.isSafeInteger(options.maxHandlers) || options.maxHandlers < 1)
    taskStop('task_handler_budget_required');
  const bank = spec.scriptEntry >>> 16,
    pointer = (spec.scriptEntry + 2) & 65535;
  if (a.ctx.y !== (continuation ? continuation.nextPC + 1 : 1))
    taskStop('task_script_body_entry_required');
  if (continuation && a.ctx.d !== continuation.frame) taskStop('task_script_body_frame_required');
  integrity(a, spec);
  const steps = [...(continuation?.steps ?? [])],
    bodyPCs = [...(continuation?.bodyPCs ?? [])];
  // Expected LIFO ownership only. 4C/50 themselves perform every source store,
  // fresh pointer read, saved WORD read and opcode fetch; no cached return data.
  const localReturns = [...(continuation?.pendingLocalReturns ?? [])],
    localReturnEvents = [...(continuation?.localReturnEvents ?? [])];
  const localState = () =>
    spec.localBody
      ? {
          pendingLocalReturns: Object.freeze(localReturns.map((e) => Object.freeze({ ...e }))),
          localReturnEvents: Object.freeze(localReturnEvents.map((e) => Object.freeze({ ...e }))),
        }
      : {};
  if (spec.localWaitBody && continuation) localReturnOwners(a, spec, a.ctx.d, localReturns);
  let waitIndex = 0,
    inputIndex = 0;
  const observations = () => {
    if (
      (allocatedChild ||
        spec.scriptChildBody ||
        spec.modalBody ||
        spec.selectionBody ||
        spec.native7CObservations ||
        spec.c8Observations ||
        spec.native13Observations ||
        spec.nativeA3Observations ||
        spec.audioObservations ||
        spec.randomObservations) &&
      waitIndex !== (options.waitObservations?.length ?? 0)
    )
      taskStop('task_wait_observation_unused', { observationIndex: waitIndex });
    if (
      (allocatedChild ||
        spec.scriptChildBody ||
        spec.modalBody ||
        spec.selectionBody ||
        spec.native7CObservations ||
        spec.native13Observations ||
        spec.nativeA3Observations ||
        spec.audioObservations ||
        spec.randomObservations) &&
      inputIndex !== (options.inputObservations?.length ?? 0)
    )
      taskStop('task_input_observation_unused', { observationIndex: inputIndex });
    return {
      ...(spec.modalBody ||
      spec.selectionBody ||
      spec.native7CObservations ||
      spec.c8Observations ||
      spec.native13Observations ||
      spec.nativeA3Observations ||
      spec.audioObservations
        ? {
            waitObservationsUsed: waitIndex,
            waitEvents: Object.freeze((options.waitObservations ?? []).slice(0, waitIndex)),
          }
        : {}),
      ...(spec.modalBody ||
      spec.selectionBody ||
      spec.native7CObservations ||
      spec.native13Observations ||
      spec.nativeA3Observations ||
      spec.audioObservations
        ? { inputObservationsUsed: inputIndex }
        : {}),
    };
  };
  for (let n = 0; n < options.maxHandlers; n++) {
    const livePointer = a.readWord(a.ctx.d, 16, 'body-fresh-pointer'),
      pc = (a.ctx.y - 1) & 65535;
    if (a.ctx.bank !== bank || livePointer !== pointer)
      taskStop('task_script_body_pointer_required', { scriptId: spec.id });
    const instruction = spec.instructions.find((i) => i.pc === pc);
    if (!instruction || a.ctx.x !== instruction.opcode)
      taskStop('task_script_body_instruction_required', { scriptId: spec.id, bodyPC: pc });
    // Check the first observed opcode WORD too; later WORD fetches are performed
    // by the original handlers. The last ignored highbyte is an explicit source.
    if (
      n === 0 &&
      (a.readWord(spec.scriptEntry + 2 + pc, 24, 'body-entry-opcode-WORD') & 255) !== a.ctx.x
    )
      taskStop('task_script_body_instruction_required');
    const native =
      instruction.opcode === 0x58
        ? scriptBodyNativeSources.find((s) => s.id === instruction.operand)
        : null;
    if (instruction.opcode === 0x58 && !native) taskStop('task_script_body_source_required');
    if (native)
      for (const anchor of native.anchors)
        for (let byte = 0; byte < 2; byte++)
          if (a.read(anchor.address + byte, 'original-body-native-table') !== anchor.bytes[byte])
            taskStop('task_script_body_bytes_required', {
              scriptId: spec.id,
              address: anchor.address + byte,
            });
    // Saved-PC/workspace stores can replace a pushed index before the callee.
    // Admit the pinned ROM lookup at the actual read, never a cached argument.
    const bodyView =
      native || (instruction.opcode === 0x52 && spec.scriptChildBody)
        ? {
            ...a,
            readWord(address, wrap = 24, label = 'WORD', outer = false) {
              const romRead =
                ((native?.id === 0x4c || spec.nativeA7Observations || spec.originalTextSources) &&
                  label === 'text-root-WORD' &&
                  (renderAddress(address) ?? 0) >= 0x800000) ||
                (spec.sourceRomGuards
                  ? [
                      'argument-metadata-WORD',
                      'leaf-long-WORD',
                      'position-indirect-WORD',
                      'd2-table-WORD',
                      'd2-indirect-WORD',
                      'script-bank-table-WORD',
                      'script-frame-argument-metadata-WORD',
                      'script-pointer-table-WORD',
                    ].includes(label) && (renderAddress(address) ?? 0) >= 0x800000
                  : native?.id === 13
                    ? label === 'leaf-long-WORD'
                    : native?.id === 0xd2 && ['d2-table-WORD', 'd2-indirect-WORD'].includes(label));
              const pinned = romRead ? spec.romReads.find((r) => r.address === address) : null;
              if (romRead && !pinned) taskStop('task_script_body_ROM_read_required', { address });
              const value = native
                ? nativeWord(a, native, address, wrap, label, outer)
                : a.readWord(address, wrap, label, outer);
              if (pinned && value !== pinned.value)
                taskStop('task_script_body_ROM_read_required', {
                  address,
                  expected: pinned.value,
                  actual: value,
                });
              return value;
            },
            read(address, label, outer = false) {
              if (
                label !== 'd2-indirect-BYTE' &&
                !(
                  (spec.nativeA7Observations || spec.originalTextSources) &&
                  label === 'text-root-BYTE' &&
                  (renderAddress(address) ?? 0) >= 0x800000
                ) &&
                !(
                  spec.sourceRomGuards &&
                  ['script-header-BYTE', 'script-header-indexed-BYTE'].includes(label)
                )
              )
                return a.read(address, label, outer);
              const pinned = spec.romReads.find((r) => r.address === address);
              if (!pinned) taskStop('task_script_body_ROM_read_required', { address });
              const value = a.read(address, label, outer);
              if (value !== (pinned.value & 255))
                taskStop('task_script_body_ROM_read_required', { address });
              return value;
            },
          }
        : a;
    const frame = a.ctx.d,
      parentSlot =
        instruction.opcode === 0x52 && spec.scriptChildBody
          ? a.readWord(0x800250, 24, 'body-child-parent-slot')
          : null;
    const c8Waits =
      options.waitObservations === null ? null : (options.waitObservations ?? []).slice(waitIndex);
    const counterBoundary = spec.nativeA3Observations
      ? c8Waits?.findIndex((o) => o.pc === 0x81b0a5)
      : -1;
    const result =
      native &&
      ((spec.modalBody && [0x72, 0xbf, 0x74, 0xd7].includes(native.id)) ||
        (spec.recordAndWaitBody && native.id === 0x74))
        ? {
            steps: [
              runTaskModalOpcode(
                bodyView,
                {
                  ...options,
                  waitObservations:
                    options.waitObservations === null
                      ? null
                      : Object.freeze((options.waitObservations ?? []).slice(waitIndex)),
                  inputObservations:
                    options.inputObservations === null
                      ? null
                      : Object.freeze((options.inputObservations ?? []).slice(inputIndex)),
                },
                native.id,
                true,
              ),
            ],
            frontier: '80:F390',
          }
        : native && (spec.modalBody || spec.selectionBody) && [0x1a, 0x9a].includes(native.id)
          ? {
              steps: [
                runTaskSelectionOpcode(
                  bodyView,
                  {
                    ...options,
                    waitObservations:
                      options.waitObservations === null
                        ? null
                        : Object.freeze((options.waitObservations ?? []).slice(waitIndex)),
                  },
                  native.id,
                  true,
                ),
              ],
              frontier: '80:F390',
            }
          : native?.id === 0x7c && spec.native7CObservations
            ? {
                steps: [
                  runTaskNative7COpcode(
                    bodyView,
                    {
                      ...options,
                      waitObservations:
                        options.waitObservations === null
                          ? null
                          : Object.freeze((options.waitObservations ?? []).slice(waitIndex)),
                      inputObservations:
                        options.inputObservations === null
                          ? null
                          : Object.freeze((options.inputObservations ?? []).slice(inputIndex)),
                    },
                    true,
                  ),
                ],
                frontier: '80:F390',
              }
            : native?.id === 0x13 && spec.native13Observations
              ? {
                  steps: [
                    runTaskNative13Opcode(
                      bodyView,
                      {
                        ...options,
                        waitObservations:
                          options.waitObservations === null
                            ? null
                            : Object.freeze((options.waitObservations ?? []).slice(waitIndex)),
                        inputObservations:
                          options.inputObservations === null
                            ? null
                            : Object.freeze((options.inputObservations ?? []).slice(inputIndex)),
                      },
                      true,
                    ),
                  ],
                  frontier: '80:F390',
                }
              : native?.id === 0x4c && spec.audioObservations
                ? { steps: [runTaskNativeAudioOpcode(bodyView, options)], frontier: '80:F390' }
                : native?.id === 0x3e && spec.randomObservations
                  ? { steps: [runTaskNativeRandomOpcode(bodyView, options)], frontier: '80:F390' }
                  : native?.id === 0x63 && spec.random63Observations
                    ? {
                        steps: [runTaskNativeRandomOpcode(bodyView, options, 0x63)],
                        frontier: '80:F390',
                      }
                    : native?.id === 0xa7 && spec.nativeA7Observations
                      ? {
                          steps: [
                            runTaskNativeClearOpcode(
                              bodyView,
                              {
                                ...options,
                                waitObservations:
                                  options.waitObservations === null
                                    ? null
                                    : Object.freeze(
                                        (options.waitObservations ?? []).slice(waitIndex),
                                      ),
                              },
                              true,
                            ),
                          ],
                          frontier: '80:F390',
                        }
                      : native?.id === 0xa3 && spec.nativeA3Observations
                        ? {
                            steps: [
                              runTaskNativeInputWaitOpcode(
                                bodyView,
                                {
                                  ...options,
                                  waitObservations:
                                    options.waitObservations === null
                                      ? null
                                      : Object.freeze(
                                          (options.waitObservations ?? []).slice(waitIndex),
                                        ),
                                  inputObservations:
                                    options.inputObservations === null
                                      ? null
                                      : Object.freeze(
                                          (options.inputObservations ?? []).slice(inputIndex),
                                        ),
                                },
                                true,
                              ),
                            ],
                            frontier: '80:F390',
                          }
                        : native?.id === 0xc8
                          ? {
                              steps: [
                                runTaskNativeC8Opcode(
                                  bodyView,
                                  {
                                    ...options,
                                    waitObservations:
                                      c8Waits === null
                                        ? null
                                        : Object.freeze(
                                            counterBoundary >= 0
                                              ? c8Waits.slice(0, counterBoundary)
                                              : c8Waits,
                                          ),
                                  },
                                  true,
                                ),
                              ],
                              frontier: '80:F390',
                            }
                          : native?.id === 0x9f
                            ? { steps: [runTaskNativeWaitOpcode(bodyView, options)] }
                            : runTaskOpcodeSequence(bodyView, {
                                ...options,
                                maxHandlers: 1,
                                native58Composition: true,
                                ...(spec.scriptChildBody
                                  ? { script52Composition: true, expectedScriptId: spec.childId }
                                  : {}),
                                ...(native ? { expectedNativeTarget: native.target } : {}),
                              });
    if (native?.id === 0xc8 || (native?.id === 0xa7 && spec.nativeA7Observations))
      waitIndex += result.steps[0].waitObservationsUsed;
    if (native?.id === 0x13 && spec.native13Observations) {
      waitIndex += result.steps[0].waitObservationsUsed;
      inputIndex += result.steps[0].inputObservationsUsed;
    }
    if (native?.id === 0xa3 && spec.nativeA3Observations) {
      waitIndex += result.steps[0].waitObservationsUsed;
      inputIndex += result.steps[0].inputObservationsUsed;
    }
    if (native?.id === 0x7c && spec.native7CObservations) {
      waitIndex += result.steps[0].waitObservationsUsed;
      inputIndex += result.steps[0].inputObservationsUsed;
    }
    if (native?.id === 0x9a && spec.native9AObservations)
      waitIndex += result.steps[0].waitObservationsUsed;
    if (native && spec.modalBody && [0x72, 0xbf, 0x74, 0xd7].includes(native.id)) {
      waitIndex += result.steps[0].waitObservationsUsed;
      inputIndex += result.steps[0].inputObservationsUsed;
    }
    steps.push(Object.freeze(result.steps[0]));
    bodyPCs.push(pc);
    if (instruction.opcode === 0x52 && spec.scriptChildBody) {
      if (n + 1 !== options.maxHandlers || instruction.operand !== spec.childId)
        taskStop('task_script_body_handler_count_required');
      const childSlot = a.ctx.x,
        childFrame = a.readWord(0x800252 + childSlot, 24, 'body-child-created-frame');
      if (
        result.steps[0].returnTarget !== 0x80c20b ||
        childSlot & 0x8000 ||
        childSlot === parentSlot ||
        a.readWord(0x800312 + childSlot, 24, 'body-child-parent-link') !== parentSlot ||
        a.readWord(0x800372 + parentSlot, 24, 'body-parent-child-link') !== childSlot ||
        a.readWord(0x800ba2 + parentSlot, 24, 'body-parent-child-wait') !== 65535 ||
        a.readWord(0x8002b2 + parentSlot, 24, 'body-parent-child-continuation') !== 0xf494
      )
        taskStop('task_script_body_child_owner_required');
      return {
        ...steps.at(-1),
        ...observations(),
        steps: Object.freeze(steps),
        bodyPCs: Object.freeze(bodyPCs),
        scriptId: spec.id,
        bodyComplete: false,
        scriptChildSuspended: true,
        nextPC: pc + instruction.length,
        frame,
        parentSlot,
        childSlot,
        childFrame,
        childId: spec.childId,
        handlersExecuted: steps.length,
        segmentHandlers: n + 1,
        fullTaskBinding: false,
        scope: 'manual-original-parent-through-actual-Script52-child-yield-not-complete',
      };
    }
    if (spec.localBody && instruction.opcode === 0x4c) {
      const r = result.steps[0],
        destination = renderAddress(bank * 65536 + r.destination),
        high = renderAddress((bank * 65536 + r.destination + 1) & 0xffffff);
      if (
        destination === null ||
        high === null ||
        destination < 0x7e0000 ||
        destination > 0x7fffff ||
        high < 0x7e0000 ||
        high > 0x7fffff ||
        r.freshPointer !== r.destination ||
        r.newPointer !== ((r.destination - 2) & 65535) ||
        r.targetWord !== instruction.operand
      )
        taskStop('task_script_body_local_owner_required', { bodyPC: pc });
      localReturns.push({
        callPC: pc,
        returnPC: pc + instruction.length,
        destination: r.destination,
        newPointer: r.newPointer,
      });
      localReturnEvents.push({
        kind: 'call',
        pc,
        ...localReturns.at(-1),
        freshPointer: r.freshPointer,
        target: r.targetWord,
      });
    }
    if (spec.localBody && instruction.opcode === 0x50) {
      const r = result.steps[0],
        top = localReturns.at(-1);
      if (
        !top ||
        r.originalPointer !== top.newPointer ||
        r.newPointer !== top.destination ||
        r.freshPointer !== top.destination ||
        r.returnWord !== top.returnPC
      )
        taskStop('task_script_body_local_return_required', { bodyPC: pc });
      localReturns.pop();
      localReturnEvents.push({
        kind: 'return',
        pc,
        ...top,
        originalPointer: r.originalPointer,
        freshPointer: r.freshPointer,
        returnWord: r.returnWord,
      });
    }
    if (native?.id === 0x9f) {
      if (n + 1 !== options.maxHandlers) taskStop('task_script_body_handler_count_required');
      const nextPC = pc + instruction.length;
      if (!spec.edges.some((e) => e.from === pc && e.to === nextPC))
        taskStop('task_script_body_edge_required');
      if (spec.localWaitBody) localReturnOwners(a, spec, frame, localReturns);
      return {
        ...steps.at(-1),
        ...observations(),
        ...localState(),
        steps: Object.freeze(steps),
        bodyPCs: Object.freeze(bodyPCs),
        scriptId: spec.id,
        bodyComplete: false,
        bodySuspended: true,
        nextPC,
        frame,
        waitSlot: a.ctx.x,
        handlersExecuted: steps.length,
        segmentHandlers: n + 1,
        fullTaskBinding: false,
        scope: 'manual-original-body-prefix-through-native9F-yield-not-complete',
      };
    }
    if (instruction.opcode === 0x56) {
      if (spec.localBody && localReturns.length) taskStop('task_script_body_local_return_required');
      if (n + 1 !== options.maxHandlers)
        taskStop('task_script_body_handler_count_required', { handlersExecuted: n + 1, bodyPCs });
      return {
        ...steps.at(-1),
        ...observations(),
        steps: Object.freeze(steps),
        bodyPCs: Object.freeze(bodyPCs),
        scriptId: spec.id,
        bodyComplete: true,
        handlersExecuted: steps.length,
        ...(continuation
          ? {
              segmentHandlers: n + 1,
              observedReadinessEntries: continuation.observedReadinessEntries,
            }
          : {}),
        ...localState(),
        fullTaskBinding: false,
        scope: 'manual-original-script-body-through-actual-END-return',
      };
    }
    if (result.frontier !== '80:F390') taskStop('task_script_body_frontier_required');
    const next = (a.ctx.y - 1) & 65535;
    if (
      !(spec.localBody && instruction.opcode === 0x50
        ? next === localReturnEvents.at(-1).returnPC
        : spec.localBody && instruction.opcode === 0x4c
          ? next === instruction.operand
          : spec.edges.some((e) => e.from === pc && e.to === next))
    )
      taskStop('task_script_body_edge_required', {
        scriptId: spec.id,
        bodyPC: pc,
        nextBodyPC: next,
      });
  }
  taskStop('task_script_body_handler_count_required', {
    handlersExecuted: steps.length,
    bodyPCs,
    nextBodyPC: (a.ctx.y - 1) & 65535,
  });
}
function remember(plan, options, parentWaitOwner = null) {
  if (plan.handled && plan.scriptChildSuspended)
    suspendedParents.set(
      plan,
      Object.freeze({
        data: options.data,
        scriptId: plan.scriptId,
        nextPC: plan.nextPC,
        frame: plan.frame,
        parentSlot: plan.parentSlot,
        childSlot: plan.childSlot,
        childFrame: plan.childFrame,
        childId: plan.childId,
        steps: plan.steps,
        bodyPCs: plan.bodyPCs,
        callerOuterS: options.context.s,
        callerReturnPointer: (options.context.s - 3) & 65535,
      }),
    );
  if (plan.handled && plan.bodySuspended)
    suspendedBodies.set(plan, {
      data: options.data,
      scriptId: plan.scriptId,
      nextPC: plan.nextPC,
      frame: plan.frame,
      waitSlot: plan.waitSlot,
      steps: plan.steps,
      bodyPCs: plan.bodyPCs,
      ...(plan.pendingLocalReturns
        ? {
            pendingLocalReturns: plan.pendingLocalReturns,
            localReturnEvents: plan.localReturnEvents,
          }
        : {}),
      observedReadinessEntries: plan.observedReadinessEntries ?? 0,
    });
  if (
    plan.handled &&
    plan.bodySuspended &&
    scriptBodySpecs.find((s) => s.id === plan.scriptId)?.parentWaitChild &&
    (plan.parentEntry || parentWaitOwner)
  ) {
    const freshYield = (plan.segmentHandlers ?? plan.handlersExecuted) > 0;
    parentWaitOwners.set(
      plan,
      freshYield
        ? Object.freeze({
            data: options.data,
            scriptId: plan.scriptId,
            frame: plan.frame,
            parentSlot: plan.waitSlot,
            callerEntryS: options.context.s,
            callerReturnPointer: (options.context.s - 3) & 65535,
            postrunReturned: false,
            waitMask:
              new Map(plan.byteWrites).get(0x7e0ba2 + plan.waitSlot) |
              (new Map(plan.byteWrites).get(0x7e0ba3 + plan.waitSlot) << 8),
          })
        : parentWaitOwner,
    );
  }
  return plan;
}
function bodyOptions(options, allocatedChild = false) {
  const childInvalid = allocatedChild ? validateTaskActionsOptions(options) : null;
  if (childInvalid) return { invalid: childInvalid, devices: null };
  const spec = scriptBodySpecs.find((s) => s.id === options?.scriptId);
  if (spec?.parentWaitChild)
    return { invalid: validateTaskActionsOptions(options), devices: parentWaitDevices };
  if (spec?.modalBody)
    return { invalid: validateTaskActionsOptions(options), devices: modalDevices };
  if (spec?.scriptChildBody)
    return {
      invalid: validateTaskActionsOptions(options),
      devices: spec.c8Observations ? fec1Registers : null,
    };
  if (spec?.selectionBody)
    return { invalid: validateTaskActionsOptions(options), devices: selectionDevices };
  if (spec?.native7CObservations)
    return { invalid: validateTaskActionsOptions(options), devices: hitObjectsInBlastDevices };
  if (spec?.audioObservations && spec?.random63Observations)
    return { invalid: validateTaskActionsOptions(options), devices: mixedDevices };
  if (spec?.nativeA3Observations)
    return { invalid: validateTaskActionsOptions(options), devices: taskActionsDevices };
  return spec?.native13Observations
    ? { invalid: validateTaskActionsOptions(options), devices: taskActionsDevices }
    : spec?.c8Observations
      ? { invalid: validateNoticeOptions(options), devices: fec1Registers }
      : spec?.audioObservations
        ? { invalid: validateTaskActionsOptions(options), devices: taskAudioDevices }
        : spec?.randomObservations
          ? { invalid: null, devices: taskRandomDevices }
          : { invalid: null, devices: null };
}
export const prepareTaskScriptBody = (options) => {
  const spec = scriptBodySpecs.find((s) => s.id === options?.scriptId);
  if (spec?.scriptChildBody && options.entry !== 0x80c1ca)
    return { handled: false, reason: 'task_script_body_child_entry_required' };
  const { invalid, devices } = bodyOptions(options);
  if (invalid) return invalid;
  if (spec?.scriptChildBody && options.entry === 0x80c1ca)
    return remember(
      prepareTaskPlan(
        options,
        [0x80c1ca],
        (a) => {
          if (
            ![1, 2].every((n) =>
              options.protectedStackBytes.includes(renderAddress((a.ctx.s + n) & 65535)),
            )
          )
            taskStop('task_outer_return_required');
          integrity(a, spec);
          const { view, inner, protectedBytes } = childReturnView(a),
            visit = runTaskVisit(view);
          if (
            visit.frontier !== '80:F390' ||
            !visit.interpreterEntryExecuted ||
            !inner.size ||
            a.ctx.y !== 1
          )
            taskStop('task_script_body_child_entry_required');
          return {
            ...runTaskScriptBody(view, {
              ...options,
              protectedStackBytes: protectedBytes(options.protectedStackBytes),
            }),
            parentEntry: visit,
          };
        },
        devices,
      ),
      options,
    );
  return remember(
    prepareTaskPlan(options, [0x80f390], (a) => runTaskScriptBody(a, options), devices),
    options,
  );
};

// A suspension is branded by the real original-body prefix and its successful
// owner commit. Future C1F9 context is an explicit caller observation. Fresh
// saved frame/PC/ID and original bytes are checked again; no timer/event is
// manufactured. Only actual new PEA bytes earn inner return ownership.
export function prepareTaskScriptBodyResume(options) {
  const { invalid, devices } = bodyOptions(options, childOwners.has(options?.continuation));
  if (invalid) return invalid;
  const prior = suspendedBodies.get(options?.continuation);
  if (
    !prior ||
    prior.data !== options.data ||
    prior.scriptId !== options.scriptId ||
    !isLatestCommittedTaskPlan(options.data, options.continuation)
  )
    return { handled: false, reason: 'task_script_body_continuation_required' };
  const childOwner = childOwners.get(options.continuation);
  const parentWaitOwner = parentWaitOwners.get(options.continuation);
  if (parentWaitOwner && !parentWaitOwner.postrunReturned)
    return { handled: false, reason: 'task_script_body_parent_postrun_required' };
  const plan = prepareTaskPlan(
    options,
    parentWaitOwner ? [0x80c1ca] : childOwner ? [0x80c1f9, 0x80c1ca] : [0x80c1f9],
    (a) => {
      if (!Number.isSafeInteger(options.maxHandlers) || options.maxHandlers < 1)
        taskStop('task_handler_budget_required');
      const wholeVisit = (childOwner || parentWaitOwner) && a.entry === 0x80c1ca;
      if (a.ctx.bank !== 0x80 || (!wholeVisit && a.ctx.x !== prior.waitSlot))
        taskStop('task_script_body_wait_owner_required');
      if (childOwner) {
        childParentSources(a, childOwner);
        if (wholeVisit && a.readWord(0x80024c, 24, 'body-child-visit-tail') !== prior.waitSlot)
          taskStop('task_script_body_child_owner_required');
      }
      if (parentWaitOwner) {
        parentWaitSources(a, parentWaitOwner, prior);
        if (
          a.ctx.s !== parentWaitOwner.callerEntryS ||
          a.readWord(0x80024c, 24, 'body-parent-wait-tail') !== prior.waitSlot
        )
          taskStop('task_script_body_parent_wait_owner_required');
      }
      const spec = scriptBodySpecs.find((s) => s.id === prior.scriptId);
      integrity(a, spec);
      if (spec.localWaitBody) localReturnOwners(a, spec, prior.frame, prior.pendingLocalReturns);
      if (
        (!wholeVisit && a.readWord(0x800250, 24, 'body-resume-current-slot') !== prior.waitSlot) ||
        a.readWord(0x800252 + prior.waitSlot, 24, 'body-resume-task-frame') !== prior.frame ||
        a.readWord((prior.frame + 3) & 65535, 16, 'body-resume-saved-PC') !== prior.nextPC ||
        a.readWord((prior.frame + 9) & 65535, 16, 'body-resume-saved-native-ID') !== 0x9f
      )
        taskStop('task_script_body_wait_owner_required');
      const native = scriptBodyNativeSources.find((s) => s.id === 0x9f);
      for (const anchor of native.anchors)
        for (let n = 0; n < 2; n++)
          if (a.read(anchor.address + n, 'body-resume-native-source') !== anchor.bytes[n])
            taskStop('task_script_body_bytes_required');
      let resumePhase = true;
      const inner = new Map(),
        adapted = {
          ...a,
          pushWord(value, label) {
            a.pushWord(value, label);
            if (label === 'visit-PEA-continuation-return') {
              if (value !== 0xc20a) taskStop('task_script_body_inner_return_required');
              inner.set(renderAddress((a.ctx.s + 1) & 65535), [
                renderAddress((a.ctx.s + 1) & 65535),
                renderAddress((a.ctx.s + 2) & 65535),
              ]);
            }
          },
          readWord(address, wrap = 24, label = 'WORD', outer = false) {
            const owned = outer && wrap === 16 ? inner.get(renderAddress(address)) : null;
            if (!owned)
              return resumePhase
                ? nativeWord(a, native, address, wrap, label, outer)
                : a.readWord(address, wrap, label, outer);
            const raw = a.readWord(address, wrap, label + '-body-inner');
            if (raw !== 0xc20a) taskStop('task_script_body_inner_return_required');
            // Native bridge needs this same owner later; the final consumption ends
            // this plan, so capabilities never escape as input to another plan.
            return raw;
          },
        };
      const ready = runTaskNativeWaitResume(adapted, options),
        observedReadinessEntries = prior.observedReadinessEntries + 1;
      resumePhase = false;
      if (ready.frontier !== '80:F390') {
        if (
          (childOwner ||
            spec.modalBody ||
            spec.selectionBody ||
            spec.native7CObservations ||
            spec.c8Observations ||
            spec.native13Observations ||
            spec.nativeA3Observations ||
            spec.audioObservations) &&
          (options.waitObservations?.length ?? 0)
        )
          taskStop('task_wait_observation_unused', { observationIndex: 0 });
        if (
          (childOwner ||
            spec.modalBody ||
            spec.selectionBody ||
            spec.native7CObservations ||
            spec.native13Observations ||
            spec.nativeA3Observations ||
            spec.audioObservations) &&
          (options.inputObservations?.length ?? 0)
        )
          taskStop('task_input_observation_unused', { observationIndex: 0 });
        return {
          ...ready,
          bodyComplete: false,
          bodySuspended: true,
          scriptId: prior.scriptId,
          nextPC: prior.nextPC,
          frame: prior.frame,
          waitSlot: prior.waitSlot,
          steps: prior.steps,
          bodyPCs: prior.bodyPCs,
          handlersExecuted: prior.steps.length,
          segmentHandlers: 0,
          observedReadinessEntries,
          ...(parentWaitOwner ? { parentReadiness: ready } : {}),
          ...(spec.localWaitBody
            ? {
                pendingLocalReturns: prior.pendingLocalReturns,
                localReturnEvents: prior.localReturnEvents,
              }
            : {}),
        };
      }
      if (ready.continuationTarget !== 0x80f509 || !inner.size)
        taskStop('task_script_body_inner_return_required');
      const resumed = runTaskScriptBody(
        adapted,
        {
          ...options,
          protectedStackBytes: [...options.protectedStackBytes, ...[...inner.values()].flat()],
        },
        { ...prior, observedReadinessEntries },
        !!childOwner,
      );
      return {
        ...resumed,
        observedReadinessEntries,
        ...(parentWaitOwner ? { parentReadiness: ready } : {}),
      };
    },
    devices,
  );
  if (plan.handled && childOwners.has(options.continuation))
    childOwners.set(plan, childOwners.get(options.continuation));
  return remember(plan, options, parentWaitOwner);
}

function parentWaitSources(a, owner, body) {
  const spec = scriptBodySpecs.find((s) => s.id === owner.scriptId);
  integrity(a, spec);
  const pointer = (spec.scriptEntry + 2) & 65535;
  if (
    !spec.parentWaitChild ||
    body.frame !== owner.frame ||
    body.waitSlot !== owner.parentSlot ||
    a.readWord(owner.frame, 16, 'body-parent-wait-stream') !== pointer ||
    a.readWord(owner.frame + 1, 16, 'body-parent-wait-bank') !==
      (((spec.scriptEntry >>> 16) << 8) | (pointer >>> 8)) ||
    a.readWord(0x800252 + owner.parentSlot, 24, 'body-parent-wait-task-frame') !== owner.frame ||
    a.readWord(owner.frame + 3, 16, 'body-parent-wait-saved-PC') !== body.nextPC ||
    a.readWord(owner.frame + 9, 16, 'body-parent-wait-saved-ID') !== 0x9f ||
    a.readWord(0x8002b2 + owner.parentSlot, 24, 'body-parent-wait-continuation') !== 0xf508 ||
    a.readWord(0x800ba2 + owner.parentSlot, 24, 'body-parent-wait-mask') !== owner.waitMask ||
    a.readWord(0x800250, 24, 'body-parent-wait-cursor') !== owner.parentSlot
  )
    taskStop('task_script_body_parent_wait_owner_required');
}
// Only a committed parent entered by actual wholeC1CA owns its earlier
// C1D8. The observed postrun consumes it and executes the actual epilogue;
// a later wholeC1CA remains a separate observed entry, never a shortcut.
export function prepareTaskScriptBodyParentPostrun(options) {
  const owner = parentWaitOwners.get(options?.continuation),
    body = suspendedBodies.get(options?.continuation);
  if (
    !owner ||
    !body ||
    owner.data !== options.data ||
    owner.scriptId !== options.scriptId ||
    owner.postrunReturned ||
    !isLatestCommittedTaskPlan(options.data, options.continuation)
  )
    return { handled: false, reason: 'task_script_body_parent_wait_continuation_required' };
  const { invalid, devices } = bodyOptions(options);
  if (invalid) return invalid;
  const plan = prepareTaskPlan(
    options,
    [0x80c20b],
    (a) => {
      if ((options.waitObservations?.length ?? 0) !== 0)
        taskStop('task_wait_observation_unused', { observationIndex: 0 });
      if ((options.inputObservations?.length ?? 0) !== 0)
        taskStop('task_input_observation_unused', { observationIndex: 0 });
      parentWaitSources(a, owner, body);
      if (
        a.ctx.d !== 0 ||
        a.ctx.bank !== 0x80 ||
        a.ctx.s !== ((owner.callerReturnPointer - 1) & 65535)
      )
        taskStop('task_script_body_parent_wait_owner_required');
      const view = {
        ...a,
        readWord(address, wrap = 24, label = 'WORD', outer = false) {
          if (!(
            outer &&
            wrap === 16 &&
            renderAddress(address) === renderAddress(owner.callerReturnPointer)
          ))
            return a.readWord(address, wrap, label, outer);
          const raw = a.readWord(address, wrap, label + '-parent-actual-C1CA-JSR-body');
          if (raw !== 0xc1d8) taskStop('task_script_body_parent_caller_return_required');
          return raw;
        },
      };
      const post = runTaskVisit(view);
      if (post.returnTarget !== 0x80c1d9)
        taskStop('task_script_body_parent_caller_return_required');
      const epilogue = runTaskVisitEpilogue(a);
      return {
        ...epilogue,
        bodyComplete: false,
        bodySuspended: true,
        scriptId: owner.scriptId,
        nextPC: body.nextPC,
        frame: body.frame,
        waitSlot: body.waitSlot,
        steps: body.steps,
        bodyPCs: body.bodyPCs,
        handlersExecuted: body.steps.length,
        segmentHandlers: 0,
        observedReadinessEntries: body.observedReadinessEntries,
        parentPostrunReturned: true,
        scope: 'manual-actual-parent-yield-C20B-C1D9-before-independent-whole-C1CA',
      };
    },
    devices,
  );
  return remember(plan, options, Object.freeze({ ...owner, postrunReturned: true }));
}

// A C20B transition is independently observed. Only the actual fresh JSR/PEA
// bytes produced on this overlay grant a temporary inner return capability.
function childReturnView(a) {
  const inner = new Map();
  const view = {
    ...a,
    pushWord(value, label) {
      a.pushWord(value, label);
      if (['visit-JSR-F378', 'visit-PEA-continuation-return'].includes(label)) {
        if (value !== 0xc20a) taskStop('task_script_body_inner_return_required');
        inner.set(renderAddress((a.ctx.s + 1) & 65535), [
          renderAddress((a.ctx.s + 1) & 65535),
          renderAddress((a.ctx.s + 2) & 65535),
        ]);
      }
    },
    readWord(address, wrap = 24, label = 'WORD', outer = false) {
      if (!(outer && wrap === 16 && inner.has(renderAddress(address))))
        return a.readWord(address, wrap, label, outer);
      const raw = a.readWord(address, wrap, label + '-body-inner');
      if (raw !== 0xc20a) taskStop('task_script_body_inner_return_required');
      return raw;
    },
  };
  return { view, inner, protectedBytes: (base) => [...base, ...[...inner.values()].flat()] };
}
export function prepareTaskScriptBodyChildPostrun(options) {
  const prior = childOwners.get(options?.continuation),
    body = suspendedBodies.get(options?.continuation);
  if (
    !prior ||
    !body ||
    prior.data !== options.data ||
    !options.continuation.childEntry ||
    !isLatestCommittedTaskPlan(options.data, options.continuation)
  )
    return { handled: false, reason: 'task_script_body_child_continuation_required' };
  const { invalid, devices } = bodyOptions({ ...options, scriptId: prior.childId });
  if (invalid) return invalid;
  const plan = prepareTaskPlan(
    options,
    [0x80c20b],
    (a) => {
      if ((options.waitObservations?.length ?? 0) !== 0)
        taskStop('task_wait_observation_unused', { observationIndex: 0 });
      if ((options.inputObservations?.length ?? 0) !== 0)
        taskStop('task_input_observation_unused', { observationIndex: 0 });
      childParentSources(a, prior);
      if (
        a.ctx.d !== 0 ||
        a.ctx.s !== ((prior.callerReturnPointer - 1) & 65535) ||
        a.readWord(0x800250, 24, 'body-child-postrun-cursor') !== prior.childSlot
      )
        taskStop('task_script_body_child_owner_required');
      const adapted = {
        ...a,
        readWord(address, wrap = 24, label = 'WORD', outer = false) {
          if (!(
            outer &&
            wrap === 16 &&
            renderAddress(address) === renderAddress(prior.callerReturnPointer)
          ))
            return a.readWord(address, wrap, label, outer);
          const raw = a.readWord(address, wrap, label + '-child-actual-C1CA-JSR-body');
          if (raw !== 0xc1d8) taskStop('task_script_body_child_caller_return_required');
          return raw;
        },
      };
      const post = runTaskVisit(adapted);
      if (post.returnTarget !== 0x80c1d9) taskStop('task_script_body_child_caller_return_required');
      const epilogue = runTaskVisitEpilogue(a);
      return {
        ...epilogue,
        bodyComplete: false,
        bodySuspended: true,
        scriptId: prior.childId,
        nextPC: body.nextPC,
        frame: body.frame,
        waitSlot: body.waitSlot,
        steps: body.steps,
        bodyPCs: body.bodyPCs,
        handlersExecuted: body.steps.length,
        segmentHandlers: 0,
        observedReadinessEntries: body.observedReadinessEntries,
        childPostrunReturned: true,
        scope: 'manual-actual-child-yield-C20B-C1D9-epilogue-return-before-independent-next-C1CA',
      };
    },
    devices,
  );
  if (plan.handled) childOwners.set(plan, prior);
  return remember(plan, { ...options, scriptId: prior.childId });
}
function childParentSources(a, p) {
  const spec = scriptBodySpecs.find((s) => s.id === p.scriptId);
  integrity(a, spec);
  const child = scriptBodySpecs.find((s) => s.id === p.childId);
  if (!child) taskStop('task_script_body_child_source_required');
  integrity(a, child);
  const parentPointer = (spec.scriptEntry + 2) & 65535,
    childPointer = (child.scriptEntry + 2) & 65535;
  if (
    a.readWord(p.frame, 16, 'body-child-parent-stream') !== parentPointer ||
    a.readWord(p.frame + 1, 16, 'body-child-parent-bank') !==
      (((spec.scriptEntry >>> 16) << 8) | (parentPointer >>> 8)) ||
    a.readWord(p.childFrame, 16, 'body-child-child-stream') !== childPointer ||
    a.readWord(p.childFrame + 1, 16, 'body-child-child-bank') !==
      (((child.scriptEntry >>> 16) << 8) | (childPointer >>> 8)) ||
    a.readWord(0x800252 + p.parentSlot, 24, 'body-child-current-parent-frame') !== p.frame ||
    a.readWord((p.frame + 3) & 65535, 16, 'body-child-parent-saved-PC') !== p.nextPC ||
    a.readWord((p.frame + 9) & 65535, 16, 'body-child-parent-saved-ID') !== p.childId ||
    a.readWord(0x8002b2 + p.parentSlot, 24, 'body-child-parent-saved-continuation') !== 0xf494 ||
    a.readWord(0x800ba2 + p.parentSlot, 24, 'body-child-current-parent-wait') !== 65535 ||
    a.readWord(0x800252 + p.childSlot, 24, 'body-child-current-child-frame') !== p.childFrame ||
    a.readWord(0x800312 + p.childSlot, 24, 'body-child-current-parent-link') !== p.parentSlot ||
    a.readWord(0x800372 + p.parentSlot, 24, 'body-child-current-child-link') !== p.childSlot
  )
    taskStop('task_script_body_child_owner_required');
  return { spec, child };
}
export function prepareTaskScriptBodyChildEnter(options) {
  const prior = suspendedParents.get(options?.continuation);
  if (
    !prior ||
    prior.data !== options.data ||
    prior.scriptId !== options.scriptId ||
    !isLatestCommittedTaskPlan(options.data, options.continuation)
  )
    return { handled: false, reason: 'task_script_body_child_continuation_required' };
  const childOptions = { ...options, scriptId: prior.childId },
    { invalid, devices } = bodyOptions(childOptions, true);
  if (invalid) return invalid;
  const plan = prepareTaskPlan(
    options,
    [0x80c20b],
    (a) => {
      const { child } = childParentSources(a, prior);
      if (
        a.ctx.bank !== 0x80 ||
        a.ctx.d !== 0 ||
        a.ctx.s !== ((prior.callerReturnPointer - 1) & 65535) ||
        a.readWord(0x800250, 24, 'body-child-entry-cursor') !== prior.parentSlot
      )
        taskStop('task_script_body_child_owner_required');
      const { view, inner, protectedBytes } = childReturnView(a),
        visit = runTaskVisit(view);
      if (
        visit.frontier !== '80:F390' ||
        !visit.interpreterEntryExecuted ||
        !inner.size ||
        a.ctx.d !== prior.childFrame ||
        a.ctx.y !== 1 ||
        a.readWord(0x800250, 24, 'body-child-entered-cursor') !== prior.childSlot
      )
        taskStop('task_script_body_child_owner_required');
      const body = runTaskScriptBody(
        view,
        { ...childOptions, protectedStackBytes: protectedBytes(options.protectedStackBytes) },
        null,
        true,
      );
      if (body.scriptId !== child.id || !(body.bodySuspended || body.bodyComplete))
        taskStop('task_script_body_child_source_required');
      return { ...body, childEntry: visit, parentScriptId: prior.scriptId, parentPC: prior.nextPC };
    },
    devices,
  );
  if (plan.handled) childOwners.set(plan, prior);
  return remember(plan, childOptions);
}
export function prepareTaskScriptBodyParentResume(options) {
  const prior = childOwners.get(options?.continuation);
  if (
    !prior ||
    prior.data !== options.data ||
    prior.scriptId !== options.scriptId ||
    !options.continuation.bodyComplete ||
    options.continuation.scriptId !== prior.childId ||
    !isLatestCommittedTaskPlan(options.data, options.continuation)
  )
    return { handled: false, reason: 'task_script_body_child_completion_required' };
  const { invalid, devices } = bodyOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80c20b],
    (a) => {
      childParentSources(a, prior);
      if (
        a.ctx.d !== 0 ||
        a.ctx.s !== options.continuation.outputContext.s ||
        a.ctx.bank !== options.continuation.outputContext.bank ||
        a.readWord(0x800250, 24, 'body-child-completed-cursor') !== prior.childSlot ||
        a.readWord(0x800ba2 + prior.childSlot, 24, 'body-child-completed-status') !== 0
      )
        taskStop('task_script_body_child_owner_required');
      const { view, inner, protectedBytes } = childReturnView(a),
        post = runTaskVisit(view);
      if (
        post.frontier !== '80:F390' ||
        post.continuationTarget !== 0x80f495 ||
        !post.continuationOccurrenceProven ||
        !inner.size ||
        a.ctx.d !== prior.frame ||
        a.ctx.y !== prior.nextPC + 1 ||
        a.readWord(0x800250, 24, 'body-parent-restored-cursor') !== prior.parentSlot ||
        a.readWord(0x800ba2 + prior.parentSlot, 24, 'body-parent-released-status') !== 0 ||
        a.readWord(0x80024e, 24, 'body-child-released-free-slot') !== prior.childSlot
      )
        taskStop('task_script_body_child_owner_required');
      const body = runTaskScriptBody(
        view,
        { ...options, protectedStackBytes: protectedBytes(options.protectedStackBytes) },
        prior,
      );
      return {
        ...body,
        childCompletion: options.continuation.resultWord,
        childPostrun: post,
        scope: 'manual-original-parent-through-actual-child-END-release-F495-parent-END',
      };
    },
    devices,
  );
}
