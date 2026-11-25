import { nativeCB4DSpec } from './task-native-cb4d-spec.mjs';
import { nativeCDB2Spec } from './task-native-cdb2-spec.mjs';
import { nativeCBCBSpec } from './task-native-cbcb-spec.mjs';
import { nativeCB3CSpec, native9DECSpec } from './task-native-tier-specs.mjs';
import { nativeAAAFSpec } from './task-native-aaaf-spec.mjs';
import { nextLeafSpecs } from './task-native-next-specs.mjs';
import { nativeD15CSpec } from './task-native-d15c-spec.mjs';
import { nativeCB06Spec } from './task-native-cb06-spec.mjs';
import { nativeCCA4Spec } from './task-native-cca4-spec.mjs';
import { fieldLeafSpecs } from './task-native-field-specs.mjs';
import { createNativeSpec } from './task-native-create-spec.mjs';
import { smallFamilySpecs } from './task-native-small-specs.mjs';
import { m1dLeafSpecs } from './task-native-m1d-specs.mjs';
// Exact original source bytes and Native58 table anchors, reviewed against listings.
export const taskLeafSpecs = [
  nativeCBCBSpec,
  nativeCDB2Spec,
  nativeCB4DSpec,
  nativeCB3CSpec,
  native9DECSpec,
  nativeAAAFSpec,
  ...nextLeafSpecs,
  nativeD15CSpec,
  nativeCB06Spec,
  nativeCCA4Spec,
  ...fieldLeafSpecs,
  createNativeSpec,
  ...smallFamilySpecs,
  ...m1dLeafSpecs,
  {
    name: 'native-ca3a',
    id: 2,
    entry: 8440378,
    windows: [
      {
        start: 8440378,
        hex: 'A400BEA813BF01007E29FF00850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574908,
        hex: '3ACA',
      },
      {
        kind: 'argument-metadata',
        start: 8575566,
        hex: '0102',
      },
      {
        kind: 'return-metadata',
        start: 8575346,
        hex: '0200',
      },
    ],
    contract:
      'Read full recordWORD at offset1, maskLow after both bytes, store DP00. Y fromDP00, full X from actualDBR13A8+Y.',
  },
  {
    name: 'native-cc26',
    id: 3,
    entry: 8440870,
    windows: [
      {
        start: 8440870,
        hex: 'A600BFBB3B7E25029FBB3B7E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574910,
        hex: '26CC',
      },
      {
        kind: 'argument-metadata',
        start: 8575567,
        hex: '0203',
      },
      {
        kind: 'return-metadata',
        start: 8575347,
        hex: '0000',
      },
    ],
    contract: 'Full DP00 index; WORD AND of7E3BBB+X with freshDP02, store original long address.',
  },
  {
    name: 'native-d97c',
    id: 5,
    entry: 8444284,
    windows: [
      {
        start: 8444284,
        hex: 'A50029FE018D411D60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574914,
        hex: '7CD9',
      },
      {
        kind: 'argument-metadata',
        start: 8575569,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575349,
        hex: '0002',
      },
    ],
    contract: 'Full DP00 masked01FE to actualDBR1D41, Carry/V retained.',
  },
  {
    name: 'native-ca2b',
    id: 6,
    entry: 8440363,
    windows: [
      {
        start: 8440363,
        hex: 'A400BEA813BF00007E29FF00850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574916,
        hex: '2BCA',
      },
      {
        kind: 'argument-metadata',
        start: 8575570,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575350,
        hex: '0202',
      },
    ],
    contract:
      'Read full recordWORD at offset0, maskLow after both bytes, storeDP00; fresh actualDBR table.',
  },
  {
    name: 'native-ca58',
    id: 12,
    entry: 8440408,
    windows: [
      {
        start: 8440408,
        hex: 'A400BEA813BF03007E850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574928,
        hex: '58CA',
      },
      {
        kind: 'argument-metadata',
        start: 8575576,
        hex: '0102',
      },
      {
        kind: 'return-metadata',
        start: 8575356,
        hex: '0200',
      },
    ],
    contract:
      'Read full recordWORD at offset3 without mask, writeDP00; low/high record bytes required.',
  },
  {
    name: 'native-d9a0',
    id: 17,
    entry: 8444320,
    windows: [
      {
        start: 8444320,
        hex: 'A9FFFF8DDA1F60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574938,
        hex: 'A0D9',
      },
      {
        kind: 'argument-metadata',
        start: 8575581,
        hex: '0002',
      },
      {
        kind: 'return-metadata',
        start: 8575361,
        hex: '0000',
      },
    ],
    contract: 'WORDFFFF to actualDBR1FDA; actual AFFFF/N1/Z0, other observed registers retained.',
  },
  {
    name: 'native-8afa',
    id: 20,
    entry: 8424186,
    windows: [
      {
        start: 8424186,
        hex: 'A60018BFF8437E65029FF8437E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574944,
        hex: 'FA8A',
      },
      {
        kind: 'argument-metadata',
        start: 8575584,
        hex: '0202',
      },
      {
        kind: 'return-metadata',
        start: 8575364,
        hex: '0000',
      },
    ],
    contract: 'CLC/fresh WORD7E43F8+X andDP02 binary ADC; actual C/V/N/Z, low/high store.',
  },
  {
    name: 'native-d997',
    id: 22,
    entry: 8444311,
    windows: [
      {
        start: 8444311,
        hex: 'A50029FE018D471D60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574948,
        hex: '97D9',
      },
      {
        kind: 'argument-metadata',
        start: 8575586,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575366,
        hex: '0002',
      },
    ],
    contract: 'FullDP00 mask01FE to actualDBR1D47; Carry/V retained.',
  },
  {
    name: 'native-d622',
    id: 24,
    entry: 8443426,
    windows: [
      {
        start: 8443426,
        hex: '9C311DA964008D331DA20000A980019DEF1CE8E8E02000D0F660',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574952,
        hex: '22D6',
      },
      {
        kind: 'argument-metadata',
        start: 8575588,
        hex: '0001',
      },
      {
        kind: 'return-metadata',
        start: 8575368,
        hex: '0002',
      },
    ],
    contract:
      'Zero1D31, WORD100 to1D33, sixteen unaligned WORD0180 stores at actualDBR1CEF+X forX0..30. X32/C1/N0/Z1 from finalCPX, A0180.',
  },
  {
    name: 'native-caf2',
    id: 25,
    entry: 8440562,
    windows: [
      {
        start: 8440562,
        hex: 'A600BF22B08D0A85000A6500AABFB2EF8C850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574954,
        hex: 'F2CA',
      },
      {
        kind: 'argument-metadata',
        start: 8575589,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575369,
        hex: '0200',
      },
    ],
    contract:
      'Fresh8DB022+X, ASL/DP00store, ASL thenADC freshDP00 with actual Carry. FullX8CEFB2+X thenDP00store, no inferred multiply6 shortcut.',
  },
  {
    name: 'native-d0fc',
    id: 31,
    entry: 8442108,
    windows: [
      {
        start: 8442108,
        hex: 'A600BF22B08D850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574966,
        hex: 'FCD0',
      },
      {
        kind: 'argument-metadata',
        start: 8575595,
        hex: '0100',
      },
      {
        kind: 'return-metadata',
        start: 8575375,
        hex: '0200',
      },
    ],
    contract: 'FullDP00 index, fullWORD8DB022+X toDP00; ignored-looking high is actual value.',
  },
  {
    name: 'native-8af1',
    id: 36,
    entry: 8424177,
    windows: [
      {
        start: 8424177,
        hex: 'A600A5029FF8437E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574976,
        hex: 'F18A',
      },
      {
        kind: 'argument-metadata',
        start: 8575600,
        hex: '0202',
      },
      {
        kind: 'return-metadata',
        start: 8575380,
        hex: '0000',
      },
    ],
    contract: 'FullDP00 index and freshDP02 WORD to7E43F8+X; destination not read.',
  },
  {
    name: 'native-c6f3',
    id: 37,
    entry: 8439539,
    windows: [
      {
        start: 8439539,
        hex: 'A900008003',
      },
      {
        start: 8439547,
        hex: 'A6009F38417EA900009F90417EA5029FE8417EA901009FE0407E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574978,
        hex: 'F3C6',
      },
      {
        kind: 'argument-metadata',
        start: 8575601,
        hex: '0202',
      },
      {
        kind: 'return-metadata',
        start: 8575381,
        hex: '0000',
      },
    ],
    contract:
      'Original backward/shared reset tail: zero4138 and4190, freshDP02 to41E8 then1 to40E0; fullX retained.',
  },
  {
    name: 'native-c79c',
    id: 47,
    entry: 8439708,
    windows: [
      {
        start: 8439708,
        hex: 'A900008003',
      },
      {
        start: 8439716,
        hex: 'A6009F38417EA5020A0A9F90417EA5040A0A9FE8417EA901009FE0407E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8574998,
        hex: '9CC7',
      },
      {
        kind: 'argument-metadata',
        start: 8575611,
        hex: '0302',
      },
      {
        kind: 'return-metadata',
        start: 8575391,
        hex: '0000',
      },
    ],
    contract:
      'Zero4138; freshDP02/DP04 two WORDASLs each to4190/41E8, then1 to40E0. Carry from second DP04 ASL remains.',
  },
  {
    name: 'native-8b08',
    id: 48,
    entry: 8424200,
    windows: [
      {
        start: 8424200,
        hex: 'A60038BFF8437EE5029FF8437E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575000,
        hex: '088B',
      },
      {
        kind: 'argument-metadata',
        start: 8575612,
        hex: '0201',
      },
      {
        kind: 'return-metadata',
        start: 8575392,
        hex: '0000',
      },
    ],
    contract:
      'SEC then binary fullWORD7E43F8+X minus freshDP02, actual C/V/N/Z; no conventional clamp.',
  },
  {
    name: 'native-ca0d',
    id: 63,
    entry: 8440333,
    windows: [
      {
        start: 8440333,
        hex: 'A600A5029D581460',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575030,
        hex: '0DCA',
      },
      {
        kind: 'argument-metadata',
        start: 8575627,
        hex: '0201',
      },
      {
        kind: 'return-metadata',
        start: 8575407,
        hex: '0002',
      },
    ],
    contract: 'FullXDP00 and freshDP02 to actualDBR1458+X WORD; bank crossing preserved.',
  },
  {
    name: 'native-c9f1',
    id: 64,
    entry: 8440305,
    windows: [
      {
        start: 8440305,
        hex: 'A600BF283F7E0A85000A6500AABFB2EF8C850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575032,
        hex: 'F1C9',
      },
      {
        kind: 'argument-metadata',
        start: 8575628,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575408,
        hex: '0202',
      },
    ],
    contract:
      'Fresh7E3F28+X WORD ASL ->DP00, secondASL and ADC freshDP00 with actualCarry, fullX8CEFB2+X WORD toDP00. Binary required.',
  },
  {
    name: 'native-a941',
    id: 68,
    entry: 8431937,
    windows: [
      {
        start: 8431937,
        hex: 'A600BD200D850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575040,
        hex: '41A9',
      },
      {
        kind: 'argument-metadata',
        start: 8575632,
        hex: '0100',
      },
      {
        kind: 'return-metadata',
        start: 8575412,
        hex: '0200',
      },
    ],
    contract: 'FullDP00 X, actualDBR0D20+X fullWORD toDP00; physical high byte mandatory.',
  },
  {
    name: 'native-a949',
    id: 70,
    entry: 8431945,
    windows: [
      {
        start: 8431945,
        hex: 'A600BD780D850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575044,
        hex: '49A9',
      },
      {
        kind: 'argument-metadata',
        start: 8575634,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575414,
        hex: '0202',
      },
    ],
    contract: 'FullDP00 X, actualDBR0D78+X fullWORD toDP00.',
  },
  {
    name: 'native-a951',
    id: 71,
    entry: 8431953,
    windows: [
      {
        start: 8431953,
        hex: 'A600BDD00D850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575046,
        hex: '51A9',
      },
      {
        kind: 'argument-metadata',
        start: 8575635,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575415,
        hex: '0202',
      },
    ],
    contract: 'FullDP00 X, actualDBR0DD0+X fullWORD toDP00.',
  },
  {
    name: 'native-d0d3',
    id: 73,
    entry: 8442067,
    windows: [
      {
        start: 8442067,
        hex: 'A400B95814890008D01E890002D00DB9001429FE7F09010099001460B9001429FE7F09018099001460',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575050,
        hex: 'D3D0',
      },
      {
        kind: 'argument-metadata',
        start: 8575637,
        hex: '0100',
      },
      {
        kind: 'return-metadata',
        start: 8575417,
        hex: '0002',
      },
    ],
    contract:
      'FullYDP00, actualDBR1458+Y WORD; immediate BIT0800 sets onlyZ and gates write. BIT0200 sets onlyZ then fresh1400+Y AND7FFE OR0001/8001. Gate preserves A/N/V/C.',
  },
];
