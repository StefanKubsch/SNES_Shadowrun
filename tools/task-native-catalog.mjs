// Independently source-proved manual bindings. This catalog is tooling only;
// it never dispatches original Task opcodes or executes a ROM instruction.
import { taskLeafSpecs } from './task-native-leaf-specs.mjs';
const definitions = [
  ['native-clear-ff79', 'NativeClearFF79', 'proofs', 'prove', [0x80ff79]],
  ['native-actions', 'NativeActions', 'proofs', 'prove', [0x8099eb, 0x809ba0]],
  [
    'native-menu-compose',
    'NativeMenuCompose',
    'proofs',
    'prove',
    [0x80a6a5, 0x80a6ad, 0x80a6b8, 0x80a6c7],
  ],
  [
    'native-audio-compose',
    'NativeAudioCompose',
    'proofs',
    'prove',
    [0x80c46e, 0x81f130, 0x81f100, 0x81f122, 0x81f1e8],
  ],
  ['native-input-apu', 'NativeInputApu', 'proofs', 'prove', [0x809e1a, 0x81f007, 0x80c416]],
  ['native-counter-b0a1', 'NativeCounterB0A1', 'proofs', 'prove', [0x81b0a1]],
  [
    'native-list-prerequisites',
    'NativeListPrerequisites',
    'proofs',
    'prove',
    [0x80a617, 0x80a5db, 0x80a5f9, 0x80faac, 0x80fd80],
  ],
  [
    'sign-extension',
    'SignExtension',
    'sign_extensions',
    'proveSignExtensionToDispatch',
    [0x80f3f6, 0x80f408],
  ],
  ['state-reads', 'StateReads', 'state_reads', 'proveStateReadToDispatch', [0x80f8d4, 0x80f8e4]],
  [
    'state-writes',
    'StateWrites',
    'state_writes',
    'proveStateWriteToDispatch',
    [0x80f8f1, 0x80f902],
  ],
  ['state-sign-extension', 'StateSignExtension', 'proofs', 'proveStateSignToDispatch', [0x80f90f]],
  ['jump-zero', 'JumpZero', 'proofs', 'prove', [0x80f420]],
  ['jump-nonzero', 'JumpNonzero', 'proofs', 'prove', [0x80f42e]],
  ['jump', 'Jump', 'proofs', 'prove', [0x80f43c]],
  ['call-local', 'CallLocal', 'proofs', 'prove', [0x80f442]],
  ['return-local', 'ReturnLocal', 'proofs', 'prove', [0x80f454]],
  [
    'compare-gates',
    'CompareGates',
    'compare_gates',
    'proveCompareGatesToDispatch',
    [0x80f852, 0x80f86e, 0x80f88e, 0x80f8aa],
  ],
  [
    'carry-compare',
    'CarryCompare',
    'carry_compare',
    'proveCarryCompareToDispatch',
    [0x80f735, 0x80f77a, 0x80f7bc, 0x80f7fe],
  ],
  [
    'carry-sign-gates',
    'CarrySignGates',
    'carry_sign_gates',
    'proveCarrySignGatesToDispatch',
    [0x80f745, 0x80f762, 0x80f789, 0x80f7a5],
  ],
  [
    'complement-sign-gates',
    'ComplementSignGates',
    'complement_sign_gates',
    'proveComplementSignGatesToDispatch',
    [0x80f7cb, 0x80f7e7, 0x80f80e, 0x80f82b],
  ],
  ['multiply-unsigned', 'MultiplyUnsigned', 'proofs', 'prove', [0x80f581]],
  ['multiply-su', 'MultiplySU', 'proofs', 'prove', [0x80f546]],
  ['multiply-us', 'MultiplyUS', 'proofs', 'prove', [0x80f556]],
  ['multiply-ss', 'MultiplySS', 'proofs', 'prove', [0x80f566]],
  ['divide-unsigned', 'DivideUnsigned', 'proofs', 'prove', [0x80f609]],
  ['divide-su', 'DivideSU', 'proofs', 'prove', [0x80f5cc]],
  ['divide-us', 'DivideUS', 'proofs', 'prove', [0x80f5de]],
  ['divide-ss', 'DivideSS', 'proofs', 'prove', [0x80f5f0]],
  ['remainder-unsigned', 'RemainderUnsigned', 'proofs', 'prove', [0x80f6ae]],
  ['remainder-signed', 'RemainderSigned', 'proofs', 'prove', [0x80f67a, 0x80f689, 0x80f696]],
  ['script-arguments', 'ScriptArguments', 'proofs', 'prove', [0x80f460]],
  ['native-arguments', 'NativeArguments', 'proofs', 'prove', [0x80f4cb]],
  ['native-bridge', 'NativeBridge', 'proofs', 'prove', [0x80f4f6]],
  ['native-resume', 'NativeResume', 'proofs', 'prove', [0x80f509]],
  ['native-dispatch', 'NativeDispatch', 'proofs', 'prove', [0x80f52f]],
  ...taskLeafSpecs.map((s) => [
    s.name,
    'Native' + (s.entry & 65535).toString(16).toUpperCase(),
    'proofs',
    'prove',
    [s.entry],
  ]),
];
export const taskNativeNames = Object.freeze(definitions.map((d) => d[0]));
// Atomic plan bindings live in proof/task; their shared game routines stay in src/task.
export function taskModulePath(name) {
  return `proof/task/${name}.mjs`;
}
export async function loadTaskNativeBlock(name) {
  const definition = definitions.find((d) => d[0] === name);
  if (!definition) throw Error('Unknown manual native source binding');
  const [, suffix, proofField, proofExport, entries] = definition;
  const module = taskModulePath(name),
    exportName = `prepareTask${suffix}`;
  const native = await import(`../${module}`),
    proof = await import(`./render-task-${name}-source-proof.mjs`);
  const proveSource = (map, entry) => {
    const result = proof[proofExport](map, entry);
    return Array.isArray(result)
      ? result.find((p) => p.entry === `80:${(entry & 65535).toString(16).toUpperCase()}`)
      : result;
  };
  const fixtures = await import(
    name === 'native-clear-ff79'
      ? './task-native-clear-fixtures.mjs'
      : name === 'native-actions'
        ? './task-native-actions-fixtures.mjs'
        : name === 'native-menu-compose'
          ? './task-native-menu-fixtures.mjs'
          : name === 'native-audio-compose'
            ? './task-native-audio-fixtures.mjs'
            : name === 'native-input-apu'
              ? './task-native-input-apu-fixtures.mjs'
              : name === 'native-list-prerequisites'
                ? './task-native-list-fixtures.mjs'
                : name === 'native-counter-b0a1'
                  ? './task-native-counter-fixtures.mjs'
                  : name === 'native-dispatch'
                    ? './task-native-dispatch-fixtures.mjs'
                    : ['native-bridge', 'native-resume'].includes(name)
                      ? './task-native-continuation-fixtures.mjs'
                      : name.startsWith('multiply-') || name.startsWith('divide-')
                        ? './task-arithmetic-native-fixtures.mjs'
                        : name.startsWith('native-') && name !== 'native-arguments'
                          ? './task-native-leaf-fixtures.mjs'
                          : name.startsWith('remainder-') ||
                              name === 'script-arguments' ||
                              name === 'native-arguments'
                            ? './task-prefix-native-fixtures.mjs'
                            : './task-control-native-fixtures.mjs'
  );
  return {
    name,
    module,
    exportName,
    sourceName: name,
    proofField,
    entries,
    prepare: native[exportName],
    proveSource,
    decodeModes: proof.decodeModes ?? [],
    decodeSource: proof.decodeSource,
    fixture:
      fixtures.taskClearFixture ??
      fixtures.taskActionsFixture ??
      fixtures.taskMenuFixture ??
      fixtures.taskAudioFixture ??
      fixtures.taskInputApuFixture ??
      fixtures.taskListFixture ??
      fixtures.taskCounterFixture ??
      fixtures.taskDispatchFixture ??
      fixtures.taskContinuationFixture ??
      fixtures.taskArithmeticFixture ??
      fixtures.taskLeafFixture ??
      fixtures.taskPrefixFixture ??
      fixtures.taskControlFixture,
  };
}
