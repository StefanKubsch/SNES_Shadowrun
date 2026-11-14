import { childParentAddBodySpecs } from './script-body-child-parent-add-specs.mjs';
// Own original parent/child source pins.
import { childInputBodySpecs } from './script-body-child-input-specs.mjs';
import { childMenuBodySpecs } from './script-body-child-menu-specs.mjs';
import { childCountdownBodySpecs } from './script-body-child-countdown-specs.mjs';
import { childPropertyBodySpecs } from './script-body-child-property-specs.mjs';
import { childParentWaitBodySpecs } from './script-body-child-parent-wait-specs.mjs';
import { childParentAliasBodySpecs } from './script-body-child-parent-alias-specs.mjs';
export const childBodySpecs = [
  {
    id: 445,
    scriptEntry: 10210892,
    argumentBytes: 0,
    returnBytes: 0,
    header: [0, 4],
    bytecode: [
      20, 82, 25, 88, 205, 20, 178, 8, 176, 68, 19, 0, 0, 182, 88, 154, 72, 34, 0, 0, 181, 88, 154,
      82, 75, 0, 20, 178, 8, 20, 0, 0, 88, 116, 86,
    ],
    fetchTail: 0,
    sourceHash: '1a29bd0d35838f8de4d2af9669e2aa14217684036255e7ace480b8bee35581a6',
    instructions: [
      {
        pc: 0,
        opcode: 20,
        operand: 6482,
        length: 3,
        flow: 'next',
      },
      {
        pc: 3,
        opcode: 88,
        operand: 205,
        length: 2,
        flow: 'next',
      },
      {
        pc: 5,
        opcode: 20,
        operand: 2226,
        length: 3,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 176,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 9,
        opcode: 68,
        operand: 19,
        length: 3,
        flow: 'conditional',
      },
      {
        pc: 12,
        opcode: 0,
        operand: 182,
        length: 2,
        flow: 'next',
      },
      {
        pc: 14,
        opcode: 88,
        operand: 154,
        length: 2,
        flow: 'next',
      },
      {
        pc: 16,
        opcode: 72,
        operand: 34,
        length: 3,
        flow: 'jump',
      },
      {
        pc: 19,
        opcode: 0,
        operand: 181,
        length: 2,
        flow: 'next',
      },
      {
        pc: 21,
        opcode: 88,
        operand: 154,
        length: 2,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 82,
        operand: 75,
        length: 3,
        flow: 'next',
      },
      {
        pc: 26,
        opcode: 20,
        operand: 2226,
        length: 3,
        flow: 'next',
      },
      {
        pc: 29,
        opcode: 20,
        operand: 0,
        length: 3,
        flow: 'next',
      },
      {
        pc: 32,
        opcode: 88,
        operand: 116,
        length: 2,
        flow: 'next',
      },
      {
        pc: 34,
        opcode: 86,
        operand: null,
        length: 1,
        flow: 'end',
      },
    ],
    edges: [
      {
        from: 0,
        to: 3,
        kind: 'fallthrough',
      },
      {
        from: 3,
        to: 5,
        kind: 'fallthrough',
      },
      {
        from: 5,
        to: 8,
        kind: 'fallthrough',
      },
      {
        from: 8,
        to: 9,
        kind: 'fallthrough',
      },
      {
        from: 9,
        to: 19,
        kind: 'conditional',
      },
      {
        from: 9,
        to: 12,
        kind: 'fallthrough',
      },
      {
        from: 12,
        to: 14,
        kind: 'fallthrough',
      },
      {
        from: 14,
        to: 16,
        kind: 'fallthrough',
      },
      {
        from: 16,
        to: 34,
        kind: 'jump',
      },
      {
        from: 19,
        to: 21,
        kind: 'fallthrough',
      },
      {
        from: 21,
        to: 23,
        kind: 'fallthrough',
      },
      {
        from: 23,
        to: 26,
        kind: 'fallthrough',
      },
      {
        from: 26,
        to: 29,
        kind: 'fallthrough',
      },
      {
        from: 29,
        to: 32,
        kind: 'fallthrough',
      },
      {
        from: 32,
        to: 34,
        kind: 'fallthrough',
      },
    ],
    romReads: [
      {
        address: 8439019,
        value: 31,
      },
      {
        address: 8444706,
        value: 33284,
      },
      {
        address: 8444708,
        value: 33375,
      },
      {
        address: 8498220,
        value: 518,
      },
      {
        address: 8498221,
        value: 1026,
      },
      {
        address: 8498227,
        value: 771,
      },
      {
        address: 8498232,
        value: 1027,
      },
      {
        address: 8498234,
        value: 1538,
      },
      {
        address: 8498251,
        value: 1542,
      },
      {
        address: 8498253,
        value: 1542,
      },
      {
        address: 8498256,
        value: 1542,
      },
      {
        address: 8498257,
        value: 1542,
      },
      {
        address: 8498262,
        value: 1542,
      },
      {
        address: 8498272,
        value: 1542,
      },
      {
        address: 8498275,
        value: 1542,
      },
      {
        address: 8498277,
        value: 1542,
      },
      {
        address: 8498285,
        value: 1542,
      },
      {
        address: 8498286,
        value: 1542,
      },
      {
        address: 8498287,
        value: 1542,
      },
      {
        address: 8498288,
        value: 1542,
      },
      {
        address: 8498289,
        value: 1286,
      },
      {
        address: 8498291,
        value: 1542,
      },
      {
        address: 8498292,
        value: 774,
      },
      {
        address: 8498293,
        value: 1027,
      },
      {
        address: 8498295,
        value: 773,
      },
      {
        address: 8498296,
        value: 1539,
      },
      {
        address: 8498297,
        value: 1542,
      },
      {
        address: 8498298,
        value: 1542,
      },
      {
        address: 8498299,
        value: 1542,
      },
      {
        address: 8498300,
        value: 1542,
      },
      {
        address: 8498302,
        value: 1541,
      },
      {
        address: 8498303,
        value: 1286,
      },
      {
        address: 8498304,
        value: 1541,
      },
      {
        address: 8498305,
        value: 1542,
      },
      {
        address: 8498306,
        value: 1542,
      },
      {
        address: 8498307,
        value: 1542,
      },
      {
        address: 8498309,
        value: 1542,
      },
      {
        address: 8498310,
        value: 1030,
      },
      {
        address: 8498329,
        value: 771,
      },
      {
        address: 8498337,
        value: 49152,
      },
      {
        address: 8498339,
        value: 57344,
      },
      {
        address: 8498343,
        value: 63488,
      },
      {
        address: 8498345,
        value: 64512,
      },
      {
        address: 8575859,
        value: 33667,
      },
      {
        address: 8576871,
        value: 64865,
      },
      {
        address: 8578670,
        value: 0,
      },
      {
        address: 8579607,
        value: 2048,
      },
      {
        address: 8650081,
        value: 2048,
      },
      {
        address: 8650082,
        value: 8,
      },
      {
        address: 9285664,
        value: 15191,
      },
      {
        address: 9292146,
        value: 12076,
      },
      {
        address: 9827280,
        value: 0,
      },
      {
        address: 9827281,
        value: 0,
      },
      {
        address: 9827282,
        value: 0,
      },
      {
        address: 9827283,
        value: 0,
      },
      {
        address: 9827284,
        value: 0,
      },
      {
        address: 9827285,
        value: 0,
      },
      {
        address: 9827286,
        value: 0,
      },
      {
        address: 9827287,
        value: 0,
      },
      {
        address: 9827288,
        value: 256,
      },
      {
        address: 9827289,
        value: 257,
      },
      {
        address: 9827290,
        value: 257,
      },
      {
        address: 9827291,
        value: 1,
      },
      {
        address: 9827292,
        value: 256,
      },
      {
        address: 9827293,
        value: 1,
      },
      {
        address: 9827294,
        value: 0,
      },
      {
        address: 9827295,
        value: 0,
      },
      {
        address: 9827336,
        value: 259,
      },
      {
        address: 9827337,
        value: 513,
      },
      {
        address: 9827338,
        value: 2,
      },
      {
        address: 9827339,
        value: 0,
      },
      {
        address: 9827340,
        value: 0,
      },
      {
        address: 9827341,
        value: 0,
      },
      {
        address: 9827342,
        value: 0,
      },
      {
        address: 9827343,
        value: 256,
      },
      {
        address: 9827376,
        value: 0,
      },
      {
        address: 9827377,
        value: 0,
      },
      {
        address: 9827378,
        value: 0,
      },
      {
        address: 9827379,
        value: 0,
      },
      {
        address: 9827380,
        value: 256,
      },
      {
        address: 9827381,
        value: 513,
      },
      {
        address: 9827382,
        value: 2,
      },
      {
        address: 9827383,
        value: 0,
      },
      {
        address: 9827392,
        value: 0,
      },
      {
        address: 9827393,
        value: 0,
      },
      {
        address: 9827394,
        value: 0,
      },
      {
        address: 9827395,
        value: 0,
      },
      {
        address: 9827396,
        value: 256,
      },
      {
        address: 9827397,
        value: 1,
      },
      {
        address: 9827398,
        value: 0,
      },
      {
        address: 9827399,
        value: 0,
      },
      {
        address: 9827528,
        value: 3584,
      },
      {
        address: 9827529,
        value: 4366,
      },
      {
        address: 9827530,
        value: 1553,
      },
      {
        address: 9827531,
        value: 6,
      },
      {
        address: 9827532,
        value: 1024,
      },
      {
        address: 9827533,
        value: 4,
      },
      {
        address: 9827534,
        value: 0,
      },
      {
        address: 9827535,
        value: 0,
      },
      {
        address: 9827544,
        value: 4366,
      },
      {
        address: 9827545,
        value: 4369,
      },
      {
        address: 9827546,
        value: 7953,
      },
      {
        address: 9827547,
        value: 4383,
      },
      {
        address: 9827548,
        value: 4369,
      },
      {
        address: 9827549,
        value: 17,
      },
      {
        address: 9827550,
        value: 0,
      },
      {
        address: 9827551,
        value: 7680,
      },
      {
        address: 9827568,
        value: 4636,
      },
      {
        address: 9827569,
        value: 4370,
      },
      {
        address: 9827570,
        value: 4369,
      },
      {
        address: 9827571,
        value: 4369,
      },
      {
        address: 9827572,
        value: 7697,
      },
      {
        address: 9827573,
        value: 30,
      },
      {
        address: 9827574,
        value: 0,
      },
      {
        address: 9827575,
        value: 7936,
      },
      {
        address: 9827576,
        value: 4127,
      },
      {
        address: 9827577,
        value: 7696,
      },
      {
        address: 9827578,
        value: 4126,
      },
      {
        address: 9827579,
        value: 4112,
      },
      {
        address: 9827580,
        value: 7952,
      },
      {
        address: 9827581,
        value: 31,
      },
      {
        address: 9827582,
        value: 0,
      },
      {
        address: 9827583,
        value: 7936,
      },
      {
        address: 9827616,
        value: 259,
      },
      {
        address: 9827617,
        value: 257,
      },
      {
        address: 9827618,
        value: 257,
      },
      {
        address: 9827619,
        value: 4353,
      },
      {
        address: 9827620,
        value: 3601,
      },
      {
        address: 9827621,
        value: 14,
      },
      {
        address: 9827622,
        value: 0,
      },
      {
        address: 9827623,
        value: 4352,
      },
      {
        address: 9827696,
        value: 1055,
      },
      {
        address: 9827697,
        value: 1028,
      },
      {
        address: 9827698,
        value: 1028,
      },
      {
        address: 9827699,
        value: 1028,
      },
      {
        address: 9827700,
        value: 1028,
      },
      {
        address: 9827701,
        value: 4,
      },
      {
        address: 9827702,
        value: 0,
      },
      {
        address: 9827703,
        value: 4352,
      },
      {
        address: 9827720,
        value: 4369,
      },
      {
        address: 9827721,
        value: 4369,
      },
      {
        address: 9827722,
        value: 5393,
      },
      {
        address: 9827723,
        value: 6933,
      },
      {
        address: 9827724,
        value: 4379,
      },
      {
        address: 9827725,
        value: 17,
      },
      {
        address: 9827726,
        value: 0,
      },
      {
        address: 9827727,
        value: 4352,
      },
      {
        address: 9827736,
        value: 4369,
      },
      {
        address: 9827737,
        value: 2577,
      },
      {
        address: 9827738,
        value: 1034,
      },
      {
        address: 9827739,
        value: 1028,
      },
      {
        address: 9827740,
        value: 1028,
      },
      {
        address: 9827741,
        value: 4,
      },
      {
        address: 9827742,
        value: 0,
      },
      {
        address: 9827743,
        value: 7936,
      },
      {
        address: 9827800,
        value: 3584,
      },
      {
        address: 9827801,
        value: 270,
      },
      {
        address: 9827802,
        value: 3841,
      },
      {
        address: 9827803,
        value: 4367,
      },
      {
        address: 9827804,
        value: 3857,
      },
      {
        address: 9827805,
        value: 15,
      },
      {
        address: 9827806,
        value: 0,
      },
      {
        address: 9827807,
        value: 4096,
      },
      {
        address: 9827808,
        value: 5648,
      },
      {
        address: 9827809,
        value: 6422,
      },
      {
        address: 9827810,
        value: 4377,
      },
      {
        address: 9827811,
        value: 4369,
      },
      {
        address: 9827812,
        value: 7697,
      },
      {
        address: 9827813,
        value: 30,
      },
      {
        address: 9827814,
        value: 0,
      },
      {
        address: 9827815,
        value: 0,
      },
      {
        address: 9827816,
        value: 3584,
      },
      {
        address: 9827817,
        value: 4366,
      },
      {
        address: 9827818,
        value: 4113,
      },
      {
        address: 9827819,
        value: 4112,
      },
      {
        address: 9827820,
        value: 3856,
      },
      {
        address: 9827821,
        value: 15,
      },
      {
        address: 9827822,
        value: 0,
      },
      {
        address: 9827823,
        value: 256,
      },
      {
        address: 9827824,
        value: 3329,
      },
      {
        address: 9827825,
        value: 4877,
      },
      {
        address: 9827826,
        value: 4371,
      },
      {
        address: 9827827,
        value: 4369,
      },
      {
        address: 9827828,
        value: 3857,
      },
      {
        address: 9827829,
        value: 15,
      },
      {
        address: 9827830,
        value: 0,
      },
      {
        address: 9827831,
        value: 0,
      },
      {
        address: 9827832,
        value: 3584,
      },
      {
        address: 9827833,
        value: 4366,
      },
      {
        address: 9827834,
        value: 7953,
      },
      {
        address: 9827835,
        value: 4127,
      },
      {
        address: 9827836,
        value: 3600,
      },
      {
        address: 9827837,
        value: 14,
      },
      {
        address: 9827838,
        value: 0,
      },
      {
        address: 9827839,
        value: 768,
      },
      {
        address: 9827848,
        value: 1792,
      },
      {
        address: 9827849,
        value: 2311,
      },
      {
        address: 9827850,
        value: 4361,
      },
      {
        address: 9827851,
        value: 4881,
      },
      {
        address: 9827852,
        value: 3347,
      },
      {
        address: 9827853,
        value: 269,
      },
      {
        address: 9827854,
        value: 3585,
      },
      {
        address: 9827855,
        value: 4110,
      },
      {
        address: 9827856,
        value: 5648,
      },
      {
        address: 9827857,
        value: 6422,
      },
      {
        address: 9827858,
        value: 4377,
      },
      {
        address: 9827859,
        value: 4369,
      },
      {
        address: 9827860,
        value: 4369,
      },
      {
        address: 9827861,
        value: 17,
      },
      {
        address: 9827862,
        value: 0,
      },
      {
        address: 9827863,
        value: 256,
      },
      {
        address: 9827864,
        value: 1,
      },
      {
        address: 9827865,
        value: 768,
      },
      {
        address: 9827866,
        value: 259,
      },
      {
        address: 9827867,
        value: 257,
      },
      {
        address: 9827868,
        value: 257,
      },
      {
        address: 9827869,
        value: 1,
      },
      {
        address: 9827870,
        value: 0,
      },
      {
        address: 9827871,
        value: 256,
      },
      {
        address: 9827880,
        value: 2312,
      },
      {
        address: 9827881,
        value: 2569,
      },
      {
        address: 9827882,
        value: 3082,
      },
      {
        address: 9827883,
        value: 2572,
      },
      {
        address: 9827884,
        value: 2314,
      },
      {
        address: 9827885,
        value: 9,
      },
      {
        address: 9827886,
        value: 0,
      },
      {
        address: 9827887,
        value: 768,
      },
      {
        address: 9827888,
        value: 259,
      },
      {
        address: 9827889,
        value: 257,
      },
      {
        address: 9827890,
        value: 257,
      },
      {
        address: 9827891,
        value: 257,
      },
      {
        address: 9827892,
        value: 257,
      },
      {
        address: 9827893,
        value: 1,
      },
      {
        address: 9827894,
        value: 0,
      },
      {
        address: 9827895,
        value: 0,
      },
      {
        address: 9827896,
        value: 4352,
      },
      {
        address: 9827897,
        value: 6929,
      },
      {
        address: 9827898,
        value: 5403,
      },
      {
        address: 9827899,
        value: 4373,
      },
      {
        address: 9827900,
        value: 4369,
      },
      {
        address: 9827901,
        value: 17,
      },
      {
        address: 9827902,
        value: 0,
      },
      {
        address: 9827903,
        value: 0,
      },
      {
        address: 9827904,
        value: 7168,
      },
      {
        address: 9827905,
        value: 4636,
      },
      {
        address: 9827906,
        value: 4370,
      },
      {
        address: 9827907,
        value: 4369,
      },
      {
        address: 9827908,
        value: 4369,
      },
      {
        address: 9827909,
        value: 17,
      },
      {
        address: 9827910,
        value: 0,
      },
      {
        address: 9827911,
        value: 0,
      },
      {
        address: 9827912,
        value: 3584,
      },
      {
        address: 9827913,
        value: 4366,
      },
      {
        address: 9827914,
        value: 4369,
      },
      {
        address: 9827915,
        value: 4369,
      },
      {
        address: 9827916,
        value: 3601,
      },
      {
        address: 9827917,
        value: 14,
      },
      {
        address: 9827918,
        value: 0,
      },
      {
        address: 9827919,
        value: 0,
      },
      {
        address: 9827920,
        value: 7168,
      },
      {
        address: 9827921,
        value: 4636,
      },
      {
        address: 9827922,
        value: 4370,
      },
      {
        address: 9827923,
        value: 4369,
      },
      {
        address: 9827924,
        value: 7697,
      },
      {
        address: 9827925,
        value: 4126,
      },
      {
        address: 9827926,
        value: 4112,
      },
      {
        address: 9827927,
        value: 16,
      },
      {
        address: 9827936,
        value: 2816,
      },
      {
        address: 9827937,
        value: 3083,
      },
      {
        address: 9827938,
        value: 2060,
      },
      {
        address: 9827939,
        value: 2056,
      },
      {
        address: 9827940,
        value: 2056,
      },
      {
        address: 9827941,
        value: 8,
      },
      {
        address: 9827942,
        value: 0,
      },
      {
        address: 9827943,
        value: 0,
      },
      {
        address: 9827944,
        value: 3584,
      },
      {
        address: 9827945,
        value: 4110,
      },
      {
        address: 9827946,
        value: 3600,
      },
      {
        address: 9827947,
        value: 270,
      },
      {
        address: 9827948,
        value: 7681,
      },
      {
        address: 9827949,
        value: 30,
      },
      {
        address: 9827950,
        value: 0,
      },
      {
        address: 9827951,
        value: 1024,
      },
      {
        address: 9827952,
        value: 3588,
      },
      {
        address: 9827953,
        value: 1038,
      },
      {
        address: 9827954,
        value: 1028,
      },
      {
        address: 9827955,
        value: 1028,
      },
      {
        address: 9827956,
        value: 772,
      },
      {
        address: 9827957,
        value: 3,
      },
      {
        address: 9827958,
        value: 0,
      },
      {
        address: 9827959,
        value: 0,
      },
      {
        address: 9827960,
        value: 4352,
      },
      {
        address: 9827961,
        value: 4369,
      },
      {
        address: 9827962,
        value: 4369,
      },
      {
        address: 9827963,
        value: 2321,
      },
      {
        address: 9827964,
        value: 1801,
      },
      {
        address: 9827965,
        value: 7,
      },
      {
        address: 9827966,
        value: 0,
      },
      {
        address: 9827967,
        value: 0,
      },
      {
        address: 9827968,
        value: 4352,
      },
      {
        address: 9827969,
        value: 4369,
      },
      {
        address: 9827970,
        value: 4369,
      },
      {
        address: 9827971,
        value: 2577,
      },
      {
        address: 9827972,
        value: 1034,
      },
      {
        address: 9827973,
        value: 4,
      },
      {
        address: 9827974,
        value: 0,
      },
      {
        address: 9827975,
        value: 0,
      },
      {
        address: 9827976,
        value: 4352,
      },
      {
        address: 9827977,
        value: 4369,
      },
      {
        address: 9827978,
        value: 5393,
      },
      {
        address: 9827979,
        value: 6933,
      },
      {
        address: 9827980,
        value: 4379,
      },
      {
        address: 9827981,
        value: 17,
      },
      {
        address: 9827982,
        value: 0,
      },
      {
        address: 9827983,
        value: 0,
      },
      {
        address: 9827992,
        value: 4352,
      },
      {
        address: 9827993,
        value: 4369,
      },
      {
        address: 9827994,
        value: 4881,
      },
      {
        address: 9827995,
        value: 3347,
      },
      {
        address: 9827996,
        value: 269,
      },
      {
        address: 9827997,
        value: 513,
      },
      {
        address: 9827998,
        value: 7170,
      },
      {
        address: 9827999,
        value: 28,
      },
      {
        address: 9828000,
        value: 7936,
      },
      {
        address: 9828001,
        value: 543,
      },
      {
        address: 9828002,
        value: 1026,
      },
      {
        address: 9828003,
        value: 2052,
      },
      {
        address: 9828004,
        value: 7944,
      },
      {
        address: 9828005,
        value: 31,
      },
      {
        address: 9828006,
        value: 0,
      },
      {
        address: 9828007,
        value: 256,
      },
      {
        address: 10321920,
        value: 4,
      },
      {
        address: 10321922,
        value: 620,
      },
      {
        address: 10321924,
        value: 8,
      },
      {
        address: 10321926,
        value: 248,
      },
      {
        address: 10321928,
        value: 12,
      },
      {
        address: 10321930,
        value: 156,
      },
      {
        address: 10321932,
        value: 16,
      },
      {
        address: 10321934,
        value: 84,
      },
      {
        address: 10321936,
        value: 20,
      },
      {
        address: 10321938,
        value: 68,
      },
      {
        address: 10321940,
        value: 59886,
      },
      {
        address: 10321988,
        value: 62181,
      },
      {
        address: 10321990,
        value: 72,
      },
      {
        address: 10321992,
        value: 59617,
      },
      {
        address: 10321994,
        value: 76,
      },
      {
        address: 10321998,
        value: 58368,
      },
      {
        address: 10322004,
        value: 88,
      },
      {
        address: 10322006,
        value: 108,
      },
      {
        address: 10322008,
        value: 92,
      },
      {
        address: 10322010,
        value: 96,
      },
      {
        address: 10322014,
        value: 60901,
      },
      {
        address: 10322016,
        value: 100,
      },
      {
        address: 10322022,
        value: 62697,
      },
      {
        address: 10322030,
        value: 136,
      },
      {
        address: 10322058,
        value: 41193,
      },
      {
        address: 10322076,
        value: 160,
      },
      {
        address: 10322078,
        value: 228,
      },
      {
        address: 10322080,
        value: 164,
      },
      {
        address: 10322082,
        value: 188,
      },
      {
        address: 10322084,
        value: 168,
      },
      {
        address: 10322086,
        value: 180,
      },
      {
        address: 10322088,
        value: 63205,
      },
      {
        address: 10322100,
        value: 184,
      },
      {
        address: 10322104,
        value: 41200,
      },
      {
        address: 10322108,
        value: 192,
      },
      {
        address: 10322112,
        value: 196,
      },
      {
        address: 10322116,
        value: 61172,
      },
      {
        address: 10322148,
        value: 232,
      },
      {
        address: 10322150,
        value: 58784,
      },
      {
        address: 10322154,
        value: 62696,
      },
      {
        address: 10322168,
        value: 252,
      },
      {
        address: 10322170,
        value: 412,
      },
      {
        address: 10322172,
        value: 256,
      },
      {
        address: 10322174,
        value: 328,
      },
      {
        address: 10322176,
        value: 260,
      },
      {
        address: 10322178,
        value: 292,
      },
      {
        address: 10322180,
        value: 264,
      },
      {
        address: 10322184,
        value: 268,
      },
      {
        address: 10322190,
        value: 272,
      },
      {
        address: 10322194,
        value: 276,
      },
      {
        address: 10322196,
        value: 57835,
      },
      {
        address: 10322212,
        value: 296,
      },
      {
        address: 10322214,
        value: 61429,
      },
      {
        address: 10322216,
        value: 300,
      },
      {
        address: 10322218,
        value: 320,
      },
      {
        address: 10322220,
        value: 304,
      },
      {
        address: 10322224,
        value: 308,
      },
      {
        address: 10322230,
        value: 312,
      },
      {
        address: 10322234,
        value: 41216,
      },
      {
        address: 10322242,
        value: 58853,
      },
      {
        address: 10322248,
        value: 332,
      },
      {
        address: 10322250,
        value: 364,
      },
      {
        address: 10322252,
        value: 336,
      },
      {
        address: 10322254,
        value: 352,
      },
      {
        address: 10322256,
        value: 41207,
      },
      {
        address: 10322274,
        value: 360,
      },
      {
        address: 10322280,
        value: 50176,
      },
      {
        address: 10322284,
        value: 368,
      },
      {
        address: 10322290,
        value: 388,
      },
      {
        address: 10322308,
        value: 58849,
      },
      {
        address: 10322332,
        value: 416,
      },
      {
        address: 10322334,
        value: 496,
      },
      {
        address: 10322338,
        value: 456,
      },
      {
        address: 10322376,
        value: 460,
      },
      {
        address: 10322378,
        value: 484,
      },
      {
        address: 10322380,
        value: 41354,
      },
      {
        address: 10322406,
        value: 63904,
      },
      {
        address: 10322416,
        value: 500,
      },
      {
        address: 10322418,
        value: 568,
      },
      {
        address: 10322420,
        value: 504,
      },
      {
        address: 10322424,
        value: 508,
      },
      {
        address: 10322428,
        value: 60897,
      },
      {
        address: 10322488,
        value: 572,
      },
      {
        address: 10322492,
        value: 576,
      },
      {
        address: 10322496,
        value: 63457,
      },
      {
        address: 10322498,
        value: 580,
      },
      {
        address: 10322502,
        value: 588,
      },
      {
        address: 10322510,
        value: 61424,
      },
      {
        address: 10322540,
        value: 624,
      },
      {
        address: 10322542,
        value: 980,
      },
      {
        address: 10322544,
        value: 628,
      },
      {
        address: 10322546,
        value: 776,
      },
      {
        address: 10322548,
        value: 632,
      },
      {
        address: 10322550,
        value: 696,
      },
      {
        address: 10322552,
        value: 636,
      },
      {
        address: 10322554,
        value: 660,
      },
      {
        address: 10322556,
        value: 640,
      },
      {
        address: 10322558,
        value: 644,
      },
      {
        address: 10322560,
        value: 41203,
      },
      {
        address: 10322562,
        value: 61422,
      },
      {
        address: 10322564,
        value: 648,
      },
      {
        address: 10322566,
        value: 57838,
      },
      {
        address: 10322568,
        value: 652,
      },
      {
        address: 10322572,
        value: 656,
      },
      {
        address: 10322576,
        value: 64000,
      },
      {
        address: 10322580,
        value: 41204,
      },
      {
        address: 10322582,
        value: 664,
      },
      {
        address: 10322584,
        value: 668,
      },
      {
        address: 10322588,
        value: 672,
      },
      {
        address: 10322592,
        value: 676,
      },
      {
        address: 10322598,
        value: 63918,
      },
      {
        address: 10322616,
        value: 700,
      },
      {
        address: 10322618,
        value: 732,
      },
      {
        address: 10322622,
        value: 62624,
      },
      {
        address: 10322654,
        value: 756,
      },
      {
        address: 10322676,
        value: 760,
      },
      {
        address: 10322678,
        value: 58528,
      },
      {
        address: 10322680,
        value: 764,
      },
      {
        address: 10322682,
        value: 768,
      },
      {
        address: 10322684,
        value: 62447,
      },
      {
        address: 10322690,
        value: 62887,
      },
      {
        address: 10322696,
        value: 780,
      },
      {
        address: 10322698,
        value: 864,
      },
      {
        address: 10322700,
        value: 784,
      },
      {
        address: 10322702,
        value: 824,
      },
      {
        address: 10322704,
        value: 788,
      },
      {
        address: 10322706,
        value: 820,
      },
      {
        address: 10322710,
        value: 800,
      },
      {
        address: 10322720,
        value: 804,
      },
      {
        address: 10322722,
        value: 812,
      },
      {
        address: 10322724,
        value: 808,
      },
      {
        address: 10322730,
        value: 41172,
      },
      {
        address: 10322732,
        value: 816,
      },
      {
        address: 10322738,
        value: 41177,
      },
      {
        address: 10322742,
        value: 63983,
      },
      {
        address: 10322744,
        value: 828,
      },
      {
        address: 10322746,
        value: 832,
      },
      {
        address: 10322748,
        value: 62112,
      },
      {
        address: 10322750,
        value: 41209,
      },
      {
        address: 10322752,
        value: 836,
      },
      {
        address: 10322754,
        value: 852,
      },
      {
        address: 10322756,
        value: 60576,
      },
      {
        address: 10322774,
        value: 860,
      },
      {
        address: 10322780,
        value: 62706,
      },
      {
        address: 10322782,
        value: 59552,
      },
      {
        address: 10322784,
        value: 868,
      },
      {
        address: 10322786,
        value: 916,
      },
      {
        address: 10322788,
        value: 872,
      },
      {
        address: 10322790,
        value: 904,
      },
      {
        address: 10322792,
        value: 876,
      },
      {
        address: 10322794,
        value: 884,
      },
      {
        address: 10322796,
        value: 60645,
      },
      {
        address: 10322804,
        value: 888,
      },
      {
        address: 10322808,
        value: 49056,
      },
      {
        address: 10322810,
        value: 892,
      },
      {
        address: 10322812,
        value: 61679,
      },
      {
        address: 10322814,
        value: 58081,
      },
      {
        address: 10322824,
        value: 62880,
      },
      {
        address: 10322836,
        value: 920,
      },
      {
        address: 10322840,
        value: 924,
      },
      {
        address: 10322844,
        value: 41191,
      },
      {
        address: 10322846,
        value: 60389,
      },
      {
        address: 10322900,
        value: 984,
      },
      {
        address: 10322902,
        value: 1156,
      },
      {
        address: 10322904,
        value: 988,
      },
      {
        address: 10322906,
        value: 1060,
      },
      {
        address: 10322908,
        value: 992,
      },
      {
        address: 10322914,
        value: 1004,
      },
      {
        address: 10322924,
        value: 1008,
      },
      {
        address: 10322928,
        value: 1012,
      },
      {
        address: 10322934,
        value: 1016,
      },
      {
        address: 10322936,
        value: 55040,
      },
      {
        address: 10322980,
        value: 1064,
      },
      {
        address: 10322982,
        value: 1112,
      },
      {
        address: 10322984,
        value: 1068,
      },
      {
        address: 10322986,
        value: 1076,
      },
      {
        address: 10322988,
        value: 1072,
      },
      {
        address: 10322990,
        value: 44192,
      },
      {
        address: 10322994,
        value: 61157,
      },
      {
        address: 10322998,
        value: 1092,
      },
      {
        address: 10323012,
        value: 1096,
      },
      {
        address: 10323016,
        value: 62177,
      },
      {
        address: 10323032,
        value: 1116,
      },
      {
        address: 10323034,
        value: 1136,
      },
      {
        address: 10323036,
        value: 41185,
      },
      {
        address: 10323038,
        value: 1120,
      },
      {
        address: 10323042,
        value: 1132,
      },
      {
        address: 10323052,
        value: 61102,
      },
      {
        address: 10323054,
        value: 60649,
      },
      {
        address: 10323056,
        value: 1140,
      },
      {
        address: 10323062,
        value: 41187,
      },
      {
        address: 10323076,
        value: 1160,
      },
      {
        address: 10323078,
        value: 1284,
      },
      {
        address: 10323080,
        value: 1164,
      },
      {
        address: 10323082,
        value: 1204,
      },
      {
        address: 10323084,
        value: 1168,
      },
      {
        address: 10323086,
        value: 1176,
      },
      {
        address: 10323088,
        value: 62368,
      },
      {
        address: 10323096,
        value: 1180,
      },
      {
        address: 10323098,
        value: 1200,
      },
      {
        address: 10323102,
        value: 59891,
      },
      {
        address: 10323120,
        value: 41376,
      },
      {
        address: 10323122,
        value: 58624,
      },
      {
        address: 10323124,
        value: 1208,
      },
      {
        address: 10323126,
        value: 1232,
      },
      {
        address: 10323130,
        value: 1212,
      },
      {
        address: 10323132,
        value: 1216,
      },
      {
        address: 10323134,
        value: 1224,
      },
      {
        address: 10323138,
        value: 1220,
      },
      {
        address: 10323142,
        value: 51937,
      },
      {
        address: 10323144,
        value: 57828,
      },
      {
        address: 10323152,
        value: 1236,
      },
      {
        address: 10323154,
        value: 1272,
      },
      {
        address: 10323156,
        value: 49408,
      },
      {
        address: 10323192,
        value: 1276,
      },
      {
        address: 10323198,
        value: 1280,
      },
      {
        address: 10323200,
        value: 58851,
      },
      {
        address: 10323204,
        value: 1288,
      },
      {
        address: 10323206,
        value: 1348,
      },
      {
        address: 10323208,
        value: 1292,
      },
      {
        address: 10323210,
        value: 1312,
      },
      {
        address: 10323212,
        value: 1296,
      },
      {
        address: 10323214,
        value: 1304,
      },
      {
        address: 10323218,
        value: 1300,
      },
      {
        address: 10323220,
        value: 50432,
      },
      {
        address: 10323224,
        value: 55791,
      },
      {
        address: 10323232,
        value: 1316,
      },
      {
        address: 10323236,
        value: 1320,
      },
      {
        address: 10323238,
        value: 60652,
      },
      {
        address: 10323240,
        value: 1324,
      },
      {
        address: 10323242,
        value: 61428,
      },
      {
        address: 10323244,
        value: 62638,
      },
      {
        address: 10323268,
        value: 1352,
      },
      {
        address: 10323270,
        value: 1388,
      },
      {
        address: 10323272,
        value: 1356,
      },
      {
        address: 10323274,
        value: 1368,
      },
      {
        address: 10323278,
        value: 1360,
      },
      {
        address: 10323280,
        value: 62464,
      },
      {
        address: 10323288,
        value: 1372,
      },
      {
        address: 10323290,
        value: 1376,
      },
      {
        address: 10323294,
        value: 58852,
      },
      {
        address: 10323296,
        value: 1380,
      },
      {
        address: 10323302,
        value: 1384,
      },
      {
        address: 10323304,
        value: 42988,
      },
      {
        address: 10323308,
        value: 1392,
      },
      {
        address: 10323310,
        value: 59621,
      },
      {
        address: 10323312,
        value: 61426,
      },
      {
        address: 10387972,
        value: 61162,
      },
      {
        address: 10387974,
        value: 48249,
      },
      {
        address: 10387976,
        value: 24999,
      },
      {
        address: 10387978,
        value: 5440,
      },
      {
        address: 10387980,
        value: 55797,
      },
      {
        address: 10387982,
        value: 8375,
      },
      {
        address: 10387984,
        value: 53904,
      },
      {
        address: 10387986,
        value: 37661,
      },
      {
        address: 10387988,
        value: 30410,
      },
      {
        address: 10387990,
        value: 60950,
      },
      {
        address: 10387992,
        value: 4274,
      },
      {
        address: 10387994,
        value: 26764,
      },
      {
        address: 10387996,
        value: 6292,
      },
      {
        address: 10387998,
        value: 62182,
      },
      {
        address: 10388000,
        value: 23208,
      },
      {
        address: 10388002,
        value: 46770,
      },
      {
        address: 10388004,
        value: 27348,
      },
      {
        address: 10388006,
        value: 27263,
      },
      {
        address: 10388008,
        value: 18355,
      },
      {
        address: 10388010,
        value: 16362,
      },
      {
        address: 10388012,
        value: 41936,
      },
      {
        address: 10388014,
        value: 47187,
      },
      {
        address: 10388016,
        value: 50676,
      },
      {
        address: 10388018,
        value: 22493,
      },
      {
        address: 10388020,
        value: 43712,
      },
      {
        address: 10388022,
        value: 20381,
      },
      {
        address: 10388024,
        value: 25341,
      },
      {
        address: 10388026,
        value: 30542,
      },
      {
        address: 10388028,
        value: 49566,
      },
      {
        address: 10388030,
        value: 16196,
      },
      {
        address: 10388032,
        value: 39830,
      },
      {
        address: 10388034,
        value: 16172,
      },
      {
        address: 10388036,
        value: 4763,
      },
      {
        address: 10388038,
        value: 40956,
      },
      {
        address: 10388040,
        value: 12038,
      },
      {
        address: 10388042,
        value: 11248,
      },
      {
        address: 10388044,
        value: 29385,
      },
      {
        address: 10388046,
        value: 50418,
      },
      {
        address: 10388048,
        value: 22810,
      },
      {
        address: 10388050,
        value: 39104,
      },
      {
        address: 10388052,
        value: 30759,
      },
      {
        address: 10388054,
        value: 57640,
      },
      {
        address: 10388056,
        value: 53838,
      },
      {
        address: 10388058,
        value: 35767,
      },
      {
        address: 10388060,
        value: 22961,
      },
      {
        address: 10388062,
        value: 60064,
      },
      {
        address: 10388063,
        value: 61162,
      },
      {
        address: 10388065,
        value: 48249,
      },
      {
        address: 10388067,
        value: 24999,
      },
      {
        address: 10388069,
        value: 5440,
      },
      {
        address: 10388071,
        value: 55797,
      },
      {
        address: 10388073,
        value: 8375,
      },
      {
        address: 10388075,
        value: 53904,
      },
      {
        address: 10388077,
        value: 37661,
      },
      {
        address: 10388079,
        value: 30410,
      },
      {
        address: 10388081,
        value: 60950,
      },
      {
        address: 10388083,
        value: 4274,
      },
      {
        address: 10388085,
        value: 57710,
      },
      {
        address: 10388087,
        value: 41910,
      },
      {
        address: 10388089,
        value: 47187,
      },
      {
        address: 10388091,
        value: 50676,
      },
      {
        address: 10388093,
        value: 22493,
      },
      {
        address: 10388095,
        value: 43712,
      },
      {
        address: 10388097,
        value: 20381,
      },
      {
        address: 10388099,
        value: 25341,
      },
      {
        address: 10388101,
        value: 30542,
      },
      {
        address: 10388103,
        value: 49566,
      },
      {
        address: 10388105,
        value: 16196,
      },
      {
        address: 10388107,
        value: 39830,
      },
      {
        address: 10388109,
        value: 16172,
      },
      {
        address: 10388111,
        value: 4763,
      },
      {
        address: 10388113,
        value: 40956,
      },
      {
        address: 10388115,
        value: 12038,
      },
      {
        address: 10388117,
        value: 11248,
      },
      {
        address: 10388119,
        value: 29385,
      },
      {
        address: 10388121,
        value: 50418,
      },
      {
        address: 10388123,
        value: 22810,
      },
      {
        address: 10388125,
        value: 39104,
      },
      {
        address: 10388127,
        value: 30759,
      },
      {
        address: 10388129,
        value: 57640,
      },
      {
        address: 10388131,
        value: 53838,
      },
      {
        address: 10388133,
        value: 35767,
      },
      {
        address: 10388135,
        value: 22961,
      },
      {
        address: 10388137,
        value: 37536,
      },
    ],
    scriptChildBody: true,
    childId: 75,
    modalBody: true,
    native9AObservations: true,
    sourceRomGuards: true,
    originalTextSources: true,
  },
  {
    id: 474,
    scriptEntry: 8650671,
    argumentBytes: 0,
    returnBytes: 0,
    header: [0, 4],
    bytecode: [20, 178, 8, 20, 153, 9, 88, 116, 0, 2, 20, 201, 11, 88, 13, 82, 75, 0, 86],
    fetchTail: 1,
    sourceHash: 'c13c52d95f2ad9c8c1d53c5b955f8722ac1769ad2636e09fb7d77bb2101a5f4e',
    instructions: [
      {
        pc: 0,
        opcode: 20,
        operand: 2226,
        length: 3,
        flow: 'next',
      },
      {
        pc: 3,
        opcode: 20,
        operand: 2457,
        length: 3,
        flow: 'next',
      },
      {
        pc: 6,
        opcode: 88,
        operand: 116,
        length: 2,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 0,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 10,
        opcode: 20,
        operand: 3017,
        length: 3,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 88,
        operand: 13,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 82,
        operand: 75,
        length: 3,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 86,
        operand: null,
        length: 1,
        flow: 'end',
      },
    ],
    edges: [
      {
        from: 0,
        to: 3,
        kind: 'fallthrough',
      },
      {
        from: 3,
        to: 6,
        kind: 'fallthrough',
      },
      {
        from: 6,
        to: 8,
        kind: 'fallthrough',
      },
      {
        from: 8,
        to: 10,
        kind: 'fallthrough',
      },
      {
        from: 10,
        to: 13,
        kind: 'fallthrough',
      },
      {
        from: 13,
        to: 15,
        kind: 'fallthrough',
      },
      {
        from: 15,
        to: 18,
        kind: 'fallthrough',
      },
    ],
    romReads: [
      {
        address: 8439019,
        value: 31,
      },
      {
        address: 8575859,
        value: 33667,
      },
      {
        address: 8576871,
        value: 64865,
      },
      {
        address: 8578670,
        value: 0,
      },
      {
        address: 8579607,
        value: 2048,
      },
      {
        address: 8650081,
        value: 2048,
      },
      {
        address: 8650082,
        value: 8,
      },
      {
        address: 9288121,
        value: 12111,
      },
      {
        address: 9288681,
        value: 12086,
      },
    ],
    scriptChildBody: true,
    childId: 75,
    modalBody: true,
    native9AObservations: false,
    sourceRomGuards: true,
    originalTextSources: true,
  },
  {
    id: 703,
    scriptEntry: 10282641,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 6],
    bytecode: [
      44, 0, 20, 1, 128, 194, 88, 179, 0, 7, 0, 1, 194, 88, 210, 20, 122, 3, 0, 122, 194, 82, 61, 3,
      86,
    ],
    fetchTail: 1,
    sourceHash: 'de306c2bef3fea5fec524839e018b591e7c39f96deb99e20276d1ee380217f0c',
    instructions: [
      {
        pc: 0,
        opcode: 44,
        operand: 0,
        length: 2,
        flow: 'next',
      },
      {
        pc: 2,
        opcode: 20,
        operand: 32769,
        length: 3,
        flow: 'next',
      },
      {
        pc: 5,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 6,
        opcode: 88,
        operand: 179,
        length: 2,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 0,
        operand: 7,
        length: 2,
        flow: 'next',
      },
      {
        pc: 10,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 12,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 88,
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 20,
        operand: 890,
        length: 3,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 0,
        operand: 122,
        length: 2,
        flow: 'next',
      },
      {
        pc: 20,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 21,
        opcode: 82,
        operand: 829,
        length: 3,
        flow: 'next',
      },
      {
        pc: 24,
        opcode: 86,
        operand: null,
        length: 1,
        flow: 'end',
      },
    ],
    edges: [
      {
        from: 0,
        to: 2,
        kind: 'fallthrough',
      },
      {
        from: 2,
        to: 5,
        kind: 'fallthrough',
      },
      {
        from: 5,
        to: 6,
        kind: 'fallthrough',
      },
      {
        from: 6,
        to: 8,
        kind: 'fallthrough',
      },
      {
        from: 8,
        to: 10,
        kind: 'fallthrough',
      },
      {
        from: 10,
        to: 12,
        kind: 'fallthrough',
      },
      {
        from: 12,
        to: 13,
        kind: 'fallthrough',
      },
      {
        from: 13,
        to: 15,
        kind: 'fallthrough',
      },
      {
        from: 15,
        to: 18,
        kind: 'fallthrough',
      },
      {
        from: 18,
        to: 20,
        kind: 'fallthrough',
      },
      {
        from: 20,
        to: 21,
        kind: 'fallthrough',
      },
      {
        from: 21,
        to: 24,
        kind: 'fallthrough',
      },
    ],
    romReads: [
      {
        address: 8450792,
        value: 62423,
      },
      {
        address: 8576613,
        value: 33436,
      },
      {
        address: 8578379,
        value: 59159,
      },
      {
        address: 8579424,
        value: 0,
      },
      {
        address: 8580361,
        value: 6,
      },
      {
        address: 9210056,
        value: 35064,
      },
      {
        address: 9210104,
        value: 33809,
      },
      {
        address: 9210105,
        value: 644,
      },
      {
        address: 9210106,
        value: 65026,
      },
      {
        address: 9210107,
        value: 1278,
      },
      {
        address: 9210108,
        value: 65028,
      },
      {
        address: 9210109,
        value: 1278,
      },
      {
        address: 9210110,
        value: 6148,
      },
      {
        address: 9210111,
        value: 2072,
      },
      {
        address: 9210112,
        value: 4104,
      },
      {
        address: 9210119,
        value: 43840,
      },
      {
        address: 9235872,
        value: 35014,
      },
      {
        address: 10282775,
        value: 3079,
      },
      {
        address: 10282776,
        value: 11276,
      },
      {
        address: 10282778,
        value: 13312,
      },
      {
        address: 10282780,
        value: 13313,
      },
      {
        address: 10282782,
        value: 22019,
      },
    ],
    scriptChildBody: true,
    childId: 829,
    modalBody: true,
    native9AObservations: false,
    sourceRomGuards: true,
    originalTextSources: true,
  },
  {
    id: 707,
    scriptEntry: 10282668,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 6],
    bytecode: [
      44, 0, 20, 1, 128, 194, 88, 179, 0, 6, 0, 1, 194, 88, 210, 0, 153, 0, 230, 194, 82, 61, 3, 86,
    ],
    fetchTail: 1,
    sourceHash: '9dccef087f514adb9665acfe759d7e15db91a8aa353814d57420024f00da9eb6',
    instructions: [
      {
        pc: 0,
        opcode: 44,
        operand: 0,
        length: 2,
        flow: 'next',
      },
      {
        pc: 2,
        opcode: 20,
        operand: 32769,
        length: 3,
        flow: 'next',
      },
      {
        pc: 5,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 6,
        opcode: 88,
        operand: 179,
        length: 2,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 0,
        operand: 6,
        length: 2,
        flow: 'next',
      },
      {
        pc: 10,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 12,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 88,
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 0,
        operand: 153,
        length: 2,
        flow: 'next',
      },
      {
        pc: 17,
        opcode: 0,
        operand: 230,
        length: 2,
        flow: 'next',
      },
      {
        pc: 19,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 20,
        opcode: 82,
        operand: 829,
        length: 3,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 86,
        operand: null,
        length: 1,
        flow: 'end',
      },
    ],
    edges: [
      {
        from: 0,
        to: 2,
        kind: 'fallthrough',
      },
      {
        from: 2,
        to: 5,
        kind: 'fallthrough',
      },
      {
        from: 5,
        to: 6,
        kind: 'fallthrough',
      },
      {
        from: 6,
        to: 8,
        kind: 'fallthrough',
      },
      {
        from: 8,
        to: 10,
        kind: 'fallthrough',
      },
      {
        from: 10,
        to: 12,
        kind: 'fallthrough',
      },
      {
        from: 12,
        to: 13,
        kind: 'fallthrough',
      },
      {
        from: 13,
        to: 15,
        kind: 'fallthrough',
      },
      {
        from: 15,
        to: 17,
        kind: 'fallthrough',
      },
      {
        from: 17,
        to: 19,
        kind: 'fallthrough',
      },
      {
        from: 19,
        to: 20,
        kind: 'fallthrough',
      },
      {
        from: 20,
        to: 23,
        kind: 'fallthrough',
      },
    ],
    romReads: [
      {
        address: 8450792,
        value: 62423,
      },
      {
        address: 8576613,
        value: 33436,
      },
      {
        address: 8578379,
        value: 59159,
      },
      {
        address: 8579424,
        value: 0,
      },
      {
        address: 8580361,
        value: 6,
      },
      {
        address: 9210056,
        value: 35064,
      },
      {
        address: 9210104,
        value: 33809,
      },
      {
        address: 9210105,
        value: 644,
      },
      {
        address: 9210106,
        value: 65026,
      },
      {
        address: 9210107,
        value: 1278,
      },
      {
        address: 9210108,
        value: 65028,
      },
      {
        address: 9210109,
        value: 1278,
      },
      {
        address: 9210110,
        value: 6148,
      },
      {
        address: 9210111,
        value: 2072,
      },
      {
        address: 9210112,
        value: 4104,
      },
      {
        address: 9210118,
        value: 16440,
      },
      {
        address: 9235872,
        value: 35014,
      },
      {
        address: 10282775,
        value: 3079,
      },
      {
        address: 10282776,
        value: 11276,
      },
      {
        address: 10282778,
        value: 13312,
      },
      {
        address: 10282780,
        value: 13313,
      },
      {
        address: 10282782,
        value: 22019,
      },
    ],
    scriptChildBody: true,
    childId: 829,
    modalBody: true,
    native9AObservations: false,
    sourceRomGuards: true,
    originalTextSources: true,
  },
  ...childInputBodySpecs,
  ...childMenuBodySpecs,
  ...childCountdownBodySpecs,
  ...childPropertyBodySpecs,
  ...childParentWaitBodySpecs,
  ...childParentAliasBodySpecs,
  ...childParentAddBodySpecs,
].sort((a, b) => a.id - b.id);
export const childBodyNativeSources = [
  {
    id: 40,
    target: 8442250,
    anchors: [
      {
        address: 8574984,
        bytes: [138, 209],
      },
      {
        address: 8575604,
        bytes: [0, 1],
      },
      {
        address: 8575384,
        bytes: [2, 2],
      },
    ],
  },
  {
    id: 123,
    anchors: [
      {
        address: 8575150,
        bytes: [178, 205],
      },
      {
        address: 8575687,
        bytes: [1, 2],
      },
      {
        address: 8575467,
        bytes: [0, 2],
      },
    ],
    target: 8441266,
  },
  {
    id: 204,
    target: 8442314,
    anchors: [
      {
        address: 8575312,
        bytes: [202, 209],
      },
      {
        address: 8575768,
        bytes: [1, 1],
      },
      {
        address: 8575548,
        bytes: [2, 2],
      },
    ],
  },
  {
    id: 205,
    target: 8440653,
    anchors: [
      {
        address: 8575314,
        bytes: [77, 203],
      },
      {
        address: 8575769,
        bytes: [1, 0],
      },
      {
        address: 8575549,
        bytes: [2, 2],
      },
    ],
  },
];
