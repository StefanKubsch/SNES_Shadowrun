import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';

// Combat natives of bank 80 (src/task/native-combat.mjs): own code in pinned windows; random C51F, the
// line of sight 81:A25F and the notice FEC1 are external returns into their own proofs. The velocity
// body 8D84/8D95 (hardware divider) is shared by 8D7F, 8D3F and 8D4E.
const VELOCITY='A9FFFF8504A602BD280E85B4BD800E85B7BDD80E85BA64A864AB64AEA40038A5B4F9280E100649FFFF1AC6A885A238A5B7F9800E100649FFFF1AC6AB85A538A5BAF9D80E100649FFFF1AC6AE8D04421865A265A54A4A4A4AE604D0014AC90000D003A90100E2208D0642C22085004A85B1A5AE4D144210011A99D00DA5A28D0442E220A5008D0642C220EAEAEAEAA5A84D144210011A99200DA5A58D0442E220A5008D0642C220EAEAEAEAA5AB4D144210011A99780D60';
const sight=[0x81A25F,'RTL','line of sight, src/task/line-of-sight.mjs (tools/task-sight-a25f-source.mjs)'];
const random=[0x80C51F,'RTS','random below DP00, src/task/native-random.mjs'];
const notice=[0x80FEC1,'RTS','notice window, showNotice in src/task/native-notice.mjs'];
// Proof figures per native: reachable instructions, local stack bytes, RTS exits.
const FIGURES={'8b43':[31,0,['80:8B5E','80:8B89']],'8c08':[64,4,['80:8C17','80:8C8C']],'8c8d':[33,2,['80:8CC8','80:8CCE']],
 '8ccf':[27,0,['80:8CFA','80:8D0A']],'8d7f':[92,0,['80:8E35']],'8d3f':[97,2,['80:8D4D']],'8d4e':[115,2,['80:8D7E']]};
const spec=(name,id,entry,windows,externalReturns,contract,extra={})=>({name:'task-native-'+name,entry,id,rootReturn:'RTS',
 instructions:FIGURES[name][0],maximumLocalStackBytes:FIGURES[name][1],returns:FIGURES[name][2],windows,externalReturns,
 scope:`Original Native${id.toString(16).toUpperCase().padStart(2,'0')} ${name.toUpperCase()} own code with external returns into separately proved routines; equations in src/task/native-combat.mjs, differential check in tools/task-native-combat.test.mjs.`,
 contract,...extra});
export const combatSpecs=[
 spec('8b43',0xAB,0x808B43,[{start:0x808B43,hex:'AD601F4AAAE22038BF963C7EE500900C9F963C7EC220A9FFFF850060C220A90B008500A914008502A913008504A903008506A900008508A90100850AA93C00850C20C1FE640060'}],[notice],
  'X = 1F60 >> 1; SEP20 SEC 7E3C96+X BYTE minus DP00 BYTE: no borrow stores it, REP, DP00 = FFFF; borrow: REP, DP00..0C = 0B, 14, 13, 3, 0, 1, 3C, JSR FEC1, STZ DP00. E0M0X0 D0 entry, returns M0X0 with entry DBR.',
  // REP #20 at 8B5F is reached by BCC from the BYTE section.
  {widthJoins:[0x808B5F]}),
 spec('8c08',0x86,0x808C08,[{start:0x808C08,hex:'A400B95814890400D006A9FFFF850060AD6B1DD007AFE62D7EA88003A00000A9FFFF85A585A8BEA81F5AA40038BD280EF9280EB00449FFFF1A85A238BD800EF9800EB00449FFFF1A1865A285A238BDD80EF9D80EB00449FFFF1A1865A2C5A5B01A85A2BD5814890010D010A400DA225FA281FAB00686A8A5A285A57A888810A6A5A8850060'}],[sight],
  'Object DP00 without bit 0004 in 1458: DP00 = FFFF. Else Y = 7E2DE6 (0 when 1D6B), DPA5 = DPA8 = FFFF; for each 1FA8+Y down to 0: sum of the axis magnitudes of 0E28/0E80/0ED8 (BCS keeps, else EOR/INC), below DPA5 and without bit 1000: PHX, JSL 81:A25F, PLX, free sight stores X to DPA8 and the sum to DPA5. DP00 = DPA8.'),
 spec('8c8d',0x4E,0x808C8D,[{start:0x808C8D,hex:'A400B95814890400F032ADB01F302D5A4A1A8500201FC5A5000AAA688500BCB21FB95814890010D013890400F00E5ABBA400225FA2817AB003840060A9FFFF850060'}],[sight,random],
  'Object DP00 without bit 0004 or 1FB0 negative: FFFF. Else PHY, C51F below (1FB0 >> 1) + 1, ASL to X, PLA (the PHY WORD) to DP00, candidate 1FB2+X; bit 1000 or no bit 0004: FFFF; else JSL 81:A25F, blocked FFFF, free the candidate.',
  {indexPulls:[0x808CA8]}),
 spec('8ccf',0x69,0x808CCF,[{start:0x808CCF,hex:'A400B95814890400F01FA402B95814890010D015890400F010AEB01F300BA502DDB21FF007CACA10F7640060A400A602225FA281B0F3A9FFFF850060'}],[sight],
  'DP00 needs bit 0004, DP02 bit 0004 without 1000 and a place in the fight list 1FB2 (from 1FB0 down); then JSL 81:A25F (Y = DP00, X = DP02): free DP00 = FFFF, otherwise STZ DP00.'),
 spec('8d7f',0x73,0x808D7F,[{start:0x808D7F,hex:VELOCITY}],[],
  'DP04 = FFFF, point = position of object DP02, 8D95: per axis magnitude of point minus object DP00 with sign FFFF in DPA8/DPAB/DPAE (DEC), divisor = sum >> 4 (>> 5 when INC DP04 gives 0), at least 1, low byte to 4206; quotients with sign to 0DD0/0D20/0D78+Y, divisor to DP00, half to DPB1.'),
 spec('8d3f',0x62,0x808D3F,[{start:0x808D3F,hex:'640420848D18B9D00D65B199D00D60'},{start:0x808D84,hex:VELOCITY.slice(10)}],[],
  'STZ DP04, JSR 8D84 (point = object DP02, velocity body of 8D7F), 0DD0+Y plus DPB1.'),
 spec('8d4e',0xD9,0x808D4E,[{start:0x808D4E,hex:'6404A5020A0A0A38E502E502A8C8B7F30A0A85B4C8C8B7F30A0A85B7C8C8B7F30A0A85BA20958D18B9D00D65B199D00D60'},{start:0x808D95,hex:VELOCITY.slice(44)}],[],
  'STZ DP04, Y = 6 * DP02, point = [F3]+Y+1/+3/+5 WORDs times 4, JSR 8D95 (velocity body of 8D7F), 0DD0+Y plus DPB1.'),
];
export const combatSpec=name=>combatSpecs.find(s=>s.name==='task-native-'+name);
export const proveCombatSource=(map,spec)=>proveExternalSource(map,spec);
export const emitCombatSources=async()=>{for(const spec of combatSpecs)await emitExternalSource(spec);};
