import {proveFrontend} from './main-frontend-source.mjs';
export const proveStartup=proveFrontend;
export const startupSpecs=[
  {
    "name": "startup-owner-a133",
    "entry": 8429875,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8429875,
        "hex": "205CA1A9010048A903008DD61F68208CA18500AFFE1F708DD61F2263EF81204EE2208896A9000080DD"
      }
    ],
    "instructions": 15,
    "stackBytes": 4,
    "returns": [],
    "externalReturns": [
      "80:9688",
      "80:A15C",
      "80:A18C",
      "80:E24E",
      "81:EF63"
    ]
  },
  {
    "name": "startup-a15c",
    "entry": 8429916,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8429916,
        "hex": "0822BCE781F48080ABAB2860"
      }
    ],
    "instructions": 7,
    "stackBytes": 5,
    "returns": [
      {
        "at": "80:A167",
        "m": 0,
        "x": 0,
        "dbr": 128
      }
    ],
    "externalReturns": [
      "81:E7BC"
    ]
  },
  {
    "name": "startup-e7bc",
    "entry": 8513468,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8513468,
        "hex": "08C23064102297EB81A20080A08A002216EC8122E9EB81227BEB8122DDEE812207EF81A2960022BBEE81CAD0F922F1EE812289EB81AFFC1F702980018FFC1F70E22022ECD581F00422F4D581C2202297EB81A226ECA089002216EC8122E9EB81227BEB8122DDEE81A2B40022D5EE8122F1EE812289EB812236EF81286B"
      }
    ],
    "instructions": 39,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E838",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:D5EC",
      "81:D5F4",
      "81:EB7B",
      "81:EB89",
      "81:EB97",
      "81:EBE9",
      "81:EC16",
      "81:EEBB",
      "81:EED5",
      "81:EEDD",
      "81:EEF1",
      "81:EF07",
      "81:EF36"
    ]
  },
  {
    "name": "startup-ef07",
    "entry": 8515335,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515335,
        "hex": "A9FFFF8DDE1C227FF081A90800A200002207F081A90D00A220202207F0816B"
      }
    ],
    "instructions": 10,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:EF25",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:F007",
      "81:F07F"
    ]
  },
  {
    "name": "startup-f07f",
    "entry": 8515711,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515711,
        "hex": "08C210E220A00080A997A2550C22A5EF8128",
        "finalM": 1
      },
      {
        "start": 8515729,
        "hex": "6B"
      }
    ],
    "instructions": 9,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:F091",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:EFA5"
    ]
  },
  {
    "name": "startup-efa5",
    "entry": 8515493,
    "rootReturn": "RTL",
    "initialM": 1,
    "windows": [
      {
        "start": 8515493,
        "hex": "08858B8489AD4021C9AAD0F9AD4121C9BBD0F2EE4121A9008D4221A9028D4321A9CC8D40212001F0A00000B78920FAEFC8CAD0F79C4121A9008D4221A9028D4321981A8D4021A9CACD4121D0FB9C40219CE41C286B8D4121988D4021CD4021D0FB60",
        "initialM": 1,
        "finalM": 1
      }
    ],
    "instructions": 44,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:EFF9",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "startup-effa",
    "entry": 8515578,
    "rootReturn": "RTS",
    "initialM": 1,
    "windows": [
      {
        "start": 8515578,
        "hex": "8D4121988D4021CD4021D0FB60",
        "initialM": 1,
        "finalM": 1
      }
    ],
    "instructions": 6,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:F006",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "startup-f001",
    "entry": 8515585,
    "rootReturn": "RTS",
    "initialM": 1,
    "windows": [
      {
        "start": 8515585,
        "hex": "CD4021D0FB60",
        "initialM": 1,
        "finalM": 1
      }
    ],
    "instructions": 3,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:F006",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "startup-nmi-e839",
    "entry": 8513593,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8513593,
        "hex": "6B"
      }
    ],
    "instructions": 1,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:E839",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  }
];
export const startupDataWindows=[
  {
    "start": 9076736,
    "hex": "0239E881000300009C878A00000803004031818A00E01F0300080AFB81000008030010B8F88100E01F0420008A003180000000DF7B197B"
  },
  {
    "start": 9038886,
    "hex": "0239E88100030000CEF789000008030040EDEC8900E01F04500089004DEC050D21FC050D21FF000000"
  },
  {
    "start": 9928704,
    "hex": "C020CDEFBD8F6CF28FFFF38F2DF28F00"
  }
];
