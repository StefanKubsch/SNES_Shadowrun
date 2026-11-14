import {readFile,writeFile} from 'node:fs/promises';
import {prepareRenderF130} from '../proof/render/samples-f130.mjs';
import {sampleEntry,sampleFixture} from './render-f130-fixtures.mjs';
const source=JSON.parse(await readFile('analysis/render-audio.json','utf8'));
const fixtures=[
  {a:0x1234},
  {},
  {address:0x12FF,blocks:[{kind:'raw',values:[0xAA,0xBB]}]},
  {address:0xFFFE,blocks:[{kind:'repeat',count:2,value:0xABCD}]},
  {blocks:[{kind:'raw',values:[0xAA]},{kind:'repeat',count:2,value:0xBEEF},{kind:'raw',values:[0x12,0x34]}]},
  {blocks:[{kind:'repeat',count:1,value:0}],ioRead2140:[0,1]},
  {writeWindows:[[0x7E0089,0x7E0099],[0x7E1CE6,0x7E1CE7]]},
];
const probes=fixtures.map(fixture=>{
  const data=sampleFixture(fixture),before=JSON.stringify(data.snapshot());
  const p=prepareRenderF130({...sampleEntry,data,...fixture});
  if(JSON.stringify(data.snapshot())!==before)throw Error('Prepare mutated data');
  if(p.handled&&!data.commit(p).handled)throw Error('Commit failed');return {fixture,...p};
});
await writeFile('analysis/render-f130-native.json',JSON.stringify({romSha256:source.rom_sha256,
  source:source.windows.find(w=>w.name==='samplesF130'),
  stackProof:source.graph.proofs.find(p=>p.entry==='81:F130'),
  scope:'Manual atomic F130 data loader/F100 length subtraction using explicitly synthetic directory/block/payload data and actual BYTE2140 polls. Fresh24bit pointers, original overlapping reads, WORD/BYTE counters and do-loops, actual raw-tail A/F03A effects, repeatedWORD refetch, PHP/PLP entry status, one provider/global polls/budget/outer commit. No audio/device/CPU/clock/interrupt/scene execution.',
  declaredInputs:sampleEntry,probes},null,2)+'\n');
console.log('F130: seven synthetic manual gate/odd/even/repeat/mixed/poll/window probes.');
