import {textMaskWords} from './render-text-compose-fixtures.mjs';
import {taskClearFixture} from './task-native-clear-fixtures.mjs';
import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';import {sampleWord} from './render-f130-fixtures.mjs';
const freeze=values=>Object.freeze(values.map(v=>Object.freeze(v)));
export function clearBodyCases(){return [
 {name:'signed-empty',slots:[0x8000,0x8001,0xFFFE,0xFFFF]},
 {name:'zero-buffer',slots:[65535,65535,65535,0]},
 {name:'four-buffers',slots:[0,2,4,6]},
 {name:'active-zero-buffer',slots:[65535,65535,65535,0],active:true},
 {name:'observed-nonzero-poll',slots:[65535,65535,65535,0],wait:[7,0]}
 ];}
export function expandClearBodyFixture(spec,variant,f){
 const original=f.data.snapshot().bytes,notice=taskFEC1Fixture({s:0xAFF}),
  clear=taskClearFixture(0x80FF79,{s:0xAFF,last:30,flags:Array(16).fill(0),...variant});
 for(const source of [notice,clear])for(const [a,v]of source.data.snapshot().bytes)f.data.seed(a,[v]);
 for(const [a,v]of original)f.data.seed(a,[v]);
 // Individually pinned original dictionary, compressed text, glyph widths,
 // masks and font. Caller/allocation/slot/geometry bytes remain synthetic.
 for(const r of spec.romReads)sampleWord(f.data,r.address,r.value);
 const height=spec.doubleClearWait?new Map([[0xF9,7],[0x1FB,9],[0x240,8]]).get(spec.id):9;
 for(const [offset,value]of [[0x2020,23],[0x2040,height],[0x2060,32],[0x2080,256],
  [0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])sampleWord(f.data,0x7E0000+offset+2,value);
 const segment={ioObservations:clear.ioObservations,waitObservations:clear.waitObservations};
 return {...f,maxWork:1000000,maxOutputBytes:1000000,ioMode:clear.ioMode,ioObservations:spec.doubleClearWait?freeze([]):clear.ioObservations,
  waitMode:clear.waitMode,waitObservations:spec.doubleClearWait?freeze([]):clear.waitObservations,
  ...(spec.doubleClearWait?{a7ResumeObservations:segment}:{}),
  c8ResumeObservations:{ioObservations:freeze([
   {pc:0x81ADDD,address:0x804216,width:2,value:0},{pc:0x81AE39,address:0x804216,width:2,value:0}]),
   waitObservations:freeze([{pc:0x81ACC9,address:0x7E01FC,width:2,value:0},...textMaskWords(),{pc:0x81ACC3,address:0x7E01FA,width:2,value:0}])}};
}
