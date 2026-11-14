// Individually pinned original direction bodies; explicit synthetic callers only.
export const directionBodySpecs = [
  {
    id: 539,
    scriptEntry: 10456658,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 8],
    bytecode: [
      44, 0, 0, 44, 88, 87, 190, 68, 41, 0, 0, 4, 192, 194, 88, 210, 0, 120, 0, 1, 88, 159, 188,
      194, 88, 108, 0, 3, 0, 255, 0, 58, 194, 88, 76, 194, 88, 91, 72, 44, 0, 194, 88, 185, 86,
    ],
    fetchTail: 1,
    sourceHash: 'ddea855bc93e01b1adcbe722c3e9ebc8de6cf3342111283a392f2b7839538ad7',
    romReads: [
      {
        address: 8439021,
        value: 32,
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
        address: 9210082,
        value: 3596,
      },
      {
        address: 9210083,
        value: 4110,
      },
      {
        address: 9210084,
        value: 4624,
      },
      {
        address: 9210085,
        value: 5138,
      },
      {
        address: 9210086,
        value: 5652,
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
        opcode: 0,
        operand: 44,
        length: 2,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 88,
        operand: 87,
        length: 2,
        flow: 'next',
      },
      {
        pc: 6,
        opcode: 190,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 7,
        opcode: 68,
        operand: 41,
        length: 3,
        flow: 'conditional',
      },
      {
        pc: 10,
        opcode: 0,
        operand: 4,
        length: 2,
        flow: 'next',
      },
      {
        pc: 12,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 14,
        opcode: 88,
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 16,
        opcode: 0,
        operand: 120,
        length: 2,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 20,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 22,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 24,
        opcode: 88,
        operand: 108,
        length: 2,
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
        operand: 255,
        length: 2,
        flow: 'next',
      },
      {
        pc: 30,
        opcode: 0,
        operand: 58,
        length: 2,
        flow: 'next',
      },
      {
        pc: 32,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 33,
        opcode: 88,
        operand: 76,
        length: 2,
        flow: 'next',
      },
      {
        pc: 35,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 36,
        opcode: 88,
        operand: 91,
        length: 2,
        flow: 'next',
      },
      {
        pc: 38,
        opcode: 72,
        operand: 44,
        length: 3,
        flow: 'jump',
      },
      {
        pc: 41,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 42,
        opcode: 88,
        operand: 185,
        length: 2,
        flow: 'next',
      },
      {
        pc: 44,
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
        to: 7,
        kind: 'fallthrough',
      },
      {
        from: 7,
        to: 41,
        kind: 'conditional',
      },
      {
        from: 7,
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
        to: 33,
        kind: 'fallthrough',
      },
      {
        from: 33,
        to: 35,
        kind: 'fallthrough',
      },
      {
        from: 35,
        to: 36,
        kind: 'fallthrough',
      },
      {
        from: 36,
        to: 38,
        kind: 'fallthrough',
      },
      {
        from: 38,
        to: 44,
        kind: 'jump',
      },
      {
        from: 41,
        to: 42,
        kind: 'fallthrough',
      },
      {
        from: 42,
        to: 44,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    directionBody: true,
    audioWait: true,
    audioObservations: true,
  },
  {
    id: 553,
    scriptEntry: 10285595,
    argumentBytes: 2,
    returnBytes: 0,
    header: [1, 14],
    bytecode: [
      44, 0, 0, 2, 192, 194, 88, 210, 20, 69, 1, 0, 1, 88, 159, 188, 0, 180, 0, 241, 20, 0, 4, 0, 4,
      0, 19, 0, 5, 0, 14, 88, 200, 0, 200, 0, 1, 88, 159, 188, 194, 88, 108, 86,
    ],
    fetchTail: 2,
    sourceHash: 'd30fdfa7ada54d86df21841c6c5508529f342e45e18bf7136ef9cc21a3b25f79',
    romReads: [
      {
        address: 8444826,
        value: 34901,
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
        address: 8498270,
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
        address: 8498288,
        value: 1542,
      },
      {
        address: 8498289,
        value: 1286,
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
        address: 8498307,
        value: 1542,
      },
      {
        address: 8498309,
        value: 1542,
      },
      {
        address: 8498331,
        value: 257,
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
        address: 9210082,
        value: 3596,
      },
      {
        address: 9210083,
        value: 4110,
      },
      {
        address: 9210084,
        value: 4624,
      },
      {
        address: 9210085,
        value: 5138,
      },
      {
        address: 9210086,
        value: 5652,
      },
      {
        address: 9210087,
        value: 15126,
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
        address: 10321936,
        value: 20,
      },
      {
        address: 10321938,
        value: 68,
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
        address: 10321952,
        value: 59876,
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
        address: 10322078,
        value: 228,
      },
      {
        address: 10322150,
        value: 58784,
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
        address: 10322176,
        value: 260,
      },
      {
        address: 10322182,
        value: 284,
      },
      {
        address: 10322204,
        value: 41192,
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
        address: 10322340,
        value: 424,
      },
      {
        address: 10322346,
        value: 57844,
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
        address: 10322422,
        value: 548,
      },
      {
        address: 10322468,
        value: 552,
      },
      {
        address: 10322474,
        value: 556,
      },
      {
        address: 10322476,
        value: 60641,
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
        address: 10322538,
        value: 58861,
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
        address: 10322594,
        value: 63464,
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
        address: 10322644,
        value: 728,
      },
      {
        address: 10322648,
        value: 62625,
      },
      {
        address: 10322654,
        value: 756,
      },
      {
        address: 10322678,
        value: 58528,
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
        address: 10322706,
        value: 820,
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
        address: 10322748,
        value: 62112,
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
        address: 10322798,
        value: 880,
      },
      {
        address: 10322800,
        value: 61669,
      },
      {
        address: 10322824,
        value: 62880,
      },
      {
        address: 10322838,
        value: 932,
      },
      {
        address: 10322852,
        value: 936,
      },
      {
        address: 10322856,
        value: 940,
      },
      {
        address: 10322858,
        value: 58085,
      },
      {
        address: 10322862,
        value: 948,
      },
      {
        address: 10322868,
        value: 952,
      },
      {
        address: 10322874,
        value: 57840,
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
        address: 10322910,
        value: 1032,
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
        address: 10322938,
        value: 59885,
      },
      {
        address: 10322952,
        value: 35328,
      },
      {
        address: 10322980,
        value: 1064,
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
        address: 10322994,
        value: 61157,
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
        address: 10323080,
        value: 1164,
      },
      {
        address: 10323084,
        value: 1168,
      },
      {
        address: 10323090,
        value: 1172,
      },
      {
        address: 10323092,
        value: 62452,
      },
      {
        address: 10323204,
        value: 1288,
      },
      {
        address: 10323210,
        value: 1312,
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
        address: 10323240,
        value: 1324,
      },
      {
        address: 10323246,
        value: 1328,
      },
      {
        address: 10323248,
        value: 62433,
      },
      {
        address: 10389589,
        value: 49111,
      },
      {
        address: 10389591,
        value: 63455,
      },
      {
        address: 10389593,
        value: 9141,
      },
      {
        address: 10389595,
        value: 20780,
      },
      {
        address: 10389597,
        value: 23390,
      },
      {
        address: 10389599,
        value: 35862,
      },
      {
        address: 10389601,
        value: 22519,
      },
      {
        address: 10389603,
        value: 22548,
      },
      {
        address: 10389605,
        value: 59801,
      },
      {
        address: 10389607,
        value: 62682,
      },
      {
        address: 10389609,
        value: 51264,
      },
      {
        address: 10389611,
        value: 18819,
      },
      {
        address: 10389613,
        value: 25,
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
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 192,
        operand: null,
        length: 1,
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
        operand: 210,
        length: 2,
        flow: 'next',
      },
      {
        pc: 8,
        opcode: 20,
        operand: 325,
        length: 3,
        flow: 'next',
      },
      {
        pc: 11,
        opcode: 0,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 13,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 16,
        opcode: 0,
        operand: 180,
        length: 2,
        flow: 'next',
      },
      {
        pc: 18,
        opcode: 0,
        operand: 241,
        length: 2,
        flow: 'next',
      },
      {
        pc: 20,
        opcode: 20,
        operand: 1024,
        length: 3,
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
        operand: 19,
        length: 2,
        flow: 'next',
      },
      {
        pc: 27,
        opcode: 0,
        operand: 5,
        length: 2,
        flow: 'next',
      },
      {
        pc: 29,
        opcode: 0,
        operand: 14,
        length: 2,
        flow: 'next',
      },
      {
        pc: 31,
        opcode: 88,
        operand: 200,
        length: 2,
        flow: 'next',
      },
      {
        pc: 33,
        opcode: 0,
        operand: 200,
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
        operand: 108,
        length: 2,
        flow: 'next',
      },
      {
        pc: 43,
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
    ],
    sourceRomGuards: true,
    directionBody: true,
    c8Observations: true,
    originalTextSources: true,
  },
];
export const directionNativeSources = [
  {
    id: 108,
    target: 8442322,
    anchors: [
      {
        address: 8575120,
        bytes: [210, 209],
      },
      {
        address: 8575672,
        bytes: [1, 1],
      },
      {
        address: 8575452,
        bytes: [0, 0],
      },
    ],
  },
];
