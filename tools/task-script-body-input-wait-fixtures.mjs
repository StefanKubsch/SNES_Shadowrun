import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
const freeze=xs=>Object.freeze(xs.map(Object.freeze));
export function inputWaitBodyCases(spec){
 const contexts=spec.id===0x10E?[0,1,2,3,255].flatMap(state=>[0,0xCAFF,65535].map(input=>({state,input}))):[{}];
 return contexts.flatMap(context=>[false,true].map(repeated=>({...context,repeated,
  name:`state-${context.state??'none'}-argument-${context.input??'none'}-${repeated?'repeat':'ready'}`})));
}
export function inputWaitBodyPCs(spec,variant){
 if(spec.id!==0x10E)return spec.instructions.map(i=>i.pc);
 const first=[0,2,5,6,7],last=[60,62,64];
 if(!variant.state)return [...first,...last];
 return [...first,10,13,15,16,...(variant.state<=2?[40,42,45,48,50,52,54,56]:[19,21,24,27,29,31,33,35,37]),58,...last];
}
export function expandInputWaitBodyFixture(spec,variant,f){
 // Body argument and every actual table remain original. Existing allocation,
 // buffer geometry and device/control samples are declared synthetic providers.
 const body=f.data.snapshot().bytes,notice=taskFEC1Fixture({s:0xAFF});
 for(const [a,v]of notice.data.snapshot().bytes)f.data.seed(a,[v]);
 for(const [a,v]of body)f.data.seed(a,[v]);
 for(const r of spec.romReads)sampleWord(f.data,r.address,r.value);
 const allocation=spec.id===0x10E?5:6,hasCalls=spec.id!==0x10E||!!variant.state;
 for(const [offset,value]of [[0x2020,64],[0x2040,8],[0x2060,32],[0x2080,256],
  [0x20C0,32],[0x20E0,0],[0x2100,0],[0x2140,0]])sampleWord(f.data,0x7E0000+offset+allocation,value);
 sampleWord(f.data,0x7E2DE6,0xAB00|(variant.state??0));
 if(spec.id===0x10E)sampleWord(f.data,0x800,variant.input??0);
 for(const [a,v]of [[0x7E1C76,5],[0x8001CA,0],[0x8001CC,0],[0x8001CE,0]])sampleWord(f.data,a,v);
 const counter=hasCalls?(variant.repeated?[5,6,6,7]:[6]):[],controls=hasCalls?(variant.repeated?[0,0x40]:[0x40]):[];
 return {...f,maxHandlers:spec.id===0x10E?inputWaitBodyPCs(spec,variant).length:12,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:'record-requests',ioObservations:hasCalls?notice.ioObservations:freeze([]),waitMode:'record-observations',
  waitObservations:freeze([...(hasCalls?notice.waitObservations:[]),...counter.map(value=>({pc:0x81B0A5,address:0x7E1C76,width:2,value}))]),
  inputMode:'record-observations',inputObservations:freeze(controls.map(value=>({pc:0x809E1A,address:0x8001CA,width:2,value})))};
}
