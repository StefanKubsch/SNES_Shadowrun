// Pinned European ROM transition; external routines retain separate contracts.
import{assertPinnedTaskSource}from'./pinned-task-source.mjs';import{proveWordStack}from'./static-word-stack-proof.mjs';
export const transitionSpecs=[
  {
    "name": "80a4bf",
    "entry": 8430783,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8430783,
        "hex": "8FE22D7E0A0A0A6FE22D7EAABF9D928D8586204DA4A900800486DAA9FEFF22ACB08120B2BC20A6C1ADD61F890200F017ADB01F1012A00100B78629FF00C9FF00F009CDDE1CF0042294EF81A00200B7863A8DDA0CA78629FF002217A18122BDB08122A1B081226188812079FF2272A781FABF9F928D29FF008511BFA0928D8514BFA2928D8517BFA4928D851A20FAA220B6A32064A422E69A8122058D8122D98B81ADD61F290200F018ADDE1CC9FFFFD014A00100B78629FF00C9FF00D003ADCA1F2247EF8122568781201185A79D29FF000A480A0A0A38E30138659D85F368A7F329FF000A480A0A0A38E3013865F385F368A7F329FF000A480A0A38E3013865F385FC6820BBBA9C611D2292AD81A9FFFF8D611DA9020022ACB08160"
      }
    ],
    "externalReturns": [
      [
        8430669,
        "RTS"
      ],
      [
        8499372,
        "RTL"
      ],
      [
        8436914,
        "RTS"
      ],
      [
        8438182,
        "RTS"
      ],
      [
        8515476,
        "RTL"
      ],
      [
        8495383,
        "RTL"
      ],
      [
        8499389,
        "RTL"
      ],
      [
        8499361,
        "RTL"
      ],
      [
        8489057,
        "RTL"
      ],
      [
        8454009,
        "RTS"
      ],
      [
        8497010,
        "RTL"
      ],
      [
        8430330,
        "RTS"
      ],
      [
        8430518,
        "RTS"
      ],
      [
        8430692,
        "RTS"
      ],
      [
        8493798,
        "RTL"
      ],
      [
        8490245,
        "RTL"
      ],
      [
        8489945,
        "RTL"
      ],
      [
        8515399,
        "RTL"
      ],
      [
        8488790,
        "RTL"
      ],
      [
        8422673,
        "RTS"
      ],
      [
        8436411,
        "RTS"
      ],
      [
        8498578,
        "RTL"
      ]
    ],
    "instructions": 118,
    "reachable": 118,
    "stackBytes": 4,
    "returns": [
      {
        "at": "80:A5DA",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80a2fa",
    "entry": 8430330,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8430330,
        "hex": "A9FFFF8DC20C8D611DAFE62D7E10034CB5A3AA8626A5148502A5178504A51A8506BFE82D7E850048BFF02D7EAABF24B08D85082035A8A301C90B00D005A5008DC20CA511850220AFAAA400A626BFF02D7E990A15AABF1FB08D29C000EB0A690000990014BF20B08D99A813B90A15A21A00CACADD0097D0F98A0A0AAABF303C7E29FF00BB9FF8437E68C90B00D017AF183C7E29FF00F01718BFF8437E6902009FF8437E8009BD58140903009D5814A626989DA81FCACA30034C0DA360"
      }
    ],
    "externalReturns": [
      [
        8431669,
        "RTS"
      ],
      [
        8432303,
        "RTS"
      ]
    ],
    "instructions": 79,
    "reachable": 79,
    "stackBytes": 4,
    "returns": [
      {
        "at": "80:A3B5",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80a3b6",
    "entry": 8430518,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8430518,
        "hex": "A00400B786C829FF00D0034C46A48529B78629FF078502B7862900F8EB4A4A4A8506C8C8B78629FF078504B7862900F8EB0A0A0406C8C8B786AAC8C8BF1FB08D29FF0085200FE42D7EF03EBF20B08D8523F00CDAAABF03007EFAC9FFFFD02ABF22B08D8500BF24B08D85085ADA2035A8A600689D0A15A52029C000EB0A6900009D0014A5239DA8137AC629F0034CC6A398186586859A60"
      }
    ],
    "externalReturns": [
      [
        8431669,
        "RTS"
      ]
    ],
    "indexPulls": [
      8430632
    ],
    "instructions": 75,
    "reachable": 75,
    "stackBytes": 6,
    "returns": [
      {
        "at": "80:A44C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80a44d",
    "entry": 8430669,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8430669,
        "hex": "0AE220A999690085888DDC0C859F859C85F585FEC22060"
      }
    ],
    "externalReturns": [],
    "instructions": 12,
    "reachable": 12,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:A463",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80a464",
    "entry": 8430692,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8430692,
        "hex": "38A98804E514E5174A0A0A8DC60C18A90001651738E5140A0A8DC40C850EADC60C851122058A81061A061AA5111869000138E51A8511A50E1003A90000C900089003A900088DC40CA5111003A90000C97C049003A97C048DC60C60"
      }
    ],
    "externalReturns": [
      [
        8489477,
        "RTL"
      ]
    ],
    "instructions": 43,
    "reachable": 43,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:A4BE",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81b0ac",
    "entry": 8499372,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8499372,
        "hex": "8DC601100449FFFF1A186908008DC8016B"
      }
    ],
    "externalReturns": [],
    "instructions": 8,
    "reachable": 8,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:B0BC",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81b0bd",
    "entry": 8499389,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8499389,
        "hex": "9CC601A980008DBC016B"
      }
    ],
    "externalReturns": [],
    "instructions": 4,
    "reachable": 4,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:B0C6",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81ef94",
    "entry": 8515476,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515476,
        "hex": "A9FFFF8DDE1CA90200A200002207F0816B"
      }
    ],
    "externalReturns": [
      [
        8515591,
        "RTL"
      ]
    ],
    "instructions": 6,
    "reachable": 6,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:EFA4",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818861",
    "entry": 8489057,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489057,
        "hex": "9CDC1FA980018DDE1FE220A9E08D32219C3121C2206B"
      }
    ],
    "externalReturns": [],
    "instructions": 9,
    "reachable": 9,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8876",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818d05",
    "entry": 8490245,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8490245,
        "hex": "EE0E0D6B"
      }
    ],
    "externalReturns": [],
    "instructions": 2,
    "reachable": 2,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8D08",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "808511",
    "entry": 8422673,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8422673,
        "hex": "A9FEFF8DB01F9CCE1F9CD01F9CD41F60"
      }
    ],
    "externalReturns": [],
    "instructions": 6,
    "reachable": 6,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:8520",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80babb",
    "entry": 8436411,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8436411,
        "hex": "9C180DA27E00A900008FA8447E8F28457E9FA8457ECACA10F860"
      }
    ],
    "externalReturns": [],
    "instructions": 10,
    "reachable": 10,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:BAD4",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818954",
    "entry": 8489300,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489300,
        "hex": "ADD00CF03EA9602D8D3243A940008D3543ADCC0C8D1621E220A9818D1521A9088D0B42C220A9A02D8D3243A940008D3543ADCE0C8D1621E220A9088D0B42C2209CD00CADD60CF03EA9E02C8D3243A940008D3543ADD20C8D1621E220A9808D1521A9088D0B42C220A9202D8D3243A940008D3543ADD40C8D1621E220A9088D0B42C2209CD60CADC40C4A4AE2208D0D219C0D218D0F219C0F21C220ADC60C4A4AE2208D0E219C0E218D10219C1021C2206B"
      }
    ],
    "externalReturns": [],
    "instructions": 69,
    "reachable": 69,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8A04",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818bd9",
    "entry": 8489945,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489945,
        "hex": "22BDB08122A1B081CED80CADDB0C489CDB0C9CCA0CADC40CC90004900EE900048DC40CA920008DC80C800C6900048DC40CA9E0FF8DC80CA22000DA22918A8122548981FACAF003DA80F19CC80C688DDB0CEED80C6B"
      }
    ],
    "externalReturns": [
      [
        8499389,
        "RTL"
      ],
      [
        8499361,
        "RTL"
      ],
      [
        8489617,
        "RTL"
      ],
      [
        8489300,
        "RTL"
      ]
    ],
    "instructions": 33,
    "reachable": 33,
    "stackBytes": 7,
    "returns": [
      {
        "at": "81:8C2D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveTransition(map,s){assertPinnedTaskSource(map,s.windows);const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns),indexPulls:new Set(s.indexPulls)});if(map.size!==s.instructions||p.reachable_instructions!==s.reachable||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' transition drift');return p;}
