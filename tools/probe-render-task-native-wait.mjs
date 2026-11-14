import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskRomHash } from './task-partial-source.mjs';
import { proveNativeWaitSources } from './task-native-wait-source.mjs';
import { nativeWaitFixture } from './task-native-wait-fixtures.mjs';
import {
  prepareTaskNativeWait,
  prepareTaskNativeWaitOpcode,
  prepareTaskNativeWaitResume,
} from '../proof/task/native-wait.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong wait ROM');
const path = 'analysis/render-task-native-wait.json',
  source = JSON.parse(await readFile(path)),
  renewed = await proveNativeWaitSources(bytes);
if (JSON.stringify(source) !== JSON.stringify(renewed)) throw Error('Wait native source drift');
const definitions = [
  [0x80c401, prepareTaskNativeWait],
  [0x80f390, prepareTaskNativeWaitOpcode],
  [0x80c1f9, prepareTaskNativeWaitResume],
];
const bindings = definitions.map(([entry, prepare], n) => ({
    entry: source.proofs[n].entry,
    module: 'proof/task/native-wait.mjs',
    export: prepare.name,
    source_contract: path,
    source_proof_field: 'proofs',
    source_proof: source.proofs[n],
  })),
  probes = [];
for (const [entry, prepare] of definitions)
  for (const limits of [{}, { maxWork: 0 }, { maxOutputBytes: 0 }]) {
    const f = nativeWaitFixture(entry),
      before = JSON.stringify(f.data.snapshot()),
      p = prepare({ ...f, ...limits });
    if (JSON.stringify(f.data.snapshot()) !== before) throw Error('Wait prepare mutation');
    if (!Object.keys(limits).length && !p.handled)
      throw Error(`Wait probe failure ${entry.toString(16)} ${p.reason}`);
    if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Wait commit failure');
    probes.push({
      ...p,
      entry: bindings.find((b) => parseInt(b.entry.replace(':', ''), 16) === entry).entry,
      synthetic: true,
      limits,
    });
  }
await writeFile(
  'analysis/render-task-native-wait-native.json',
  JSON.stringify(
    {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      completed_script_bodies: 0,
      bindings: bindings.slice(0, 1),
      observed_compositions: bindings.slice(1),
      probes,
      scope:
        'Independent explicit synthetic observations for Native9F, actual Native58 yield and later C1F9 readiness. No automatic temporal join or completed body claim.',
    },
    null,
    2,
  ) + '\n',
);
console.log('Native9F: three native entries, nine synthetic probes; completed bodies0.');
