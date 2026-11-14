import { createRenderData } from '../src/render/data.mjs';
import { readFile } from 'node:fs/promises';
import { cpuToOffset } from './rom.mjs';
const rom=await readFile(new URL('../Shadowrun (E).smc',import.meta.url));
export const transferTable=rom.subarray(cpuToOffset(0x808F87,rom.length),cpuToOffset(0x808F87,rom.length)+16);
export const transferEntry={bank:0x80,status:0xC5,y:0xBEEF,emulation:0,directPage:0,
  stackWindow:[0x1FFA,0x1FFF],ioMode:'record-requests',waitMode:'record-observations',
  waitRead1C76:Array.from({length:11},(_,n)=>0x1235+n)};
export function transferWindows(bank=0x80){
  const base=bank===0x7F?0x7F0000:0x7E0000;
  return [[base+0x144,base+0x153],[base+0x1C2,base+0x1C4],[0x7E1C76,0x7E1C77],
    ...([0x7E,0x7F].includes(bank)?[[base+0x2123,base+0x2124],[base+0x212A,base+0x212B],
      [base+0x4300,base+0x4304]]:[])];
}
// Original table bytes only. Gate/counter/observations/windows are synthetic;
// this is not an initialized original dialog, DMA or NMI fixture.
export function transferFixture({bank=0x80,gate=0xA4,baseline=0x1234,table=transferTable,
  writeWindows=transferWindows(bank)}={}){
  const data=createRenderData({writeWindows}),base=bank===0x7F?0x7F0000:0x7E0000;
  if(table!==null)data.seed(0x808F87,table);
  if(gate!==null)data.seed(base+0x1C4,[gate]);
  if(baseline!==null)data.seed(0x7E1C76,[baseline&255,baseline>>>8]);
  return data;
}
