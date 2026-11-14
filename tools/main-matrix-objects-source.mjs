// Original Matrix object/map/OAM equations; external helpers retain separate proofs.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const matrixObjectSpecs=[
  {
    "name": "b54c",
    "entry": 8500556,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500556,
        "hex": "186D5C178520A97F008522BD00170A0A0A0A0A187DF2160A1865208520A72029FF0360",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 20,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B56E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b56f",
    "entry": 8500591,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500591,
        "hex": "85126414A20000BDF216307BA5123DD6C2F06DAD56171DD6C28D5617A00000B942B6204CB5C90700F007C8C8C00800D0EE18BDF21679F9B59DF2160A0A0A0A850E18BD00177901B69D00170A0A0A0A8510A00000B942B6204CB5D95AB6D01AE61418A50E794AB6851A18A5107952B6851CB962B6851E20C8B8C8C8C00800D0D4E8E8E00E00D080A51460",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8500556,
        "RTS"
      ],
      [
        8501448,
        "RTS"
      ]
    ],
    "instructions": 65,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B5F8",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b8c8",
    "entry": 8501448,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501448,
        "hex": "DAA20000BD5613F009E8E8E04200D0F4FA60A51A9D2415A51C9D6615A51E9D5613A9B1BE9DA8159EEA15A906009D6E16A901009D2C16BD98130901009D9813A9050020C6B1FA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8499654,
        "RTS"
      ]
    ],
    "instructions": 30,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:B8D9",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:B90E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b1c6",
    "entry": 8499654,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499654,
        "hex": "DA5A48A20F00A90F002207F081680900FFAAA907002207F0817AFA60",
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
    "instructions": 14,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:B1E1",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bd7c",
    "entry": 8502652,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8502652,
        "hex": "642C22D7ED81A20000BD5613F0032099BDE8E8E04200D0F1220CEE8160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515031,
        "RTL"
      ],
      [
        8502681,
        "RTS"
      ],
      [
        8515084,
        "RTL"
      ]
    ],
    "instructions": 12,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:BD98",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bd99",
    "entry": 8502681,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8502681,
        "hex": "18BD24157DA0149D241518BD66157DE2149D6615BD98130901009D9813290080D0016038BD2415ED3417850E18BD6615ED36178510DE2C16D03BBD6E169D2C16BDA8158512BCEA15B112C9FEFFD00ABD981329FEFF9D981360C9FFFFD00EBD981329FEFF9D9813A00000F0DC9DDA13C8C8989DEA15A50EC9F8FFB005C9F800B04AA510C9F8FFB005C9D800B03EBDDA138514DAA62CA50E9D1E0FA5109D1F0FA5149D200FE8E8E8E8862CA50E101C8A4A4A3A290300AABD65BE29FF0085168A4A4AAAA5161D1E119D1E11FA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 93,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:BDBB",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:BDF1",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:BE64",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "edd7",
    "entry": 8515031,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515031,
        "hex": "08C2209C1E119C20119C22119C24119C26119C28119C2A119C2C119C2E119C30119C32119C34119C36119C38119C3A119C3C11286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 20,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EE0B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ee0c",
    "entry": 8515084,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515084,
        "hex": "08C230A62CA9FFF09D1E0FE8E8E8E8E00002D0F4286B",
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
        "at": "81:EE21",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b66a",
    "entry": 8500842,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500842,
        "hex": "186D5C178520A97F008522BD2415186908004A4A4A4A8510BD66151869080029F0FF0A05100A186520852060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 24,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B695",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b696",
    "entry": 8500886,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500886,
        "hex": "206AB698872060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8500842,
        "RTS"
      ]
    ],
    "instructions": 4,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B69C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b69d",
    "entry": 8500893,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500893,
        "hex": "206AB6A72029FF0360",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8500842,
        "RTS"
      ]
    ],
    "instructions": 4,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B6A5",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b6a6",
    "entry": 8500902,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500902,
        "hex": "851698DA20B9B448AD3C171A1AC940009003A900008D3C17AA689F9A017FFABD2415186908004A4A4A4A8510BD66151869080029F0FF0A05100900201865168514DAAE4817A902009D3E11A980009D4011A97F009D411118AD3C17699A019D4211A5149D44119E46118A186908008D4817A901008D4A17FA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8500409,
        "RTS"
      ]
    ],
    "instructions": 57,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:B71E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b90f",
    "entry": 8501519,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501519,
        "hex": "A20000BD5613C90200902DC90500B0280A850EA8B94FB9A8A900002096B6BD9813290100D012A900009D5613A40EB94FB9A8A9000020A6B6E8E8E04200D0C460",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8500886,
        "RTS"
      ],
      [
        8500902,
        "RTS"
      ]
    ],
    "instructions": 28,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B94E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export const matrixObjectTables=[
  {
    "start": 8500729,
    "hex": "000001000000FFFFFFFF000001000000"
  },
  {
    "start": 8500802,
    "hex": "C0FF02004000FEFF000010000000F0FFF0FF0000100000003F003E003F003E000300040003000400"
  },
  {
    "start": 8504022,
    "hex": "0200040008001000200040008000"
  },
  {
    "start": 8502885,
    "hex": "01041040C035FFFFC235FFFFC435FFFFC635FFFFC835FFFFCA35FFFFCC35FFFFCE35FFFFA035A235A435A635FFFFA835AA35AC35AE35FFFF88358A358C358E35FFFF8035823584358635FFFFE033E233E433E633E833EA33EC33EE33FEFF"
  },
  {
    "start": 8501583,
    "hex": "00000000071002100110"
  }
];
export function proveMatrixObjects(map,s){
 assertPinnedTaskSource(map,s.windows);const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns)});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' Matrix object source drift');return p;
}
