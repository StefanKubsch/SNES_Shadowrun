// Original Matrix control/action graphs; indirect-call targets require the pinned tables below.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const matrixControlSpecs=[
  {
    "name": "b1b5",
    "entry": 8499637,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8499637,
        "hex": "850E38AD5417E50EB003A900008D541760"
      }
    ],
    "externalReturns": [],
    "instructions": 8,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B1C5",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b609",
    "entry": 8500745,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8500745,
        "hex": "6414A20000A00000B942B6209DB6D95AB6D01CE61418AD2415794AB6851A18AD66157952B6851CB962B6851E20C8B8C8C8C00800D0D2A51460"
      }
    ],
    "externalReturns": [
      [
        8500893,
        "RTS"
      ],
      [
        8501448,
        "RTS"
      ]
    ],
    "instructions": 25,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B641",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b71f",
    "entry": 8501023,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501023,
        "hex": "640EA20000A90000206AB6BD24158512BD66158514A72029FF03C90000F018C90100F013C90200F00EC620C62038A512E91000851280DEE620E62018A5126910008512A72029FF03C90000F01CC90100F017C90200F01238A520E94000852038A514E91000851480DA18A520694000852018A51469100085146416A00000B72029FF03C90000F006C8C8E61680F06418A00000B72029FF03C90000F00A9818694000A8E61880ECA5128510A5108512A00000A616B72029FF03C908009017C91000B012A512851AA514851CA90200851E20C8B8E60E18A5126910008512C8C8CAD0D218A520694000852018A5146910008514C618D0B5A50E60"
      }
    ],
    "externalReturns": [
      [
        8500842,
        "RTS"
      ],
      [
        8501448,
        "RTS"
      ]
    ],
    "instructions": 116,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B817",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b8ad",
    "entry": 8501421,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501421,
        "hex": "CDA815F0158DA8159CEA15A901008D2C16AD98130901008D981360"
      }
    ],
    "externalReturns": [],
    "instructions": 10,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B8C7",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b959",
    "entry": 8501593,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501593,
        "hex": "640EA20000A00E00B9C0B9209DB6C908009007C91000B002E60E888810EAA40EC00000F041AD4617D03C98186930208F48017FA24001A07F002082B2EE4617A20F00A90F002207F081A27F7FA906002207F081A50E0A18695000EB091600AAA905002207F08160"
      }
    ],
    "externalReturns": [
      [
        8500893,
        "RTS"
      ],
      [
        8499842,
        "RTS"
      ],
      [
        8515591,
        "RTL"
      ]
    ],
    "instructions": 42,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B9BF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b9d0",
    "entry": 8501712,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501712,
        "hex": "A20000A90000209DB6C908009005C910009001609C461738E908000AA8B93EBA850022A8F280A5001A20B5B1AC1C14AD2415187950BA8D2415AD6615187960BA8D6615A901008D40178D4217A90A008D3E17A90F008DB0169CA0149CE214A2C0C5A081002082B2A9120020C6B160"
      }
    ],
    "externalReturns": [
      [
        8500893,
        "RTS"
      ],
      [
        8450728,
        "RTL"
      ],
      [
        8499637,
        "RTS"
      ],
      [
        8499842,
        "RTS"
      ],
      [
        8499654,
        "RTS"
      ]
    ],
    "instructions": 43,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:B9E3",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:BA3D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bd44",
    "entry": 8502596,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8501872,
        "hex": "A902008D3E1760AD2415290F00D017AD6615290F00D00F2059B9ADCA01EB290F000AAAFC56BB60AC1C14B9E6BB20ADB89CA0149CE21420D0B960CC1C14F0309CA0149CE214A905008D42178C5E149838ED1C14290F00C90800900AA908008D3E1720D0B960A906008D3E1720D0B960A20000B986BB209DB6C90000F0AAC95800F0A5C910009005C95000909B8C1C149C4617B9D6BB20ADB8A20000B986BB209DB6C90100F005C90200D013B9B6BB8DA014B9C6BB8DE214A904008D3E1760B996BB8DA014B9A6BB8DE21420D0B960A00C004CAABAA004004CAABAA000004CAABAA008004CAABA"
      },
      {
        "start": 8502262,
        "hex": "AD2415290F00D01CAD6615290F00D014AE1C14FC1BBCB00C9CA0149CE214A902008D3E1760"
      },
      {
        "start": 8502315,
        "hex": "AC1C14B9B6BB8DA014B9C6BB8DE214B9D6BB20ADB8608AA8A20000A90000209DB6D973BCF00ED983BCD00BB9A3BC8D1C14202BBC3860D993BCD00BB9B3BC8D1C14202BBC38601860"
      },
      {
        "start": 8502467,
        "hex": "AD1C14CD5E14F0101A1A290F008D1C14A8B9E6BB20ADB860A902008D3E17A901008D421760AD1C14CD5E14F0103A3A290F008D1C14A8B9E6BB20ADB860A902008D3E17A901008D421760AC1C14B9E6BB20ADB8AF761C7E290100D00ECEB016300AAD98134900808D981360A902008D3E17AD98130900808D9813A901008D421760CE4017D00CAD42178D4017AE3E17FC56BD60"
      }
    ],
    "externalReturns": [
      [
        8501593,
        "RTS"
      ],
      [
        8501421,
        "RTS"
      ],
      [
        8501712,
        "RTS"
      ],
      [
        8500893,
        "RTS"
      ]
    ],
    "indirectCalls": [
      [
        8502610,
        [
          8501872,
          8501879,
          8502262,
          8502467,
          8502504,
          8502541
        ]
      ],
      [
        8501907,
        [
          8501911,
          8502084,
          8502078,
          8502096,
          8502090
        ]
      ],
      [
        8502281,
        [
          8502337
        ]
      ]
    ],
    "instructions": 192,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:BD55",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c108",
    "entry": 8503560,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503560,
        "hex": "A2D2C5A081004C82B2"
      },
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
    "instructions": 18,
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
    "name": "c111",
    "entry": 8503569,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503569,
        "hex": "AD3E17C90200D057AD2415290F00D04FAD6615290F00D047ADCE01290080F03FA20000AC1C14B986BB209DB6C90700D007A9010020B5B160C92000F023C921009030C92800B02B38E920000AAAAD56173FD4C281D009A2C3C6A081002082B2602009B6F00C2008C1A2B1C6A081002082B260C90800906CC91000B0678D44172008C1A90700850022A8F280AD8C1D29FF00850EA50038E50E1027AC1C14AD241518793CC2851AAD661518794CC2851CA90200851E20C8B8A2E6C5A081002082B26038AD4417E908000AA8B93EBA850022A8F280A5001A20B5B1A2FBC5A081002082B260C94000F00AC91000903DC91800B03838E910000AA8AD581719D4C28D5817AC1C14B986BBA041002096B6AC1C14B976BBA0411020A6B62008C1201FB7F009A296C6A081002082B260"
      }
    ],
    "externalReturns": [
      [
        8500893,
        "RTS"
      ],
      [
        8499637,
        "RTS"
      ],
      [
        8499842,
        "RTS"
      ],
      [
        8500745,
        "RTS"
      ],
      [
        8503560,
        "RTS"
      ],
      [
        8450728,
        "RTL"
      ],
      [
        8501448,
        "RTS"
      ],
      [
        8500886,
        "RTS"
      ],
      [
        8500902,
        "RTS"
      ],
      [
        8501023,
        "RTS"
      ]
    ],
    "instructions": 120,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:C148",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C170",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C1D1",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C1F3",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C23B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C182",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c25c",
    "entry": 8503900,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503900,
        "hex": "DA1829FF006D5017CD4C179003A94000C94000900CA2D8C6A081002082B2FA38608D5017A242C6A081002082B2FA1860"
      }
    ],
    "externalReturns": [
      [
        8499842,
        "RTS"
      ]
    ],
    "instructions": 22,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:C27C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C28B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c28c",
    "entry": 8503948,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8503948,
        "hex": "AD3E17C90200D03FAD2415290F00D037AD6615290F00D02FADCE01298000F027A20000AC1C14B986BB209DB6C920009027C92800B022A90A00205CC2B009A258C6A081002082B260"
      },
      {
        "start": 8504036,
        "hex": "C910009050C91800B04B38E91000A80AAAAD58171FD4C2818D581718B930C3205CC2B027AC1C14B986BBA04000A200002096B6AC1C14B976BBA04010A2000020A6B6A281C6A081002082B260"
      },
      {
        "start": 8504121,
        "hex": "C918009057C92000B05238E91800A80AAAAD5A171FD4C2818D5A1718B996C3205CC2B038BDD4C2206FB5F009A2B1C6A081002082B2AC1C14B986BBA04200A200002096B6AC1C14B976BBA04210A2000020A6B6A26FC6A081002082B260"
      }
    ],
    "externalReturns": [
      [
        8500893,
        "RTS"
      ],
      [
        8503900,
        "RTS"
      ],
      [
        8499842,
        "RTS"
      ],
      [
        8500886,
        "RTS"
      ],
      [
        8500902,
        "RTS"
      ],
      [
        8500591,
        "RTS"
      ]
    ],
    "instructions": 93,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:C2D3",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C32F",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:C395",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "f2a8",
    "entry": 8450728,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8450728,
        "hex": "8BF40000ABAB201FC5AB6B"
      }
    ],
    "externalReturns": [
      [
        8439071,
        "RTS"
      ]
    ],
    "instructions": 7,
    "stackBytes": 6,
    "returns": [
      {
        "at": "80:F2B2",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export const matrixControlTables=[
  {
    "start": 8502614,
    "hex": "70BA77BAF6BBC3BCE8BC0DBD"
  },
  {
    "start": 8502102,
    "hex": "97BA44BB3EBB97BA50BB97BA97BA97BA4ABB97BA97BA97BA97BA97BA97BA97BA"
  },
  {
    "start": 8502299,
    "hex": "41BC000041BC000041BC000041BC0000"
  },
  {
    "start": 8501696,
    "hex": "C0FFC2FF0200420040003E00FEFFBEFF"
  },
  {
    "start": 8501822,
    "hex": "06000C00120018001E0024002A003000360000000000F0FF000000000000100000001000000000000000F0FF000000000000"
  },
  {
    "start": 8502134,
    "hex": "E0FF00000100000020000000FFFF0000C0FF00000200000040000000FEFF0000000000000100000000000000FFFF0000FFFF0000000000000100000000000000000000000400000000000000FCFF0000FCFF000000000000040000000000000089BE0000A7BE000093BE00009DBE000069BE6DBE71BE75BE79BE7DBE81BE85BE"
  },
  {
    "start": 8502387,
    "hex": "020000000100000002000000010000000300000004000000050000000300000004000000060000000600000005000000040000000800000004000000080000000C000000000000000C00000000000000"
  },
  {
    "start": 8503868,
    "hex": "000000001000000000000000F0FF0000F0FF0000000000001000000000000000"
  },
  {
    "start": 8504020,
    "hex": "01000200040008001000200040008000"
  },
  {
    "start": 8504112,
    "hex": "010203040506070809"
  },
  {
    "start": 8504214,
    "hex": "010203040506070809"
  }
];
export function proveMatrixControl(map,s){
 assertPinnedTaskSource(map,s.windows);const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),indexPulls:new Set(s.indexPulls??[]),indirectCalls:new Map(s.indirectCalls??[])});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' Matrix control source drift');return p;
}
