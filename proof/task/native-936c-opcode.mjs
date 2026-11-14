import { taskStop } from '../../src/task/plan.mjs';
import { prepareTaskPlan } from './plan.mjs';
import { runTaskOpcodeTarget } from './opcode-target.mjs';
import { runTaskNativeArguments } from './native-arguments.mjs';
import { runTaskNativeBridge } from './native-bridge.mjs';
import { runTaskNativeResume } from './native-resume.mjs';
import {
  talkWithObjectObserved,
  validateDialogTaskOptions,
} from '../../src/task/native-dialog.mjs';
import { fec1Registers } from '../../src/task/native-notice.mjs';
import { taskListDevices } from '../../src/task/native-list-prerequisites.mjs';
import { taskAudioDevices } from '../../src/task/native-audio-compose.mjs';
import { taskMenuDevices } from '../../src/task/native-menu-compose.mjs';
// Devices of 936C: windows and menus (FEC1/F963 family, A6C7), APU ports of EF47/C46E, and its own PPU/DMA writes
// (CGWSEL/CGADSUB, window, brightness via 2101, VRAM DMA channel 0, HDMA tables).
const own = Object.freeze({
  writes: [
    0x2101, 0x2102, 0x2115, 0x2116, 0x2117, 0x2123, 0x2124, 0x212a, 0x212b, 0x2131, 0x2132, 0x4300,
    0x4301, 0x4302, 0x4303, 0x4304, 0x4305, 0x4306, 0x420b,
  ],
  reads: [],
  observationPcs: [],
});
export const native936CDevices = Object.freeze(
  Object.fromEntries(
    ['writes', 'reads', 'observationPcs'].map((key) => [
      key,
      Object.freeze([
        ...new Set([
          ...own[key],
          ...fec1Registers[key],
          ...taskListDevices[key],
          ...taskAudioDevices[key],
          ...taskMenuDevices[key],
        ]),
      ]),
    ]),
  ),
);
// One individually proved Native58/95 call through 936C (two argument words, no result).
export function runTaskNative936COpcode(a, options) {
  if (a.ctx.x !== 0x58) taskStop('task_native_95_opcode_required');
  const slot = runTaskOpcodeTarget(a);
  if (slot.target !== 0x80f4cb) taskStop('task_opcode_target_required', { target: slot.target });
  const argumentsResult = runTaskNativeArguments(a);
  if (
    argumentsResult.id !== 0x95 ||
    argumentsResult.freshId !== 0x95 ||
    argumentsResult.metadataWord !== 0x0202 ||
    argumentsResult.wordPops !== 2
  )
    taskStop('task_native_95_argument_source_required', {
      id: argumentsResult.id,
      freshId: argumentsResult.freshId,
      metadataWord: argumentsResult.metadataWord,
    });
  const bridge = runTaskNativeBridge(a, options.protectedStackBytes),
    pointerWord = a.readWord(0xa2, 16, 'native-95-fresh-A2');
  if (bridge.pointerWord !== 0x936c || pointerWord !== 0x936c)
    taskStop('task_native_95_target_required', {
      tablePointerWord: bridge.pointerWord,
      pointerWord,
    });
  a.ctx.pc = pointerWord;
  const callee = talkWithObjectObserved(a, options, false);
  if (callee.returnTarget !== 0x80f509)
    taskStop('task_native_resume_target_required', { returnTarget: callee.returnTarget });
  if (a.ctx.d !== 0 || a.ctx.bank !== 0x80 || a.ctx.status & 0x30)
    taskStop('task_native_resume_context_required');
  const resume = runTaskNativeResume(a, options.protectedStackBytes, 0x82d970, true, 0x95);
  if (resume.resultPushed)
    taskStop('task_native_95_return_source_required', { metadataWord: resume.metadataWord });
  return {
    ...resume,
    scope: 'manual-original-native58-95-through-936c-actual-f508-and-f509-before-F390',
    argumentPrefixExecuted: true,
    stackMigrationExecuted: true,
    boundedNativeDispatchExecuted: true,
    dynamicDispatchExecuted: false,
    calleeEntry: 0x80936c,
    tablePointerWord: bridge.pointerWord,
    dispatchPointerWord: pointerWord,
    calleeReturnWord: callee.rawReturnWord,
    calleeReturnTarget: callee.returnTarget,
    calleeReturnTargetExecuted: true,
    arguments: argumentsResult,
    callee,
    waitObservationsUsed: callee.waitObservationsUsed,
    fullTaskBinding: false,
  };
}
export function prepareTaskNativeOpcode936C(options) {
  const invalid = validateDialogTaskOptions(options);
  if (invalid) return invalid;
  return prepareTaskPlan(
    options,
    [0x80f390],
    (a) => runTaskNative936COpcode(a, options),
    native936CDevices,
  );
}
