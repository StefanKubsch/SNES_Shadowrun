import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom } from './rom.mjs';
import { taskHash, taskRomHash } from './task-partial-source.mjs';
import { scriptBodySpecs, scriptBodyBatches } from '../proof/task/script-body-specs.mjs';
import {
  proveScriptBody,
  proveScriptBodyDependencies,
  proveScriptBodyFrontiers,
} from './task-script-body-source.mjs';
import { scriptBodyFixture, bodyCases, isWaitBody } from './task-script-body-fixtures.mjs';
import { waitBodyProbe } from './task-script-body-wait-fixtures.mjs';
import { prepareTaskScriptBody } from '../proof/task/script-bodies.mjs';
import { commitTaskPlan } from '../proof/task/plan.mjs';
import { proveScriptChildFlow } from './task-script-child-source.mjs';
import { childBodyProbe } from './task-script-body-child-fixtures.mjs';
import { propertyPairProbeDetails } from './task-script-body-property-pair-fixtures.mjs';
const put = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const readRom = async () => {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong body ROM');
  return bytes;
};
export async function emitScriptBodySources() {
  const bytes = await readRom(),
    dependencies = await proveScriptBodyDependencies(bytes),
    proofs = [];
  for (const s of scriptBodySpecs) proofs.push(await proveScriptBody(bytes, s));
  await put('analysis/render-task-script-body-dependencies.json', dependencies);
  await put('analysis/render-task-script-body-frontiers.json', proveScriptBodyFrontiers(bytes));
  await put('analysis/render-task-script-child-flow.json', await proveScriptChildFlow(bytes));
  for (const batch of scriptBodyBatches)
    await put(`analysis/render-task-${batch.stem}.json`, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      proofs: proofs.filter((p) => batch.ids.includes(p.script_id)),
      shared_dependencies_sha256: taskHash(Buffer.from(JSON.stringify(dependencies))),
      source_graph: {
        native_binding: false,
        local_source_complete: true,
        full_graph_closed: false,
      },
      scope:
        'Grouped original body contracts; shared handler/native dependencies renewed once. Actual caller/frame/initialization/scene/frames remain separate.',
    });
  console.log(
    `Original script bodies: ${proofs.length} separate bodies, ${dependencies.handlers.length} shared opcode and ${dependencies.natives.length} native dependencies.`,
  );
}
export function bodyProbe(spec, variant) {
  const f = scriptBodyFixture(spec, variant),
    before = JSON.stringify(f.data.snapshot()),
    p = prepareTaskScriptBody(f);
  if (JSON.stringify(f.data.snapshot()) !== before || !p.handled)
    throw Error(`Body ${spec.id}/${variant.name}: ${p.reason ?? 'prepare mutation'}`);
  if (!commitTaskPlan(f.data, p).handled) throw Error('Body commit failure');
  return {
    script_id: spec.id,
    case: variant.name,
    synthetic_context: true,
    original_body_bytes: true,
    body_complete: p.bodyComplete,
    body_pcs: p.bodyPCs,
    handlers: p.handlersExecuted,
    output_context: p.outputContext,
    work: p.work,
    output_bytes: p.outputBytes,
    byte_writes: p.byteWrites,
    result_word: p.resultWord,
    access_sha256: taskHash(Buffer.from(JSON.stringify(p.accesses))),
    ...(spec.propertyPairBody ? propertyPairProbeDetails(spec, variant, f, p) : {}),
    ...(spec.localBody ? { local_return_events: p.localReturnEvents } : {}),
    ...(spec.modalBody
      ? {
          modal_root_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              modal_root_calls: p.steps.filter((s) =>
                [0x80cd43, 0x80cd20, 0x80cbf7, 0x80935b, 0x80933a].includes(s.calleeEntry),
              ).length,
              io_records: f.ioObservations,
              io_requests: p.ioRequests,
              io_observations_used: p.observationsUsed,
              wait_records: p.waitEvents,
              wait_observations_used: p.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: p.inputObservationsUsed,
            },
          ],
        }
      : {}),
    ...(spec.selectionBody
      ? {
          selection_root_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              selection_root_calls: p.steps.filter((s) =>
                [0x80933a, 0x80bba0].includes(s.calleeEntry),
              ).length,
              io_records: f.ioObservations,
              io_requests: p.ioRequests,
              io_observations_used: p.observationsUsed,
              wait_records: p.waitEvents,
              wait_observations_used: p.waitObservationsUsed,
            },
          ],
        }
      : {}),
    ...(spec.nativeA3Observations
      ? {
          native_a3_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              native_a3_calls: p.steps.filter((s) => s.calleeEntry === 0x80f953).length,
              wait_records: p.waitEvents,
              wait_observations_used: p.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: p.inputObservationsUsed,
            },
          ],
        }
      : {}),
    ...(spec.randomObservations
      ? {
          native3e_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              native3e_calls: p.steps.filter((s) => s.calleeEntry === 0x80c51f).length,
              io_records: f.ioObservations,
              io_requests: p.ioRequests,
              io_observations_used: p.observationsUsed,
            },
          ],
        }
      : {}),
    ...(spec.audioObservations
      ? {
          native4c_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              native4c_calls: p.steps.filter((s) => s.calleeEntry === 0x80c46e).length,
              io_records: f.ioObservations,
              io_requests: p.ioRequests,
              io_observations_used: p.observationsUsed,
              wait_records: p.waitEvents,
              wait_observations_used: p.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: p.inputObservationsUsed,
            },
          ],
        }
      : {}),
    ...(spec.c8Observations
      ? {
          c8_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              c8_calls: p.steps.filter((s) => s.calleeEntry === 0x80fec1).length,
              io_records: f.ioObservations,
              io_requests: p.ioRequests,
              io_observations_used: p.observationsUsed,
              wait_records: p.waitEvents,
              wait_observations_used: p.waitObservationsUsed,
            },
          ],
        }
      : {}),
    ...(spec.native13Observations
      ? {
          native13_observation_segments: [
            {
              segment: 0,
              synthetic: true,
              native13_calls: p.steps.filter((s) => s.calleeEntry === 0x809ba0).length,
              c8_calls: p.steps.filter((s) => s.calleeEntry === 0x80fec1).length,
              io_records: f.ioObservations,
              io_requests: p.ioRequests,
              io_observations_used: p.observationsUsed,
              wait_records: p.waitEvents,
              wait_observations_used: p.waitObservationsUsed,
              input_records: f.inputObservations,
              input_observations_used: p.inputObservationsUsed,
            },
          ],
        }
      : {}),
  };
}
export async function emitScriptBodyNatives({ batchId = null } = {}) {
  const bytes = await readRom();
  if (batchId !== null && !scriptBodyBatches.some((b) => b.id === batchId))
    throw Error('Unknown body probe batch');
  for (const batch of scriptBodyBatches.filter((b) => batchId === null || b.id === batchId)) {
    const sourcePath = `analysis/render-task-${batch.stem}.json`,
      source = JSON.parse(await readFile(sourcePath)),
      proofs = [];
    const specs = scriptBodySpecs.filter((s) => batch.ids.includes(s.id));
    for (const s of specs) proofs.push(await proveScriptBody(bytes, s));
    if (JSON.stringify(source.proofs) !== JSON.stringify(proofs))
      throw Error('Body native source drift');
    await put(`analysis/render-task-${batch.stem}-native.json`, {
      rom_sha256: taskRomHash,
      progress_reference: 'docs/PORTIERUNGSSTAND.json',
      native_binding: true,
      manual_only: true,
      full_task_binding: false,
      global_stack_minimum: null,
      bindings: proofs.map((p) => ({
        entry: p.entry,
        script_id: p.script_id,
        module: 'proof/task/script-bodies.mjs',
        export: 'prepareTaskScriptBody',
        source_contract: sourcePath,
        source_proof: p,
      })),
      probes: specs.flatMap((s) =>
        bodyCases(s).map((v) =>
          s.scriptChildBody
            ? childBodyProbe(s, v)
            : isWaitBody(s)
              ? waitBodyProbe(s, v)
              : bodyProbe(s, v),
        ),
      ),
      scope:
        'Actual original body ROM bytes over independently synthetic observed contexts. Exact source-proved paths through existing native handlers and END; no inferred Script52/F378/scene/frame lifecycle.',
    });
    console.log(
      `Original script bodies: ${proofs.length} shared native bindings and compact path probes.`,
    );
  }
}
