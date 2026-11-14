// Fixed original Native58 windows and table anchors, individually reviewed.
export const nextLeafSpecs=[
  {
    "name": "native-a963",
    "id": 80,
    "entry": 8431971,
    "windows": [
      {
        "start": 8431971,
        "hex": "A600BD800E4A4A850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575064,
        "hex": "63A9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575644,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575424,
        "hex": "0202"
      }
    ],
    "contract": "Full DP00 X; actualDBR0E80+X WORD, two logical right shifts, WORD result DP00."
  },
  {
    "name": "native-a96d",
    "id": 81,
    "entry": 8431981,
    "windows": [
      {
        "start": 8431981,
        "hex": "A600BDD80E4A4A850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575066,
        "hex": "6DA9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575645,
        "hex": "0102"
      },
      {
        "kind": "return-metadata",
        "start": 8575425,
        "hex": "0200"
      }
    ],
    "contract": "Full DP00 X; actualDBR0ED8+X WORD, two logical right shifts, WORD result DP00."
  },
  {
    "name": "native-a91d",
    "id": 91,
    "entry": 8431901,
    "windows": [
      {
        "start": 8431901,
        "hex": "A600A9FFFF9D501360"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575086,
        "hex": "1DA9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575655,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575435,
        "hex": "0002"
      }
    ],
    "contract": "Full DP00 X; load FFFF and write actualDBR1350+X, no destination read."
  },
  {
    "name": "native-a926",
    "id": 118,
    "entry": 8431910,
    "windows": [
      {
        "start": 8431910,
        "hex": "A600AD50029D501360"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575140,
        "hex": "26A9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575682,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575462,
        "hex": "0000"
      }
    ],
    "contract": "Full DP00 X; actualDBR0250 WORD to actualDBR1350+X."
  },
  {
    "name": "native-a92f",
    "id": 121,
    "entry": 8431919,
    "windows": [
      {
        "start": 8431919,
        "hex": "A600A5029D200DA5049D780DA5069DD00D60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575146,
        "hex": "2FA9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575685,
        "hex": "0402"
      },
      {
        "kind": "return-metadata",
        "start": 8575465,
        "hex": "0000"
      }
    ],
    "contract": "Full DP00 X; fresh DP02/04/06 WORDs in original order to actualDBR0D20/0D78/0DD0+X."
  },
  {
    "name": "native-ca05",
    "id": 147,
    "entry": 8440325,
    "windows": [
      {
        "start": 8440325,
        "hex": "A600BD5814850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575198,
        "hex": "05CA"
      },
      {
        "kind": "argument-metadata",
        "start": 8575711,
        "hex": "0100"
      },
      {
        "kind": "return-metadata",
        "start": 8575491,
        "hex": "0200"
      }
    ],
    "contract": "Full DP00 X; fresh actualDBR1458+X WORD result to DP00."
  },
  {
    "name": "native-ca15",
    "id": 207,
    "entry": 8440341,
    "windows": [
      {
        "start": 8440341,
        "hex": "A600A5021D58149D581460"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575318,
        "hex": "15CA"
      },
      {
        "kind": "argument-metadata",
        "start": 8575771,
        "hex": "0200"
      },
      {
        "kind": "return-metadata",
        "start": 8575551,
        "hex": "0002"
      }
    ],
    "contract": "Full DP00 X; DP02 WORD OR fresh actualDBR1458+X then original destination write."
  },
  {
    "name": "native-cc07",
    "id": 87,
    "entry": 8440839,
    "windows": [
      {
        "start": 8440839,
        "hex": "A600BFBB3B7E850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575078,
        "hex": "07CC"
      },
      {
        "kind": "argument-metadata",
        "start": 8575651,
        "hex": "0100"
      },
      {
        "kind": "return-metadata",
        "start": 8575431,
        "hex": "0202"
      }
    ],
    "contract": "Full DP00 X; full long WORD7E3BBB+X result DP00."
  },
  {
    "name": "native-cc19",
    "id": 155,
    "entry": 8440857,
    "windows": [
      {
        "start": 8440857,
        "hex": "A600BFBB3B7E05029FBB3B7E60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575214,
        "hex": "19CC"
      },
      {
        "kind": "argument-metadata",
        "start": 8575719,
        "hex": "0202"
      },
      {
        "kind": "return-metadata",
        "start": 8575499,
        "hex": "0000"
      }
    ],
    "contract": "Full DP00 X; long WORD7E3BBB+X OR fresh DP02 WORD and original long store."
  },
  {
    "name": "native-d255",
    "id": 93,
    "entry": 8442453,
    "windows": [
      {
        "start": 8442453,
        "hex": "A600BD981129FF00850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575090,
        "hex": "55D2"
      },
      {
        "kind": "argument-metadata",
        "start": 8575657,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575437,
        "hex": "0200"
      }
    ],
    "contract": "Full DP00 X; read both bytes at actualDBR1198+X before mask00FF and DP00 WORD store."
  },
  {
    "name": "native-d1ca",
    "id": 204,
    "entry": 8442314,
    "windows": [
      {
        "start": 8442314,
        "hex": "A600BD0A15850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575312,
        "hex": "CAD1"
      },
      {
        "kind": "argument-metadata",
        "start": 8575768,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575548,
        "hex": "0202"
      }
    ],
    "contract": "Full DP00 X; actualDBR150A+X WORD result DP00."
  },
  {
    "name": "native-d17b",
    "id": 164,
    "entry": 8442235,
    "windows": [
      {
        "start": 8442235,
        "hex": "A600BD0014290180850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575232,
        "hex": "7BD1"
      },
      {
        "kind": "argument-metadata",
        "start": 8575728,
        "hex": "0100"
      },
      {
        "kind": "return-metadata",
        "start": 8575508,
        "hex": "0202"
      }
    ],
    "contract": "Full DP00 X; actualDBR1400+X WORD AND8001 to DP00."
  },
  {
    "name": "native-d16d",
    "id": 179,
    "entry": 8442221,
    "windows": [
      {
        "start": 8442221,
        "hex": "A600BD001429FE7F05029D001460"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575262,
        "hex": "6DD1"
      },
      {
        "kind": "argument-metadata",
        "start": 8575743,
        "hex": "0201"
      },
      {
        "kind": "return-metadata",
        "start": 8575523,
        "hex": "0002"
      }
    ],
    "contract": "Full DP00 X; actualDBR1400+X WORD AND7FFE OR fresh full DP02, no mask on OR operand."
  },
  {
    "name": "native-d985",
    "id": 162,
    "entry": 8444293,
    "windows": [
      {
        "start": 8444293,
        "hex": "A50029FE018D431D60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575228,
        "hex": "85D9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575726,
        "hex": "0100"
      },
      {
        "kind": "return-metadata",
        "start": 8575506,
        "hex": "0000"
      }
    ],
    "contract": "DP00 WORD AND01FE to actualDBR1D43."
  },
  {
    "name": "native-d98e",
    "id": 190,
    "entry": 8444302,
    "windows": [
      {
        "start": 8444302,
        "hex": "A50029FE018D451D60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575284,
        "hex": "8ED9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575754,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575534,
        "hex": "0002"
      }
    ],
    "contract": "DP00 WORD AND01FE to actualDBR1D45."
  },
  {
    "name": "native-d9a7",
    "id": 180,
    "entry": 8444327,
    "windows": [
      {
        "start": 8444327,
        "hex": "A5000A660060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575264,
        "hex": "A7D9"
      },
      {
        "kind": "argument-metadata",
        "start": 8575744,
        "hex": "0102"
      },
      {
        "kind": "return-metadata",
        "start": 8575524,
        "hex": "0200"
      }
    ],
    "contract": "LDA fullDP00; ASL A gives original bit15 Carry, then fresh WORD ROR DP00 uses that Carry. Final NZ/C from memory ROR; A retains ASL result."
  },
  {
    "name": "native-94ee",
    "id": 181,
    "entry": 8426734,
    "windows": [
      {
        "start": 8426734,
        "hex": "A600A5029F50447E60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575266,
        "hex": "EE94"
      },
      {
        "kind": "argument-metadata",
        "start": 8575745,
        "hex": "0202"
      },
      {
        "kind": "return-metadata",
        "start": 8575525,
        "hex": "0000"
      }
    ],
    "contract": "Full DP00 X; DP02 WORD to long7E4450+X."
  },
  {
    "name": "native-9e59",
    "id": 211,
    "entry": 8429145,
    "windows": [
      {
        "start": 8429145,
        "hex": "ADCA01850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575326,
        "hex": "599E"
      },
      {
        "kind": "argument-metadata",
        "start": 8575775,
        "hex": "0001"
      },
      {
        "kind": "return-metadata",
        "start": 8575555,
        "hex": "0202"
      }
    ],
    "contract": "Full actualDBR01CA WORD to DP00; no input-device observation inferred."
  },
  {
    "name": "native-9e5f",
    "id": 97,
    "entry": 8429151,
    "windows": [
      {
        "start": 8429151,
        "hex": "ADCE01850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575098,
        "hex": "5F9E"
      },
      {
        "kind": "argument-metadata",
        "start": 8575661,
        "hex": "0002"
      },
      {
        "kind": "return-metadata",
        "start": 8575441,
        "hex": "0202"
      }
    ],
    "contract": "Full actualDBR01CE WORD to DP00; no frame or input chronology inferred."
  },
  {
    "name": "native-cd97",
    "id": 133,
    "entry": 8441239,
    "windows": [
      {
        "start": 8441239,
        "hex": "ADC20C850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575170,
        "hex": "97CD"
      },
      {
        "kind": "argument-metadata",
        "start": 8575697,
        "hex": "0001"
      },
      {
        "kind": "return-metadata",
        "start": 8575477,
        "hex": "0202"
      }
    ],
    "contract": "Full actualDBR0CC2 WORD to DP00 at distinct original entryCD97."
  },
  {
    "name": "native-c0f7",
    "id": 137,
    "entry": 8438007,
    "windows": [
      {
        "start": 8438007,
        "hex": "ADD50129FF00850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575178,
        "hex": "F7C0"
      },
      {
        "kind": "argument-metadata",
        "start": 8575701,
        "hex": "0000"
      },
      {
        "kind": "return-metadata",
        "start": 8575481,
        "hex": "0202"
      }
    ],
    "contract": "Read full actualDBR01D5 WORD before mask00FF and DP00 WORD store."
  },
  {
    "name": "native-c100",
    "id": 139,
    "entry": 8438016,
    "windows": [
      {
        "start": 8438016,
        "hex": "ADD70129FF00850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575182,
        "hex": "00C1"
      },
      {
        "kind": "argument-metadata",
        "start": 8575703,
        "hex": "0001"
      },
      {
        "kind": "return-metadata",
        "start": 8575483,
        "hex": "0200"
      }
    ],
    "contract": "Read full actualDBR01D7 WORD before mask00FF and DP00 WORD store."
  },
  {
    "name": "native-e255",
    "id": 201,
    "entry": 8446549,
    "windows": [
      {
        "start": 8446549,
        "hex": "A9D40D8D871DA91D008D891D60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575306,
        "hex": "55E2"
      },
      {
        "kind": "argument-metadata",
        "start": 8575765,
        "hex": "0000"
      },
      {
        "kind": "return-metadata",
        "start": 8575545,
        "hex": "0002"
      }
    ],
    "contract": "Load0DD4/store actualDBR1D87 then load001D/store actualDBR1D89; final flags from001D."
  },
  {
    "name": "native-d016",
    "id": 218,
    "entry": 8441878,
    "windows": [
      {
        "start": 8441878,
        "hex": "A9FFFF8DD81F60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575340,
        "hex": "16D0"
      },
      {
        "kind": "argument-metadata",
        "start": 8575782,
        "hex": "0001"
      },
      {
        "kind": "return-metadata",
        "start": 8575562,
        "hex": "0000"
      }
    ],
    "contract": "LoadFFFF and store actualDBR1FD8; no destination read."
  }
];
