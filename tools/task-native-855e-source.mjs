import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';

// NativeC0/855E (fight end, src/task/native-fight-list-remove.mjs): own code in one window; the notice FEC1, cursor
// FAAC, number FD80, text FE69, sound C46E and the music change 81:EF47 are external returns into
// their own proofs.
export const native855ESpec={name:'task-native-855e',entry:0x80855E,id:0xC0,rootReturn:'RTS',maximumLocalStackBytes:0,
 instructions:89,returns:['80:856E','80:8628','80:8630'],
 windows:[
  {start:0x80855E,hex:'AEB01F300BBDB21FC500F005CACA10F560BDB41F9DB21FE8E8ECB01F90F3ADCE1FD01ECECE1FAD6B1D3016AFE62D7E3010AABFF82D7EF0053A9FF82D7ECACA10F1CEB01FCEB01F10C7AF113C7E4A4A4A38EDCC1FF0638DCC1FC90A009005A90A008003A909008504A90A008500A902008502A903008506A900008508A90400850AA97800850C20C1FE85006402640420ACFAADCC1F85022080FDA9177185022069FEA9FFFF8500A9FF008504A907008506A932008502206EC4ADD61F290200F00AADCA1F30042247EF8160A900002247EF8160'},
 ],
 externalReturns:[
  [0x80FEC1,'RTS','notice window, showNotice in src/task/native-notice.mjs'],
  [0x80FAAC,'RTS','cursor, setTextCursor in src/task/native-list-prerequisites.mjs'],
  [0x80FD80,'RTS','decimal number, printNumber in src/task/native-list-prerequisites.mjs'],
  [0x80FE69,'RTS','text, printText in src/task/native-text-compose.mjs'],
  [0x80C46E,'RTS','sound, playSoundEffect in src/task/native-audio-compose.mjs'],
  [0x81EF47,'RTL','music mode change, setMusicMode in src/task/native-audio-compose.mjs (analysis/render-ef47.json)'],
 ],
 scope:'Original NativeC0 855E own code with external returns into the separately proved notice, list, text and audio graphs; equations in src/task/native-fight-list-remove.mjs, differential check in tools/task-native-855e.test.mjs.',
 contract:'Own 855E code: DP00 searched in 1FB2 downward from X = 1FB0 (missing returns), the entries above shifted down. 1FCE = 0: DEC 1FCE and, with 1D6B and 7E2DE6 nonnegative, the nonzero words 7E2DF8+X for X = 7E2DE6 down to 0 decremented. 1FB0 -= 2, nonnegative returns. Empty list: 7E3C11 >> 3 minus 1FCC; nonzero goes to 1FCC and opens notice FEC1 (DP 0A,02,9|10,03,00,04,78), FAAC, FD80 with 1FCC, FE69 7117, C46E sound 32. Bit 1 of 1FD6: negative 1FCA returns, else JSL EF47 with 1FCA; without it JSL EF47 with 0. E0M0X0 D0 entry, return M0X0 with entry DBR. Fresh WRAM.'};

export const prove855ESource=(map,spec=native855ESpec)=>proveExternalSource(map,spec);
export const emit855ESource=()=>emitExternalSource(native855ESpec);
