import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash, decodeTaskWindows } from './task-partial-source.mjs';
import { modalSpecs } from './task-native-modal-specs.mjs';
import { proveModalRoot } from './task-native-modal-source.mjs';
import { proveModalOpcode } from './task-native-modal-opcode-source.mjs';
import { emitTaskNativeProbe } from './task-native-probe.mjs';
import { taskModalFixture, modalOpcodeFixture } from './task-native-modal-fixtures.mjs';
import { prepareTaskModalRoot as root } from '../proof/task/native-modal.mjs';
import { prepareTaskModalOpcode as opcode } from '../proof/task/native-modal-opcode.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes } = inspectRom(await readFile('Shadowrun (E).smc'));
for (const s of modalSpecs) {
  await emitTaskNativeProbe({
    name: s.name,
    sourceName: s.name,
    module: 'proof/task/native-modal.mjs',
    exportName: 'prepareTaskModalRoot',
    entries: [s.entry],
    proofField: 'proofs',
    proveSource: (map) => proveModalRoot(map, s),
    decodeSource: (bytes) => decodeTaskWindows(bytes, s.windows),
    prepare: root,
    fixture: () => taskModalFixture(s.id),
  });
  const proof = await proveModalOpcode(bytes, s.id),
    probes = [];
  for (const limits of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = modalOpcodeFixture(s.id),
      before = JSON.stringify(f.data.snapshot()),
      p = opcode({ ...f, nativeId: s.id, ...limits });
    if (JSON.stringify(f.data.snapshot()) !== before) throw Error('Modal prepare mutated owner');
    if (!Object.keys(limits).length && !p.handled) throw Error('Modal fixture ' + p.reason);
    if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Modal commit failed');
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
            module: 'proof/task/native-modal-opcode.mjs',
            export: 'prepareTaskModalOpcode',
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
