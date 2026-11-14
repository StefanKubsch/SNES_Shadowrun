import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const sceneIntroTables=[
 {start:0x81D85C,hex:'02F28400A84E51F28400A85693F28400A85E16F48400A866DDD88400A8760000'},
 {start:0x81DC78,hex:'00009600AC000A00F6005F00040016016F001000D6015F00FFFF'},
 {start:0x81D687,hex:'38FF003800FF3800FF01FF000008'},
 {start:0x81E949,hex:'040005000600070000F200F400F600F800FA00FF00FF00AF008F006F004F002F0000000000000000'},
 {start:0x81E12A,hex:'B400BC00B000B800AC00B100B700B4004E0052004C004F005100500050005200'},
 {start:0x98FFFA,hex:'ACFE9FC8FF99'},
];
export const sceneIntroSpecs=[
  {
    "name": "f092",
    "entry": 8515730,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515730,
        "hex": "08C210AABFFAFF98858CBFFBFF98858DA00200B78C8589C8B78C858AA00000B7893A3AAA8592E220A9012207F0819CE61CC220C8C8B7892022F1C8C8A592F027B78930342000F1C8C8B789858FC8B78985905AA00000E220B78F203AF0C8C498D0F6C2207A80D3E220203AF028",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515839,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515850,
        "hex": "29FF7FAA0A2000F1C8C8B7898598A5982022F1CAD0F880AA",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515591,
        "RTL"
      ],
      [
        8515874,
        "RTS"
      ],
      [
        8515840,
        "RTS"
      ],
      [
        8515642,
        "RTS"
      ]
    ],
    "instructions": 70,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:F0FF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "d83e",
    "entry": 8509502,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8509502,
        "hex": "4BABBD5CD8F016DA48BC5ED8BD60D8AA6822A0F2806818690600AA80E560",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8450720,
        "RTL"
      ]
    ],
    "programBankPushes": [
      8509502
    ],
    "indexPulls": [
      8509523
    ],
    "instructions": 17,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:D85B",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ]
  },
  {
    "name": "dc43",
    "entry": 8510531,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8510531,
        "hex": "088B4BABC230A200009BB978DC302318693C009D3E11B97ADC4A9D5E11B97CDC4A186938009D7E119818690600A8E8E880D8AB2860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "programBankPushes": [
      8510533
    ],
    "instructions": 30,
    "stackBytes": 5,
    "returns": [
      {
        "at": "81:DC77",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "d60f",
    "entry": 8508943,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8508943,
        "hex": "9C1C0D2297EB8122E9EB81A2EFF6A081002216EC81A20000203ED8A2FE07BFA8767E0900209FA8767ECACA10F1641E2043DC60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8509502,
        "hex": "4BABBD5CD8F016DA48BC5ED8BD60D8AA6822A0F2806818690600AA80E560",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8514455,
        "RTL"
      ],
      [
        8514537,
        "RTL"
      ],
      [
        8514582,
        "RTL"
      ],
      [
        8450720,
        "RTL"
      ],
      [
        8510531,
        "RTS"
      ]
    ],
    "programBankPushes": [
      8509502
    ],
    "indexPulls": [
      8509523
    ],
    "instructions": 35,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:D641",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ]
  },
  {
    "name": "d642",
    "entry": 8508994,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8508994,
        "hex": "08A9A88E8D7243E220A20D00BF87D6819FA88E7ECA10F5A9018D7043A9268D7143A97E8D7443A9808D0C42A9338D2321A9038D24218D2521A9178D2E219C2A219C2B2128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8509062,
        "hex": "60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 28,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:D686",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ddb1",
    "entry": 8510897,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8510897,
        "hex": "4BABA90300A20A0A2207F081A90F00A203002207F081A90800A27F7FDA2207F081A90200FA2207F0816B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515591,
        "RTL"
      ]
    ],
    "programBankPushes": [
      8510897
    ],
    "instructions": 16,
    "stackBytes": 5,
    "returns": [
      {
        "at": "81:DDDA",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ]
  },
  {
    "name": "e8e5",
    "entry": 8513765,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8513765,
        "hex": "08C230A21E00A9FFFF9D3E11CACA10F99C9E119CA0119CA211286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 13,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E8FF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "e900",
    "entry": 8513792,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8513792,
        "hex": "8620A20E008532BD3E113006CACA10F780369E3E11989D7E11A5209D5E118A29060048BD5E1138E532186940004A4A4A4A4A290F000AAABF51E981FA1F49E981AAA907002207F0816B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515591,
        "RTL"
      ]
    ],
    "dataPulls": [
      8513851
    ],
    "instructions": 37,
    "stackBytes": 5,
    "returns": [
      {
        "at": "81:E948",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ef63",
    "entry": 8515427,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515427,
        "hex": "F48080ABABA900008DE01C8DDE1C2229F281A900002292F081A203008EE21CA90F002207F081A90300A208082207F0816B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8516137,
        "RTL"
      ],
      [
        8515730,
        "RTL"
      ],
      [
        8515591,
        "RTL"
      ]
    ],
    "instructions": 17,
    "stackBytes": 5,
    "returns": [
      {
        "at": "81:EF93",
        "m": 0,
        "x": 0,
        "dbr": 128
      }
    ]
  },
  {
    "name": "dfe7",
    "entry": 8511463,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8511463,
        "hex": "084BABC230A900002229F281A903002292F08122E5E881200FD6A29FF7A081002216EC81A936008D3E118D4011A9FFFF8D42118D4411A928008D4E11A96C008D6E11A94C008D8E11A9FFFF8D70118D901122B1DD812042D6A20100A90F002207F081A90A802230F181A903002229F281A20A44A907002207F081A2C000A90F002207F081227BEB8122DDEE819CA211641A641CA22C01DA22BBEE812298F280AD4E111006A928008D4E11AD42111012A91A008D4211A964008D6211A963008D8211ADA211C96400B02B290700D01EADA2114A4A290E00AABD3AE14A18693800A8BD2AE14AAAA900002200E981A9FFFF8D4211802E38E94600EB850E4A8510AD701138E50E8D7011AD6E11E900008D6E11AD901138E5108D9011AD8E11E900008D8E11FAADCA01D006CAF0034C7DE022F1EE812289EB81A9058022F8CD812263EF81286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515427,
        "hex": "F48080ABABA900008DE01C8DDE1C2229F281A900002292F081A203008EE21CA90F002207F081A90300A208082207F0816B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8516137,
        "RTL"
      ],
      [
        8515730,
        "RTL"
      ],
      [
        8513765,
        "RTL"
      ],
      [
        8508943,
        "RTS"
      ],
      [
        8514582,
        "RTL"
      ],
      [
        8510897,
        "RTL"
      ],
      [
        8508994,
        "RTS"
      ],
      [
        8515591,
        "RTL"
      ],
      [
        8515888,
        "RTL"
      ],
      [
        8514427,
        "RTL"
      ],
      [
        8515293,
        "RTL"
      ],
      [
        8515259,
        "RTL"
      ],
      [
        8450712,
        "RTL"
      ],
      [
        8513792,
        "RTL"
      ],
      [
        8515313,
        "RTL"
      ],
      [
        8514441,
        "RTL"
      ],
      [
        8506872,
        "RTL"
      ]
    ],
    "programBankPushes": [
      8511464
    ],
    "instructions": 137,
    "stackBytes": 9,
    "returns": [
      {
        "at": "81:E129",
        "m": 0,
        "x": 0,
        "dbr": 128
      }
    ]
  }
];
export function proveSceneIntro(map,s){
 assertPinnedTaskSource(map,s.windows);
 const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),programBankPushes:new Set(s.programBankPushes??[]),indexPulls:new Set(s.indexPulls??[]),dataPulls:new Set(s.dataPulls??[])});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' scene intro source drift');
 return p;
}
