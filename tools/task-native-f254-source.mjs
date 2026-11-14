import {proveExternalSource,emitExternalSource} from './task-native-external-source.mjs';
// Native01/F254 (src/task/native-member-spell-menu.mjs): weapon menu E693 with its own helpers E4B3, E433, E41F, E48D,
// 81:A954, E9C5 and E9A8; every other call is an external return into its own proof.
const RTS='RTS',RTL='RTL';
export const nativeF254Spec={name:'task-native-f254',entry:0x80F254,id:0x01,rootReturn:RTS,maximumLocalStackBytes:12,
 instructions:328,returns:['80:F28F'],
 windows:[
  {start:0x80F254,hex:'A9FFFF8D621FA400A21800B90A15DD0097F004CACA10F78D5A1F8C5C1F8E601FBD1A971869060085F9E220BD349785FBC2209C631D2093E69C621F60'},
  {start:0x80E693,hex:'A9FFFF8D681FA20000A00600B7F929FF00F001E8C8C00C00D0F2E00000D0034CBFE7E8E8E88606A90B008500A90F008502A912008504A9000085082063F9A5008D501F6404A988708DA91DA00600B7F929FF00F043483A0A0A85020A65028502980AAA981865F948BD04E848BD10E848BD1CE8488A6502AABDBCE7A604E8E886049DA91D689D311F689D4D1E689D2D1E689D5D1E689D3D1EC8C00C00D0B0A6049EAB1DA9010085026404A907008506A9A91D8508A97E00850A20C7A6A500F06410058D631D805D0AA8BE2D1EB93D1E8500AD5C1FCDC20CD017B94D1E8F133C7EB95D1E8F1A3C7EB9311F8F153C7E8034AD681FF02F204AC39C581F20CAC1AD631DD021AD581FF00722B0AE8120B3E4A20600BF16027E1006CACA10F680062053F92079FFAD501F8500203EFAAD681FD00320C5E960'},
  {start:0x80E41F,hex:'08E2208A1869398D441F8A49FF693B8D431F28',finalM:1},
  // RTS after PLP: the PHP width M0 again (the linear decode does not restore it).
  {start:0x80E432,hex:'60'},
  {start:0x80E433,hex:'A922228D23219C2A21A93F1F8D0243E220A20C00BF80E4809D3F1FCA10F6A9018D0043A9268D0143A97E8D0443A9010CC401C220A90F008DC201A2020022A1B081201FE4E8E8E8E0210090F160'},
  {start:0x80E48D,hex:'A9A1008D4201A2000820F58FA91A1A8F103D7EA980348F123D7EA928008F083F7E2254A98160AD541F0AAABDF794AAA940008D01219CD417E220BF02008D85F8C220BF00008D85F6A00200B7F629FF00A8A7F6A25052206D9F20208F202290208DE42033E460'},
  {start:0x80E9A8,hex:'3012AABF22B08D0A856B0A656BAABFB0EF8C8003A92E7185022069FE60AD4C1F8500AD5C1FCDC20CD016A90A008502A91400850420ACFAAF153C7E85022069FEA90A008502A91500850420ACFAAD601F0A0AAABF2E3C7E48AD5C1FCDC20CD013AF183C7E29FF00F00A18BF303C7E6902008004BF303C7E29FF0048BF313C7E48A97F7085022069FEA90A008502A91500850420ACFA6820A8E9A90A008502A91600850420ACFAA97F7085022069FEA90A008502A91600850420ACFA6885022080FD6820A8E960'},
  {start:0x81A954,hex:'EE62156B'},
 ],
 externalReturns:[
  [0x80F963,RTS,'window, openWindow in src/task/native-window-open.mjs'],
  [0x80A6C7,RTS,'menu, runTaskMenuCompose in src/task/native-menu-compose.mjs'],
  [0x80FA3E,RTS,'window release, releaseWindow in src/task/native-render-compose.mjs'],
  [0x80C34A,RTS,'append task, appendScriptTask in src/task/task-append.mjs'],
  [0x80C1CA,RTS,'visit, nested scheduler round NativeCalls.round (src/vm/native-call.mjs)'],
  [0x81AEB0,RTL,'window list, resetAndDrawWindowList in src/task/native-glove-target.mjs (tools/task-native-9bc6-source.mjs)'],
  [0x80F953,RTS,'input wait, waitForConfirmKey in src/task/native-input-wait.mjs'],
  [0x80FF79,RTS,'clear, releaseNoticeWindows in src/task/native-slot-release.mjs'],
  [0x809F6D,RTS,'unpack, unpackPortrait in src/task/native-dialog-portrait.mjs (tools/task-native-936c-source.mjs)'],
  [0x808F20,RTS,'portrait buffer, shiftPortraitRows in src/task/native-dialog-portrait.mjs (tools/task-native-936c-source.mjs)'],
  [0x809022,RTS,'portrait DMA, uploadFirstPortrait in src/task/native-dialog-portrait.mjs (tools/task-native-936c-source.mjs)'],
  [0x808FF5,RTS,'portrait DMA request, uploadPortraitTiles in src/task/native-dialog-portrait.mjs (tools/task-native-936c-source.mjs)'],
  [0x81B0A1,RTL,'frame counter, waitForRandomStateChange in src/task/native-frame-wait.mjs'],
  [0x80FAAC,RTS,'cursor, setTextCursor in src/task/native-list-prerequisites.mjs'],
  [0x80FE69,RTS,'text, printText in src/task/native-text-compose.mjs'],
  [0x80FD80,RTS,'number, printNumber in src/task/native-list-prerequisites.mjs'],
 ],
 scope:'Original Native01 F254 own code with the weapon menu E693 and its helpers; external returns into the proved window, menu, task, scheduler, input, portrait, counter, cursor, text and number graphs; equations in src/task/native-member-spell-menu.mjs, differential check in tools/task-native-f254.test.mjs.',
 contract:'F254: 1F62 FFFF, weapon index of 150A+DP00 in 9700, [F9] = 971A+6/9734, 1D63 0, JSR E693, 1F62 0, RTS. E0M0X0 D0 entry, return M0X0 with entry DBR. Result word DP00.'};
export const proveF254Source=(map,spec=nativeF254Spec)=>proveExternalSource(map,spec);
export const emitF254Source=()=>emitExternalSource(nativeF254Spec);
