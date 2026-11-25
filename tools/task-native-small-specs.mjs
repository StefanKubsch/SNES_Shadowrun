// Fixed reviewed original source windows and Native58 anchors.
export const smallFamilySpecs = [
  {
    name: 'native-e1b3',
    id: 109,
    entry: 8446387,
    windows: [
      {
        start: 8446387,
        hex: 'A20000BF1C3C7EF008C500F00EE8E880F29F1E3C7EA5009F1C3C7E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575122,
        hex: 'B3E1',
      },
      {
        kind: 'argument-metadata',
        start: 8575673,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575453,
        hex: '0002',
      },
    ],
    contract:
      'Fresh WORD list scan, zero insertion or equality return; full X+2 wrap, CMP carry, zero next WORD before fresh DP00 store. No count/cap/termination invented.',
  },
  {
    name: 'native-913c',
    id: 126,
    entry: 8425788,
    windows: [
      {
        start: 8425788,
        hex: 'E220A20000BFA33C7EC9FFF00DC500F003E880F1A9FF9FD63C7EC22060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575156,
        hex: '3C91',
      },
      {
        kind: 'argument-metadata',
        start: 8575690,
        hex: '0100',
      },
      {
        kind: 'return-metadata',
        start: 8575470,
        hex: '0002',
      },
    ],
    contract:
      'BYTE list scan with original SEP20/REP20, full WORD X+1, FF sentinel before DP00 low comparison, only matching flag byte store. A high preserved, true CMP/load flags.',
  },
  {
    name: 'native-cb9f',
    id: 96,
    entry: 8440735,
    windows: [
      {
        start: 8440735,
        hex: 'A600BF20B08DF00BAAE220A5029F01007EC22060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575096,
        hex: '9FCB',
      },
      {
        kind: 'argument-metadata',
        start: 8575660,
        hex: '0200',
      },
      {
        kind: 'return-metadata',
        start: 8575440,
        hex: '0002',
      },
    ],
    contract:
      'Original full WORD table lookup, zero gate, BYTE DP02 load and single field write with high A preserved.',
  },
  {
    name: 'native-8b16',
    id: 52,
    entry: 8424214,
    windows: [
      {
        start: 8424214,
        hex: 'AD601F0A0AAAA400B90A159F2E3C7EA502E2209F303C7EC220ADDA011005AEC20C8003AEDE01A5029FF8437E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575008,
        hex: '168B',
      },
      {
        kind: 'argument-metadata',
        start: 8575616,
        hex: '0201',
      },
      {
        kind: 'return-metadata',
        start: 8575396,
        hex: '0000',
      },
    ],
    contract:
      'Full WORD 1F60 twice ASL, unaligned record WORD and BYTE stores, actual signed01DA gate and fresh CC2/01DE selected full index.',
  },
];
