import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';

// NativeAC/8521 (fight list, proof/game-reference/fight-list-append.mjs): own code in one window; the music change
// 81:EF47 is an external return into its own proof (docs/reference/render-routines.md#ef47, tools/render-ef47-source.test.mjs).
export const native8521Spec={name:'task-native-8521',entry:0x808521,id:0xAC,rootReturn:'RTS',maximumLocalStackBytes:0,
 instructions:25,returns:['80:855D'],
 windows:[
  {start:0x808521,hex:'AEB01FE8E88EB01FA5009DB21FE00000D02AAF113C7E4A4A4A8DCC1FA9FFFF8DCA1FADD61F290100F012A90600CDDE1CF00AACDE1C8CCA1F2247EF8160'},
 ],
 externalReturns:[
  [0x81EF47,'RTL','music mode change, setMusicMode in src/task/native-audio-compose.mjs (analysis/render-ef47.json)'],
 ],
 scope:'Original NativeAC 8521 own code with an external return into the separately proved EF47 graph; equations in proof/game-reference/fight-list-append.mjs, differential check in tools/task-native-8521.test.mjs.',
 contract:'Own 8521 code: 1FB0 += 2 (INX INX, no capacity check), DP00 to 1FB2+X. Nonzero X returns with CPX flags. Index 0: long 7E3C11 >> 3 to 1FCC, FFFF to 1FCA; bit 0 of 1FD6 clear or 1CDE = 6 returns; else 1CDE to 1FCA and JSL 81:EF47 with A = 6. E0M0X0 D0 entry, return M0X0 with entry DBR. Fresh WRAM.'};

export const prove8521Source=(map,spec=native8521Spec)=>proveExternalSource(map,spec);
export const emit8521Source=()=>emitExternalSource(native8521Spec);
