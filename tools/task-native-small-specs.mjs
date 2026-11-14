// Fixed reviewed original source windows and Native58 anchors.
export const smallFamilySpecs=[
  {
    "name": "native-e1b3",
    "id": 109,
    "entry": 8446387,
    "windows": [
      {
        "start": 8446387,
        "hex": "A20000BF1C3C7EF008C500F00EE8E880F29F1E3C7EA5009F1C3C7E60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575122,
        "hex": "B3E1"
      },
      {
        "kind": "argument-metadata",
        "start": 8575673,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575453,
        "hex": "0002"
      }
    ],
    "contract": "Fresh WORD list scan, zero insertion or equality return; full X+2 wrap, CMP carry, zero next WORD before fresh DP00 store. No count/cap/termination invented."
  },
  {
    "name": "native-913c",
    "id": 126,
    "entry": 8425788,
    "windows": [
      {
        "start": 8425788,
        "hex": "E220A20000BFA33C7EC9FFF00DC500F003E880F1A9FF9FD63C7EC22060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575156,
        "hex": "3C91"
      },
      {
        "kind": "argument-metadata",
        "start": 8575690,
        "hex": "0100"
      },
      {
        "kind": "return-metadata",
        "start": 8575470,
        "hex": "0002"
      }
    ],
    "contract": "BYTE list scan with original SEP20/REP20, full WORD X+1, FF sentinel before DP00 low comparison, only matching flag byte store. A high preserved, true CMP/load flags."
  },
  {
    "name": "native-d105",
    "id": 182,
    "entry": 8442117,
    "windows": [
      {
        "start": 8442117,
        "hex": "A600A5020A0A0A38E502E502A8C8B7F30A0A9D280EC8C8B7F30A0A9D800EC8C8B7F30A0A9DD80EA900009FE0407E60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575268,
        "hex": "05D1"
      },
      {
        "kind": "argument-metadata",
        "start": 8575746,
        "hex": "0201"
      },
      {
        "kind": "return-metadata",
        "start": 8575526,
        "hex": "0000"
      }
    ],
    "contract": "Three ASL then SEC/SBC/SBC with retained borrow, full X/Y, three fresh long pointers and WORD reads before two ASL stores; no six-times replacement or cached pointer."
  },
  {
    "name": "native-cb9f",
    "id": 96,
    "entry": 8440735,
    "windows": [
      {
        "start": 8440735,
        "hex": "A600BF20B08DF00BAAE220A5029F01007EC22060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575096,
        "hex": "9FCB"
      },
      {
        "kind": "argument-metadata",
        "start": 8575660,
        "hex": "0200"
      },
      {
        "kind": "return-metadata",
        "start": 8575440,
        "hex": "0002"
      }
    ],
    "contract": "Original full WORD table lookup, zero gate, BYTE DP02 load and single field write with high A preserved."
  },
  {
    "name": "native-aa4c",
    "id": 175,
    "entry": 8432204,
    "windows": [
      {
        "start": 8432204,
        "hex": "A600A900009F40427E9F98427E9FF0427E9F48437E9FA0437E9FE0407E9D40119F803F7E9D9010A9FFFF9D3810A980009F30407EA901009FD83F7EBDA012F0228517186D1C0D8D1C0DBCF812B964159DF812AD1E0D8C1E0D996415C617D0EA9EA01260"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575254,
        "hex": "4CAA"
      },
      {
        "kind": "argument-metadata",
        "start": 8575739,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575519,
        "hex": "0000"
      }
    ],
    "contract": "Original whole linked release loop, fresh DP17 countdown and source-order link/free stores. Same individually proved AA4C helper equations, separate root return and table anchors."
  },
  {
    "name": "native-8b16",
    "id": 52,
    "entry": 8424214,
    "windows": [
      {
        "start": 8424214,
        "hex": "AD601F0A0AAAA400B90A159F2E3C7EA502E2209F303C7EC220ADDA011005AEC20C8003AEDE01A5029FF8437E60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575008,
        "hex": "168B"
      },
      {
        "kind": "argument-metadata",
        "start": 8575616,
        "hex": "0201"
      },
      {
        "kind": "return-metadata",
        "start": 8575396,
        "hex": "0000"
      }
    ],
    "contract": "Full WORD 1F60 twice ASL, unaligned record WORD and BYTE stores, actual signed01DA gate and fresh CC2/01DE selected full index."
  },
  {
    "name": "native-8b9f",
    "id": 35,
    "entry": 8424351,
    "windows": [
      {
        "start": 8424351,
        "hex": "AD601F0A0AAAA400B90A159F313C7EE220A5029F333C7EA5049F343C7EA5069F353C7EC22060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8574974,
        "hex": "9F8B"
      },
      {
        "kind": "argument-metadata",
        "start": 8575599,
        "hex": "0402"
      },
      {
        "kind": "return-metadata",
        "start": 8575379,
        "hex": "0000"
      }
    ],
    "contract": "Full WORD 1F60 twice ASL, record WORD plus three fresh BYTE arguments; preserve actual byte-load N/Z and second shift carry."
  },
  {
    "name": "native-cb2b",
    "id": 187,
    "entry": 8440619,
    "windows": [
      {
        "start": 8440619,
        "hex": "A600BF20B08DAABF01007E29FF00850060"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575278,
        "hex": "2BCB"
      },
      {
        "kind": "argument-metadata",
        "start": 8575751,
        "hex": "0102"
      },
      {
        "kind": "return-metadata",
        "start": 8575531,
        "hex": "0200"
      }
    ],
    "contract": "Full index table WORD, no zero guard, full field WORD read before low mask and DP00 result store."
  },
  {
    "name": "native-ccdb",
    "id": 153,
    "entry": 8441051,
    "windows": [
      {
        "start": 8441051,
        "hex": "18AF0D3C7E650090168F0D3C7EAF0F3C7E1A8F0F3C7ED00BA9FFFF8F0F3C7E8F0D3C7E60"
      }
    ],
    "anchors": [
      {
        "kind": "pointer",
        "start": 8575210,
        "hex": "DBCC"
      },
      {
        "kind": "argument-metadata",
        "start": 8575717,
        "hex": "0101"
      },
      {
        "kind": "return-metadata",
        "start": 8575497,
        "hex": "0000"
      }
    ],
    "contract": "Actual binary CLC/ADC, carry-only high INC path. Saturation overwrites high and then low with FFFF on wrap; no conventional saturating-counter replacement."
  }
];
