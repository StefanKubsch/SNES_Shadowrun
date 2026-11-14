// Fixed European-ROM windows. C152 owns only its long frame; all eleven
// children are included in the separate closed graph proof in the test.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export function proveGameNmi(map,s){
  assertPinnedTaskSource(map,s.windows);
  const p=proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,externalReturns:new Map(s.externalReturns)});
  if(p.reachable_instructions!==map.size||map.size!==s.instructions||p.minimum_protected_stack_bytes!==s.stackBytes
    ||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' game NMI source drift');
  return p;
}
export const gameNmiSpecs=[
  {
    "name": "80:C152",
    "entry": 8438098,
    "windows": [
      {
        "start": 8438098,
        "hex": "E220A9808D0021C2202249898122E1A981209A9922C480812219A9812258A981228EA98120BA8F200B9E206BC022D1B081E220ADBC018D0021ADBE018D2C21ADC0018D2D21ADC2018D2E21ADC4018D0C42C2206B"
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [
      [
        8489289,
        "RTL"
      ],
      [
        8497633,
        "RTL"
      ],
      [
        8427930,
        "RTS"
      ],
      [
        8487108,
        "RTL"
      ],
      [
        8497433,
        "RTL"
      ],
      [
        8497496,
        "RTL"
      ],
      [
        8497550,
        "RTL"
      ],
      [
        8425402,
        "RTS"
      ],
      [
        8429067,
        "RTS"
      ],
      [
        8437867,
        "RTS"
      ],
      [
        8499409,
        "RTL"
      ]
    ],
    "instructions": 28,
    "stackBytes": 3,
    "returns": [
      {
        "at": "80:C1A5",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:8949",
    "entry": 8489289,
    "windows": [
      {
        "start": 8489289,
        "hex": "ADD80CD005AD6215D0016BADD00CF03EA9602D8D3243A940008D3543ADCC0C8D1621E220A9818D1521A9088D0B42C220A9A02D8D3243A940008D3543ADCE0C8D1621E220A9088D0B42C2209CD00CADD60CF03EA9E02C8D3243A940008D3543ADD20C8D1621E220A9808D1521A9088D0B42C220A9202D8D3243A940008D3543ADD40C8D1621E220A9088D0B42C2209CD60CADC40C4A4AE2208D0D219C0D218D0F219C0F21C220ADC60C4A4AE2208D0E219C0E218D10219C1021C2206B"
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 74,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:8953",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:8A04",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:A9E1",
    "entry": 8497633,
    "windows": [
      {
        "start": 8497633,
        "hex": "ADF601F03AA98CAC8D6243AD0C02C90114900BE900148D0C02A9001480039CF6018D6543AD0A028D16211869000A8D0A02E220A9808D1521A9408D0B42C220ADF801F023A9A0238D7243A940078D7543A900788D1621E220A9808D1521A9808D0B42C2209CF801ADFA01F023A9E02A8D7243AD10028D7543AD0E028D1621E220A9808D1521A9808D0B42C2209CFA01ADFC01F026AD0E028D1621A910008D5543A9E02A8D5243E220A9808D1521AD3A21A9208D0B42C2209CFC016B"
      }
    ],
    "rootReturn": "RTL",
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
    "name": "80:999A",
    "entry": 8427930,
    "windows": [
      {
        "start": 8427930,
        "hex": "AD0E0DF04BAD100DF0460AA8B9FE0C0A0A0A0A0A6924F68D4243A91E008D4543E220980A0A0A1A8D2121A98C8D4443A9108D0B42C2208888D0D2E2209C2121AD120D8D2221AD130D8D2221C2209C0E0D60"
      }
    ],
    "rootReturn": "RTS",
    "externalReturns": [],
    "instructions": 40,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:99EA",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:80C4",
    "entry": 8487108,
    "windows": [
      {
        "start": 8487108,
        "hex": "ADDA1CF02D8D0243ADDC1CAAADCA1C8D0543A900228D0043E220BDC61C8D2121A98B8D0443A9018D0B42C220A900008DDA1C6B"
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 20,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:80F6",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:A919",
    "entry": 8497433,
    "windows": [
      {
        "start": 8497433,
        "hex": "AD6215F035ACD417F0308888B9D6170A0A0A0A69BAF18D4243A91E008D4543E220980A0A0A69818D2121A98D8D4443A9108D0B42C220888810D26B"
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 31,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:A953",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:A958",
    "entry": 8497496,
    "windows": [
      {
        "start": 8497496,
        "hex": "AD6215F030A682302CBDD4168D1243A940008D1543BD54178D1621E220A9808D1521BD54168D1443A9028D0B42C220CACA10D686826B"
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 23,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:A98D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:A98E",
    "entry": 8497550,
    "windows": [
      {
        "start": 8497550,
        "hex": "AD6215F01EA9083D8D2243A920028D2543A900808D0221E220A9048D0B42C2209C62156B"
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 14,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:A9B1",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80:8FBA",
    "entry": 8425402,
    "windows": [
      {
        "start": 8425402,
        "hex": "AD400130358D1621E220A9018D0B42C220A5F6186903008D4243A91E008D4543E220AD42018D2121A5F88D4443A9108D0B42C220A9FFFF8D400160"
      }
    ],
    "rootReturn": "RTS",
    "externalReturns": [],
    "instructions": 24,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:8FF4",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80:9E0B",
    "entry": 8429067,
    "windows": [
      {
        "start": 8429067,
        "hex": "AD1242290100D0F8AD18428DCA0160"
      }
    ],
    "rootReturn": "RTS",
    "externalReturns": [],
    "instructions": 6,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:9E19",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "80:C06B",
    "entry": 8437867,
    "windows": [
      {
        "start": 8437867,
        "hex": "ADE801F05FC9FEFFF00FC9FDFFF005A9F8FB8008A978FC8003A978FB8D0243E220A98D8D0443A9188D0143A9808D1521A9018D0043C220A900008D1621A940008D0543E220A9018D0B42C220A900018D1621A940008D0543E220A9018D0B42C2209CE8019C0221E220ADD5018D0421AED801D007A9F08D0421800EADD7018D04219C0421A9308D0421C22060"
      }
    ],
    "rootReturn": "RTS",
    "externalReturns": [],
    "instructions": 55,
    "stackBytes": 2,
    "returns": [
      {
        "at": "80:C0F6",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81:B0D1",
    "entry": 8499409,
    "windows": [
      {
        "start": 8499409,
        "hex": "ADC601F023CEC801D01EADC601101A49FFFF1A8DC801E220ADBC01290FF024ADBC013A8DBC01C2206B8DC801E220ADBC01290FC90FF00CADBC011A297F8DBC01C2206B"
      },
      {
        "start": 8499476,
        "hex": "C2209CC6016B",
        "initialM": 1
      }
    ],
    "rootReturn": "RTL",
    "externalReturns": [],
    "instructions": 33,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:B0F9",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:B119",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:B113",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
