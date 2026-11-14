import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { formatBlock } from './disassemble.mjs';
import { taskNativeRenderSpec as spec } from './task-native-render-spec.mjs';

export function proveTaskNativeRender(map) {
  assertPinnedTaskSource(map, spec.windows);
  const proof = proveWordStack(map, spec.entry, 'RTS', { measureStack: true });
  if (
    proof.external_return_assumptions ||
    proof.reachable_instructions !== map.size ||
    proof.maximum_local_stack_bytes !== 6 ||
    proof.minimum_protected_stack_bytes !== 8 ||
    proof.returns.some((r) => r.m !== 0 || r.x !== 0 || r.dbr !== 'entry')
  )
    throw Error('F963 graph/stack/mode drift');
  return {
    ...proof,
    native_binding: false,
    local_source_complete: true,
    full_graph_closed: true,
    full_task_binding: false,
    global_stack_minimum: null,
    return_target_executed: false,
    inner_calls: [...map.values()]
      .filter((i) => ['JSR', 'JSL'].includes(i.mnemonic))
      .map((i) => ({
        at: cpuLabel(i.cpu),
        target: cpuLabel(i.target),
        continuation: cpuLabel(i.next),
        return_word: (i.next - 1) & 65535,
        return_bytes: i.mnemonic === 'JSL' ? 3 : 2,
        ...(i.mnemonic === 'JSL' ? { return_bank: i.cpu >>> 16 } : {}),
        ownership:
          'Actual bank00 current-S bank/high/low push; fresh low/high/bank return checked before fixed continuation.',
      })),
    device_events: [0x80f9ec, 0x80f9ef, 0x80f9f6, 0x80fa01, 0x80fa19].map((pc) => {
      const i = map.get(pc);
      return { at: cpuLabel(pc), operation: i.mnemonic, offset: i.value, width: i.state.m ? 1 : 2 };
    }),
    waits: [
      { at: '81:ACBD', offset: 0x1f6 },
      { at: '81:ACAF', offset: 0x1f8 },
    ],
    qualification:
      'Whole individually pinned F963/FA67/ACBD/ACCF/ACB5/ACAF graph; root RTS and real mixed inner calls, PHB/PEA/PLB/PHX/PLX. Six local plus two outer bytes under intact stack/code. Fresh actualDBR and DP0 bytes/full wrapping WORD indices. Explicit chronological hardware products and external wait observations; binary arithmetic, bounded work/output, one private plan/commit. No NativeC8/FEC1, Native58, actual original caller/initialization, device/time/interrupt execution, wholeTask/scene/frame binding or complete scriptbody claim.',
  };
}
export async function emitTaskNativeRender() {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong European ROM');
  const { map, blocks, windows } = decodeTaskWindows(bytes, spec.windows),
    proof = proveTaskNativeRender(map);
  const report = {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    windows,
    proofs: [proof],
    source_graph: {
      local_source_complete: true,
      full_graph_closed: true,
      native_binding: false,
      full_task_binding: false,
      code_bytes: windows.reduce((n, w) => n + w.covered_bytes, 0),
      instructions: map.size,
    },
    native_module: 'proof/task/native-f963.mjs',
    completed_script_bodies: 0,
  };
  await writeFile('analysis/render-task-native-f963.json', JSON.stringify(report, null, 2) + '\n');
  await writeFile('analysis/render-task-native-f963.asm.txt', blocks.map(formatBlock).join('\n'));
  console.log(
    `Task F963: ${report.source_graph.code_bytes}/${map.size}, six local + two outer stackbytes; FEC1 OPEN.`,
  );
  return report;
}
