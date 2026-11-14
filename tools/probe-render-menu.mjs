import { readFile,writeFile } from 'node:fs/promises';
import { prepareRenderA6A5,prepareRenderA6AD,prepareRenderA6B8,prepareRenderA6C7 } from '../proof/render/menu-a6a5.mjs';
import { menuEntry,menuFixture } from './render-menu-fixtures.mjs';
const source=JSON.parse(await readFile('analysis/render-a6a5.json','utf8'));
const entries={A6A5:prepareRenderA6A5,A6AD:prepareRenderA6AD,A6B8:prepareRenderA6B8,A6C7:prepareRenderA6C7};
const fixtures=[
  {helper:'A6A5',held:0x2000},
  {helper:'A6C7',held:0x40},
  {helper:'A6B8',held:0x40,a:0x8001},
  {helper:'A6A5',held:0x400,tokens:[0x10,0x10,0],count:1,numbers:[0,0x400,0]},
  {helper:'A6AD',held:0x3030},
  {helper:'A6C7',held:0,waitRead1C76:[1,2,3]},
  {helper:'A6C7',held:0x40,ioRead2140:[0]},
  {helper:'A6C7',held:0x40,sound:0x8007,load:true},
  {helper:'A6C7',held:0x40,sound:0x8007,load:true,blocks:[{kind:'repeat',count:2,value:0xBEEF}]},
  {helper:'A6C7',held:0x40,sound:0xFFFF,load:true},
];
const probes=fixtures.map(fixture=>{
  const data=menuFixture(fixture),before=JSON.stringify(data.snapshot());
  const p=entries[fixture.helper]({...menuEntry,data,...fixture});
  if(JSON.stringify(data.snapshot())!==before)throw Error('Prepare mutated data');
  if(p.handled&&!data.commit(p).handled)throw Error('Commit failed');
  return {fixture,...p};
});
await writeFile('analysis/render-menu-native.json',JSON.stringify({romSha256:source.rom_sha256,
  source:source.windows[0],stackProofs:source.conditional_menu_graph.proofs,
  scope:'Manual atomic A6A5/A6AD/A6B8/A6C7 menu with explicitly synthetic complete byte sources and independent chronological arithmetic/transfer/counter/APU observations. Fresh aliases, original PEI/PHY saved words, actual callee registers/DBR, shared provider/global budgets/one outer commit. No input inferred from counter change, CPU/device/time/interrupt/scene execution or automatic frame binding; reset remains an atomic boundary.',
  declaredInputs:menuEntry,probes},null,2)+'\n');
console.log(probes.map(p=>`${p.fixture.helper}:${p.outcome??p.reason}`).join(', '));
