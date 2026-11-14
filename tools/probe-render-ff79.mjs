import { readFile, writeFile } from 'node:fs/promises';
import { prepareRenderFF79 } from '../proof/render/clear-ff79.mjs';
import { ff79Fixture, ff79Entry } from './render-ff79-fixtures.mjs';

const source = JSON.parse(await readFile('analysis/render-ff79.json', 'utf8'));
const fixtures = [
  [{},{}], [{slots:[0x8000,0x8001,0xFFFE,0xFFFF]}, {waitMode:null,waitRead01F8:null}],
  [{slots:[0x8000,4,4,4],last:6},{}], [{bank:0x7F},{bank:0x7F}],
  [{},{waitRead01F8:[3,0,0x100,2,0,0,9,0]}], [{active:true},{divisionMode:'stable-native'}],
  [{},{waitRead01F8:[0,0,0]}], [{},{maxOutputBytes:14991}],
];
const probes = fixtures.map(([fixture,extra]) => {
  const data = ff79Fixture(fixture), before = data.snapshot();
  const p = prepareRenderFF79({data,...ff79Entry,...extra});
  if (JSON.stringify(data.snapshot()) !== JSON.stringify(before)) throw Error('Prepare mutated live bytes');
  const {operations,byteOperations,byteWrites,readAddresses,...result} = p;
  return {fixture,extra,qualification:'Explicit synthetic manual slots/parameters/observations; original0740 conversion stream and optional AF1F tables only. No original dialog/CPU/device/time/frame execution.',
    result,plannedBytes:byteWrites?.length??0};
});
await writeFile('analysis/render-ff79-native.json',JSON.stringify({rom_sha256:source.rom_sha256,
  source_graph:source.full_graph,scope:'Manual atomic FF79 with actual FA3E/AD92, one shared view/cumulative budget/outer commit. Fresh fixed7E slots, actual entryDBR tail, global WORD01F8 transcript and separate stable-native division ledger. EF47 complete source supplied; native F1FA supplied; native F25A supplied; native EF47 supplied under22 protected stackbytes; FA92 complete source supplied under2 protected stackbytes; native atomic FA92 supplied under2 protected stackbytes; original936C/BF3B caller with nine remaining dialog source helpers remain open.',probes},null,2)+'\n');
console.log('FF79: eight synthetic public plans, real releases and late atomic boundaries.');
