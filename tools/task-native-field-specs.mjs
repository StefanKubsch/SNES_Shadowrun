export const fieldLeafSpecs = [
  {
    name: 'native-cc33',
    id: 0x54,
    entry: 0x80cc33,
    windows: [{ start: 0x80cc33, hex: 'A5008DE91CA5028DEB1CA5048FE22D7E60' }],
    anchors: [
      { kind: 'pointer', start: 0x82d860, hex: '33CC' },
      { kind: 'argument-metadata', start: 0x82daa0, hex: '0301' },
      { kind: 'return-metadata', start: 0x82d9c4, hex: '0000' },
    ],
    contract:
      'Fresh DP00 -> actualDBR1CE9, then freshDP02 -> actualDBR1CEB, then freshDP04 -> long7E2DE2; full WORD stores and aliases, no destination reads, C/V preserved.',
  },
];
