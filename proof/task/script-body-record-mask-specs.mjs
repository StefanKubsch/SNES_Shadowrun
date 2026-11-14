// Whole original391: full record read, BYTE mask, separate early/full END results.
export const recordMaskBodySpecs = [
  {
    id: 913,
    scriptEntry: 10471656,
    argumentBytes: 2,
    returnBytes: 2,
    header: [1, 4],
    bytecode: [
      44, 0, 194, 88, 2, 0, 128, 126, 190, 70, 17, 0, 194, 88, 185, 192, 86, 20, 127, 255, 194, 88,
      122, 0, 64, 194, 88, 207, 192, 194, 88, 209, 194, 88, 108, 10, 255, 86,
    ],
    fetchTail: 1,
    sourceHash: '382f3a4533c05c6f930b4d7f22f8e8a90cebd5683637a129aa6b0f4cdaadd63c',
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
        operand: 128,
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
        opcode: 70,
        operand: 17,
        length: 3,
        flow: 'conditional',
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
        operand: 185,
        length: 2,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 16,
        opcode: 86,
        operand: null,
        length: 1,
        flow: 'end',
      },
      {
        pc: 17,
        opcode: 20,
        operand: 65407,
        length: 3,
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
        operand: 122,
        length: 2,
        flow: 'next',
      },
      {
        pc: 23,
        opcode: 0,
        operand: 64,
        length: 2,
        flow: 'next',
      },
      {
        pc: 25,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 26,
        opcode: 88,
        operand: 207,
        length: 2,
        flow: 'next',
      },
      {
        pc: 28,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 29,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 30,
        opcode: 88,
        operand: 209,
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
        operand: 108,
        length: 2,
        flow: 'next',
      },
      {
        pc: 35,
        opcode: 10,
        operand: 255,
        length: 2,
        flow: 'next',
      },
      {
        pc: 37,
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
        to: 17,
        kind: 'conditional',
      },
      {
        from: 9,
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
        to: 16,
        kind: 'fallthrough',
      },
      {
        from: 17,
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
        to: 29,
        kind: 'fallthrough',
      },
      {
        from: 29,
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
        to: 37,
        kind: 'fallthrough',
      },
    ],
    sourceRomGuards: true,
    recordMaskBody: true,
  },
];
export const recordMaskNativeSources = [
  {
    id: 122,
    target: 8440522,
    anchors: [
      {
        address: 8575148,
        bytes: [202, 202],
      },
      {
        address: 8575686,
        bytes: [2, 1],
      },
      {
        address: 8575466,
        bytes: [0, 0],
      },
    ],
  },
];
