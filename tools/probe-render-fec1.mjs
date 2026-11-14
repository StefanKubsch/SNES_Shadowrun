import { writeFile } from 'node:fs/promises';
import { prepareRenderFEC1 } from '../proof/render/notice-fec1.mjs';
import { noticeFixture, noticeEntry } from './render-fec1-fixtures.mjs';

const cases = [
  ['free6', {}, {}], ['free4', { occupied: [65535, 65535, 65535, 4] }, {}],
  ['ties0', { occupied: [4, 4, 4, 4] }, {}],
  ['minimum2', { occupied: [4, 4, 4, 4], lifetimes: [40, 10, 20, 30] }, {}],
  ['activeAllocation', { cursor: 0 }, {}],
  ['lateWaitBoundary', { occupied: [4, 4, 4, 4] }, { waitRead01F8: [] }],
];
const probes = cases.map(([name, options, overrides]) => {
  const data = noticeFixture(options), before = data.snapshot();
  const p = prepareRenderFEC1({ data, ...noticeEntry, ...overrides });
  if (JSON.stringify(before) !== JSON.stringify(data.snapshot())) throw Error('Live mutation during prepare');
  const { byteOperations, operations, waitOperations, readAddresses, byteWrites, ...result } = p;
  return { name, qualification: 'Explicit synthetic manual parameters/slots/text table; original0740 conversion source only. No CPU/scene/frame/transfer execution.',
    result, plannedBytes: byteWrites?.length ?? 0 };
});
await writeFile('analysis/render-fec1-native.json', JSON.stringify({ scope: 'Manual atomic FEC1 prerequisite. Whole BF3B action/dialog graph remains open.', probes }, null, 2) + '\n');
console.log(probes.map(p => `${p.name}: ${p.result.outcome ?? p.result.reason}, slot ${p.result.slot ?? '-'}, ${p.plannedBytes} planned bytes`).join('\n'));
