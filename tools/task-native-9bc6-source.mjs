import { proveExternalSource, emitExternalSource } from './task-native-external-source.mjs';

// NativeD8/9BC6 (choose a target with the action glove, proof/replay/native-glove-target.mjs): own code at 9BC6, 9C40,
// BC67/BC36, BCBE/BE5B/BE6D, FADD/FB2A and 81:AEB0 in pinned windows; frame wait B0A1, joypad 9E1A,
// glove access at BCB2, notice FEC1, window F963/FA3E, text FE69, bitstream AF04 and window list AD92 are
// external returns to their own proofs. The 9E1A reset path (L+R+Select+Start) ends there with
// taskStop. Compare against the original instructions in tools/task-native-9bc6.test.mjs.
export const native9BC6Spec = {
  name: 'task-native-9bc6',
  entry: 0x809bc6,
  id: 0xd8,
  rootReturn: 'RTS',
  maximumLocalStackBytes: 12,
  instructions: 434,
  returns: ['80:9BD2'],
  // $FAF2 REP #$20 is reached from the WORD entry and from the BYTE character loop.
  widthJoins: [0x80faf2],
  windows: [
    { start: 0x809bc6, hex: '20409CA4003005B90A15850060' },
    {
      start: 0x809c40,
      hex: '2067BC22A1B081201A9E206DBEADCE0129C0C0F0EEADDA013075ACDE01AEC20C38BD280EF9280E100449FFFF1A856B38BD800EF9800E100449FFFF1A18656BC98100B01238BDD80EF9D80E100449FFFF1AC981009022A9020085008502A90C008504A903008506A900008508640AA93C00850C20C1FE8017AD621FD00422B0AE81ADDE014820B2BC688500201A9E6020B2BCAD621FD00422B0AE81A9FFFF8500201A9E60',
    },
    {
      start: 0x80bc36,
      hex: 'ACC20C38A9000CF9300FF9D80EEDC60CE948004A4AEB8DD60118A9000679800E38F9280EEDC40CE910004A4AEB8DD401602036BCA900068DE401A9000C8DE601A9FFFF8DE8018DD80160',
    },
    {
      start: 0x80bcbe,
      hex: 'ACB01410034C99BDADD401EB29FF00850EADD601EB29FF008511BEB214BD9010D0034C92BDBF283F7EC90B00D017ADD801C9FDFFF00BAD5F1D0D6D1DD0034C92BDBF283F7E0A851A0A651A861AAABFB0EF8CA61AC9FFFFF07B38ADE601FD300F38FDD80E38EDC60C306A4A4A85170A38FF40427E38FFF0427E30594AC5119054A51738FFA0437E0A38FF98427E38FF48437E30054AC511B03B18ADE4017D800E38FD280E38EDC40C1004386A386A4A4A851438FF40427E187F48437E3016C50E9012A514187FF0427E38FF98427E3014C50E9010888830034CD8BCADDA013003205BBE60ADDA013013DF283F7ED008ECDE01D0034C38BEDA205BBEFA38A514E50E8DE00138A517E5118DE201BF283F7E8DDA018EDE01BD5814290300C90300D016BD0A15A21800DF009780F004CACA10F6BF829780800EADDA010A851A0A651AAABFB0EF8C85004820DDFA186918004A4A4A850438A91E00E5048500A917008502A903008506A9000885082063F9A5008DDC016885022069FE6038A514EDE001C9FF00B014EB8DD40138A517EDE201C9FF00B005EB8DD60160205BBE60ADDC018500203EFAA9FFFF8DDA018DDE0160ADD801D0034C36BFADCA01EB290F004AAAB01B4A9030ADD0013003A90000E93000C900FDB003A900FD8DD001801BADD0011003A90000692F00C900039003A900038DD00180039CD0018A4A4AB01B4A9030ADD2013003A90000E93000C900FDB003A900FD8DD201801BADD2011003A90000692F00C900039003A900038DD20180039CD20118ADD4016DD001C90003B003A90003C901EF9003A900EF8DD40118ADD6016DD201C90003B003A90003C901CE9003A900CE8DD601ADCA01EB290F00F009ADDA013003205BBE6020BEBC60',
    },
    {
      start: 0x80fadd,
      hex: 'A9FF9D85D0A5001002E6D009008085CF64BA9C0602C220A90000AA2204AF819002E8E8BF00809D10F1297F7F85D22900FFEBE220C90AF010202AFBA5D2F0D6C90AF005202AFB80CDC220A5BA60',
    },
    { start: 0x80fb2a, hex: 'AA18BF0CAC81C22065BA85BAE22060', initialM: 1, finalM: 1 },
    { start: 0x81aeb0, hex: '9C00022292AD816B' },
  ],
  externalReturns: [
    [
      0x81b0a1,
      'RTL',
      'frame counter wait, waitForRandomStateChange in src/system/native-frame-wait.mjs',
    ],
    [0x809e1a, 'RTS', 'joypad, readInput in src/system/native-input-apu.mjs (reset path taskStop)'],
    [
      0x80bcb2,
      'RTS',
      'glove off, putGloveAway in src/system/native-dialog-portrait.mjs (tools/task-native-936c-source.mjs, group bcb2)',
    ],
    [0x80fec1, 'RTS', 'notice window, showNotice in proof/replay/native-notice.mjs'],
    [0x80f963, 'RTS', 'window allocation, openWindow in proof/replay/native-window-open.mjs'],
    [0x80fa3e, 'RTS', 'window release, releaseWindow in proof/system/native-render-compose.mjs'],
    [0x80fe69, 'RTS', 'text, printText in proof/replay/native-text-compose.mjs'],
    [0x81af04, 'RTL', 'text bit stream, readTextBit in src/system/native-text-prerequisites.mjs'],
    [0x81ad92, 'RTL', 'window list, drawWindowList in proof/system/native-render-compose.mjs'],
  ],
  scope:
    'Original NativeD8 9BC6 own code with external returns into the separately proved wait, input, window, text and list graphs; equations in proof/replay/native-glove-target.mjs, differential check in tools/task-native-9bc6.test.mjs.',
  contract:
    '9C40: glove over player 0CC2 (BC67: 01D4/01D6, 01E4 = 600, 01E6 = C00, 01E8 = 01D8 = FFFF). Per frame B0A1, 9E1A, BE6D (velocity 01D0/01D2 +-30 to +-300 from the pad, position 01D4 in 0300..EF00 and 01D6 in 0300..CE00; at rest BCBE marks the first scene object 14B2 whose box contains the glove, name window over FADD/F963/FE69, moving releases it over BE5B) until 01CE AND C0C0. Marked object 01DE within 80 of the player (sum of x/z distances and height difference each below 81): result 01DE, else FFFF; too far opens notice FEC1 (0C x 3, 3C frames). BCB2, AEB0 (AD92) unless 1F62, 9E1A. 9BC6: nonnegative result becomes 150A+result in DP00. E0M0X0 D0 entry, return M0X0 with entry DBR.',
};

export const prove9BC6Source = (map, spec = native9BC6Spec) => proveExternalSource(map, spec);
export const emit9BC6Source = () => emitExternalSource(native9BC6Spec);

// NativeA6/8D0B (choose a target with the glove without distance checks, chooseObjectUnderGlove): own code at 8D0B with the
// shared 9BC6 windows BC67/BC36, BCBE/BE5B/BE6D and FADD/FB2A; without the notice or window list.
const [, , windowBC36, windowBCBE, windowFADD, windowFB2A] = native9BC6Spec.windows;
export const native8D0BSpec = {
  name: 'task-native-8d0b',
  entry: 0x808d0b,
  id: 0xa6,
  rootReturn: 'RTS',
  maximumLocalStackBytes: 10,
  instructions: 378,
  returns: ['80:8D32', '80:8D3E'],
  widthJoins: [0x80faf2],
  windows: [
    {
      start: 0x808d0b,
      hex: '2067BC22A1B081201A9E206DBEADCE0129C0C0F0EEADDA01300EADDE014820B2BC688500201A9E6020B2BCA9FFFF8500201A9E60',
    },
    windowBC36,
    windowBCBE,
    windowFADD,
    windowFB2A,
  ],
  externalReturns: native9BC6Spec.externalReturns.filter(
    ([target]) => ![0x80fec1, 0x81ad92].includes(target),
  ),
  scope:
    'Original NativeA6 8D0B own code with the glove windows of 9BC6 and external returns into the separately proved wait, input, window and text graphs; equations in proof/replay/native-glove-target.mjs, differential check in tools/task-native-9bc6.test.mjs.',
  contract:
    '8D0B: BC67, then per frame B0A1, 9E1A, BE6D until 01CE AND C0C0. Marked object 01DA nonnegative: 01DE (PHA), BCB2, PLA to DP00, 9E1A; else BCB2, DP00 = FFFF, 9E1A. E0M0X0 D0 entry, returns M0X0 with entry DBR.',
};
export const prove8D0BSource = (map, spec = native8D0BSpec) => proveExternalSource(map, spec);
export const emit8D0BSource = () => emitExternalSource(native8D0BSpec);

// NativeBD/9BD3 (choose a target with the magic glove) and NativeC1/9C33 (9C40 with marker 1D6D): separate windows plus the
// shared 9BC6 windows; 9BD3 uses BC36 without BC67 and BC99, plus 81:AEB8 (A9B2, ACB5).
const [, , , , , , windowAEB0] = native9BC6Spec.windows;
const windowBC36Only = {
  start: 0x80bc36,
  hex: 'ACC20C38A9000CF9300FF9D80EEDC60CE948004A4AEB8DD60118A9000679800E38F9280EEDC40CE910004A4AEB8DD40160',
};
export const native9BD3Spec = {
  name: 'task-native-9bd3',
  entry: 0x809bd3,
  id: 0xbd,
  rootReturn: 'RTS',
  maximumLocalStackBytes: 10,
  instructions: 402,
  returns: ['80:9C1A', '80:9C32'],
  widthJoins: [0x80faf2],
  windows: [
    {
      start: 0x809bd3,
      hex: 'AD621FF00320C59222B8AE812099BC22A1B081201A9E206DBEADCE0129C0C0F0EEADDA013022AEDE01BD581410E1AD621FD00422B0AE81ADDE018DD21F4820B2BC688500201A9E6020B2BCAD621FD00422B0AE81A9FFFF8DD21F8500201A9E60',
    },
    windowBC36Only,
    { start: 0x80bc99, hex: '2036BCA900068DE401A9000C8DE601A9FDFF8DE8018DD80160' },
    windowBCBE,
    windowFADD,
    windowFB2A,
    windowAEB0,
    { start: 0x81aeb8, hex: '22B2A98122B5AC81AD04021A8D00026B' },
  ],
  externalReturns: [
    ...native9BC6Spec.externalReturns.filter(([target]) => target !== 0x80fec1),
    [
      0x8092c5,
      'RTS',
      'dialog close, 92C5 in proof/replay/native-dialog.mjs (tools/task-native-936c-source.mjs)',
    ],
    [0x81a9b2, 'RTL', 'list conversion, unpackWindowMap in src/system/native-render-unpack.mjs'],
    [
      0x81acb5,
      'RTL',
      'list transfer with wait, requestTextMapUpload in proof/system/native-render-compose.mjs',
    ],
  ],
  scope:
    'Original NativeBD 9BD3 own code with the glove windows of 9BC6, BC99 and 81:AEB8; external returns into the proved dialog, wait, input, window, text and list graphs; equations in proof/replay/native-glove-target.mjs, differential check in tools/task-native-9bc6.test.mjs.',
  contract:
    '1F62 set: JSR 92C5. JSL 81:AEB8 (A9B2, ACB5, 0200 = 0204 + 1), BC99 (spell glove, 01E8 = 01D8 = FFFD). Per frame B0A1, 9E1A, BE6D until 01CE AND C0C0; a marked object without bit 15 in 1458 continues the loop. Object: AEB0 unless 1F62, 01DE to 1FD2 and DP00, BCB2 in between; none: BCB2, AEB0 unless 1F62, FFFF to 1FD2 and DP00; 9E1A. E0M0X0 D0 entry, returns M0X0 with entry DBR.',
};
export const native9C33Spec = {
  name: 'task-native-9c33',
  entry: 0x809c33,
  id: 0xc1,
  rootReturn: 'RTS',
  maximumLocalStackBytes: 12,
  instructions: 433,
  returns: ['80:9C3F'],
  widthJoins: [0x80faf2],
  windows: [
    { start: 0x809c33, hex: 'A9FFFF8D6D1D20409C9C6D1D60' },
    ...native9BC6Spec.windows.slice(1),
  ],
  externalReturns: native9BC6Spec.externalReturns,
  scope:
    'Original NativeC1 9C33 own code around the proved 9C40 of 9BC6; equations in proof/replay/native-glove-target.mjs, differential check in tools/task-native-9bc6.test.mjs.',
  contract:
    '1D6D = FFFF, JSR 9C40 (glove selection of 9BC6, result DP00), STZ 1D6D. E0M0X0 D0 entry, return M0X0 with entry DBR.',
};
export const prove9BD3Source = (map, spec = native9BD3Spec) => proveExternalSource(map, spec);
export const prove9C33Source = (map, spec = native9C33Spec) => proveExternalSource(map, spec);
export const emit9BD3Sources = async () => {
  for (const spec of [native9BD3Spec, native9C33Spec, native9BB9Spec])
    await emitExternalSource(spec);
};
// Native8F/9BB9: 9BC6 with marker 1D6D (all 9BC6 windows plus its own frame).
export const native9BB9Spec = {
  name: 'task-native-9bb9',
  entry: 0x809bb9,
  id: 0x8f,
  rootReturn: 'RTS',
  maximumLocalStackBytes: 14,
  instructions: 439,
  returns: ['80:9BC5'],
  widthJoins: [0x80faf2],
  windows: [{ start: 0x809bb9, hex: 'A9FFFF8D6D1D20C69B9C6D1D60' }, ...native9BC6Spec.windows],
  externalReturns: native9BC6Spec.externalReturns,
  scope:
    'Original Native8F 9BB9 own code around the proved 9BC6; equations in proof/replay/native-glove-target.mjs, differential check in tools/task-native-9bc6.test.mjs.',
  contract:
    '1D6D = FFFF, JSR 9BC6 (glove selection, object number or FFFF in DP00), STZ 1D6D. E0M0X0 D0 entry, return M0X0 with entry DBR.',
};
export const prove9BB9Source = (map, spec = native9BB9Spec) => proveExternalSource(map, spec);
// NativeA8/C724: locate with the action glove (BC67, BE6D, AEB8/AEB0, BCB2); the BRA at C727 skips C729.
export const nativeC724Spec = {
  name: 'task-native-c724',
  entry: 0x80c724,
  id: 0xa8,
  rootReturn: 'RTS',
  maximumLocalStackBytes: 12,
  instructions: 421,
  returns: ['80:C79B'],
  widthJoins: [0x80faf2],
  windows: [
    { start: 0x80c724, hex: 'A900008003' },
    {
      start: 0x80c72c,
      hex: 'A600DA9F38417E22B8AE812067BC22A1B081201A9E206DBEADCE0129C0C0F0EE22B0AE81ADD4014A4A4A4A4A4A85A84A85A2ADD6014A4A4A4A4A4A85A5FAA900091865A238EDC60CE5A5FDD80E0A186DC40C4A9FE8417E1869000638E5A8EDC40C9F90417EA901009FE0407E20B2BC60',
    },
    windowBC36,
    windowBCBE,
    windowFADD,
    windowFB2A,
    windowAEB0,
    { start: 0x81aeb8, hex: '22B2A98122B5AC81AD04021A8D00026B' },
  ],
  externalReturns: [
    ...native9BC6Spec.externalReturns.filter(([target]) => target !== 0x80fec1),
    [0x81a9b2, 'RTL', 'list conversion, unpackWindowMap in src/system/native-render-unpack.mjs'],
    [
      0x81acb5,
      'RTL',
      'list transfer with wait, requestTextMapUpload in proof/system/native-render-compose.mjs',
    ],
  ],
  scope:
    'Original NativeA8 C724 own code with the glove windows of 9BC6 and 81:AEB8; external returns into the proved wait, input, window, text and list graphs; equations in proof/replay/native-glove-target.mjs, differential check in tools/task-native-9bc6.test.mjs.',
  contract:
    '7E4138+DP00 = 0, JSL 81:AEB8, BC67, per frame B0A1, 9E1A, BE6D until 01CE AND C0C0; JSL 81:AEB0; record 7E41E8/7E4190 from the glove 01D4/01D6 and camera 0CC4/0CC6, 7E40E0 = 1; BCB2. E0M0X0 D0 entry, return M0X0 with entry DBR. No result word.',
};
export const proveC724Source = (map, spec = nativeC724Spec) => proveExternalSource(map, spec);
export const emitC724Source = () => emitExternalSource(nativeC724Spec);
