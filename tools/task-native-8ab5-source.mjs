import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';

// Native10/8AB5 (enemy shot, src/task/native-object-shoot.mjs): the own code 8AB5/8A43/8497/8904 in four
// windows, with every call into a routine proved elsewhere as an external return (the hit 8691 with
// 8778/881C belongs to the Native7C graph, tools/task-native-8e36-source.mjs).
export const native8AB5Spec={name:'task-native-8ab5',entry:0x808AB5,id:0x10,rootReturn:'RTS',maximumLocalStackBytes:6,
 instructions:234,returns:['80:8AEA','80:8AF0'],
 windows:[
  {start:0x808497,hex:'DA5A64C064C338BD800EF9800E100685C349FFFF1A85BD38BD280EF9280E100685C049FFFF1A85BAA5BD4AC5BAB035A5BA4AC5BDB020A5C0F00EA5C3F005A20500802DA207008028A5C3F005A20300801FA20100801AA5C0F005A206008011A20200800CA5C3F005A204008003A200008400860220AFAA7AFA60'},
  {start:0x808904,hex:'A5A2C90400B0034C9189C90600F07E38BD280EF9280E100449FFFF1AC9400090034CB08938BD800EF9800E100449FFFF1AC94000B07638BDD80EF9D80E100449FFFF1AC94000B064A5A2C90500F01BA908008500DA5A201FC57AFAA5001A38E90200E5B1E5A81044803CA908008500DA5A201FC57AFAA5001A38E90300E5AEE5A81029A5AE4A1865A585A58019A908008500DA5A201FC57AFAA5001A38E90200E5ABE5A81006A5A52091866084B718BFA0437E690A000A0A8500DA5A201FC57AFA18A5007DD80E4A4A8506A908008500DA201FC5FAA5000AA8BD280E4A4A1879238A8502BD800E4A4A1879338A8504A6B7BD98110AAAB9138A48A980008508A9E60085002035A8A600689FF8437E60'},
  {start:0x808A43,hex:'F00BA5AB3A3A1003A9000085AB60'},
  {start:0x808AB5,hex:'64B4A502302BA50485AE85B185ABA50685A2A50885A5A50A85A8A400A602225FA281B01220438AA400A602209784200489A5B4850060A9FFFF850060'},
 ],
 externalReturns:[
  [0x81A25F,'RTL','line of sight, src/task/line-of-sight.mjs (tools/task-sight-a25f-source.mjs)'],
  [0x80C51F,'RTS','random below DP00, src/task/native-random.mjs'],
  [0x80A835,'RTS','object slot creation, src/task/native-object-create.mjs'],
  [0x80AAAF,'RTS','object action, src/task/native-object-action-set.mjs'],
  [0x808691,'RTS','hit with 8778 notices and 881C, hitObject in src/task/native-object-hit.mjs'],
 ],
 scope:'Original Native10 8AB5 own code with external returns into separately proved routines; equations in src/task/native-object-shoot.mjs, differential check in tools/task-native-8ab5.test.mjs.',
 contract:'Own 8AB5/8A43/8497/8904 code: DP02 negative returns DPB4; otherwise JSL 81:A25F (Y=DP00 shooter, X=DP02 target), blocked returns FFFF; free: 8A43 lowers DPAB by 2 (not below 0) after a low box (DP68), 8497 facing in eight directions via AAAF, 8904 hit roll with C51F against DPB1/DPAB/DPAE and DPA8 and the 40 distance limit for kinds 4, 5 and 7+; a miss creates object E6 via A835 (tables 8A13/8A23/8A33), a hit runs 8691 with damage limit DPA5. E0M0X0 D0 entry, both returns M0X0 with entry DBR. Fresh tables, no termination inferred.'};

export const prove8AB5Source=(map,spec=native8AB5Spec)=>proveExternalSource(map,spec);
export const emit8AB5Source=()=>emitExternalSource(native8AB5Spec);

// Native58/8A51 (player shoots at the object under the glove) and Native5A/8A8C (object DP00 shoots at DP02):
// own entries plus the weapon lookup 8860/88EB, sharing 8A43, 8904 (and for 8A8C 8497) with 8AB5.
const [window8497,window8904,window8A43]=native8AB5Spec.windows;
const window8860={start:0x808860,hex:'5AB90A15A21A00CACADD0097D0F9BD1A9785ABBD349785ADA00700B7AB29FF0085AEA00800B7AB29FF004A69000085B1A00600B7AB29FF0085AB8A0A0AAABF333C7E29FF0085A2BF343C7E29FF0085A5BF353C7E29FF00C9800090030900FF85A87A5AA5A2D008A90C0020EB88801AC90100D008A9400020EB88800DC90600D008A90E0020EB8880007A60D400D40284008502A9FF0085048506206EC468850268850060'};
// 88EB saves DP00 and DP02 with PEI; the two PLA take these DATA words back.
const peiWordPushes=[[0x8088EB,0],[0x8088ED,2]];
const sound=[0x80C46E,'RTS','sound, playSoundEffect in src/task/native-audio-compose.mjs'];
const [sight,random,slot,action,hit]=native8AB5Spec.externalReturns;
export const native8A51Spec={name:'task-native-8a51',entry:0x808A51,id:0x58,rootReturn:'RTS',maximumLocalStackBytes:10,
 instructions:243,returns:['80:8A85','80:8A8B'],peiWordPushes,
 windows:[window8860,window8904,window8A43,
  {start:0x808A51,hex:'64B4ACC20C206088ADDA013023AEDE01301EACC20C225FA281B01A20438AAEDE01ACC20CBD58140910009D5814200489A5B4850060A90100850060'}],
 externalReturns:[sight,random,slot,hit,sound],
 scope:'Original Native58 8A51 own code (8A51, 8860/88EB, 8A43, 8904) with external returns into separately proved routines; equations in src/task/native-object-shoot.mjs, differential check in tools/task-native-8a51.test.mjs.',
 contract:'8A51: DPB4 = 0, 8860 for the player 0CC2 (object number 150A,Y found in 9700 from X = 18 down, record 971A/9734 bytes 7/8/6 to DPAE, DPB1 (half rounded up), DPAB; weapon 7E3C33+4X kind DPA2, damage DPA5, signed range DPA8; kinds 0/1/6 sound C/40/E via 88EB and C46E). Tagged object 01DA and slot 01DE nonnegative: JSL 81:A25F, blocked returns 1; free: 8A43, bit 4 into 1458+X, 8904 hit roll. DP00 = DPB4. E0M0X0 D0 entry, returns M0X0 with entry DBR. Unknown object numbers loop in the original (no termination inferred).'};
export const native8A8CSpec={name:'task-native-8a8c',entry:0x808A8C,id:0x5A,rootReturn:'RTS',maximumLocalStackBytes:10,
 instructions:297,returns:['80:8AAE','80:8AB4'],peiWordPushes,
 windows:[window8497,window8860,window8904,window8A43,
  {start:0x808A8C,hex:'64B4A400206088A400A602225FA281B01220438AA400A602209784200489A5B4850060A9FFFF850060'}],
 externalReturns:[sight,random,slot,action,hit,sound],
 scope:'Original Native5A 8A8C own code (8A8C, 8860/88EB, 8A43, 8497, 8904) with external returns into separately proved routines; equations in src/task/native-object-shoot.mjs, differential check in tools/task-native-8a51.test.mjs.',
 contract:'8A8C: DPB4 = 0, 8860 for object DP00 (as in 8A51), JSL 81:A25F (Y = DP00, X = DP02), blocked returns FFFF; free: 8A43, 8497 facing via AAAF, 8904 hit roll; DP00 = DPB4. E0M0X0 D0 entry, returns M0X0 with entry DBR.'};
export const prove8A51Source=(map,spec=native8A51Spec)=>proveExternalSource(map,spec);
export const prove8A8CSource=(map,spec=native8A8CSpec)=>proveExternalSource(map,spec);
export const emit8A51Source=()=>emitExternalSource(native8A51Spec);
export const emit8A8CSource=()=>emitExternalSource(native8A8CSpec);
