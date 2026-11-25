// Fixed original Native58 windows and table anchors, individually reviewed.
export const nextLeafSpecs = [
  {
    name: 'native-a926',
    id: 118,
    entry: 8431910,
    windows: [
      {
        start: 8431910,
        hex: 'A600AD50029D501360',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575140,
        hex: '26A9',
      },
      {
        kind: 'argument-metadata',
        start: 8575682,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575462,
        hex: '0000',
      },
    ],
    contract: 'Full DP00 X; actualDBR0250 WORD to actualDBR1350+X.',
  },
  {
    name: 'native-cc19',
    id: 155,
    entry: 8440857,
    windows: [
      {
        start: 8440857,
        hex: 'A600BFBB3B7E05029FBB3B7E60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575214,
        hex: '19CC',
      },
      {
        kind: 'argument-metadata',
        start: 8575719,
        hex: '0202',
      },
      {
        kind: 'return-metadata',
        start: 8575499,
        hex: '0000',
      },
    ],
    contract: 'Full DP00 X; long WORD7E3BBB+X OR fresh DP02 WORD and original long store.',
  },
  {
    name: 'native-d17b',
    id: 164,
    entry: 8442235,
    windows: [
      {
        start: 8442235,
        hex: 'A600BD0014290180850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575232,
        hex: '7BD1',
      },
      {
        kind: 'argument-metadata',
        start: 8575728,
        hex: '0100',
      },
      {
        kind: 'return-metadata',
        start: 8575508,
        hex: '0202',
      },
    ],
    contract: 'Full DP00 X; actualDBR1400+X WORD AND8001 to DP00.',
  },
  {
    name: 'native-d985',
    id: 162,
    entry: 8444293,
    windows: [
      {
        start: 8444293,
        hex: 'A50029FE018D431D60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575228,
        hex: '85D9',
      },
      {
        kind: 'argument-metadata',
        start: 8575726,
        hex: '0100',
      },
      {
        kind: 'return-metadata',
        start: 8575506,
        hex: '0000',
      },
    ],
    contract: 'DP00 WORD AND01FE to actualDBR1D43.',
  },
  {
    name: 'native-d98e',
    id: 190,
    entry: 8444302,
    windows: [
      {
        start: 8444302,
        hex: 'A50029FE018D451D60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575284,
        hex: '8ED9',
      },
      {
        kind: 'argument-metadata',
        start: 8575754,
        hex: '0101',
      },
      {
        kind: 'return-metadata',
        start: 8575534,
        hex: '0002',
      },
    ],
    contract: 'DP00 WORD AND01FE to actualDBR1D45.',
  },
  {
    name: 'native-d9a7',
    id: 180,
    entry: 8444327,
    windows: [
      {
        start: 8444327,
        hex: 'A5000A660060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575264,
        hex: 'A7D9',
      },
      {
        kind: 'argument-metadata',
        start: 8575744,
        hex: '0102',
      },
      {
        kind: 'return-metadata',
        start: 8575524,
        hex: '0200',
      },
    ],
    contract:
      'LDA fullDP00; ASL A gives original bit15 Carry, then fresh WORD ROR DP00 uses that Carry. Final NZ/C from memory ROR; A retains ASL result.',
  },
  {
    name: 'native-9e59',
    id: 211,
    entry: 8429145,
    windows: [
      {
        start: 8429145,
        hex: 'ADCA01850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575326,
        hex: '599E',
      },
      {
        kind: 'argument-metadata',
        start: 8575775,
        hex: '0001',
      },
      {
        kind: 'return-metadata',
        start: 8575555,
        hex: '0202',
      },
    ],
    contract: 'Full actualDBR01CA WORD to DP00; no input-device observation inferred.',
  },
  {
    name: 'native-9e5f',
    id: 97,
    entry: 8429151,
    windows: [
      {
        start: 8429151,
        hex: 'ADCE01850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575098,
        hex: '5F9E',
      },
      {
        kind: 'argument-metadata',
        start: 8575661,
        hex: '0002',
      },
      {
        kind: 'return-metadata',
        start: 8575441,
        hex: '0202',
      },
    ],
    contract: 'Full actualDBR01CE WORD to DP00; no frame or input chronology inferred.',
  },
  {
    name: 'native-c0f7',
    id: 137,
    entry: 8438007,
    windows: [
      {
        start: 8438007,
        hex: 'ADD50129FF00850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575178,
        hex: 'F7C0',
      },
      {
        kind: 'argument-metadata',
        start: 8575701,
        hex: '0000',
      },
      {
        kind: 'return-metadata',
        start: 8575481,
        hex: '0202',
      },
    ],
    contract: 'Read full actualDBR01D5 WORD before mask00FF and DP00 WORD store.',
  },
  {
    name: 'native-c100',
    id: 139,
    entry: 8438016,
    windows: [
      {
        start: 8438016,
        hex: 'ADD70129FF00850060',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575182,
        hex: '00C1',
      },
      {
        kind: 'argument-metadata',
        start: 8575703,
        hex: '0001',
      },
      {
        kind: 'return-metadata',
        start: 8575483,
        hex: '0200',
      },
    ],
    contract: 'Read full actualDBR01D7 WORD before mask00FF and DP00 WORD store.',
  },
  {
    name: 'native-e255',
    id: 201,
    entry: 8446549,
    windows: [
      {
        start: 8446549,
        hex: 'A9D40D8D871DA91D008D891D60',
      },
    ],
    anchors: [
      {
        kind: 'pointer',
        start: 8575306,
        hex: '55E2',
      },
      {
        kind: 'argument-metadata',
        start: 8575765,
        hex: '0000',
      },
      {
        kind: 'return-metadata',
        start: 8575545,
        hex: '0002',
      },
    ],
    contract:
      'Load0DD4/store actualDBR1D87 then load001D/store actualDBR1D89; final flags from001D.',
  },
];
