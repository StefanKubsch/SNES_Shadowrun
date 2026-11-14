import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
// Source chronology only: the actual native NMI vector and handler, including the switched
// stack, PHP/JSL C14F/PLP, register restoration and RTI. No interrupt scheduling proof.
export const sceneNmiChronology=[
 {start:0x00FFEA,hex:'12C1'},
 {start:0x00C112,hex:'C2308F781C7EAD10423B8F7A1C7EA9BB1C1BAF781C7E48DA5A8B0BA900005B4BABEE761C08224FC180282BAB7AFA688F781C7EAF7A1C7E1BAF781C7E40DC6E00'},
];
export const sceneAnimationSpecs=[
  {
    "name": "cf72",
    "entry": 8507250,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8507250,
        "hex": "A51E0AAA7C1FD4",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8507340,
        "hex": "AF761C7E290700D025A20300A90F002207F081A51629C0030A0A0A0A05160A0A2900FF690D00AAA907002207F081A51C4A4A4AEB290700A8A51E0AAAB922D02903004849FF001A29FF00EB187D13D420E8D468851460",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8507434,
        "hex": "A20100A90F002207F081A22744A907002207F081A51C4A4A4A4A4A4A4AA61E100349FF01EB2900FF850EA51C1869003F4A4A4A4AA61E100449FFFF1A8510A9A8468D6243E220A9508D10219C1021A20000A9678FA8467EA50F8FA9467EA9008FAA467EC220A03C00A901009FAB467EA50E186510850EEB9FAC467EE8E8E888D0E7E220A9009FAE467EA9028D6043A90F8D6143A97E8D6443A9C08D0C42C220A51CEB290F00A8A51E0AAAB9FDD02907004849FF001A29FF00EB187D13D420E8D46885140A0A0A0A696402AAA918002207F08160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8507661,
        "hex": "AD6011850EE220AD9E11C980F011AD5E11850EEE9E11ADA0118D10219C1021C220A50E0A650EEB850EA9AF8A38E50E8D3A0FA908308D3C0F60AD5E111A8D6011CEA0114C0DD1AD5E113A8D6011EEA0114C0DD1A51C4A4A4A4A4A4A4AA61E100349FF01EB2900FF850EA51C4A4A4A4AA61E100449FFFF1A8510A9A8468D6243A9080038E516E2208D10219C1021A28700A51638E906F0021002A9018FA8467EA9008FA9467E8FAA467E9FAB467EC220A901009FA8467EA50EEB9FA9467EEB186510850ECACACAD0E7E220A9028D6043A90F8D6143A97E8D6443A9C08D0C42C2206414609CCA01A900088D1621A901188D0043A9A84E8D0243A900088D0543E220A9808D1521A97E8D0443A9018D0B42C220A51C4A4A4A4A4A4A4A49FF01850EA9A8468D6243A9080038E516E2208D10219C1021A51638E906F0021002A9018FA8467EA9008FA9467E8FAA467EA9288FAB467EC220A50E0A8FAC467EA901008FAE467EA50E8FAF467EE220A9008FB1467EA9028D6043A90F8D6143A97E8D6443A9E08D0C42C2206414ADA011D045A9F4018DA011207DD38BF47E7EABABAC9E11B9A86229FF00D0028025B9A862850E29FF00EB4A4A49FFFF38698003AAC8E2205A2036D37A2051D3C60ED0F48C9E11C220AB60CEA011ADA011C9B4019025E9B4014820FBD26818692300C940009013493F00C920002A293F000AAAA901179FAA5E7E60C94000B021482022D36818692300C940009013493F00C920002A293F000AAAA901139FAA5E7E60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8508214,
        "hex": "088610A22000B9A862F004C8CA80F7C2208A29FE00186510AA28",
        "initialM": 1,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8508240,
        "hex": "60",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8508241,
        "hex": "08A900EBB9A862F01538E920DA0AAABFA8567EFA9FA84E7EE8E8C84C55D3C8C2208A1869800029C0FFAA28",
        "initialM": 1,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8508284,
        "hex": "60",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8515591,
        "RTL"
      ],
      [
        8508648,
        "RTS"
      ],
      [
        8508285,
        "RTS"
      ]
    ],
    "indirectTargets": [
      [
        8507254,
        [
          8507340,
          8507434,
          8507744,
          8507718,
          8507731,
          8507888
        ]
      ]
    ],
    "widthJoins": [
      8508123
    ],
    "table": {
      "start": 8508447,
      "hex": "CCCF2AD060D146D153D1F0D1"
    },
    "instructions": 437,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:D2DE",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D30E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D335",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D145",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D1EF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D0FC",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D021",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "f229",
    "entry": 8516137,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8516137,
        "hex": "08C210E22048A904A200002207F08168F01D20FAF1C22029FF004849FFFF186900812230F181FAE220A9042207F08128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8516185,
        "hex": "6B",
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
        8516090,
        "RTS"
      ],
      [
        8515888,
        "RTL"
      ]
    ],
    "dataPulls": [
      8516175
    ],
    "instructions": 23,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:F259",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "eebb",
    "entry": 8515259,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515259,
        "hex": "08E220A5303007AD124230FB28",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515272,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515273,
        "hex": "AF761C7ECF761C7EF0FA28",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515284,
        "hex": "6B",
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
        "at": "81:EEC8",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:EED4",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "eed5",
    "entry": 8515285,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515285,
        "hex": "22BBEE81CAD0F96B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515259,
        "hex": "08E220A5303007AD124230FB28",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515272,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515273,
        "hex": "AF761C7ECF761C7EF0FA28",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8515284,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [],
    "instructions": 17,
    "stackBytes": 7,
    "returns": [
      {
        "at": "81:EEDC",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "eedd",
    "entry": 8515293,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515293,
        "hex": "08E230A20F22BBEE818A490F8D0021CA10F328",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515312,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515259,
        "hex": "08E220A5303007AD124230FB28",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515272,
        "hex": "6B",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515273,
        "hex": "AF761C7ECF761C7EF0FA28",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515284,
        "hex": "6B",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      }
    ],
    "externalReturns": [],
    "instructions": 24,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:EEF0",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "eef1",
    "entry": 8515313,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515313,
        "hex": "08E230A20F22BBEE818E0021CA10F6A9808D002128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515334,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8515259,
        "hex": "08E220A5303007AD124230FB28",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515272,
        "hex": "6B",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515273,
        "hex": "AF761C7ECF761C7EF0FA28",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      },
      {
        "start": 8515284,
        "hex": "6B",
        "initialM": 1,
        "initialX": 1,
        "finalM": 1,
        "finalX": 1
      }
    ],
    "externalReturns": [],
    "instructions": 24,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:EF06",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "d479",
    "entry": 8508537,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8508537,
        "hex": "228BED81A51C4A4A4A4A4A4A4AA61E100349FF01E2208D0F21EB8D0F21A5148D0E21A5158D0E21C220A516C51AF016B00A6518C51A900EA51A800AE5189004C51AB002A51A851618651C851CE220ADA311D002A9808D0021ADA311CDA211F00A9005CEA3118003EEA3112290F2806B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8450704,
        "hex": "08C230200B9E28",
        "initialM": 1,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8450711,
        "hex": "6B",
        "initialM": 1,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8429067,
        "hex": "AD1242290100D0F8AD18428DCA0160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "externalReturns": [
      [
        8514955,
        "RTL"
      ]
    ],
    "instructions": 64,
    "stackBytes": 9,
    "returns": [
      {
        "at": "81:D4E7",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveSceneAnimation(map,s){
 assertPinnedTaskSource(map,s.windows);
 const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),indirectTargets:new Map(s.indirectTargets??[]),dataPulls:new Set(s.dataPulls??[]),widthJoins:new Set(s.widthJoins??[])});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' scene animation source drift');
 return p;
}
