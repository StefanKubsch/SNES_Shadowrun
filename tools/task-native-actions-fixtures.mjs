import {taskMenuFixture,menuRecords,menuCursorRead,menuTextReads,menuTextWaits,menuCounterRead,menuAudioReads} from './task-native-menu-fixtures.mjs';
import {ad92Fixture,seedWord} from './render-ad92-fixtures.mjs';
export const actionsOptions=mask=>{
 const rows=[[0x7088,0,0]];
 for(const [flag,token,key] of [[0x80,0x70D9,0x20],[0x10,0x70C5,0x10],[2,0x708C,0],[0x20,0x70D1,0],
  [0x40,0x70D4,0],[0x100,0x70E3,0]])if(mask&flag)rows.push([token,flag,key]);
 if((mask&0x600)===0x600)rows.push([0x7109,0x600,0]);
 else for(const [flag,token] of [[0x200,0x70E6],[0x400,0x70F1]])if(mask&flag)rows.push([token,flag,0x10]);
 for(const [flag,token] of [[0x2000,0x70FD],[0x4000,0x7103]])if(mask&flag)rows.push([token,flag,0]);
 return rows;
};
// Declared synthetic initialization/dictionary/cache and original unpack ROM
// data; never an original action scene, generated device response or input.
export function taskActionsFixture(entry=0x809BA0,{mask=2,override=0,a=mask,bank=0x80,s=0x6FF,held=0x2000,
 writeWindows=[[0x7E0000,0x7FFFFF]],...patch}={}){
 const f=taskMenuFixture(0x80A6A5,{bank,s,a,held,index:0,writeWindows,...patch});
 const background=ad92Fixture({bank,first:0,last:65534,flags:[],writeWindows});
 for(const [address,value] of background.snapshot().bytes)f.data.seed(address,[value]);
 seedWord(f.data,0,mask);seedWord(f.data,bank*65536+0x1FA6,override);seedWord(f.data,bank*65536+0x212,0x2027);
 seedWord(f.data,bank*65536+0x226,0);
 const rows=actionsOptions(entry===0x809BA0?mask:override||a),n=rows.length;
 for(const [token] of actionsOptions(0xFFFF))f.data.seed(0x9D0000+(token|0x8000),[0x40,0]);
 for(const token of [0x70E6,0x70F1])f.data.seed(0x9D0000+(token|0x8000),[0x40,0]);
 const row=()=>[menuCursorRead(),...menuTextReads()],wait=()=>menuTextWaits();
 const displayed=Math.min(n,8)+(n>8?1:0);
 const io=n===1?[]:[{pc:0x80FA01,address:0x802134,width:2,value:n*9},
  ...Array.from({length:displayed},row).flat(),...(n<8?[menuCursorRead()]:[]),...row(),...row(),
  ...(held&0x2000?[]:menuAudioReads())];
 const waits=n===1?[]:[{pc:0x81ACBD,address:bank*65536+0x1F6,width:2,value:0},
  {pc:0x81ACAF,address:bank*65536+0x1F8,width:2,value:0},...Array.from({length:displayed},wait).flat(),
  ...wait(),menuCounterRead(1),...wait(),{pc:0x81ACAF,address:bank*65536+0x1F8,width:2,value:0}];
 return {...f,entry,context:Object.freeze({...f.context,a,pc:entry&65535}),ioObservations:menuRecords(io),waitObservations:menuRecords(waits)};
}
