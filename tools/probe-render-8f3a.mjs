import { readFile,writeFile } from 'node:fs/promises';
import { prepareRender8F3A } from '../proof/render/transfer-8f3a.mjs';
import { prepareRender8EFE } from '../proof/render/window-8efe.mjs';
import { transferEntry,transferFixture,transferWindows } from './render-8f3a-fixtures.mjs';
const source=JSON.parse(await readFile('analysis/render-8f3a.json','utf8'));
const fixtures=[{}, {bank:0x7E,ioMode:null},{bank:0x7F,ioMode:null},
  {maxWork:118,maxOutputBytes:63,y:null},{baseline:0xFFFF,waitRead1C76:Array.from({length:11},(_,n)=>n)},
  {waitRead1C76:[0x1234,...transferEntry.waitRead1C76]},
  {waitRead1C76:[]},{waitRead1C76:transferEntry.waitRead1C76.slice(0,10)},
  {table:null},{gate:null},{baseline:null},{maxWork:117},{maxOutputBytes:62},
  {stackWindow:[0x1FFB,0x1FFF]}, {writeWindows:transferWindows().filter(([a])=>a!==0x7E0144)}];
const probes=fixtures.map(fixture=>{
  const data=transferFixture(fixture),before=JSON.stringify(data.snapshot()),p=prepareRender8F3A({...transferEntry,data,...fixture});
  if(JSON.stringify(data.snapshot())!==before)throw Error('Prepare mutated data');
  if(p.handled&&!data.commit(p).handled)throw Error('Commit failed');return{fixture,...p};
});
const helperProbes=[0,0x39,0x3A,0xC6,0xC7,0xFFFF].map(x=>{
  const data=transferFixture(),p=prepareRender8EFE({...transferEntry,data,a:0xAB00,x,stackWindow:[0x1FFC,0x1FFF]});
  return{x,...p};
});
await writeFile('analysis/render-8f3a-native.json',JSON.stringify({romSha256:source.rom_sha256,progress_reference:'docs/PORTIERUNGSSTAND.json',
  source:source.windows[0],helperSources:source.windows.slice(1),table:source.tables[0],stackProof:source.full_graph.proof,
  scope:'Manual atomic8F3A/8EFE. Original table16 separate from synthetic gate/counter/window/observation fixtures. Six/four protected stackbytes, actualDBR stores, BYTE carry chain, hiddenhighA/P restoration, eleven actualB0A1/8EFE calls, global counterPolls, shared budgets and one outer commit. No CPU/device/time/interrupt/scene/frame execution or DMA/NMI completion.',
  declaredInputs:transferEntry,probes,helperProbes},null,2)+'\n');
console.log('8F3A: fifteen synthetic composition probes and six helper probes, original table separate.');
