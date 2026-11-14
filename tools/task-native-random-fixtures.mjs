import {createRenderData} from '../src/render/data.mjs';
import {randomTables,randomAnchors,random63Anchors} from './render-task-native-random-source-proof.mjs';
import {sampleWord} from './render-f130-fixtures.mjs';
export const randomRecords=values=>Object.freeze(values.flatMap(([latch,horizontal,vertical])=>[
 {pc:0x80C566,address:0x802137,width:1,value:latch},{pc:0x80C572,address:0x80213C,width:1,value:horizontal},
 {pc:0x80C57F,address:0x80213D,width:1,value:vertical}]).map(Object.freeze));
export function taskRandomFixture(entry=0x80C51F,{limit=32,values=limit===0?[]:[[0x7B,0x1A,0]],s=0x6FF,status=0x45,
 seed=0,mixLow=0,mixHigh=0x1A,writeWindows=[[0x7E0000,0x7FFFFF]]}={}){
 const data=createRenderData({writeWindows});
 for(const table of randomTables)data.seed(table.start,Buffer.from(table.hex,'hex'));
 for(const[address,value]of[[0,limit],[2,0xBEEF],[4,0xCAFE],[(s+1)&65535,0xF508]])sampleWord(data,address,value);
 data.seed(0x801CE8,[seed]);data.seed(0x7E1C76,[mixLow,mixHigh]);
 return {data,entry,context:Object.freeze({a:0xABCD,x:0xBEEF,y:0x9876,s,d:0,bank:0x80,status,e:0,programBank:0x80,pc:entry&65535}),
  protectedStackBytes:[0x7E0000+((s+1)&65535),0x7E0000+((s+2)&65535)],
  maxWork:10000,maxOutputBytes:10000,ioMode:'record-requests',ioObservations:randomRecords(values)};
}
export function taskNativeRandomOpcodeFixture({id=0x3E,frame=0x1000,operandS=0x3F0,...random}={}){
 if(![0x3E,0x63].includes(id))throw Error('Unproved random native');
 const f=taskRandomFixture(id===0x3E?0x80C51F:0x80C560,random),{data}=f;
 for(const anchor of id===0x3E?randomAnchors:random63Anchors)data.seed(anchor.start,Buffer.from(anchor.hex,'hex'));
 for(const[address,value]of[[frame,0x1200],[frame+1,0x8012],[0x800250,0x10],[0x800262,frame],
  [0x8001F2,f.context.s],[0x80F30C,0xF4CB],[(f.context.s+1)&65535,0xC20A],[operandS+1,random.limit??32]])sampleWord(data,address,value);
 data.seed(0x801204,[id,0x14,0xA5]);
 return {...f,entry:0x80F390,context:Object.freeze({...f.context,a:0xABCD,x:0x58,y:4,s:operandS,d:frame,pc:0xF390})};
}
