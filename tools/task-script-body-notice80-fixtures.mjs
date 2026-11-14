import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
const empty=Object.freeze([]);
export const notice80BodyCases=()=>[0,1,127,128,255].flatMap(oldFlag=>[false,true].map(replace=>({
 name:`flag-${oldFlag}-${replace?'replace':'free'}`,oldFlag,replace})));
export function expandNotice80BodyFixture(spec,variant,f){
 const body=f.data.snapshot().bytes,notice=taskFEC1Fixture({s:0xAFF,...(variant.replace?{occupied:[4,4,4,4]}:{})});
 for(const [a,v]of notice.data.snapshot().bytes)f.data.seed(a,[v]);
 for(const [a,v]of body)f.data.seed(a,[v]);
 for(const r of spec.romReads)sampleWord(f.data,r.address,r.value);
 // Original field pointer32B0; mutable field bytes and allocation geometry
 // remain explicit synthetic sources. The BYTE writer must retain this high.
 sampleWord(f.data,0x7E32B1,0xAB00|(variant.oldFlag??0));
 for(const [offset,value]of [[0x2020,24],[0x2040,3],[0x2060,32],[0x2080,256],
  [0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])sampleWord(f.data,0x7E0000+offset+4,value);
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:notice.ioMode,ioObservations:empty,
  waitMode:notice.waitMode,waitObservations:empty,
  c8ResumeObservations:{ioObservations:notice.ioObservations,waitObservations:notice.waitObservations}};
}
