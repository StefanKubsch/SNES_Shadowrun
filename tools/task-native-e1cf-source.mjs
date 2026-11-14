import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';
// Native8A/E1CF (spell choice, src/task/native-spell-choice.mjs) and Native52/C461 (sound command 0D,
// proof/apu-reference/sound-stereo.mjs): own code with external returns into separately proved routines.
export const nativeE1CFSpec={name:'task-native-e1cf',entry:0x80E1CF,id:0x8A,rootReturn:'RTS',maximumLocalStackBytes:2,
 instructions:56,returns:['80:E24D'],
 // PLA at E24A takes either the PHA WORD of the chosen spell (E23D) or the PEA 0000 (E240).
 pullKinds:[[0x80E24A,['data','byte']]],
 windows:[{start:0x80E1CF,hex:'AF1C3C7EF06BA90E008500A905008502A910008504A907008506A9000085082063F9A500850EA20000BF1C3C7EF00C0AA8B9B8D99D751DE8E880EE9E751DA988708D731DA9010085026404A905008506A9731D8508A97E00850A20C7A6A500C9FFFFF00D0AF00A3A3AAABF1C3C7E488003F40000A50E8500203EFA68850060'}],
 externalReturns:[
  [0x80F963,'RTS','window allocation, openWindow in src/task/native-window-open.mjs'],
  [0x80A6C7,'RTS','menu, runTaskMenuCompose in src/task/native-menu-compose.mjs'],
  [0x80FA3E,'RTS','window release, releaseWindow in src/task/native-render-compose.mjs'],
 ],
 scope:'Original Native8A E1CF own code with external returns into F963, A6C7 and FA3E; equations in src/task/native-spell-choice.mjs, differential check in tools/task-native-e1cf.test.mjs.',
 contract:'Spell list 7E3C1C (WORDs, 0 ends): empty skips window and menu. Else F963 (0E/05/10/07/0) to DP0E, names ROM D9B8+2*id to 1D75+X (0 ends), 1D73 = 7088, A6C7 with DP02 1, DP04 0, DP06 5, DP08 1D73, DP0A 7E; result FFFF or 0 pushes 0 (PEA), n pushes 7E3C1C+2(n-1); DP00 = DP0E, FA3E, PLA to DP00. E0M0X0 D0 entry, return M0X0 with entry DBR.'};
export const nativeC461Spec={name:'task-native-c461',entry:0x80C461,id:0x52,rootReturn:'RTS',maximumLocalStackBytes:0,
 instructions:5,returns:['80:C46D'],
 windows:[{start:0x80C461,hex:'A5022016C4A90D002207F08160'}],
 externalReturns:[
  [0x80C416,'RTS','stereo position, computeSoundPan in src/task/native-input-apu.mjs'],
  [0x81F007,'RTL','APU command, sendApuCommand in src/task/native-input-apu.mjs'],
 ],
 scope:'Original Native52 C461 own code with external returns into C416 and 81:F007; equations in proof/apu-reference/sound-stereo.mjs, differential check in tools/task-native-e1cf.test.mjs.',
 contract:'LDA DP02, JSR C416, LDA #0D, JSL 81:F007, RTS. No result word.'};
export const proveE1CFSource=(map,spec=nativeE1CFSpec)=>proveExternalSource(map,spec);
export const proveC461Source=(map,spec=nativeC461Spec)=>proveExternalSource(map,spec);
export const emitE1CFSources=async()=>{await emitExternalSource(nativeE1CFSpec);await emitExternalSource(nativeC461Spec);};
