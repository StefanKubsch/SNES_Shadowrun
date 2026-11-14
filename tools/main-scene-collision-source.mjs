// Pinned European ROM scene collision, with separately proved external returns.
import{assertPinnedTaskSource}from'./pinned-task-source.mjs';import{proveWordStack}from'./static-word-stack-proof.mjs';
export const sceneCollisionSpecs=[
  {
    "name": "8183fb",
    "entry": 8487931,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8487931,
        "hex": "64A09CA8DEA2FE01A9FFFF9DACDECACA10F96B"
      }
    ],
    "externalReturns": [],
    "instructions": 9,
    "reachable": 9,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:840D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81840e",
    "entry": 8487950,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8487950,
        "hex": "5ABDACE229C0030A0A0AEB853EBDB2E229C0030A0A0AEB8541BDB4E229C0034A8547BDAEE229C0034A8544053EA8DA8AA6A09D3CEFB9ACDE9D9CF78A99ACDEE8E886A0FAC8C898291E00F006C541F0DE90DCA54418692000C547F0CD90CB7A6B"
      }
    ],
    "externalReturns": [],
    "instructions": 53,
    "reachable": 53,
    "stackBytes": 7,
    "returns": [
      {
        "at": "81:846D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "8184cf",
    "entry": 8488143,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8488143,
        "hex": "B70EC829FF00C9800090030900FF6B"
      }
    ],
    "externalReturns": [],
    "instructions": 7,
    "reachable": 7,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:84DD",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "8184de",
    "entry": 8488158,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8488158,
        "hex": "A00100A77729FF00D0034CF2858511B777C8C8890060F0034CF9850ADAAABF6AC38AFA850EA900009003A9FFFF8517B77729FF00898000F0034CF9850A0A0A8520C8B77729FF000A0A851AC8B77729FF000A0A851DC85AA00700B70E29FF00D0034CEA858514A70E29FF00856B0A0A656B690800A8A517D03022CF848118651A9DACE2B70EC829FF00187DACE29DB2E222CF848118651D9DAEE2B70EC829FF00187DAEE29DB4E2802E22CF848118651D9DAEE2B70EC829FF00187DAEE29DB4E222CF848118651A9DACE2B70EC829FF00187DACE29DB2E222CF84811865209DB0E2B70EC829FF00187DB0E29DB6E2DA8A4A4AAAA900009F14E27FFA220E84818A18690C00AAC614F0034C53857AC611F0034CED849818657785776BC8C8C880ED"
      }
    ],
    "externalReturns": [
      [
        8488143,
        "RTL"
      ],
      [
        8487950,
        "RTL"
      ]
    ],
    "instructions": 141,
    "reachable": 141,
    "stackBytes": 7,
    "returns": [
      {
        "at": "81:85F8",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818701",
    "entry": 8488705,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8488705,
        "hex": "855FB79AC829FF00F04A855CB79A9DACE2C8C8B79A9DAEE2C8C8B79A9DB0E2C8C8B79A9DB2E2C8C8B79A9DB4E2C8C8B79A9DB6E2C8C8DA8A4A4AAAA55FF002C8C89F14E27FFA220E84818A18690C00AAC65CD0B86B"
      }
    ],
    "externalReturns": [
      [
        8487950,
        "RTL"
      ]
    ],
    "instructions": 49,
    "reachable": 49,
    "stackBytes": 5,
    "returns": [
      {
        "at": "81:8755",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818756",
    "entry": 8488790,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8488790,
        "hex": "8BF47E7EABAB22FB8381AEA8DEE220A98A8510C22022DE848122DE8481A90000A8220187819818659A859DA9FFFF22018781A9FFFF220187818EA8DEA5A08DAADEAB6B"
      }
    ],
    "externalReturns": [
      [
        8487931,
        "RTL"
      ],
      [
        8488158,
        "RTL"
      ],
      [
        8488705,
        "RTL"
      ]
    ],
    "instructions": 28,
    "reachable": 28,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:8798",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveSceneCollision(map,s){assertPinnedTaskSource(map,s.windows);const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),dataPulls:new Set(s.dataPulls)});if(map.size!==s.instructions||p.reachable_instructions!==s.reachable||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' scene collision drift');return p;}
