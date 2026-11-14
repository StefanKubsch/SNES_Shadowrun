// European-ROM source pins; conditional hardware requests, no DMA/NMI execution.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const sceneVideoSpecs=[
  {
    "name": "eb7b",
    "entry": 8514427,
    "windows": [
      {
        "start": 8514427,
        "hex": "08E220A530098185308D004228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514440,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 8,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EB88",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "eb89",
    "entry": 8514441,
    "windows": [
      {
        "start": 8514441,
        "hex": "08E220A530297F85308D004228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514454,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 8,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EB96",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ebe9",
    "entry": 8514537,
    "windows": [
      {
        "start": 8514537,
        "hex": "08E220A9008D0721A9048D0821A9088D0921A9248D0B21A9018D0C21A9438D0121A9098D0521A9178D2C2128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514581,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 20,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EC15",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ed8b",
    "entry": 8514955,
    "windows": [
      {
        "start": 8514955,
        "hex": "08C210E220A200008E02219C0043A9048D0143A21E0F8E0243A97E8D0443A220028E0543A9018D0B4228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514997,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 18,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EDB5",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "edb6",
    "entry": 8514998,
    "windows": [
      {
        "start": 8514998,
        "hex": "08C230A20000A9FFF09D1E0FE8E8E8E8E00002D0F49E1E0FE8E8E02002D0F6286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 18,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EDD6",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ee22",
    "entry": 8515106,
    "windows": [
      {
        "start": 8515106,
        "hex": "08C220E210A2808E1521A2098E0043A2188E0143A94EEE8D0243A2818E04439C05439C1621A2018E0B4228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 1
      },
      {
        "start": 8515149,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 19,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EE4D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ee4f",
    "entry": 8515151,
    "windows": [
      {
        "start": 8515151,
        "hex": "08E230A2029E01219E1521CA10F7A2079E05219E0D219E0D21CA10F49C21219C1A21A9019C1B218D1B219C1C219C1C219C1D219C1D219C1E218D1E219C1F219C1F219C20219C20219C3321A20E9E23219E0042CA10F7A9FF8D0142A9E08D3221A9308D3021A9018D0D4228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515258,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 44,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EEBA",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ecf2",
    "entry": 8514802,
    "windows": [
      {
        "start": 8514802,
        "hex": "0885208422860EA50E29FF000A8510A50F29FF000AAAE220A50F8D2121A00000B7209F1E0D7E8D2221E8C8B7209F1E0D7E8D2221E8C8C410D0E628",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514861,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 30,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:ED2D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c109",
    "entry": 8438025,
    "windows": [
      {
        "start": 8438025,
        "hex": "08866EE210847028",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 1
      },
      {
        "start": 8438033,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 6,
    "stackBytes": 4,
    "returns": [
      {
        "at": "80:C111",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "eb97",
    "entry": 8514455,
    "windows": [
      {
        "start": 8514455,
        "hex": "7808E220A90185308D0042A9808D00212289EB81A215ECA081002209C180224FEE812222EE8122B6ED81228BED81A9108D2121A2FF00AD1C0D8D2221AD1D0D8D2221CA10F19C1C0D9C1D0DA20000862E28",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514536,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8514441,
        "hex": "08E220A530297F85308D0042286B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8438025,
        "hex": "08866EE210847028",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8438033,
        "hex": "6B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515151,
        "hex": "08E230A2029E01219E1521CA10F7A2079E05219E0D219E0D21CA10F49C21219C1A21A9019C1B218D1B219C1C219C1C219C1D219C1D219C1E218D1E219C1F219C1F219C20219C20219C3321A20E9E23219E0042CA10F7A9FF8D0142A9E08D3221A9308D3021A9018D0D4228",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515258,
        "hex": "6B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515106,
        "hex": "08C220E210A2808E1521A2098E0043A2188E0143A94EEE8D0243A2818E04439C05439C1621A2018E0B4228",
        "initialM": 1,
        "initialX": 0,
        "finalM": 0,
        "finalX": 1
      },
      {
        "start": 8515149,
        "hex": "6B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514998,
        "hex": "08C230A20000A9FFF09D1E0FE8E8E8E8E00002D0F49E1E0FE8E8E02002D0F628",
        "initialM": 1,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515030,
        "hex": "6B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514955,
        "hex": "08C210E220A200008E02219C0043A9048D0143A21E0F8E0243A97E8D0443A220028E0543A9018D0B42286B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 144,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:EBE8",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ec16",
    "entry": 8514582,
    "windows": [
      {
        "start": 8514582,
        "hex": "088628842AA00000B72829FF00F0080AAAC8FC2FEC80F1286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8514625,
        "hex": "60B728856EC8C8B7288570C8C8605AB728AAC8C8B72848C8C8B7287A22F2EC816818690600A86008E220A9808D1521A9018D0043A9188D0143C220B7288D1621C8C8B7288524C8C8B7288526C8C8B7288D0543C8C85AA524A426A2A84622A0F2807AE220A2A8468E0243A97E8D0443A9018D0B4228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514742,
        "hex": "608BF48080ABABB728850EC8C8E220B728920EC220C8AB60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8514766,
        "hex": "606060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8514802,
        "hex": "0885208422860EA50E29FF000A8510A50F29FF000AAAE220A50F8D2121A00000B7209F1E0D7E8D2221E8C8B7209F1E0D7E8D2221E8C8C410D0E628",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8514861,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [
      [
        8450720,
        "RTL"
      ]
    ],
    "dataPulls": [
      8514652
    ],
    "indexPulls": [
      8514657
    ],
    "indirectCalls": [
      [
        8514600,
        [
          8514625,
          8514626,
          8514639,
          8514664,
          8514743,
          8514766,
          8514767,
          8514768
        ]
      ]
    ],
    "table": {
      "start": 8514607,
      "hex": "000041EC42EC68EC4FECB7ECCEECCFECD0EC"
    },
    "instructions": 129,
    "stackBytes": 12,
    "returns": [
      {
        "at": "81:EC2E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "f2a0",
    "entry": 8450720,
    "rootReturn": "RTL",
    "externalReturns": [],
    "windows": [
      {
        "start": 8450720,
        "hex": "204D9F6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "name": "unpackRoot",
        "start": 8429389,
        "hex": "088B85E184E386DD86DF64EBF47E7EABABA00000B7E1209B9EAB2860"
      },
      {
        "name": "unpackData",
        "start": 8429211,
        "hex": "85DB48C8C818B7E169020085E5A9040085E764E964EF800520659EB046A9010020659EB00620659E2A80F5A4E7A6DF85EB4A85EDF01108B7E1C8C89D0000E8E8C6EDD0F328900BE220B7E1C89D0000E8C22086DF84E7A5EB1865E985E9C5DB90028049E230A908A6EAD004A900A6E9187F33A080AAC230A9000020659E2ACAD0F91865DDAAA9010020659EB00720659E2A4C239F1A85EBA4DF547E7E84DF38A5EB65E985E9C5DBB0034CB39E6860"
      },
      {
        "name": "unpackBits",
        "start": 8429157,
        "hex": "C6EF101248A90F0085EFA4E5B7E1EB85F1C8C884E56806F160"
      }
    ],
    "instructions": 124,
    "stackBytes": 15,
    "returns": [
      {
        "at": "80:F2A3",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "f2a4",
    "entry": 8450724,
    "rootReturn": "RTL",
    "externalReturns": [
      [
        8429421,
        "RTS"
      ]
    ],
    "windows": [
      {
        "start": 8450724,
        "hex": "206D9F6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 2,
    "stackBytes": 3,
    "returns": [
      {
        "at": "80:F2A7",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveSceneVideo(map,s){
 assertPinnedTaskSource(map,s.windows);
 const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),indirectCalls:new Map(s.indirectCalls??[]),dataPulls:new Set(s.dataPulls??[]),indexPulls:new Set(s.indexPulls??[])});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' scene source drift');
 return p;
}
