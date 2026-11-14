import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash, decodeTaskWindows } from './task-partial-source.mjs';
import { selectionRoots } from './task-native-933a-bba0-specs.mjs';
import { proveSelectionRoot } from './task-native-selection-roots-source.mjs';
import { proveSelectionOpcode } from './task-native-selection-roots-opcode-source.mjs';
import { emitTaskNativeProbe } from './task-native-probe.mjs';
import {
  taskSelectionFixture,
  selectionOpcodeFixture,
} from './task-native-selection-roots-fixtures.mjs';
import { prepareTaskSelectionRoot } from '../proof/task/native-933a-bba0.mjs';
import { prepareTaskSelectionOpcode } from '../proof/task/native-selection-root-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
for (const s of selectionRoots) {
  await emitTaskNativeProbe({
    name: s.name,
    sourceName: s.name,
    module: 'proof/task/native-933a-bba0.mjs',
    exportName: 'prepareTaskSelectionRoot',
    entries: [s.entry],
    proofField: 'proofs',
    proveSource: (map) => proveSelectionRoot(map, s),
    decodeSource: (bytes) => decodeTaskWindows(bytes, s.windows),
    prepare: prepareTaskSelectionRoot,
    fixture: () => taskSelectionFixture(s.id),
  });
  const proof = await proveSelectionOpcode(bytes, s.id),
    probes = [];
  for (const limits of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = selectionOpcodeFixture(s.id),
      before = JSON.stringify(f.data.snapshot()),
      p = prepareTaskSelectionOpcode({ ...f, nativeId: s.id, ...limits });
    if (JSON.stringify(f.data.snapshot()) !== before)
      throw Error('Selection prepare mutated owner');
    if (!Object.keys(limits).length && !p.handled) throw Error('Selection fixture ' + p.reason);
    if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Selection commit failed');
    probes.push({ ...p, entry: '80:F390', synthetic: true, limits });
  }
  const stem = `native-opcode-${s.name.slice(7)}`;
  await writeFile(
    `analysis/render-task-${stem}-native.json`,
    JSON.stringify(
      {
        rom_sha256: taskRomHash,
        progress_reference: 'docs/PORTIERUNGSSTAND.json',
        native_binding: true,
        manual_only: true,
        full_task_binding: false,
        global_stack_minimum: null,
        bindings: [
          {
            entry: '80:F390',
            module: 'proof/task/native-selection-root-opcode.mjs',
            export: 'prepareTaskSelectionOpcode',
            source_contract: `analysis/render-task-${stem}.json`,
            source_proof_field: 'proofs',
            source_proof: proof,
          },
        ],
        probes,
      },
      null,
      2,
    ) + '\n',
  );
}
