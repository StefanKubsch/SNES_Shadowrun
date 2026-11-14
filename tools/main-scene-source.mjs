// Own scene-entry code; external calls stay conditional. DFE7 has its separately proved
// DBR80 exit (EF63), while the normal CDF8 path restores the caller's DBR.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const mainSceneSpecs=[
  {
    "name": "cdf8",
    "entry": 8506872,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8506872,
        "hex": "C91400D0045CE7DF81088B4BAB851E8E5E119C1C0DC2102297EB8122E9EB81A51E0AAABDD7D3851ABDE3D38518BF8DF481AAA081002216EC81A51E10032079CFA51E0AAABD13D420E8D464149CA0119C9E116416641CA938FDA08500A2A85622A0F280A9BDF2A08100A2A86222A0F280207DD3A51E0AAABD2BD48D7243E220A9018D7043A9268D7143A9818D7443A9808D0C42A9338D2321A9038D24218D2521A9138D2E219C2A219C2B21A90F8DA2119CA311C220A51E0AAABDBFD330042247EF81A51E0AAABDCBD3F0204848A20100A90F002207F0816829FF000900802230F18168AAA907002207F0812072CF227BEB81A51E0AAABDFBD3AADA22BBEE812298F2802072CFFAADCA01290090D02ACA10E8A51E0AAABDEFD38518641ABD07D4AADA22BBEE812298F2802072CFFAADCA01290090D003CA10E8F48080ABABA900002229F281A22E00A907002207F081E2209CA211ADA311D0FB22BBEE812289EB819C0C42C220F48080ABAB9CE01C9CE21CA9FFFF8DDE1CAB286B"
      }
    ],
    "programBankPushes": [
      8506883
    ],
    "externalTailReturns": [
      [
        8506877,
        8511463
      ]
    ],
    "externalTailBanks": [[8506877,128]],
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
        8507257,
        "RTS"
      ],
      [
        8508648,
        "RTS"
      ],
      [
        8450720,
        "RTL"
      ],
      [
        8508285,
        "RTS"
      ],
      [
        8515399,
        "RTL"
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
        8507250,
        "RTS"
      ],
      [
        8514427,
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
        8516137,
        "RTL"
      ],
      [
        8514441,
        "RTL"
      ]
    ],
    "instructions": 158,
    "stackBytes": 9,
    "returns": [
      {
        "at": "81:CDFD",
        "m": 0,
        "x": 0,
        "dbr": 128
      },
      {
        "at": "81:CF71",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c3ca",
    "entry": 8504266,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8504266,
        "hex": "088B4BAB2297EB81A908002247EF819C48179C4A17A2B2CDA081002216EC81A938FDA08500A2000022A4F280A91BECA08900A2160222A4F280A91602A07F00A2002420D3B4A94EE1A08900A2160222A4F280A94BEBA08900A2168222A4F280AD8F1D29FF00EB0A0A0A6916028D5C17AD5C17A07F00A2002020D3B420A0B2209FC3227BEB8122DDEE8122BBEE8120D1B2B0F7AD8B1D29FF008D54179C52179C4E179C5017AD8D1D29FF008D4C179C58179C56179C5A17AD901D29FF00D0034CFAC420D8BF2062BD2029C0AD8E1D206FB5204AB8207CBD20F8BF22BBEE812298F2802085B420D1B2204AB82044BD2011C1208CC2200FB9207CBDADCE01294000D005AD5217D0D3A21CC6A081002082B2A900808D24158D6615A23C00DA22BBEE812085B420D1B2200FB9207CBDFACAD0EB22F1EE81E220AD54178D8B1DAD58178D921DAD5A178D911DAB28",
        "finalM": 1
      },
      {
        "start": 8504596,
        "hex": "6B"
      }
    ],
    "programBankPushes": [
      8504268
    ],
    "externalReturns": [
      [
        8514455,
        "RTL"
      ],
      [
        8515399,
        "RTL"
      ],
      [
        8514582,
        "RTL"
      ],
      [
        8450724,
        "RTL"
      ],
      [
        8500435,
        "RTS"
      ],
      [
        8499872,
        "RTS"
      ],
      [
        8504223,
        "RTS"
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
        8499921,
        "RTS"
      ],
      [
        8503256,
        "RTS"
      ],
      [
        8502626,
        "RTS"
      ],
      [
        8503337,
        "RTS"
      ],
      [
        8500591,
        "RTS"
      ],
      [
        8501322,
        "RTS"
      ],
      [
        8502652,
        "RTS"
      ],
      [
        8503288,
        "RTS"
      ],
      [
        8450712,
        "RTL"
      ],
      [
        8500357,
        "RTS"
      ],
      [
        8502596,
        "RTS"
      ],
      [
        8503569,
        "RTS"
      ],
      [
        8503948,
        "RTS"
      ],
      [
        8501519,
        "RTS"
      ],
      [
        8499842,
        "RTS"
      ],
      [
        8515313,
        "RTL"
      ]
    ],
    "instructions": 117,
    "stackBytes": 7,
    "returns": [
      {
        "at": "81:C514",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "d37d",
    "entry": 8508285,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8508285,
        "hex": "A2FE07A900209FA84E7ECACA10F8A94C138FA85E7EA27E00A900009FAC5E7EA901139FAA5E7ECACA10F8A9A85E8D5243E2209C5043A92C8D5143A97E8D5443C22060"
      }
    ],
    "externalReturns": [],
    "instructions": 26,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:D3BE",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "d4e8",
    "entry": 8508648,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8508648,
        "hex": "850E6410A51E1010A900408510E220A9C038E50E850EC220A20600BD27D5A41E100449FF001A18650E9D1C0FBD29D545109D1E0FCACACACA10E1A90A008D1E1160"
      }
    ],
    "externalReturns": [],
    "instructions": 32,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:D528",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "cf79",
    "entry": 8507257,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8507257,
        "hex": "A91D00850EA01000A50EEB4A4AAABFA8467E490040DA488A493E00AABFA8467E4900408510689FA8467EFAA5109FA8467EE8E888D0D8C60E10CBA900008D1621A20000BFA8467E8D1821E8E8E08007D0F260"
      }
    ],
    "externalReturns": [],
    "instructions": 39,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:CFCA",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "f298",
    "entry": 8450712,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8450712,
        "hex": "08C230201A9E286B"
      }
    ],
    "externalReturns": [
      [
        8429082,
        "RTS"
      ]
    ],
    "instructions": 5,
    "stackBytes": 4,
    "returns": [
      {
        "at": "80:F29F",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveMainScene(map,s){
 assertPinnedTaskSource(map,s.windows);
 const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),programBankPushes:new Set(s.programBankPushes??[]),externalTailReturns:new Map(s.externalTailReturns??[]),externalTailBanks:new Map(s.externalTailBanks??[])});
 if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length+(s.externalTailReturns?.length??0))throw Error(s.name+' own scene source drift');
 return p;
}
