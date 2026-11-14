import {createRenderData} from '../src/render/data.mjs';
export function taskFixture(entry,{top=0x1234,left=0x5678,opcodeWord=0xA514,y=4,s=0x3F0,d=0x200,bank=0x80,status=0x45,
  pointer=0x1200,writeWindows=[[0x7E0000,0x7E1FFF]],seedOpcode=true,outerWord=0xC20A,savedOuterS=0x1EF}={}){
  const data=createRenderData({writeWindows});
  const seedWord=(address,value,wrap=24)=>{const mask=wrap===16?65535:0xFFFFFF;data.seed(address&mask,[value&255]);data.seed((address+1)&mask,[value>>>8]);};
  seedWord(d,pointer,16);seedWord((s+1)&65535,top,16);seedWord((s+3)&65535,left,16);
  if(seedOpcode)for(let n=0;n<3;n++)seedWord((bank*65536+pointer+y+n*2)&0xFFFFFF,opcodeWord);
  seedWord((d+0x13)&65535,0xDCFE,16);seedWord((d+0x13+(opcodeWord&255))&65535,0xABCD,16);
  seedWord(bank*65536+0x1F2,savedOuterS);seedWord((savedOuterS+1)&65535,outerWord,16);
  const context=Object.freeze({a:0xABCD,x:0xDCBA,y,s,d,bank,status,e:0,programBank:0x80,pc:entry&65535});
  return {data,context,entry,protectedStackBytes:[0x7E0000+((savedOuterS+1)&65535),0x7E0000+((savedOuterS+2)&65535)],maxWork:250000,maxOutputBytes:64};
}
