// Individually pinned original bodies; every shared dependency is renewed separately.
export const recordLifecycleBodySpecs = [
  {
    id: 548,
    scriptEntry: 10419094,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 6],
    bytecode: [
      44, 0, 20, 255, 223, 194, 88, 44, 0, 7, 192, 194, 88, 210, 20, 34, 1, 0, 1, 88, 159, 188, 0,
      3, 194, 88, 106, 0, 120, 0, 1, 88, 159, 188, 0, 7, 194, 88, 106, 194, 88, 91, 86,
    ],
    fetchTail: 1,
    sourceHash: '191f5500338924697a7d1954a8ad680b303ac3fdbfd303d6fd4a1205c0693e61',
    romReads: [
      {
        address: 9210054,
        value: 35032,
      },
      {
        address: 9210072,
        value: 256,
      },
      {
        address: 9210073,
        value: 513,
      },
      {
        address: 9210074,
        value: 65026,
      },
      {
        address: 9210075,
        value: 1278,
      },
      {
        address: 9210076,
        value: 65028,
      },
      {
        address: 9210077,
        value: 1278,
      },
      {
        address: 9210078,
        value: 6148,
      },
      {
        address: 9210079,
        value: 2072,
      },
      {
        address: 9210080,
        value: 2568,
      },
      {
        address: 9210083,
        value: 4110,
      },
      {
        address: 9210087,
        value: 15126,
      },
      {
        address: 9235872,
        value: 35014,
      },
    ],
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
        operand: 57343,
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
        operand: 44,
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
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 11,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 12,
        opcode: 88,
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 14,
        opcode: 20,
        operand: 290,
        length: 3,
        flow: 'next',
      },
      {
        pc: 17,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 19,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 21,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 22,
        opcode: 0,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 24,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 25,
        opcode: 88,
        operand: 106,
        length: 2,
        flow: 'next',
      },
      {
        pc: 27,
        opcode: 0,
        operand: 120,
        length: 2,
        flow: 'next',
      },
      {
        pc: 29,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 31,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 33,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 34,
        opcode: 0,
        operand: 7,
        length: 2,
        flow: 'next',
      },
      {
        pc: 36,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 37,
        opcode: 88,
        operand: 106,
        length: 2,
        flow: 'next',
      },
      {
        pc: 39,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 40,
        opcode: 88,
        operand: 91,
        length: 2,
        flow: 'next',
      },
      {
        pc: 42,
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
        to: 11,
        kind: 'fallthrough',
      },
      {
        from: 11,
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
        to: 21,
        kind: 'fallthrough',
      },
      {
        from: 21,
        to: 22,
        kind: 'fallthrough',
      },
      {
        from: 22,
        to: 24,
        kind: 'fallthrough',
      },
      {
        from: 24,
        to: 25,
        kind: 'fallthrough',
      },
      {
        from: 25,
        to: 27,
        kind: 'fallthrough',
      },
      {
        from: 27,
        to: 29,
        kind: 'fallthrough',
      },
      {
        from: 29,
        to: 31,
        kind: 'fallthrough',
      },
      {
        from: 31,
        to: 33,
        kind: 'fallthrough',
      },
      {
        from: 33,
        to: 34,
        kind: 'fallthrough',
      },
      {
        from: 34,
        to: 36,
        kind: 'fallthrough',
      },
      {
        from: 36,
        to: 37,
        kind: 'fallthrough',
      },
      {
        from: 37,
        to: 39,
        kind: 'fallthrough',
      },
      {
        from: 39,
        to: 40,
        kind: 'fallthrough',
      },
      {
        from: 40,
        to: 42,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    recordLifecycleBody: true,
  },
  {
    id: 603,
    scriptEntry: 10473792,
    argumentBytes: 8,
    returnBytes: 0,
    header: [6, 14],
    bytecode: [
      44, 0, 52, 1, 52, 3, 44, 5, 194, 88, 2, 2, 5, 126, 190, 68, 26, 0, 20, 19, 2, 52, 3, 72, 35,
      0, 2, 5, 194, 88, 51, 22, 1, 88, 153, 0, 1, 22, 3, 192, 0, 5, 0, 15, 0, 2, 0, 8, 88, 200, 88,
      163, 0, 1, 186, 88, 159, 188, 86,
    ],
    fetchTail: 1,
    sourceHash: '37ad7d2d27e8e0ca6b216a2787a1bcf38983d94447f4dc3979f390b5acb30d06',
    romReads: [
      {
        address: 8445404,
        value: 41757,
      },
      {
        address: 8445406,
        value: 41778,
      },
      {
        address: 8498220,
        value: 518,
      },
      {
        address: 8498234,
        value: 1538,
      },
      {
        address: 8498253,
        value: 1542,
      },
      {
        address: 8498255,
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
        address: 8498258,
        value: 1542,
      },
      {
        address: 8498260,
        value: 1030,
      },
      {
        address: 8498261,
        value: 1540,
      },
      {
        address: 8498264,
        value: 1542,
      },
      {
        address: 8498265,
        value: 1542,
      },
      {
        address: 8498266,
        value: 1542,
      },
      {
        address: 8498267,
        value: 1542,
      },
      {
        address: 8498268,
        value: 1542,
      },
      {
        address: 8498270,
        value: 1542,
      },
      {
        address: 8498271,
        value: 1542,
      },
      {
        address: 8498272,
        value: 1542,
      },
      {
        address: 8498273,
        value: 1542,
      },
      {
        address: 8498277,
        value: 1542,
      },
      {
        address: 8498325,
        value: 3855,
      },
      {
        address: 8498337,
        value: 49152,
      },
      {
        address: 8498341,
        value: 61440,
      },
      {
        address: 8498345,
        value: 64512,
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
        address: 9827560,
        value: 4366,
      },
      {
        address: 9827561,
        value: 4113,
      },
      {
        address: 9827562,
        value: 4112,
      },
      {
        address: 9827563,
        value: 4368,
      },
      {
        address: 9827564,
        value: 3601,
      },
      {
        address: 9827565,
        value: 14,
      },
      {
        address: 9827566,
        value: 0,
      },
      {
        address: 9827567,
        value: 7168,
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
        address: 9827584,
        value: 4127,
      },
      {
        address: 9827585,
        value: 7696,
      },
      {
        address: 9827586,
        value: 4126,
      },
      {
        address: 9827587,
        value: 4112,
      },
      {
        address: 9827588,
        value: 4112,
      },
      {
        address: 9827589,
        value: 16,
      },
      {
        address: 9827590,
        value: 0,
      },
      {
        address: 9827591,
        value: 1536,
      },
      {
        address: 9827600,
        value: 4369,
      },
      {
        address: 9827601,
        value: 7953,
      },
      {
        address: 9827602,
        value: 4383,
      },
      {
        address: 9827603,
        value: 4369,
      },
      {
        address: 9827604,
        value: 4369,
      },
      {
        address: 9827605,
        value: 17,
      },
      {
        address: 9827606,
        value: 0,
      },
      {
        address: 9827607,
        value: 1792,
      },
      {
        address: 9827608,
        value: 519,
      },
      {
        address: 9827609,
        value: 514,
      },
      {
        address: 9827610,
        value: 514,
      },
      {
        address: 9827611,
        value: 514,
      },
      {
        address: 9827612,
        value: 1794,
      },
      {
        address: 9827613,
        value: 7,
      },
      {
        address: 9827614,
        value: 0,
      },
      {
        address: 9827615,
        value: 768,
      },
      {
        address: 9827632,
        value: 4112,
      },
      {
        address: 9827633,
        value: 4112,
      },
      {
        address: 9827634,
        value: 4112,
      },
      {
        address: 9827635,
        value: 4112,
      },
      {
        address: 9827636,
        value: 7952,
      },
      {
        address: 9827637,
        value: 31,
      },
      {
        address: 9827638,
        value: 0,
      },
      {
        address: 9827639,
        value: 4352,
      },
      {
        address: 9827640,
        value: 6929,
      },
      {
        address: 9827641,
        value: 5403,
      },
      {
        address: 9827642,
        value: 4373,
      },
      {
        address: 9827643,
        value: 4369,
      },
      {
        address: 9827644,
        value: 4369,
      },
      {
        address: 9827645,
        value: 17,
      },
      {
        address: 9827646,
        value: 0,
      },
      {
        address: 9827647,
        value: 4352,
      },
      {
        address: 9827648,
        value: 6417,
      },
      {
        address: 9827649,
        value: 7449,
      },
      {
        address: 9827650,
        value: 5917,
      },
      {
        address: 9827651,
        value: 4887,
      },
      {
        address: 9827652,
        value: 4371,
      },
      {
        address: 9827653,
        value: 17,
      },
      {
        address: 9827654,
        value: 0,
      },
      {
        address: 9827655,
        value: 3584,
      },
      {
        address: 9827656,
        value: 4366,
      },
      {
        address: 9827657,
        value: 4369,
      },
      {
        address: 9827658,
        value: 4369,
      },
      {
        address: 9827659,
        value: 4369,
      },
      {
        address: 9827660,
        value: 3601,
      },
      {
        address: 9827661,
        value: 14,
      },
      {
        address: 9827662,
        value: 0,
      },
      {
        address: 9827663,
        value: 7680,
      },
      {
        address: 9827664,
        value: 4382,
      },
      {
        address: 9827665,
        value: 4369,
      },
      {
        address: 9827666,
        value: 7697,
      },
      {
        address: 9827667,
        value: 4126,
      },
      {
        address: 9827668,
        value: 4112,
      },
      {
        address: 9827669,
        value: 16,
      },
      {
        address: 9827670,
        value: 0,
      },
      {
        address: 9827671,
        value: 3584,
      },
      {
        address: 9827680,
        value: 4382,
      },
      {
        address: 9827681,
        value: 7697,
      },
      {
        address: 9827682,
        value: 5150,
      },
      {
        address: 9827683,
        value: 4628,
      },
      {
        address: 9827684,
        value: 4370,
      },
      {
        address: 9827685,
        value: 17,
      },
      {
        address: 9827686,
        value: 0,
      },
      {
        address: 9827687,
        value: 3584,
      },
      {
        address: 9827688,
        value: 4110,
      },
      {
        address: 9827689,
        value: 3600,
      },
      {
        address: 9827690,
        value: 270,
      },
      {
        address: 9827691,
        value: 4353,
      },
      {
        address: 9827692,
        value: 3601,
      },
      {
        address: 9827693,
        value: 14,
      },
      {
        address: 9827694,
        value: 0,
      },
      {
        address: 9827695,
        value: 7936,
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
        address: 9827704,
        value: 4369,
      },
      {
        address: 9827705,
        value: 4369,
      },
      {
        address: 9827706,
        value: 4369,
      },
      {
        address: 9827707,
        value: 4369,
      },
      {
        address: 9827708,
        value: 3601,
      },
      {
        address: 9827709,
        value: 14,
      },
      {
        address: 9827710,
        value: 0,
      },
      {
        address: 9827711,
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
        address: 10321942,
        value: 24,
      },
      {
        address: 10321946,
        value: 28,
      },
      {
        address: 10321948,
        value: 32,
      },
      {
        address: 10321954,
        value: 36,
      },
      {
        address: 10321956,
        value: 55552,
      },
      {
        address: 10322006,
        value: 108,
      },
      {
        address: 10322028,
        value: 112,
      },
      {
        address: 10322034,
        value: 128,
      },
      {
        address: 10322048,
        value: 132,
      },
      {
        address: 10322050,
        value: 52992,
      },
      {
        address: 10322054,
        value: 52736,
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
        address: 10322178,
        value: 292,
      },
      {
        address: 10322212,
        value: 296,
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
        address: 10322226,
        value: 316,
      },
      {
        address: 10322236,
        value: 54528,
      },
      {
        address: 10322240,
        value: 324,
      },
      {
        address: 10322244,
        value: 52480,
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
        address: 10322254,
        value: 352,
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
        address: 10322286,
        value: 392,
      },
      {
        address: 10322314,
        value: 408,
      },
      {
        address: 10322328,
        value: 54016,
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
        address: 10322336,
        value: 420,
      },
      {
        address: 10322342,
        value: 448,
      },
      {
        address: 10322368,
        value: 452,
      },
      {
        address: 10322374,
        value: 41161,
      },
      {
        address: 10322418,
        value: 568,
      },
      {
        address: 10322490,
        value: 592,
      },
      {
        address: 10322514,
        value: 612,
      },
      {
        address: 10322534,
        value: 616,
      },
      {
        address: 10322536,
        value: 51200,
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
        address: 10322554,
        value: 660,
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
        address: 10322596,
        value: 41156,
      },
      {
        address: 10322616,
        value: 700,
      },
      {
        address: 10322620,
        value: 704,
      },
      {
        address: 10322626,
        value: 720,
      },
      {
        address: 10322640,
        value: 724,
      },
      {
        address: 10322646,
        value: 51456,
      },
      {
        address: 10322696,
        value: 780,
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
        address: 10322726,
        value: 53248,
      },
      {
        address: 10322740,
        value: 40960,
      },
      {
        address: 10322746,
        value: 832,
      },
      {
        address: 10322754,
        value: 852,
      },
      {
        address: 10322772,
        value: 856,
      },
      {
        address: 10322778,
        value: 50688,
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
        address: 10322912,
        value: 996,
      },
      {
        address: 10322918,
        value: 44682,
      },
      {
        address: 10322980,
        value: 1064,
      },
      {
        address: 10322986,
        value: 1076,
      },
      {
        address: 10322998,
        value: 1092,
      },
      {
        address: 10323014,
        value: 1100,
      },
      {
        address: 10323022,
        value: 53760,
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
        address: 10323082,
        value: 1204,
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
        address: 10323134,
        value: 1224,
      },
      {
        address: 10323146,
        value: 1228,
      },
      {
        address: 10323148,
        value: 41153,
      },
      {
        address: 10323152,
        value: 1236,
      },
      {
        address: 10323156,
        value: 49408,
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
        address: 10323226,
        value: 1308,
      },
      {
        address: 10323228,
        value: 52224,
      },
      {
        address: 10323230,
        value: 54272,
      },
      {
        address: 10323268,
        value: 1352,
      },
      {
        address: 10323274,
        value: 1368,
      },
      {
        address: 10323288,
        value: 1372,
      },
      {
        address: 10323292,
        value: 49920,
      },
      {
        address: 10396445,
        value: 60403,
      },
      {
        address: 10396447,
        value: 6139,
      },
      {
        address: 10396449,
        value: 53663,
      },
      {
        address: 10396451,
        value: 26503,
      },
      {
        address: 10396453,
        value: 45727,
      },
      {
        address: 10396455,
        value: 37424,
      },
      {
        address: 10396457,
        value: 32175,
      },
      {
        address: 10396459,
        value: 13627,
      },
      {
        address: 10396461,
        value: 57066,
      },
      {
        address: 10396463,
        value: 27685,
      },
      {
        address: 10396465,
        value: 62240,
      },
      {
        address: 10396466,
        value: 60403,
      },
      {
        address: 10396468,
        value: 1787,
      },
      {
        address: 10396470,
        value: 54699,
      },
      {
        address: 10396472,
        value: 5855,
      },
      {
        address: 10396474,
        value: 24511,
      },
      {
        address: 10396476,
        value: 22242,
      },
      {
        address: 10396478,
        value: 48875,
      },
      {
        address: 10396480,
        value: 16799,
      },
      {
        address: 10396482,
        value: 34996,
      },
      {
        address: 10396484,
        value: 59243,
      },
      {
        address: 10396486,
        value: 23973,
      },
      {
        address: 10396488,
        value: 63890,
      },
      {
        address: 10396490,
        value: 19644,
      },
      {
        address: 10396492,
        value: 54443,
      },
      {
        address: 10396494,
        value: 18876,
      },
      {
        address: 10396496,
        value: 12106,
      },
      {
        address: 10396498,
        value: 6812,
      },
      {
        address: 10396500,
        value: 61890,
      },
    ],
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
        opcode: 52,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 52,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 6,
        opcode: 44,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 9,
        opcode: 88,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 11,
        opcode: 2,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 126,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 14,
        opcode: 190,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 68,
        operand: 26,
        length: 3,
        flow: 'conditional',
      },
      {
        pc: 18,
        opcode: 20,
        operand: 531,
        length: 3,
        flow: 'next',
      },
      {
        pc: 21,
        opcode: 52,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 72,
        operand: 35,
        length: 3,
        flow: 'jump',
      },
      {
        pc: 26,
        opcode: 2,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 28,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 29,
        opcode: 88,
        operand: 51,
        length: 2,
        flow: 'next',
      },
      {
        pc: 31,
        opcode: 22,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 33,
        opcode: 88,
        operand: 153,
        length: 2,
        flow: 'next',
      },
      {
        pc: 35,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 37,
        opcode: 22,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 39,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 40,
        opcode: 0,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 42,
        opcode: 0,
        operand: 15,
        length: 2,
        flow: 'next',
      },
      {
        pc: 44,
        opcode: 0,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 46,
        opcode: 0,
        operand: 8,
        length: 2,
        flow: 'next',
      },
      {
        pc: 48,
        opcode: 88,
        operand: 200,
        length: 2,
        flow: 'next',
      },
      {
        pc: 50,
        opcode: 88,
        operand: 163,
        length: 2,
        flow: 'next',
      },
      {
        pc: 52,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 54,
        opcode: 186,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 55,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 57,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 58,
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
        to: 4,
        kind: 'fallthrough',
      },
      {
        from: 4,
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
        to: 9,
        kind: 'fallthrough',
      },
      {
        from: 9,
        to: 11,
        kind: 'fallthrough',
      },
      {
        from: 11,
        to: 13,
        kind: 'fallthrough',
      },
      {
        from: 13,
        to: 14,
        kind: 'fallthrough',
      },
      {
        from: 14,
        to: 15,
        kind: 'fallthrough',
      },
      {
        from: 15,
        to: 26,
        kind: 'conditional',
      },
      {
        from: 15,
        to: 18,
        kind: 'fallthrough',
      },
      {
        from: 18,
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
        to: 35,
        kind: 'jump',
      },
      {
        from: 35,
        to: 37,
        kind: 'fallthrough',
      },
      {
        from: 37,
        to: 39,
        kind: 'fallthrough',
      },
      {
        from: 39,
        to: 40,
        kind: 'fallthrough',
      },
      {
        from: 40,
        to: 42,
        kind: 'fallthrough',
      },
      {
        from: 42,
        to: 44,
        kind: 'fallthrough',
      },
      {
        from: 44,
        to: 46,
        kind: 'fallthrough',
      },
      {
        from: 46,
        to: 48,
        kind: 'fallthrough',
      },
      {
        from: 48,
        to: 50,
        kind: 'fallthrough',
      },
      {
        from: 50,
        to: 52,
        kind: 'fallthrough',
      },
      {
        from: 52,
        to: 54,
        kind: 'fallthrough',
      },
      {
        from: 54,
        to: 55,
        kind: 'fallthrough',
      },
      {
        from: 55,
        to: 57,
        kind: 'fallthrough',
      },
      {
        from: 57,
        to: 58,
        kind: 'fallthrough',
      },
      {
        from: 26,
        to: 28,
        kind: 'fallthrough',
      },
      {
        from: 28,
        to: 29,
        kind: 'fallthrough',
      },
      {
        from: 29,
        to: 31,
        kind: 'fallthrough',
      },
      {
        from: 31,
        to: 33,
        kind: 'fallthrough',
      },
      {
        from: 33,
        to: 35,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    recordLifecycleBody: true,
    c8Observations: true,
    originalTextSources: true,
    nativeA3Observations: true,
  },
  {
    id: 710,
    scriptEntry: 10210258,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 8],
    bytecode: [
      44, 0, 194, 88, 2, 0, 1, 126, 190, 68, 13, 0, 86, 0, 1, 194, 88, 51, 10, 191, 194, 88, 44, 0,
      4, 0, 2, 194, 88, 210, 192, 194, 88, 29, 192, 0, 4, 88, 159, 188, 194, 88, 59, 192, 10, 251,
      10, 254, 194, 88, 121, 0, 60, 0, 1, 88, 159, 188, 194, 88, 175, 194, 88, 185, 86,
    ],
    fetchTail: 2,
    sourceHash: '6e9b8009fed2956ad8f7b20e8dcb7b48873a8a4d15d55b98823e5e288623d40d',
    romReads: [
      {
        address: 9210058,
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
        address: 9210116,
        value: 12328,
      },
      {
        address: 9235872,
        value: 35014,
      },
      {
        address: 9277441,
        value: 4,
      },
      {
        address: 9277443,
        value: 5932,
      },
    ],
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
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 3,
        opcode: 88,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 5,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 7,
        opcode: 126,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 190,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 9,
        opcode: 68,
        operand: 13,
        length: 3,
        flow: 'conditional',
      },
      {
        pc: 12,
        opcode: 86,
        operand: null,
        length: 1,
        flow: 'end',
      },
      {
        pc: 13,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 16,
        opcode: 88,
        operand: 51,
        length: 2,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 10,
        operand: 191,
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
        opcode: 88,
        operand: 44,
        length: 2,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 0,
        operand: 4,
        length: 2,
        flow: 'next',
      },
      {
        pc: 25,
        opcode: 0,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 27,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 28,
        opcode: 88,
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 30,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 31,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 32,
        opcode: 88,
        operand: 29,
        length: 2,
        flow: 'next',
      },
      {
        pc: 34,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 35,
        opcode: 0,
        operand: 4,
        length: 2,
        flow: 'next',
      },
      {
        pc: 37,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 39,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 40,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 41,
        opcode: 88,
        operand: 59,
        length: 2,
        flow: 'next',
      },
      {
        pc: 43,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 44,
        opcode: 10,
        operand: 251,
        length: 2,
        flow: 'next',
      },
      {
        pc: 46,
        opcode: 10,
        operand: 254,
        length: 2,
        flow: 'next',
      },
      {
        pc: 48,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 49,
        opcode: 88,
        operand: 121,
        length: 2,
        flow: 'next',
      },
      {
        pc: 51,
        opcode: 0,
        operand: 60,
        length: 2,
        flow: 'next',
      },
      {
        pc: 53,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 55,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 57,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 58,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 59,
        opcode: 88,
        operand: 175,
        length: 2,
        flow: 'next',
      },
      {
        pc: 61,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 62,
        opcode: 88,
        operand: 185,
        length: 2,
        flow: 'next',
      },
      {
        pc: 64,
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
        to: 7,
        kind: 'fallthrough',
      },
      {
        from: 7,
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
        to: 13,
        kind: 'conditional',
      },
      {
        from: 9,
        to: 12,
        kind: 'fallthrough',
      },
      {
        from: 13,
        to: 15,
        kind: 'fallthrough',
      },
      {
        from: 15,
        to: 16,
        kind: 'fallthrough',
      },
      {
        from: 16,
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
        to: 23,
        kind: 'fallthrough',
      },
      {
        from: 23,
        to: 25,
        kind: 'fallthrough',
      },
      {
        from: 25,
        to: 27,
        kind: 'fallthrough',
      },
      {
        from: 27,
        to: 28,
        kind: 'fallthrough',
      },
      {
        from: 28,
        to: 30,
        kind: 'fallthrough',
      },
      {
        from: 30,
        to: 31,
        kind: 'fallthrough',
      },
      {
        from: 31,
        to: 32,
        kind: 'fallthrough',
      },
      {
        from: 32,
        to: 34,
        kind: 'fallthrough',
      },
      {
        from: 34,
        to: 35,
        kind: 'fallthrough',
      },
      {
        from: 35,
        to: 37,
        kind: 'fallthrough',
      },
      {
        from: 37,
        to: 39,
        kind: 'fallthrough',
      },
      {
        from: 39,
        to: 40,
        kind: 'fallthrough',
      },
      {
        from: 40,
        to: 41,
        kind: 'fallthrough',
      },
      {
        from: 41,
        to: 43,
        kind: 'fallthrough',
      },
      {
        from: 43,
        to: 44,
        kind: 'fallthrough',
      },
      {
        from: 44,
        to: 46,
        kind: 'fallthrough',
      },
      {
        from: 46,
        to: 48,
        kind: 'fallthrough',
      },
      {
        from: 48,
        to: 49,
        kind: 'fallthrough',
      },
      {
        from: 49,
        to: 51,
        kind: 'fallthrough',
      },
      {
        from: 51,
        to: 53,
        kind: 'fallthrough',
      },
      {
        from: 53,
        to: 55,
        kind: 'fallthrough',
      },
      {
        from: 55,
        to: 57,
        kind: 'fallthrough',
      },
      {
        from: 57,
        to: 58,
        kind: 'fallthrough',
      },
      {
        from: 58,
        to: 59,
        kind: 'fallthrough',
      },
      {
        from: 59,
        to: 61,
        kind: 'fallthrough',
      },
      {
        from: 61,
        to: 62,
        kind: 'fallthrough',
      },
      {
        from: 62,
        to: 64,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    recordLifecycleBody: true,
  },
  {
    id: 861,
    scriptEntry: 10459650,
    argumentBytes: 2,
    returnBytes: 2,
    header: [2, 10],
    bytecode: [
      44, 0, 0, 144, 194, 88, 81, 194, 88, 80, 194, 0, 153, 88, 169, 44, 1, 0, 5, 0, 1, 88, 159,
      188, 194, 88, 197, 194, 88, 185, 0, 10, 0, 1, 88, 159, 188, 2, 1, 86,
    ],
    fetchTail: 2,
    sourceHash: '31ecb620b3f6faa669e586274d74e7ecb7d3a3a1e1f701948acc073745c3199e',
    romReads: [
      {
        address: 8575928,
        value: 33439,
      },
      {
        address: 8577009,
        value: 39507,
      },
      {
        address: 8579676,
        value: 514,
      },
      {
        address: 9237322,
        value: 0,
      },
      {
        address: 10459731,
        value: 2050,
      },
      {
        address: 10459732,
        value: 11272,
      },
    ],
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
        opcode: 0,
        operand: 144,
        length: 2,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 5,
        opcode: 88,
        operand: 81,
        length: 2,
        flow: 'next',
      },
      {
        pc: 7,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 88,
        operand: 80,
        length: 2,
        flow: 'next',
      },
      {
        pc: 10,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 11,
        opcode: 0,
        operand: 153,
        length: 2,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 88,
        operand: 169,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 44,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 17,
        opcode: 0,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 19,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 21,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 24,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 25,
        opcode: 88,
        operand: 197,
        length: 2,
        flow: 'next',
      },
      {
        pc: 27,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 28,
        opcode: 88,
        operand: 185,
        length: 2,
        flow: 'next',
      },
      {
        pc: 30,
        opcode: 0,
        operand: 10,
        length: 2,
        flow: 'next',
      },
      {
        pc: 32,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 34,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 36,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 37,
        opcode: 2,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 39,
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
        to: 4,
        kind: 'fallthrough',
      },
      {
        from: 4,
        to: 5,
        kind: 'fallthrough',
      },
      {
        from: 5,
        to: 7,
        kind: 'fallthrough',
      },
      {
        from: 7,
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
        to: 11,
        kind: 'fallthrough',
      },
      {
        from: 11,
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
        to: 24,
        kind: 'fallthrough',
      },
      {
        from: 24,
        to: 25,
        kind: 'fallthrough',
      },
      {
        from: 25,
        to: 27,
        kind: 'fallthrough',
      },
      {
        from: 27,
        to: 28,
        kind: 'fallthrough',
      },
      {
        from: 28,
        to: 30,
        kind: 'fallthrough',
      },
      {
        from: 30,
        to: 32,
        kind: 'fallthrough',
      },
      {
        from: 32,
        to: 34,
        kind: 'fallthrough',
      },
      {
        from: 34,
        to: 36,
        kind: 'fallthrough',
      },
      {
        from: 36,
        to: 37,
        kind: 'fallthrough',
      },
      {
        from: 37,
        to: 39,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    recordLifecycleBody: true,
  },
  {
    id: 934,
    scriptEntry: 10407546,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 14],
    bytecode: [
      44, 0, 192, 192, 194, 88, 210, 192, 0, 16, 88, 159, 188, 20, 184, 11, 88, 153, 0, 180, 20,
      244, 1, 20, 0, 8, 0, 3, 0, 11, 0, 21, 0, 11, 88, 200, 194, 88, 197, 194, 88, 185, 86,
    ],
    fetchTail: 4,
    sourceHash: '946eba52a60de26f723b163cd31662a6749ac9cd1ce5625ae75e6666219e5667',
    romReads: [
      {
        address: 8445344,
        value: 41304,
      },
      {
        address: 8498220,
        value: 518,
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
        address: 8498236,
        value: 1542,
      },
      {
        address: 8498239,
        value: 1542,
      },
      {
        address: 8498289,
        value: 1286,
      },
      {
        address: 8498298,
        value: 1542,
      },
      {
        address: 8498305,
        value: 1542,
      },
      {
        address: 8498309,
        value: 1542,
      },
      {
        address: 8498319,
        value: 32639,
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
        address: 8498345,
        value: 64512,
      },
      {
        address: 9210054,
        value: 35032,
      },
      {
        address: 9210072,
        value: 256,
      },
      {
        address: 9210073,
        value: 513,
      },
      {
        address: 9210074,
        value: 65026,
      },
      {
        address: 9210075,
        value: 1278,
      },
      {
        address: 9210076,
        value: 65028,
      },
      {
        address: 9210077,
        value: 1278,
      },
      {
        address: 9210078,
        value: 6148,
      },
      {
        address: 9210079,
        value: 2072,
      },
      {
        address: 9210080,
        value: 2568,
      },
      {
        address: 9210081,
        value: 3082,
      },
      {
        address: 9235872,
        value: 35014,
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
        address: 9827408,
        value: 4366,
      },
      {
        address: 9827409,
        value: 4369,
      },
      {
        address: 9827410,
        value: 4369,
      },
      {
        address: 9827411,
        value: 4369,
      },
      {
        address: 9827412,
        value: 3601,
      },
      {
        address: 9827413,
        value: 14,
      },
      {
        address: 9827414,
        value: 0,
      },
      {
        address: 9827415,
        value: 512,
      },
      {
        address: 9827432,
        value: 4366,
      },
      {
        address: 9827433,
        value: 529,
      },
      {
        address: 9827434,
        value: 258,
      },
      {
        address: 9827435,
        value: 4353,
      },
      {
        address: 9827436,
        value: 3601,
      },
      {
        address: 9827437,
        value: 14,
      },
      {
        address: 9827438,
        value: 0,
      },
      {
        address: 9827439,
        value: 512,
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
        address: 10321920,
        value: 4,
      },
      {
        address: 10321922,
        value: 620,
      },
      {
        address: 10321926,
        value: 248,
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
        address: 10322182,
        value: 284,
      },
      {
        address: 10322206,
        value: 288,
      },
      {
        address: 10322210,
        value: 45232,
      },
      {
        address: 10322250,
        value: 364,
      },
      {
        address: 10322284,
        value: 368,
      },
      {
        address: 10322288,
        value: 372,
      },
      {
        address: 10322294,
        value: 380,
      },
      {
        address: 10322302,
        value: 45824,
      },
      {
        address: 10322334,
        value: 496,
      },
      {
        address: 10322418,
        value: 568,
      },
      {
        address: 10322490,
        value: 592,
      },
      {
        address: 10322512,
        value: 596,
      },
      {
        address: 10322518,
        value: 604,
      },
      {
        address: 10322524,
        value: 44032,
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
        address: 10322546,
        value: 776,
      },
      {
        address: 10322696,
        value: 780,
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
        address: 10322708,
        value: 792,
      },
      {
        address: 10322714,
        value: 796,
      },
      {
        address: 10322716,
        value: 45216,
      },
      {
        address: 10322746,
        value: 832,
      },
      {
        address: 10322752,
        value: 836,
      },
      {
        address: 10322758,
        value: 840,
      },
      {
        address: 10322760,
        value: 61173,
      },
      {
        address: 10322900,
        value: 984,
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
        address: 10322910,
        value: 1032,
      },
      {
        address: 10322952,
        value: 35328,
      },
      {
        address: 10322954,
        value: 1036,
      },
      {
        address: 10322956,
        value: 1040,
      },
      {
        address: 10322962,
        value: 1044,
      },
      {
        address: 10322964,
        value: 63973,
      },
      {
        address: 10322982,
        value: 1112,
      },
      {
        address: 10323032,
        value: 1116,
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
        address: 10395992,
        value: 48729,
      },
      {
        address: 10395994,
        value: 59537,
      },
      {
        address: 10395996,
        value: 44117,
      },
      {
        address: 10395998,
        value: 56278,
      },
      {
        address: 10396000,
        value: 50720,
      },
    ],
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
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 3,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 5,
        opcode: 88,
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 7,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 0,
        operand: 16,
        length: 2,
        flow: 'next',
      },
      {
        pc: 10,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 12,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 20,
        operand: 3000,
        length: 3,
        flow: 'next',
      },
      {
        pc: 16,
        opcode: 88,
        operand: 153,
        length: 2,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 0,
        operand: 180,
        length: 2,
        flow: 'next',
      },
      {
        pc: 20,
        opcode: 20,
        operand: 500,
        length: 3,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 20,
        operand: 2048,
        length: 3,
        flow: 'next',
      },
      {
        pc: 26,
        opcode: 0,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 28,
        opcode: 0,
        operand: 11,
        length: 2,
        flow: 'next',
      },
      {
        pc: 30,
        opcode: 0,
        operand: 21,
        length: 2,
        flow: 'next',
      },
      {
        pc: 32,
        opcode: 0,
        operand: 11,
        length: 2,
        flow: 'next',
      },
      {
        pc: 34,
        opcode: 88,
        operand: 200,
        length: 2,
        flow: 'next',
      },
      {
        pc: 36,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 37,
        opcode: 88,
        operand: 197,
        length: 2,
        flow: 'next',
      },
      {
        pc: 39,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 40,
        opcode: 88,
        operand: 185,
        length: 2,
        flow: 'next',
      },
      {
        pc: 42,
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
        to: 3,
        kind: 'fallthrough',
      },
      {
        from: 3,
        to: 4,
        kind: 'fallthrough',
      },
      {
        from: 4,
        to: 5,
        kind: 'fallthrough',
      },
      {
        from: 5,
        to: 7,
        kind: 'fallthrough',
      },
      {
        from: 7,
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
        to: 16,
        kind: 'fallthrough',
      },
      {
        from: 16,
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
        to: 28,
        kind: 'fallthrough',
      },
      {
        from: 28,
        to: 30,
        kind: 'fallthrough',
      },
      {
        from: 30,
        to: 32,
        kind: 'fallthrough',
      },
      {
        from: 32,
        to: 34,
        kind: 'fallthrough',
      },
      {
        from: 34,
        to: 36,
        kind: 'fallthrough',
      },
      {
        from: 36,
        to: 37,
        kind: 'fallthrough',
      },
      {
        from: 37,
        to: 39,
        kind: 'fallthrough',
      },
      {
        from: 39,
        to: 40,
        kind: 'fallthrough',
      },
      {
        from: 40,
        to: 42,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    recordLifecycleBody: true,
    c8Observations: true,
    originalTextSources: true,
  },
];
export const recordLifecycleNativeSources = [
  {
    id: 51,
    target: 8440500,
    anchors: [
      {
        address: 8575006,
        bytes: [180, 202],
      },
      {
        address: 8575615,
        bytes: [2, 2],
      },
      {
        address: 8575395,
        bytes: [0, 0],
      },
    ],
  },
  {
    id: 197,
    target: 8428922,
    anchors: [
      {
        address: 8575298,
        bytes: [122, 157],
      },
      {
        address: 8575761,
        bytes: [1, 1],
      },
      {
        address: 8575541,
        bytes: [0, 2],
      },
    ],
  },
  {
    id: 106,
    target: 8432303,
    anchors: [
      {
        address: 8575116,
        bytes: [175, 170],
      },
      {
        address: 8575670,
        bytes: [2, 0],
      },
      {
        address: 8575450,
        bytes: [0, 2],
      },
    ],
  },
];
