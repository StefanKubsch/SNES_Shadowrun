import {taskActionsFixture} from './task-native-actions-fixtures.mjs';import {seedWord} from './render-ad92-fixtures.mjs';
import {createRenderData,renderAddress} from '../src/render/data.mjs';
export function taskNative13Fixture({frame=0x1000,operandS=0x3F0,scriptBank=0x80,mask=2,omit=null,...menu}={}){
 const f=taskActionsFixture(0x809BA0,{mask,...menu}),{data}=f;
 for(const [address,value] of [[frame,0x1200],[frame+1,scriptBank*256+0x12],[0x800250,0x10],[0x800262,frame],
  [scriptBank*65536+0x1F2,f.context.s],[0x82D7DE,0x9BA0],[0x82DA5F,0x0201],[0x82D983,2],[0x80F30C,0xF4CB],
  [operandS+1,mask],[f.context.s+1,0xC20A]])seedWord(data,address,value);
 data.seed(scriptBank*65536+0x1204,[0x13,0x14,0xA5]);
 const context=Object.freeze({...f.context,bank:scriptBank,a:0xABCD,x:0x58,y:4,s:operandS,d:frame,pc:0xF390});
 let owner=data;if(omit!==null){owner=createRenderData({writeWindows:data.snapshot().writeWindows});for(const [address,value] of data.snapshot().bytes)if(address!==renderAddress(omit))owner.seed(address,[value]);}
 return {...f,data:owner,context,entry:0x80F390};
}
