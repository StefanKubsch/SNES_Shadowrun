// Whole original3A4 with individual ROM reads under explicitly observed caller longpointer; no pointer initialization or motion/time inference.
export const slotFieldsBodySpecs = [
  {
    id: 932,
    scriptEntry: 10284057,
    argumentBytes: 4,
    returnBytes: 0,
    header: [2, 4],
    bytecode: [44, 0, 44, 1, 0, 2, 194, 88, 209, 2, 1, 194, 88, 129, 192, 0, 4, 88, 159, 188, 86],
    fetchTail: 1,
    sourceHash: '44a9d0002ff7fce7b8e2df6569e6dc11603b9deb448f963e8e2e9755db4efbf0',
    romReads: [
      {
        address: 9235872,
        value: 35014,
      },
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
        address: 9210117,
        value: 14384,
      },
      {
        address: 9277441,
        value: 4,
      },
      {
        address: 9277443,
        value: 5932,
      },
      {
        address: 9277447,
        value: 17920,
      },
      {
        address: 9277449,
        value: 64791,
      },
      {
        address: 9277453,
        value: 6002,
      },
      {
        address: 9277455,
        value: 1080,
      },
      {
        address: 9277459,
        value: 63511,
      },
      {
        address: 9277461,
        value: 52482,
      },
      {
        address: 9278971,
        value: 64,
      },
      {
        address: 9278973,
        value: 9108,
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
        opcode: 44,
        operand: 1,
        length: 2,
        flow: 'next',
      },
      {
        pc: 4,
        opcode: 0,
        operand: 2,
        length: 2,
        flow: 'next',
      },
      {
        pc: 6,
        opcode: 194,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 7,
        opcode: 88,
        operand: 209,
        length: 2,
        flow: 'next',
      },
      {
        pc: 9,
        opcode: 2,
        operand: 1,
        length: 2,
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
        operand: 129,
        length: 2,
        flow: 'next',
      },
      {
        pc: 14,
        opcode: 192,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 15,
        opcode: 0,
        operand: 4,
        length: 2,
        flow: 'next',
      },
      {
        pc: 17,
        opcode: 88,
        operand: 159,
        length: 2,
        flow: 'next',
      },
      {
        pc: 19,
        opcode: 188,
        operand: null,
        length: 1,
        flow: 'next',
      },
      {
        pc: 20,
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
    ],
    sourceRomGuards: true,
    slotFieldsWait: true,
  },
];
export const slotFieldsBodyNativeSources = [
  {
    id: 129,
    target: 8439487,
    anchors: [
      {
        address: 8575162,
        bytes: [191, 198],
      },
      {
        address: 8575693,
        bytes: [2, 0],
      },
      {
        address: 8575473,
        bytes: [0, 0],
      },
    ],
  },
];
