// Pinned European ROM scene initialization, with separate callee contracts.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const mainInitializeSpecs=[
  {
    "name": "9629",
    "entry": 8427049,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8427049,
        "hex": "E220A9018D0D429C00429C0C42C2202264B08120B38F201ABC221A898122B98C812240A8812272A781222CAB8120A6C12044CC201BE42226EF81A252C1A080002209C180E220A9818D0042A9130CBE019C12219C12219C11219C1121C22060"
      }
    ],
    "externalReturns": [
      [
        8499300,
        "RTL"
      ],
      [
        8425395,
        "RTS"
      ],
      [
        8436762,
        "RTS"
      ],
      [
        8489242,
        "RTL"
      ],
      [
        8490169,
        "RTL"
      ],
      [
        8497216,
        "RTL"
      ],
      [
        8497010,
        "RTL"
      ],
      [
        8497964,
        "RTL"
      ],
      [
        8438182,
        "RTS"
      ],
      [
        8440900,
        "RTS"
      ],
      [
        8447003,
        "RTS"
      ],
      [
        8515366,
        "RTL"
      ],
      [
        8438025,
        "RTL"
      ]
    ],
    "instructions": 32,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:9687",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "b064",
    "entry": 8499300,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8499300,
        "hex": "E220A9098D0521A9008D0121A9708D0721A9748D0821A9788D0921A9118D0B21A9058D0C21C2209CBE019CC001A980008DBC019CC6019CC2019CC4016B"
      }
    ],
    "externalReturns": [],
    "instructions": 24,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:B0A0",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "8fb3",
    "entry": 8425395,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8425395,
        "hex": "A9FFFF8D400160"
      }
    ],
    "externalReturns": [],
    "instructions": 3,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:8FB9",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "bc1a",
    "entry": 8436762,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8436762,
        "hex": "9CD0019CD201A900808DD4018DD6019CD8019CE801A9FFFF8DDA0160"
      }
    ],
    "externalReturns": [],
    "instructions": 10,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:BC35",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "891a",
    "entry": 8489242,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489242,
        "hex": "A9FFFF8DC20C9CC40C9CC60C9CC80C9CCA0C9CD00C9CD60C9CD80CE220A9018D3043A9188D3143A97E8D3443C2206B"
      }
    ],
    "externalReturns": [],
    "instructions": 18,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8948",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "8cb9",
    "entry": 8490169,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8490169,
        "hex": "9C100DA29200A9FFFF9F80C97FCACA10F8E220A9008D4043A9228D4143C2209C0E0D220080816B"
      }
    ],
    "externalReturns": [
      [
        8486912,
        "RTL"
      ]
    ],
    "instructions": 16,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8CDF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "8000",
    "entry": 8486912,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8486912,
        "hex": "A20200A900008DDA1C8DBC1C9DBE1C9DC21C9DD61CCACA10F36B"
      }
    ],
    "externalReturns": [],
    "instructions": 11,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8019",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "a840",
    "entry": 8497216,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8497216,
        "hex": "9CD417A9FFFF8DE6178DE8178DEA178DEC178DEE178DF0178DF2178DF4178DF6178DF8178DFA178DFC178DFE178D00188D02188D04188D06188D08188D0A188D0C188D0E188D10188D12188D14188D16188D18188D1A188D1C188D1E188D20188D22188D24188D26188D28188D2A188D2C188D2E188D30188D32188D34188D36188D38188D3A188D3C188D3E188D40188D42188D44188D46188D48188D4A188D4C188D4E188D50188D52188D54188D56188D58188D5A188D5C188D5E188D60188D62188D64188D66188D68188D6A188D6C188D6E188D70186B"
      }
    ],
    "externalReturns": [],
    "instructions": 73,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:A918",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "a772",
    "entry": 8497010,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8497010,
        "hex": "9C62152240A881A25600A9FFFF9F283F7ECACA10F8E220A9018D1043A9188D1143A9048D2143C220A920028D2543A9FBA78D2243E220A9818D2443A9088D20439C0221A9808D0321A9048D0B42A9008D2043A97E8D2443C220A9FEFF8DB0148582A940008D1C0DA902008D1E0DA2EE00188A1A1A850E291000F004650E8002A50E9D6415CACA10E96B"
      }
    ],
    "externalReturns": [
      [
        8497216,
        "RTL"
      ]
    ],
    "instructions": 58,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:A7FA",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ab2c",
    "entry": 8497964,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8497964,
        "hex": "A900508D1621A970018D0543A960F18D0243E220A9958D0443A9188D0143A9808D1521A9018D0043A9018D0B42C220A930008D0543A940F18D0243E220A9958D0443A9008D2121A9228D0143A9008D0043A9018D0B42A9018D7043A9098D6043A9818D5043A9188D71438D6143A9398D5143A97E8D7443A9818D6443A97E8D5443A9028D3021A9378D3121ADBE0109048DBE01C220A21E00A900009D2602CACA10F9A9FFFF8D1402A206009F16027ECACA10F8A90000229CAA81A927208D12029CF8019CF6019CFA019CFC019C00029C0202A9FEFF8D0402EEF80122E1A9816B"
      }
    ],
    "externalReturns": [
      [
        8497820,
        "RTL"
      ],
      [
        8497633,
        "RTL"
      ]
    ],
    "instructions": 86,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:AC0B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "aa9c",
    "entry": 8497820,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8497820,
        "hex": "CD1402D0034C2BAB8B8D140285D80A65D8AABFAFFF80A8BFADFF80DAA2A02322499F808D7543A9A0238D7243A9B8508D1621E220A9808D1521A9808D0B42C220FABFB2FF8029FF008DF401EB48ABABBFB0FF80AAE220A90D8D2121BD00008D2221E8BD00008D2221E8BD00008D2221E8BD00008D2221E8BD00008D2221E8BD00008D2221E8C2208EFE0122B2A981AB6B"
      }
    ],
    "externalReturns": [
      [
        8429385,
        "RTL"
      ],
      [
        8497586,
        "RTL"
      ]
    ],
    "wordPushes": [
      [
        8497896,
        [
          "palette-bank@81:AADD",
          0
        ]
      ]
    ],
    "instructions": 62,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:AB2B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "a9e1",
    "entry": 8497633,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8497633,
        "hex": "ADF601F03AA98CAC8D6243AD0C02C90114900BE900148D0C02A9001480039CF6018D6543AD0A028D16211869000A8D0A02E220A9808D1521A9408D0B42C220ADF801F023A9A0238D7243A940078D7543A900788D1621E220A9808D1521A9808D0B42C2209CF801ADFA01F023A9E02A8D7243AD10028D7543AD0E028D1621E220A9808D1521A9808D0B42C2209CFA01ADFC01F026AD0E028D1621A910008D5543A9E02A8D5243E220A9808D1521AD3A21A9208D0B42C2209CFC016B"
      }
    ],
    "externalReturns": [],
    "instructions": 71,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:AA9B",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "c1a6",
    "entry": 8438182,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8438182,
        "hex": "9C4E02A9FFFF8D4C028D50028D7203A25E009D12038ACACA10F8A9CC078DD2039CD40360"
      }
    ],
    "externalReturns": [],
    "instructions": 15,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:C1C9",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "cc44",
    "entry": 8440900,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8440900,
        "hex": "A9FFFF8DE91C60"
      }
    ],
    "externalReturns": [],
    "instructions": 3,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:CC4A",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "e41b",
    "entry": 8447003,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8447003,
        "hex": "9C621F60"
      }
    ],
    "externalReturns": [],
    "instructions": 2,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:E41E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "ef26",
    "entry": 8515366,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515366,
        "hex": "A9FFFF8DDE1CA900008DE01C8DE21C6B"
      }
    ],
    "externalReturns": [],
    "instructions": 6,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:EF35",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveMainInitialize(map,s){
  assertPinnedTaskSource(map,s.windows);
  const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),wordPushes:new Map(s.wordPushes??[])});
  if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' initialization source drift');
  return p;
}
