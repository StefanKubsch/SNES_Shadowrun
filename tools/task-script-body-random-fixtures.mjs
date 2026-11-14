import {randomRecords} from './task-native-random-fixtures.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
export const randomBodyD2Settings=new Map([[0x65,[2,3]],[0xDB,[2,3]],[0x282,[2,7]]]);
export function randomBodyPCs(spec,variant={}){
 if(spec.id!==0x7E)return spec.instructions.map(i=>i.pc);
 const inputByte=(variant.args?.[0]??variant.inputByte??5)&255,roll=variant.retry?6:variant.roll??6,fieldWord=variant.fieldWord??0;
 const succeeds=((inputByte-1)&65535)>=roll&&fieldWord<=3;
 return [0,2,4,6,7,8,10,12,14,15,16,...(succeeds?[19,21,23,24,26,28,30]:[31,32])];
}
export function randomBodyCases(spec){
 if(spec.id===0x7E)return [0,1,5,10,0x100].flatMap(inputByte=>[0,3,4,65535].flatMap(fieldWord=>[0,9].map(roll=>({name:`input${inputByte}-field${fieldWord}-roll${roll}`,inputByte,fieldWord,roll}))))
  .concat([{name:'retry-twice',inputByte:10,fieldWord:0,retry:true}]);
 return Array.from({length:7},(_,selection)=>selection).flatMap(selection=>[false,true].flatMap(selectionEqual=>[false,true].map(actionEqual=>({
  name:`selection${selection}-${selectionEqual?'equal':'changed'}-action-${actionEqual?'equal':'changed'}`,selection,selectionEqual,actionEqual}))))
  .concat([{name:'retry-and-argument-high',selection:2,retry:true,args:[0x110]}]);
}
export function expandRandomBodyFixture(spec,variant,f){
 const {data}=f,slot=variant.slot??16,roll=spec.id===0x7E?(variant.roll??6):(variant.selection??2);
 data.seed(0x801CE8,[0]);data.seed(0x7E1C76,[26^(variant.retry?(spec.id===0x7E?10:7):roll),26]);
 let samples;
 if(variant.retry)samples=spec.id===0x7E?[[123,10,0],[123,159,1],[123,86,2]]:[[123,7,0],[123,146,1]];
 else samples=[[123,roll,0]];
 if(spec.id===0x7E){sampleWord(data,0x800,variant.args?.[0]??variant.inputByte??5);sampleWord(data,0x7E3BE5,variant.fieldWord??0);}
 else {
  const action=spec.id===0x282?7:3,selection=variant.selection??2;
  sampleWord(data,0x801038+slot,variant.selectionEqual?selection:65535);
  const base=spec.romReads.find(r=>r.address===0x8CEDA0).value,
   record=spec.romReads.find(r=>r.address===0x8C0000+base+selection*2).value;
  sampleWord(data,0x801090+slot,record+8);
  sampleWord(data,0x801198+slot,variant.actionEqual?action:0);
 }
 return {...f,maxHandlers:randomBodyPCs(spec,variant).length,ioMode:'record-requests',ioObservations:randomRecords(samples)};
}
