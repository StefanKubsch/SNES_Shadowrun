import {taskFEC1Fixture} from './task-native-fec1-fixtures.mjs';
import {heldWord} from './render-be6d-fixtures.mjs';

export function c8BodyCases(spec){
 if([0xED,0x139,0x13D,0x13F,0x2D4,0x352].includes(spec.id))return [
  {name:'zero',delta:0,distance:0},{name:'near-boundary',delta:399,distance:99},
  {name:'threshold',delta:400,distance:100},{name:'above-threshold',delta:403,distance:100},
  {name:'negative-near',delta:65137,distance:99},{name:'minimum-signed',delta:32768,distance:8192}]
  .flatMap(v=>v.distance<100?[v,{...v,name:v.name+'-replacement',occupied:[4,4,4,4]}]:[v]);
 if([0x85,0xFF,0x1B1].includes(spec.id))return [0,12,52,174].flatMap(input=>[
  {name:'original-lookup-'+input,input},{name:'original-lookup-'+input+'-replacement',input,occupied:[4,4,4,4]}]);
 if(spec.id===0x25A)return [0,1,0x40,0x41,0xFFFF].map(flags=>({name:'flags-'+flags,flags}));
 if([0xBF,0x116].includes(spec.id))return [false,true].flatMap(selectionEqual=>[false,true].map(actionEqual=>({
  name:`selection-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}`,selectionEqual,actionEqual})));
 return [{name:'free-slot'},{name:'replace-slot',occupied:[4,4,4,4]}];
}
export function c8BodyPCs(spec,variant={}){
 if([0xED,0x139,0x13D,0x13F,0x2D4,0x352].includes(spec.id))return [0,2,3,5,7,8,
  ...((variant.distance??0)<100?[11,13,15,16,18,20,22,24]:[]),
  ...([0xED,0x2D4,0x352].includes(spec.id)?[26,27,29]:[26])];
 if([0x85,0xFF,0x1B1].includes(spec.id)){
  const start=[0,2,4,6,9,10,11],second=[14,16,18,21,22,23],hasTop=[12,174].includes(variant.input??0),hasNext=(variant.input??0)===174;
  const decision=hasTop?[...second,...(hasNext?[26,28,30]:[33,35]),37]:[];
  return spec.id===0xFF?[...start,...(hasTop?[...decision,39,41]:[44,47,49,51]),53,55,57,60,62,64,66,68,70]:
   [...start,...(hasTop?decision:[40,42]),44,46,48,51,53,55,57,59,61];
 }
 if(spec.id===0x25A){
  if((variant.flags??0)&1)return [0,2,3,5,7,8,9,12];
  if(!((variant.flags??0)&0x40))return [0,2,3,5,7,8,9,13,14,16,18,19,20,39];
  return spec.instructions.filter(i=>i.pc!==12).map(i=>i.pc);
 }
 return spec.instructions.map(i=>i.pc);
}
export function expandC8BodyFixture(spec,variant,f){
 const notice=taskFEC1Fixture({s:0xAFF,...variant}),bodyBytes=f.data.snapshot().bytes;
 for(const [address,value] of notice.data.snapshot().bytes)f.data.seed(address,[value]);
 for(const [address,value] of bodyBytes)f.data.seed(address,[value]);
 const pcs=c8BodyPCs(spec,variant),hasC8=pcs.some(pc=>spec.instructions.find(i=>i.pc===pc).operand===0xC8);
 const firstWait=pcs.findIndex(pc=>{const i=spec.instructions.find(i=>i.pc===pc);return i.opcode===0x58&&i.operand===0x9F;});
 // Independent expected pops from each complete original body's constants.
 const argumentsById=new Map([[0x25A,[2,2,28,3,0x400,205,240]],[0x26D,[2,2,12,3,0,0,120]],
  [0x2CE,[4,2,24,3,0,284,240]],[0x2F9,[12,2,6,3,0,34,60]],[0x38E,[2,21,16,3,0x800,14,120]],
  [0xFC,[8,2,16,3,0,532,180]],[0xBF,[3,2,27,3,0,506,180]],[0x116,[2,2,28,3,0,33,400]],
  [0xED,[9,2,11,3,0,105,120]],[0x139,[9,2,17,3,0,100,120]],[0x13D,[8,2,13,3,0,101,120]],
  [0x13F,[8,2,12,3,0,102,120]],[0x2D4,[13,2,9,3,0,104,120]],[0x352,[9,2,14,3,0,103,120]]]);
 const fieldBody=[0x85,0xFF,0x1B1].includes(spec.id),hasTop=[12,174].includes(variant.input??0),hasNext=(variant.input??0)===174;
 const fieldSelector=spec.id===0x1B1?(hasTop?(hasNext?12:13):11):(hasTop?(hasNext?8:9):spec.id===0xFF?441:10);
 const args=fieldBody?[2,21,spec.id===0xFF?(hasTop?18:14):19,3,0x800,fieldSelector,120]:argumentsById.get(spec.id),allocation=args[0],selector=args[5];
 // Explicit synthetic provider text and reused allocation geometry. These
 // bytes are not original initialized ROM scene/text claims.
 heldWord(f.data,0x80D9B8+selector*2,0x10);
 for(const [field,value] of [[0x2020,10],[0x2040,8],[0x2060,0x20],[0x2080,0x100],
  [0x20C0,0x20],[0x20E0,0],[0x2100,0],[0x2140,0]])heldWord(f.data,0x7E0000+field+allocation,value);
 const slot=0x10;heldWord(f.data,0x8013A8+slot,0x4000);heldWord(f.data,0x7E4001,0xAB00|(variant.flags??0));
 if([0xED,0x139,0x13D,0x13F,0x2D4,0x352].includes(spec.id)){
  heldWord(f.data,0x800CC2,0x20);heldWord(f.data,0x800E38,variant.delta??0);heldWord(f.data,0x800E48,0);
  heldWord(f.data,0x800E90,0);heldWord(f.data,0x800EA0,0);
 }
 if(spec.argumentBytes)heldWord(f.data,0x800,fieldBody?(variant.input??0):slot);
 if([0x25A,0xBF,0x116].includes(spec.id))f.data.seed(0x614,[0]);
 if(spec.id===0xBF)f.data.seed(0xF3,[0,0x90,0x8D]);
 heldWord(f.data,0x7E3BBB+slot,0xAB00);heldWord(f.data,0x7E3BBB+26,0x1234);
 heldWord(f.data,0x7E3BBB+14,0xAB00);
 const futureC8=[0xFC,0xBF,0x116].includes(spec.id);
 return {...f,maxHandlers:firstWait<0?pcs.length:firstWait+1,maxWork:1000000,maxOutputBytes:1000000,
  ioMode:notice.ioMode,ioObservations:hasC8&&!futureC8?notice.ioObservations:Object.freeze([]),
  waitMode:notice.waitMode,waitObservations:hasC8&&!futureC8?notice.waitObservations:Object.freeze([]),
  ...(futureC8?{c8ResumeObservations:{ioObservations:notice.ioObservations,waitObservations:notice.waitObservations}}:{})};
}
