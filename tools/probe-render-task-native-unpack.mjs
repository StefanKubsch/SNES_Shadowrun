import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { unpackWindows, proveTaskUnpack } from './task-native-unpack-source.mjs';
import { prepareTaskUnpack9F49 } from '../proof/task/native-unpack.mjs';
import { prepareTaskNativeA9B2 } from '../proof/task/native-a9b2.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { taskUnpackFixture, lengthBits } from './task-native-unpack-fixtures.mjs';
const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
if (metadata.rom_sha256 !== taskRomHash) throw Error('Unpack ROM drift');
for (const entry of [0x809f49, 0x81a9b2]) {
  const compose = entry === 0x81a9b2,
    proof = proveTaskUnpack(decodeTaskWindows(bytes, unpackWindows(entry)).map, entry);
  const sourcePath = `analysis/render-task-native-${compose ? 'a9b2' : 'unpack'}.json`,
    source = JSON.parse(await readFile(sourcePath));
  if (source.rom_sha256 !== taskRomHash) throw Error('Unpack source ROM drift');
  if (
    JSON.stringify(proof) !== JSON.stringify(source.proofs.find((p) => p.entry === cpuLabel(entry)))
  )
    throw Error('Unpack proof drift');
  const cases = compose
    ? [
        { original: 1 },
        {
          header: 1856,
          payload: Array(1856).fill(0),
          bits: lengthBits(1856),
          values: [2, 7, 5, 1, 3, 4],
        },
        { header: 1, payload: [0], bits: [1] },
        { original: 1, omit: 0x8db8d3 },
      ]
    : [
        { original: 0 },
        { original: 1 },
        { header: 5, payload: [0xa7], bits: [1, 0, ...lengthBits(3)] },
        { header: 0, payload: [0x81], bits: [1] },
        { header: 2, payload: [0x12, 0x34], bits: lengthBits(2), destination: 0xffff },
        { s: 0xed },
      ];
  const probes = cases.map((inputs) => {
    const f = taskUnpackFixture({ compose, ...inputs }),
      before = f.data.snapshot(),
      p = (compose ? prepareTaskNativeA9B2 : prepareTaskUnpack9F49)(f);
    if (JSON.stringify(before) !== JSON.stringify(f.data.snapshot()))
      throw Error('Unpack prepare mutation');
    if (p.handled && !commitTaskPlan(f.data, p).handled) throw Error('Unpack commit failed');
    const { accesses, byteWrites, readAddresses, ...result } = p;
    const { payload, bits, ...shown } = inputs;
    return {
      inputs: {
        ...shown,
        ...(payload ? { synthetic_payload_bytes: payload.length, synthetic_bits: bits } : {}),
      },
      result,
      planned_bytes: byteWrites?.length ?? 0,
      qualification:
        'Original compressed stream bytes where original is selected, otherwise explicit synthetic streams/fields/Task/stack and chronological AF1F device observations. No hardware/time/scene/frame execution or original body claim.',
    };
  });
  const module = compose ? 'proof/task/native-a9b2.mjs' : 'proof/task/native-unpack.mjs';
  await writeFile(
    `analysis/render-task-native-${compose ? 'a9b2' : 'unpack'}-native.json`,
    JSON.stringify(
      {
        rom_sha256: taskRomHash,
        progress_reference: 'docs/PORTIERUNGSSTAND.json',
        native_binding: true,
        manual_only: true,
        full_task_binding: false,
        global_stack_minimum: null,
        completed_script_bodies: 0,
        bindings: [
          {
            entry: cpuLabel(entry),
            module,
            export: compose ? 'prepareTaskNativeA9B2' : 'prepareTaskUnpack9F49',
            source_contract: sourcePath,
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
console.log(
  'Task unpack/A9B2: original streams, actual mixed stack/modes, conversion carry chain, observed AF1F and atomic commit.',
);
