import { readFile, writeFile } from 'node:fs/promises';
import { inspectRom, cpuLabel } from './rom.mjs';
import { decodeTaskWindows, taskRomHash } from './task-partial-source.mjs';
import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { proveWordStack } from './static-word-stack-proof.mjs';
import { formatBlock } from './disassemble.mjs';
import {
  DIALOG_WINDOWS,
  SPRITE_COMPARE_TARGETS,
  SPRITE_ORDER_TARGETS,
} from './task-native-936c-windows.mjs';

// Native95/936C (dialog, proof/replay/native-dialog.mjs) and its ported callees:
// each group pins original bytes and proves stack/mode with real frames and
// external returns into separately proved routines. tools/task-native-dialog.test.mjs
// compares the equations with original instructions; Mesen checks the full dialog
// (docs/MESEN-ORACLE.md).
const RTS = 'RTS',
  RTL = 'RTL';
const ext = {
  FF79: [
    0x80ff79,
    RTS,
    'clear windows, releaseNoticeWindows (proof/replay/native-slot-release.mjs)',
  ],
  EF47: [0x81ef47, RTL, 'music mode, setMusicMode (proof/replay/native-audio-compose.mjs)'],
  F963: [0x80f963, RTS, 'window allocation, openWindow (proof/replay/native-window-open.mjs)'],
  FA3E: [0x80fa3e, RTS, 'window release, releaseWindow (proof/system/native-render-compose.mjs)'],
  B0A1: [
    0x81b0a1,
    RTL,
    'frame counter wait, waitForRandomStateChange (proof/system/native-frame-wait.mjs)',
  ],
  '9E1A': [0x809e1a, RTS, 'joypad, readInput (src/system/native-input-apu.mjs)'],
  FA67: [
    0x80fa67,
    RTS,
    'window request, requestWindowUpload (proof/replay/native-menu-compose.mjs)',
  ],
  FAAC: [0x80faac, RTS, 'cursor, setTextCursor (proof/replay/native-list-prerequisites.mjs)'],
  FE69: [0x80fe69, RTS, 'text, printText (proof/replay/native-text-compose.mjs)'],
  A6C7: [0x80a6c7, RTS, 'menu, runTaskMenuCompose (proof/replay/native-menu-compose.mjs)'],
  C34A: [0x80c34a, RTS, 'append task, appendScriptTask (proof/system/task-append.mjs; topic path)'],
  C1CA: [
    0x80c1ca,
    RTS,
    'visit, nested scheduler round NativeCalls.round (proof/vm/native-call.mjs; topic path)',
  ],
};
const own = (target, op, name) => [target, op, `own proof ${name} in this file`];
export const native936CSpecs = [
  {
    name: '936c',
    entry: 0x80936c,
    root: RTS,
    externalReturns: [
      own(0x81886a, RTL, '886a'),
      own(0x80bcb2, RTS, 'bcb2'),
      ext.FF79,
      ext.EF47,
      ext.F963,
      own(0x80fa92, RTS, 'fa92'),
      own(0x809f6d, RTS, '9f6d'),
      own(0x808f20, RTS, '8f20'),
      own(0x809022, RTS, '9022'),
      own(0x80905e, RTS, '905e'),
      own(0x808f3a, RTS, '8f3a'),
      own(0x809178, RTS, '9178'),
      ext.B0A1,
      own(0x8091e2, RTS, '91e2'),
      own(0x809215, RTS, '9215'),
      ext.FA3E,
      own(0x808f97, RTS, '8f97'),
      own(0x80adf4, RTS, 'adf4'),
      ext['9E1A'],
      own(0x80b8de, RTS, 'b8de'),
    ],
    // $94E2 PLA takes the old music: PHY on a music change ($93BB) or PEA FFFF ($93C2).
    lemmas: { pullKinds: new Map([[0x8094e2, ['index', 'byte']]]) },
  },
  { name: '886a', entry: 0x81886a, root: RTL, externalReturns: [] },
  { name: 'fa92', entry: 0x80fa92, root: RTS, externalReturns: [] },
  { name: '9f6d', entry: 0x809f6d, root: RTS, externalReturns: [] },
  { name: '8f20', entry: 0x808f20, root: RTS, externalReturns: [] },
  { name: '9022', entry: 0x809022, root: RTS, externalReturns: [] },
  { name: '905e', entry: 0x80905e, root: RTS, externalReturns: [] },
  { name: '8f3a', entry: 0x808f3a, root: RTS, externalReturns: [ext.B0A1] },
  { name: '8f97', entry: 0x808f97, root: RTS, externalReturns: [ext.B0A1] },
  { name: 'bcb2', entry: 0x80bcb2, root: RTS, externalReturns: [ext.FA3E] },
  // $91D8 REP #$20 is reached from the BYTE section ($9191).
  {
    name: '9178',
    entry: 0x809178,
    root: RTS,
    externalReturns: [ext.FA67, ext.FAAC, ext.FE69, ext.C34A, ext.C1CA],
    lemmas: { widthJoins: new Set([0x8091d8]) },
  },
  { name: '91e2', entry: 0x8091e2, root: RTS, externalReturns: [ext.A6C7] },
  // PEI ($00) saves the menu choice; PLY restores it.
  {
    name: '9215',
    entry: 0x809215,
    root: RTS,
    externalReturns: [ext.F963, ext.A6C7, ext.FA3E],
    lemmas: { peiWordPushes: new Map([[0x80929b, 0]]), dataPulls: new Set([0x8092a4]) },
  },
  { name: 'adf4', entry: 0x80adf4, root: RTS, externalReturns: [ext.B0A1] },
  // Branch targets from ROM tables 80:B0E3/B126 (entries 1..4) and the unrolled sequence at 80:B936.
  {
    name: 'b8de',
    entry: 0x80b8de,
    root: RTS,
    externalReturns: [],
    lemmas: {
      indirectTargets: new Map([
        [0x80b0ac, SPRITE_COMPARE_TARGETS],
        [0x80b0ef, SPRITE_ORDER_TARGETS],
        // DP84 starts at 4 and only grows: k = DP84/4 from 1 to 128 (STA $3D09 for sprite 0 stays unreachable).
        [0x80b930, Array.from({ length: 128 }, (_, k) => 0x80b936 + 3 * k)],
      ]),
      // $B7EB REP #$20 joins BYTE/WORD OAM paths; $B7DC SEP #$20 follows BYTE code linearly.
      widthJoins: new Set([0x80b7eb, 0x80b7dc]),
    },
  },
].map((s) => ({ ...s, windows: DIALOG_WINDOWS[s.name] }));
// Pinned proof values per group: instructions, local stack bytes and return sites.
export const native936CExpected = {
  9022: { instructions: 43, stack: 2, returns: ['80:905D'] },
  9178: { instructions: 99, stack: 3, returns: ['80:91D7', '80:91E1'] },
  9215: { instructions: 76, stack: 2, returns: ['80:9253', '80:92AF', '80:92C4'] },
  '936c': { instructions: 201, stack: 8, returns: ['80:94E9'] },
  '886a': { instructions: 6, stack: 0, returns: ['81:8876'] },
  fa92: { instructions: 12, stack: 0, returns: ['80:FAAB'] },
  '9f6d': { instructions: 120, stack: 8, returns: ['80:A032'] },
  '8f20': { instructions: 13, stack: 1, returns: ['80:8F39'] },
  '905e': { instructions: 36, stack: 3, returns: ['80:908B'] },
  '8f3a': { instructions: 51, stack: 4, returns: ['80:8F86'] },
  '8f97': { instructions: 33, stack: 4, returns: ['80:8FB2'] },
  bcb2: { instructions: 12, stack: 2, returns: ['80:BCBD'] },
  '91e2': { instructions: 18, stack: 0, returns: ['80:920C'] },
  adf4: { instructions: 285, stack: 10, returns: ['80:AE11'] },
  b8de: { instructions: 1206, stack: 10, returns: ['80:BABA'] },
};
export function prove936CSource(map, spec) {
  assertPinnedTaskSource(map, spec.windows);
  const proof = proveWordStack(map, spec.entry, spec.root, {
    measureStack: true,
    externalReturns: new Map(spec.externalReturns.map(([t, op]) => [t, op])),
    ...spec.lemmas,
  });
  if (
    proof.reachable_instructions !== map.size ||
    proof.external_return_assumptions !== spec.externalReturns.length ||
    proof.returns.some((r) => r.m !== 0 || r.x !== 0 || r.dbr !== 'entry')
  )
    throw Error(spec.name + ' stack/mode drift');
  const expected = native936CExpected[spec.name];
  if (
    map.size !== expected.instructions ||
    proof.maximum_local_stack_bytes !== expected.stack ||
    proof.returns
      .map((r) => r.at)
      .sort()
      .join() !== expected.returns.join()
  )
    throw Error(spec.name + ' pinned proof drift');
  return {
    ...proof,
    root_return: spec.root,
    external_return_contracts: spec.externalReturns.map(([t, op, source]) => ({
      target: cpuLabel(t),
      return: op,
      source,
    })),
  };
}
export async function emit936CSource() {
  const { bytes, metadata } = inspectRom(await readFile('Shadowrun (E).smc'));
  if (metadata.rom_sha256 !== taskRomHash) throw Error('Wrong European ROM');
  const groups = [],
    listing = [];
  for (const spec of native936CSpecs) {
    const { map, blocks, windows } = decodeTaskWindows(bytes, spec.windows);
    for (const w of windows) {
      const literal = spec.windows.find((s) => cpuLabel(s.start) === w.entry);
      if (w.machine_bytes !== literal.hex) throw Error(spec.name + ' source literal drift');
    }
    const proof = prove936CSource(map, spec);
    groups.push({ name: spec.name, windows, proof });
    listing.push(...blocks.map(formatBlock));
  }
  const report = {
    rom_sha256: taskRomHash,
    progress_reference: 'docs/PORTIERUNGSSTAND.json',
    scope:
      'Native95/936C dialog with its newly composed subroutines; pinned windows, static stack/mode proof per group with external returns into separately proved routines. Equations in proof/replay/native-dialog.mjs, native-dialog-*.mjs, native-scene-*.mjs; comparison with the original instructions in tools/task-native-dialog.test.mjs.',
    groups,
    source_graph: {
      classification: 'native58-dialog-with-external-returns',
      code_bytes: groups.reduce(
        (n, g) => n + g.windows.reduce((m, w) => m + w.covered_bytes, 0),
        0,
      ),
      instructions: groups.reduce((n, g) => n + g.proof.reachable_instructions, 0),
    },
  };
  await writeFile('analysis/render-task-native-936c.json', JSON.stringify(report, null, 2) + '\n');
  await writeFile('analysis/render-task-native-936c.asm.txt', listing.join('\n'));
  console.log(
    `native-936c: ${groups.length} groups, ${report.source_graph.code_bytes} bytes/${report.source_graph.instructions} instructions, RTS/RTL proofs.`,
  );
}
