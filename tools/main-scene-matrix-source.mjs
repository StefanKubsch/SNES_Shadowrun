// Matrix setup and text-command domain 1..6, pinned to the European ROM.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const matrixSetupSpecs=[
  {
    "name": "b4b9",
    "entry": 8500409,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500409,
        "hex": "851E29F8030A851CA51E290700051C0A851CA51E2900FC051C60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 13,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B4D2",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b4d3",
    "entry": 8500435,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500435,
        "hex": "852084228612640E6410A20000A9FFFF9DF2169D0017E8E8E00E00D0F3A00000A91F008516640EA91F008514A510050E05128D1621B72020B9B48D1821A51E29FF03C92100901DC92800B01838E921000AAA38A91F00E5149DF21638A91F00E5169D0017C8C8E60EC61410C018A5106920008510C61610AD60",
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
    "instructions": 56,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B54B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b259",
    "entry": 8499801,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499801,
        "hex": "AE1217EC1017F020BD14178534BD161785368A18690400C920009003A900008D1217A901008D541360",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 17,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B281",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b282",
    "entry": 8499842,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499842,
        "hex": "5ADAAE1017689D1417689D16178A18690400C920009003A900008D101760",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "indexPulls": [
      8499847,
      8499851
    ],
    "instructions": 15,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:B29F",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b2a0",
    "entry": 8499872,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499872,
        "hex": "A902088D50138D52139C4A139C4E139C46139C44139C3E139C40139C12179C10179C0E17A910008D4213A918008D4C1360",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 17,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B2D0",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c39f",
    "entry": 8504223,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8504223,
        "hex": "AD901D29FF000AAABD15C5850EA00000B10E29FF00AAC8DAB10EAAC8C8B10EC85AA82082B27AFACAD0ED60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8499842,
        "RTS"
      ]
    ],
    "instructions": 26,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:C3C9",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b2d1",
    "entry": 8499921,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499921,
        "hex": "AD0E17D0062059B2EE0E17CE5413F0023860A901008D5413AD5013850E9C48139C4413AC4213A73429FF00F0670AAAE04000B009E634FC70B390EBB025BFC0FF7E0900200D4613AE48139F5A017FEE4813EE4813E634EE4413EE4413EE501388D0C4AE4817AD4413F0289D3E11A980009D4011A97F009D4111A95A019D4211A50E9D44119E46118A186908008D4817EE4A1738609C0E17AD1017CD1217D0F31860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8500094,
        "hex": "EB0A38E900048D4613186018AD501369200029E0030902088D5013EE4A13AD4A13CD4C139010AD4C138D4A1318AD4E136908008D4E13A903008D54133860A734E63429FF008D54133860CE5013A901008D54133860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8499801,
        "RTS"
      ]
    ],
    "indirectCalls": [
      [
        8499975,
        [
          8500094,
          8500105,
          8500156,
          8500168
        ]
      ]
    ],
    "instructions": 103,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:B2E2",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:B364",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:B371",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b37e",
    "entry": 8500094,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500094,
        "hex": "EB0A38E900048D46131860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 7,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B388",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b389",
    "entry": 8500105,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500105,
        "hex": "18AD501369200029E0030902088D5013EE4A13AD4A13CD4C139010AD4C138D4A1318AD4E136908008D4E13A903008D54133860",
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
        "at": "81:B3BB",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b3bc",
    "entry": 8500156,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500156,
        "hex": "A734E63429FF008D54133860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 6,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B3C7",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b3c8",
    "entry": 8500168,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500168,
        "hex": "CE5013A901008D54133860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 5,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B3D2",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b228",
    "entry": 8499752,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499752,
        "hex": "08E220A9808D1521A9098D0043A200088E1621A9188D0143A258B28E0243A9818D0443A200088E0543A9018D0B4228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8499799,
        "hex": "60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 20,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:B257",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b3d3",
    "entry": 8500179,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500179,
        "hex": "850E84168620A97F008522AFDC017F4A4A4A8514A50E4A4A4A8512A50E2907004907000AAABFC2007F8510A5141A0AA8AFD2007F87200900409720A00200A612F011AFC0007F9720C8C8C614CAD0F7A514F018A5109720C8C8C614A514F00CAFD0007F9720C8C8C614D0F8AE4817AFDC017F4A4A4A1A1A0A9D3E11A980009D4011A97F009D4111A5209D4211A5169D44119E46118A186908008D4817EE4A1760",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 79,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B472",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b473",
    "entry": 8500339,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500339,
        "hex": "BD5017DD4E17F0099004FE4E1760DE4E1760",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 8,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B480",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:B484",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b485",
    "entry": 8500357,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500357,
        "hex": "A200002073B4A204002073B4A964008FDC017FA2DE01A0C10EAD52174A20D3B3A940008FDC017FA2FA01A0010FAD4E1720D3B360",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8500339,
        "RTS"
      ],
      [
        8500179,
        "RTS"
      ]
    ],
    "instructions": 18,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B4B8",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b818",
    "entry": 8501272,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501272,
        "hex": "AD5C178520A97F008522A00000B72029FF03C95900F007C8C8C00008D0EF9829C0FF4A4A8D661598293E000A0A0A8D241560",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 25,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B849",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b84a",
    "entry": 8501322,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501322,
        "hex": "38AD2415ED3417850E38AD6615ED3617851064126414A50EC96000B00838A50EE960008512A50EC991009007A50EE991008512A510C96000B00838A510E960008514A510C991009007A510E99100851418AD341765128D341718AD361765148D361760",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 45,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B8AC",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bd62",
    "entry": 8502626,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8502626,
        "hex": "A200009E5613A900809D98139EA0149EE214E8E8E04200D0EA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 11,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:BD7B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bfd8",
    "entry": 8503256,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503256,
        "hex": "08E2209C3021A93F8D3121A2000022BBEE818A09E08D3221E8E02000D0F028",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8503287,
        "hex": "60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515259,
        "RTL"
      ]
    ],
    "instructions": 15,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:BFF7",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bff8",
    "entry": 8503288,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503288,
        "hex": "08E220A9138D2C21A21F0022BBEE818A09E08D3221CA10F3A9048D2D21A9338D2C218D3121A9028D3021A9E08D322128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8503336,
        "hex": "60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515259,
        "RTL"
      ]
    ],
    "instructions": 22,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:C028",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c029",
    "entry": 8503337,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503337,
        "hex": "E2209C6043A9098D6143A201C18E6243A9818D6443A9028D5043A9128D5143A250018E5243A97F8D5443A9068F50017FA9448F53017FA97F8F56017FA9008F51017F8F52017F8F54017F8F55017F8F57017F8F58017F8F59017FA9608D0C42C2209C36179C3417A901008D40178D4217A902008D3E17A901008D5613A971BE8DA8159CEA15A901008D2C16A908008D6E16A904008D1C149CA0149CE2142018B89C3C1720A0B2A909008D4C13A920008D4213A22EC6A081002082B2A20000BF0DC6819F40017FE8E8E0100090F122BBEE812028B22085B460",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8501272,
        "RTS"
      ],
      [
        8499872,
        "RTS"
      ],
      [
        8499842,
        "RTS"
      ],
      [
        8515259,
        "RTL"
      ],
      [
        8499752,
        "RTS"
      ],
      [
        8500357,
        "RTS"
      ]
    ],
    "instructions": 74,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:C100",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export const matrixSetupTables=[
  {
    "start": 8500082,
    "hex": "7EB37EB37EB389B3BCB3C8B3"
  },
  {
    "start": 8504597,
    "hex": "21C525C529C52DC531C535C50139C581012BC7810163C8810160CB810159C9810133CC8102044552524F5220434F4E444954494F4E210104044552524F5220414E414C595349532E"
  },
  {
    "start": 8504845,
    "hex": "0104464F554E44205820494321040003"
  }
];
export function proveMatrixSetup(map,s){
 assertPinnedTaskSource(map,s.windows);
 const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),indexPulls:new Set(s.indexPulls??[]),indirectCalls:new Map(s.indirectCalls??[])});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' Matrix setup source drift');
 return p;
}
