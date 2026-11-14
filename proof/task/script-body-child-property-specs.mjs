// Own original0D1 source; full caller/property/child/text/input ownership required.
export const childPropertyBodySpecs = [
  {
    id: 209,
    scriptEntry: 10475190,
    argumentBytes: 2,
    returnBytes: 0,
    header: [2, 14],
    bytecode: [
      52, 0, 22, 0, 20, 178, 8, 88, 66, 68, 33, 0, 0, 1, 20, 17, 2, 192, 0, 3, 0, 21, 0, 2, 0, 5,
      88, 200, 88, 163, 72, 61, 0, 82, 75, 0, 20, 178, 8, 22, 0, 88, 116, 0, 1, 20, 16, 2, 192, 0,
      3, 0, 16, 0, 2, 0, 6, 88, 200, 88, 163, 86,
    ],
    fetchTail: 2,
    sourceHash: '701fe9cc1019e3ad652475219629c84d705b712f06328602b33d121ebfc77412',
    instructions: [
      {
        pc: 0,
        opcode: 52,
        operand: 0,
        length: 2,
        flow: 'next',
      },
      {
        pc: 2,
        opcode: 22,
        operand: 0,
        length: 2,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 20,
        operand: 2226,
        length: 3,
        flow: 'next',
      },
      {
        pc: 7,
        opcode: 88,
        operand: 66,
        length: 2,
        flow: 'next',
      },
      {
        pc: 9,
        opcode: 68,
        operand: 33,
        length: 3,
        flow: 'conditional',
      },
      {
        pc: 12,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 14,
        opcode: 20,
        operand: 529,
        length: 3,
        flow: 'next',
      },
      {
        pc: 17,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 0,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 20,
        opcode: 0,
        operand: 21,
        length: 2,
        flow: 'next',
      },
      {
        pc: 22,
        opcode: 0,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 24,
        opcode: 0,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 26,
        opcode: 88,
        operand: 200,
        length: 2,
        flow: 'next',
      },
      {
        pc: 28,
        opcode: 88,
        operand: 163,
        length: 2,
        flow: 'next',
      },
      {
        pc: 30,
        opcode: 72,
        operand: 61,
        length: 3,
        flow: 'jump',
      },
      {
        pc: 33,
        opcode: 82,
        operand: 75,
        length: 3,
        flow: 'next',
      },
      {
        pc: 36,
        opcode: 20,
        operand: 2226,
        length: 3,
        flow: 'next',
      },
      {
        pc: 39,
        opcode: 22,
        operand: 0,
        length: 2,
        flow: 'next',
      },
      {
        pc: 41,
        opcode: 88,
        operand: 116,
        length: 2,
        flow: 'next',
      },
      {
        pc: 43,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 45,
        opcode: 20,
        operand: 528,
        length: 3,
        flow: 'next',
      },
      {
        pc: 48,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 49,
        opcode: 0,
        operand: 3,
        length: 2,
        flow: 'next',
      },
      {
        pc: 51,
        opcode: 0,
        operand: 16,
        length: 2,
        flow: 'next',
      },
      {
        pc: 53,
        opcode: 0,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 55,
        opcode: 0,
        operand: 6,
        length: 2,
        flow: 'next',
      },
      {
        pc: 57,
        opcode: 88,
        operand: 200,
        length: 2,
        flow: 'next',
      },
      {
        pc: 59,
        opcode: 88,
        operand: 163,
        length: 2,
        flow: 'next',
      },
      {
        pc: 61,
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
        to: 7,
        kind: 'fallthrough',
      },
      {
        from: 7,
        to: 9,
        kind: 'fallthrough',
      },
      {
        from: 9,
        to: 33,
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
        to: 17,
        kind: 'fallthrough',
      },
      {
        from: 17,
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
        to: 61,
        kind: 'jump',
      },
      {
        from: 33,
        to: 36,
        kind: 'fallthrough',
      },
      {
        from: 36,
        to: 39,
        kind: 'fallthrough',
      },
      {
        from: 39,
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
        to: 45,
        kind: 'fallthrough',
      },
      {
        from: 45,
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
        to: 59,
        kind: 'fallthrough',
      },
      {
        from: 59,
        to: 61,
        kind: 'fallthrough',
      },
    ],
    romReads: [
      {
        address: 8445400,
        value: 41712,
      },
      {
        address: 8445402,
        value: 41732,
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
        address: 8498254,
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
        address: 8498261,
        value: 1540,
      },
      {
        address: 8498264,
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
        address: 8498321,
        value: 16191,
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
        address: 9285678,
        value: 0,
      },
      {
        address: 9285680,
        value: 24,
      },
      {
        address: 9285681,
        value: 59136,
      },
      {
        address: 9289761,
        value: 167,
      },
      {
        address: 9351199,
        value: 28792,
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
        address: 9827552,
        value: 4382,
      },
      {
        address: 9827553,
        value: 7697,
      },
      {
        address: 9827554,
        value: 4382,
      },
      {
        address: 9827555,
        value: 4369,
      },
      {
        address: 9827556,
        value: 7697,
      },
      {
        address: 9827557,
        value: 30,
      },
      {
        address: 9827558,
        value: 0,
      },
      {
        address: 9827559,
        value: 3584,
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
        address: 10321934,
        value: 84,
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
        address: 10322706,
        value: 820,
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
        address: 10322996,
        value: 1080,
      },
      {
        address: 10322998,
        value: 1092,
      },
      {
        address: 10323000,
        value: 1084,
      },
      {
        address: 10323004,
        value: 49664,
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
        address: 10323126,
        value: 1232,
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
        address: 10396400,
        value: 60502,
      },
      {
        address: 10396402,
        value: 63219,
      },
      {
        address: 10396404,
        value: 44626,
      },
      {
        address: 10396406,
        value: 31945,
      },
      {
        address: 10396408,
        value: 10974,
      },
      {
        address: 10396410,
        value: 31299,
      },
      {
        address: 10396412,
        value: 16271,
      },
      {
        address: 10396414,
        value: 37988,
      },
      {
        address: 10396416,
        value: 57963,
      },
      {
        address: 10396418,
        value: 49750,
      },
      {
        address: 10396420,
        value: 63703,
      },
      {
        address: 10396422,
        value: 37525,
      },
      {
        address: 10396424,
        value: 43553,
      },
      {
        address: 10396426,
        value: 24759,
      },
      {
        address: 10396428,
        value: 53207,
      },
      {
        address: 10396430,
        value: 30232,
      },
      {
        address: 10396432,
        value: 64377,
      },
      {
        address: 10396434,
        value: 2339,
      },
      {
        address: 10396436,
        value: 63274,
      },
      {
        address: 10396438,
        value: 46035,
      },
      {
        address: 10396440,
        value: 44382,
      },
      {
        address: 10396442,
        value: 22242,
      },
      {
        address: 10396444,
        value: 62402,
      },
    ],
    sourceRomGuards: true,
    scriptChildBody: true,
    childId: 75,
    recordPropertyChild: true,
    modalBody: true,
    c8Observations: true,
    originalTextSources: true,
    nativeA3Observations: true,
  },
];
