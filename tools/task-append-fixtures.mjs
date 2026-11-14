import {readFileSync} from 'node:fs';
import {inspectRom,cpuToOffset} from './rom.mjs';
import {taskLeafFixture} from './task-native-leaf-fixtures.mjs';
const {bytes}=inspectRom(readFileSync('Shadowrun (E).smc'));
export function taskAppendFixture(entry){
 const f=taskLeafFixture(entry),word=(a,v)=>f.data.seed(a,[v&255,v>>>8]);f.context=Object.freeze({...f.context,x:0x56});
 for(const address of [0x82DB28+0x56,0x82E9CC+0x56,0x82DED1+2*0x56])word(address,bytes.readUInt16LE(cpuToOffset(address,bytes.length)));
 f.data.seed(0x82FA22,[0,2]);word(0x8003D2,0x100);word(0x8003D4,0);word(0x80024E,2);word(0x80024C,4);word(0x800314,65535);
 return f;
}
