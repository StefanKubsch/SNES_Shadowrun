import { assertPinnedTaskSource } from './pinned-task-source.mjs';
import { decodeTaskWindows } from './task-partial-source.mjs';
import { proveAudioStack } from './render-audio-stack-proof.mjs';
export const randomWindows = [
  { start: 0x80c51f, hex: 'A500F01C8502A2FEFFE8E80A90FBBD40C585042060C5A5002504C502B0F5850060' },
  {
    start: 0x80c560,
    hex: '08E230ACE81CAD3721B98DC54F761C7E85004D3C21A8B98DC54F771C7E85014D3D21CDE81CD0011A8DE81C28',
    finalM: 1,
    finalX: 1,
  },
  { start: 0x80c58c, hex: '60' },
];
// Individually checked original ROM data, never an executable ROM stream.
// The random routine tables (80:C540 masks, 80:C58D permutation) as the ROM holds them.
export const randomTables = Object.freeze([
  Object.freeze({
    start: 0x80c540,
    hex: 'FFFFFF7FFF3FFF1FFF0FFF07FF03FF01FF007F003F001F000F00070003000100',
  }),
  Object.freeze({
    start: 0x80c58d,
    hex: '1A8F462608A1E7FC21B566A35A89F040CD25F4F34FBC33D2E51D3D48F53F5B996577A2523CCF0F34EFE8BED802B8738ADBC087FE71F77F63B1EC141F2D72B46FD3037680D6D5C86DB0BAA72C04D00E969FC4CA6B2EFB5444C547A8EA3EF851F1E100EEF6A983570B7079BF677C81EB6974DA5D824CAA688410B3110C1B3B556E917D2445FA9B399359C9ED5F0D5EB2CB8D4A5886136C12CC94DEB60AFFC7DD5643AC85383122ABB7D4FD619237097B6A1850C1203032B94295BB3A19D12FA67EC24D9C9A7A90F9DF8C5C2A23E378059862ADE6C601A4A0A54197E48EAFE9CE2BD79E061C17E28B4975BD9D2807D9F229DC151EE027604E16364BAE35C3538864',
  }),
]);
export const randomAnchors = [
  { kind: 'pointer', start: 0x82d834, hex: '1FC5' },
  { kind: 'argument-metadata', start: 0x82da8a, hex: '0102' },
  { kind: 'return-metadata', start: 0x82d9ae, hex: '0200' },
];
export const random63Anchors = [
  { kind: 'pointer', start: 0x82d87e, hex: '60C5' },
  { kind: 'argument-metadata', start: 0x82daaf, hex: '0001' },
  { kind: 'return-metadata', start: 0x82d9d3, hex: '0200' },
];
export const decodeSource = (bytes) => decodeTaskWindows(bytes, randomWindows);
export function prove(all, entry) {
  if (![0x80c51f, 0x80c560].includes(entry)) throw Error('Unproved random root');
  const windows = entry === 0x80c560 ? randomWindows.slice(1) : randomWindows;
  const map = new Map(
    [...all].filter(([pc]) =>
      windows.some((w) => pc >= w.start && pc < w.start + w.hex.length / 2),
    ),
  );
  assertPinnedTaskSource(map, windows);
  const p = proveAudioStack(map, entry, 'RTS');
  if (
    p.reachable_instructions !== map.size ||
    p.external_return_assumptions !== 0 ||
    p.minimum_protected_stack_bytes !== (entry === 0x80c51f ? 5 : 3)
  )
    throw Error('Whole random graph/stack drift');
  return {
    ...p,
    native_binding: false,
    local_source_complete: true,
    full_graph_closed: true,
    full_task_binding: false,
    global_stack_minimum: null,
    root_return: 'RTS',
    source_closed_to_dispatch: false,
    return_target_executed: false,
    qualification:
      'Pinned whole original C51F range and C560 BYTE helper, both original tables separately pinned. Real JSR C534/PHP/PLP/RTS, X/Y truncation and fresh WORD comparison/limit/mask/DP result/state reads. Each discarded2137 latch read and213C/213D BYTE value is an independent external observation per reached attempt; no RNG/device/time/termination inference. Budget exhaustion withholds all effects; source structural minimum assumes intact disjoint stack and is not alias exclusion. Originalcaller/initialization/Task/scene/frames and scriptbodies remain separate.',
  };
}
