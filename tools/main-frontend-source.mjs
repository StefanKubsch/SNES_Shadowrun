import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
// Pinned European ROM frontend code and path-specific decoder modes.
// No runtime CPU decode. Callees retain their separate source contracts.
export const frontendSpecs=[
  {
    "name": "80a18c",
    "entry": 8429964,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8429964,
        "hex": "0848F48080ABABA900002229F281A903002292F08168D00D22B1DD81A901002229F28180222294D681D00DA90100224AE181800B2294D681A90000224AE181C9FEFFD00F2068A1A90000224AE181C9FEFFF0E1F48080ABAB2860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 35,
    "stackBytes": 7,
    "returns": [
      {
        "at": "80:A1E5",
        "m": 0,
        "x": 0,
        "dbr": 128
      }
    ],
    "externalReturns": [
      "80:A168",
      "81:D694",
      "81:DDB1",
      "81:E14A",
      "81:F092",
      "81:F229"
    ]
  },
  {
    "name": "80a168",
    "entry": 8429928,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8429928,
        "hex": "2263EF8122F39680F48080ABAB2297EB81A900002229F281A903002292F08122B1DD8160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 12,
    "stackBytes": 4,
    "returns": [
      {
        "at": "80:A18B",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "80:96F3",
      "81:DDB1",
      "81:EB97",
      "81:EF63",
      "81:F092",
      "81:F229"
    ]
  },
  {
    "name": "81d694",
    "entry": 8509076,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8509076,
        "hex": "08C230A90200A27F7F2207F0819C1C0D22E5E88120DBDDCAE8F003824500200FD62042D6E220AD4221D0FBC220227BEB8122DDEE81641A641CA23400DA22BBEE812298F280FAADCA01D018CAD0EEA2DFF6A081002216EC8122BBEE812298F280ADCA01F003827800A51EC90104D0E9A2A846A9F2DAA0840022A0F2802289EB81A2E5F6A081002216EC81A9B000851A641C641E6418A25E00A900009FA87E7ECACA10F822BBEE81227BEB8122BBEE81A51EC926029003201FD82298F280ADCA01D01EA51EC9E80390E2E220A9018D2C21C22022BBEE812298F280201FD8ADCA01F0034C03D8A51EC9AC0D90E6E220AD4221D0FBC2202027D9207CD8ADCA01D06FE220A9BE8D10219C1021AD4221D0FBC220207CD8ADCA01D056E220A9DF8D10219C1021AD4221D0FBC220207CD8ADCA01D03D22BBEE812298F280ADCA01D030A51EC9104D90ECAD3E212900104A4A4A651EC9006090DC22F1EE812289EB81E2209C0C42AD4221D0FB28",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8509437,
        "hex": "C220A900006BC220A90200A200002207F08122F1EE812289EB819C0C4228A901006B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 150,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:D81E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:D802",
        "m": 0,
        "x": 0,
        "dbr": 129
      },
      {
        "at": "81:D81E",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "80:F298",
      "80:F2A0",
      "81:D60F",
      "81:D642",
      "81:D81F",
      "81:D87C",
      "81:D927",
      "81:DDDB",
      "81:E8E5",
      "81:EB7B",
      "81:EB89",
      "81:EC16",
      "81:EEBB",
      "81:EEDD",
      "81:EEF1",
      "81:F007"
    ]
  },
  {
    "name": "81dddb",
    "entry": 8510939,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8510939,
        "hex": "088B2297EB8122E9EB81A903F8A08100A2A85622A0F280A9CEF5A08100A2A86222A0F280A268F7A081002216EC8122B1DD81641E641C6418227BEB818BA900008FA84E7EA2A84EA0A94EA9FE07547E7EAB22DDEE81F47E7EABABA2D403DA22BBEE812298F280C61C1011A90200851CE61EA51E290700D0032093DEFAADCA01D034E05C03D021DA8B4BABA90800A200002207F081A90200A27F7F2207F081A901002229F281ABFACAD0B3DAF48080ABAB22F1EE81FAAB2860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 75,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:DE92",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "80:F298",
      "80:F2A0",
      "81:DDB1",
      "81:DE93",
      "81:EB7B",
      "81:EB97",
      "81:EBE9",
      "81:EC16",
      "81:EEBB",
      "81:EEDD",
      "81:EEF1",
      "81:F007",
      "81:F229"
    ]
  },
  {
    "name": "81de93",
    "entry": 8511123,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8511123,
        "hex": "A51E29F8FF0A0A0A1869800729FF07AAA418B9A86229FF00F05AA92000850EB9A86229FF00F005C8C60E80F3460EA90000C60E30089FA84E7EE8E880F4A418B9A86229FF00F01838E92000DA0AAABFA8567EFA29FFC09FA84E7EE8E8C880E0C884188A293E00F00BA900009FA84E7EE8E880EF60A9A00F851C80ED",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 60,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:DF06",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d81f",
    "entry": 8509471,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8509471,
        "hex": "E220AFA88E7EC901F0123A8FA88E7EAFAB8E7E1A8FAB8E7E8FAE8E7EC22060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 12,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:D83D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d87c",
    "entry": 8509564,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8509564,
        "hex": "4BABE220A9018D2C21A9028D2D21A9028D3021A9418D3121C220A2120022BBEE8120E5D82298F280ADCA01D03BE8E01800D0EAA23C0022BBEE812298F280ADCA01D025CAD0F0A2170022BBEE8120E5D82298F280ADCA01D00FCA10EDE220A9018D2C219C2D21C22060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 42,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:D8E4",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "80:F298",
      "81:D8E5",
      "81:EEBB"
    ]
  },
  {
    "name": "81d8e5",
    "entry": 8509669,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8509669,
        "hex": "DA8A4A4A0AAABD0FD98510BD1BD98512A25E00A900002512A410F0044A88D0FC9FA87E7ECACA10EBFA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 24,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:D90E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d927",
    "entry": 8509735,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8509735,
        "hex": "08E220A9038D2C21A9138D0B21A99C8D10219C102128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8509757,
        "hex": "60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 11,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:D93D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d531",
    "entry": 8508721,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8508721,
        "hex": "B9000029FF00F01BDA38E920000AAABFA8467E0900244518FA9FA9867EE8E8C84C31D56B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 18,
    "stackBytes": 5,
    "returns": [
      {
        "at": "81:D554",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d555",
    "entry": 8508757,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8508757,
        "hex": "08C230A2FE07A900249FA9867ECACA10F88B4BAB6418A28406A082D52231D581A21E009EA411CACA10F9AB286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 23,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:D581",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:D531"
    ]
  },
  {
    "name": "81d59e",
    "entry": 8508830,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8508830,
        "hex": "08C220E210A2808E1521A2018E0043A2188E0143A9A9868D0243A27E8E0443A900088D0543A900088D1621A2018E0B4228",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 1
      },
      {
        "start": 8508879,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 21,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:D5CF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d5f4",
    "entry": 8508916,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8508916,
        "hex": "08E220A9808FFC1F70A9008FFD1F70A9038FFE1F7022E4D58128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8508942,
        "hex": "6B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 11,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:D60E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:D5E4"
    ]
  },
  {
    "name": "81ef36",
    "entry": 8515382,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8515382,
        "hex": "08C230AFFC1F70AAA914002207F081286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 8,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:EF46",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:F007"
    ]
  },
  {
    "name": "81e14a",
    "entry": 8511818,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8511818,
        "hex": "08C23048A90200A27F7F2207F081A902002229F2812297EB8122E5E88122E9EB81A2B5F7A081002216EC81227BEB812255D581A25E00A9FF7F9FC87E7ECACA10F8A21E00BFC0EB859FA87E7ECACA10F4A21800A08700A91AD722A4F280A21880A08400A9E8F922A4F280E220AD4221C902D0F9C22022DDEE81200CE5A96009FAF003A92C01851C208DE3640EA20300209FE2A9FFFF8516A50ED0038281001003829500C90100F05EC90200F00280DD640EE22022E4D581C2202236EF812046E4A20400209FE2A50E306E3A30173A30243A1031E220AFFE1F70D002A9074A8FFE1F7080CD",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8512046,
        "hex": "E220AFFD1F70490129018FFD1F7080BD",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8512062,
        "hex": "E220AFFC1F70498029808FFC1F7080AD",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8512078,
        "hex": "808120DAE3640EA20300209FE2A50E3023C90200D003826AFF85162054E3A90200A200002207F08122F1EE812289EB81A516286BA90200A200002207F08122F1EE812289EB81A9FEFF286B",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 127,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:E281",
        "m": 0,
        "x": 0,
        "dbr": 129
      },
      {
        "at": "81:E298",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "80:F2A4",
      "81:D555",
      "81:D5E4",
      "81:E29F",
      "81:E354",
      "81:E38D",
      "81:E3DA",
      "81:E446",
      "81:E50C",
      "81:E8E5",
      "81:EB7B",
      "81:EB89",
      "81:EB97",
      "81:EBE9",
      "81:EC16",
      "81:EEDD",
      "81:EEF1",
      "81:EF36",
      "81:F007",
      "81:F229"
    ]
  },
  {
    "name": "81e29f",
    "entry": 8512159,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512153,
        "hex": "A9FFFF850E60A92300202FE3806922BBEE81C61CF0EA2298F280ADCE01290090D061ADCE01290008F023DAA20922A907002207F081FAA96009851CA50ED0018A3A2043E3A50E0AA8B9A411D0EEADCE01290024F02BDAA20922A907002207F081FAA96009851C8610C610A50EC510D003A9FFFF1A2043E3A50E0AA8B9A411D0E64CA7E2A92000202FE3DAA20822A907002207F081FA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 65,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E32E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:E29E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "80:F298",
      "81:E32F",
      "81:E343",
      "81:EEBB",
      "81:F007"
    ]
  },
  {
    "name": "81e32f",
    "entry": 8512303,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512303,
        "hex": "8510A50EEB4A691004DAAAA010002231D581FA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 11,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E342",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:D531"
    ]
  },
  {
    "name": "81e343",
    "entry": 8512323,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512323,
        "hex": "48A92000202FE368850EA92300202FE360",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 8,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E353",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:E32F"
    ]
  },
  {
    "name": "81e354",
    "entry": 8512340,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512340,
        "hex": "A90800851022BBEE8122BBEE812071E322BBEE8122BBEE81C610D0E960",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 10,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:E370",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:E371",
      "81:EEBB"
    ]
  },
  {
    "name": "81e371",
    "entry": 8512369,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512369,
        "hex": "A50EEB4A690004AAA02000BFA9867E49000C9FA9867EE8E888D0F060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 14,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:E38C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81e38d",
    "entry": 8512397,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512397,
        "hex": "4BAB2255D581A21404A0B2E32231D581A29404A0C1E32231D581A21405A0D2E32231D58160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 13,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:E3B1",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "81:D531",
      "81:D555"
    ]
  },
  {
    "name": "81e3da",
    "entry": 8512474,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512474,
        "hex": "4BAB2255D581A20100DA8A22ABB181F00BFA8A0AA8A9000499A411DAFACA10E9ADA4118518A21404A025E42231D581ADA6118518A29404A033E42231D5816418A21405A041E42231D58160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 33,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E424",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "81:B1AB",
      "81:D531",
      "81:D555"
    ]
  },
  {
    "name": "81e446",
    "entry": 8512582,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512582,
        "hex": "4BAB2255D581A29404A0AEE4AFFC1F70298000F003A0A1E42231D581A21404A0B9E4AFFD1F70290100D003A0C8E42231D581A21405A0FDE4AFFE1F70290300F00BA0ECE4C90100F003A0DCE42231D581A29405A0D7E42231D58160",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 31,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:E4A0",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "81:D531",
      "81:D555"
    ]
  },
  {
    "name": "81e50c",
    "entry": 8512780,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512780,
        "hex": "4BABE220AD4221C903D0F9C220AFB87E7E850E851EA20E0022BBEE8122BBEE81E00A00B006A51E9FBE7E7EA50E18696308850E9FB87E7ECACA10DDA2000022BBEE8120DBE5DA8A38E90600900D29FE00490600AAA51E9FB67E7EFAE220A9078D2C21C220E8E00C00D0D422BBEE81207EE560",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 49,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E57D",
        "m": 0,
        "x": 0,
        "dbr": 129
      }
    ],
    "externalReturns": [
      "81:E57E",
      "81:E5DB",
      "81:EEBB"
    ]
  },
  {
    "name": "81e57e",
    "entry": 8512894,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512894,
        "hex": "08A20E00BFCBE5819D1E0FCACA10F5A9AA008D1E119C3E119C40119C42119C4411AFB8E781AAA907002207F081AFBAE781AAA907002207F0812023E6E220A9238D0121A9178D2C21EEA21128",
        "initialM": 0,
        "initialX": 0,
        "finalM": 1,
        "finalX": 0
      },
      {
        "start": 8512970,
        "hex": "60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 30,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:E5CA",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:E623",
      "81:F007"
    ]
  },
  {
    "name": "81e5db",
    "entry": 8512987,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8512987,
        "hex": "DA8A4A0AAABD0BE68510BD17E68512A25E00BFE0EB8549FF7F2512A410F0044A88D0FC49FF7F9FC87E7ECACA10E4FA60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 25,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E60A",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81e623",
    "entry": 8513059,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8513059,
        "hex": "08C230AD3E112084E68F04007FAD4011186918002084E68F06007FAD42112099E68F08007F186900048F0A007F6900048F0C007F6900048F0E007FAD4411186918002099E68F10007F186900048F12007F6900048F14007F6900048F16007F2860",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 34,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:E683",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:E684",
      "81:E699"
    ]
  },
  {
    "name": "81e684",
    "entry": 8513156,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8513156,
        "hex": "48290700EB4A85326829F800EB4A05321869188060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 13,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E698",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81e699",
    "entry": 8513177,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8513177,
        "hex": "48290700EB4A85326829F800EB0A05321869180060",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 13,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E6AD",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81e6ae",
    "entry": 8513198,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8513198,
        "hex": "228BED81229ED581E210A0008C2121A0008C0043A0228C0143A9A87E8D0243A07E8C0443A980008D0543A0018C0B42ADA211D0034C83E7A212A0808C1521A0018C0043A07F8C0443A0188C0143BF04007F8D0243A980008D0543BFA0E7818D1621A0018C0B42CACA10E3ADA211290700D018A206BD3E11C91700F007186901009D3E11CACA10ED2023E6EEA2112088E7290600AABD3E11C91700D0392088E729FF07C91E00B02EA900009D3E11DAC210A90F00A20E002207F081E210FABFB4E781C210AAA907002207F081A90F00A201002207F081",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      },
      {
        "start": 8513411,
        "hex": "2290F2806B",
        "initialM": 0,
        "initialX": 1,
        "finalM": 0,
        "finalX": 1
      }
    ],
    "instructions": 84,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:E787",
        "m": 0,
        "x": 1,
        "dbr": "entry"
      },
      {
        "at": "81:E787",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "80:F290",
      "81:D59E",
      "81:E623",
      "81:E788",
      "81:ED8B",
      "81:F007"
    ]
  },
  {
    "name": "81e788",
    "entry": 8513416,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8513416,
        "hex": "AF00007F4F02007F4DA21169DB0A8F00007F2A8F02007F60",
        "initialM": 0,
        "initialX": 0,
        "finalM": 0,
        "finalX": 0
      }
    ],
    "instructions": 8,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:E79F",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d5d0",
    "entry": 8508880,
    "rootReturn": "RTS",
    "initialM": 1,
    "windows": [
      {
        "start": 8508880,
        "hex": "08C210A20200A9EB187FFC1F70CA10F9495A2860",
        "initialM": 1,
        "finalM": 1
      }
    ],
    "instructions": 11,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:D5E3",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": []
  },
  {
    "name": "81d5e4",
    "entry": 8508900,
    "rootReturn": "RTL",
    "initialM": 1,
    "windows": [
      {
        "start": 8508900,
        "hex": "20D0D58FFF1F706B",
        "initialM": 1,
        "finalM": 1
      }
    ],
    "instructions": 3,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:D5EB",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:D5D0"
    ]
  },
  {
    "name": "81d5ec",
    "entry": 8508908,
    "rootReturn": "RTL",
    "initialM": 1,
    "windows": [
      {
        "start": 8508908,
        "hex": "20D0D5CFFF1F706B",
        "initialM": 1,
        "finalM": 1
      }
    ],
    "instructions": 3,
    "stackBytes": 3,
    "returns": [
      {
        "at": "81:D5F3",
        "m": 1,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "externalReturns": [
      "81:D5D0"
    ]
  },
{
  "name": "main-owner-a139",
  "entry": 8429881,
  "rootReturn": "RTS",
  "windows": [
    {
      "start": 8429881,
      "hex": "48A903008DD61F68208CA18500AFFE1F708DD61F2263EF81204EE2208896A9000080DD"
    }
  ],
  "instructions": 13,
  "stackBytes": 4,
  "returns": [],
  "externalReturns": [
    "80:9688",
    "80:A18C",
    "80:E24E",
    "81:EF63"
  ]
},
{
  "name": "attract-game-96f3",
  "entry": 8427251,
  "rootReturn": "RTL",
  "windows": [
    {
      "start": 8427251,
      "hex": "204EE2200D96A9AB002099966B"
    },
    {
      "start": 8427161,
      "hex": "482029966820BFA49CD81F9CDA1F2261888122A1B0812277888122768081201A9E206DBE203BBF20E3C1200080B0E3204BCCB0DE2094DE20C4AF20D5BA222E8C8122918A8120DEB82014FF2070E2ADDA1FF00160ADD81FF0B960"
    }
  ],
  "instructions": 37,
  "stackBytes": 7,
  "returns": [
    {
      "at": "80:96FF",
      "m": 0,
      "x": 0,
      "dbr": "entry"
    }
  ],
  "externalReturns": [
    "80:8000",
    "80:960D",
    "80:9629",
    "80:9E1A",
    "80:A4BF",
    "80:AFC4",
    "80:B8DE",
    "80:BAD5",
    "80:BE6D",
    "80:BF3B",
    "80:C1E3",
    "80:CC4B",
    "80:DE94",
    "80:E24E",
    "80:E270",
    "80:FF14",
    "81:8076",
    "81:8861",
    "81:8877",
    "81:8A91",
    "81:8C2E",
    "81:B0A1"
  ]
},
{
  "name": "menu-marker-e24e",
  "entry": 8446542,
  "rootReturn": "RTS",
  "windows": [
    {
      "start": 8446542,
      "hex": "A9FFFF8D891D60"
    }
  ],
  "instructions": 3,
  "stackBytes": 2,
  "returns": [
    {
      "at": "80:E254",
      "m": 0,
      "x": 0,
      "dbr": "entry"
    }
  ],
  "externalReturns": []
},
{
  "name": "save-validity-b1ab",
  "entry": 8499627,
  "rootReturn": "RTL",
  "windows": [
    {
      "start": 8499627,
      "hex": "850E202CB1DF0000706B"
    },
    {
      "start": 8499482,
      "hex": "A50E0AAABF24B181AA60"
    },
    {
      "start": 8499500,
      "hex": "201AB1DAE8E8A0260FE220A9AD85146411BF000070E81865112074B185111865142074B1851488D0E8A5111865142074B149FF85141865112074B149FF8515C220FAA51449A5AB60"
    },
    {
      "start": 8499572,
      "hex": "90011AC9FFD0011A60",
      "initialM": 1,
      "finalM": 1
    }
  ],
  "instructions": 53,
  "stackBytes": 9,
  "returns": [
    {
      "at": "81:B1B4",
      "m": 0,
      "x": 0,
      "dbr": "entry"
    }
  ],
  "externalReturns": []
},
{
  "name": "title-nmi-dd54",
  "entry": 8510804,
  "rootReturn": "RTL",
  "windows": [
    {
      "start": 8510804,
      "hex": "A900108D1621A901188D0043A9A84E8D0243A900088D0543A51EE2208D1221EB8D1221A9808D1521A97E8D0443A9018D0B42C2204C4FDD"
    },
    {
      "start": 8510799,
      "hex": "2290F2806B"
    }
  ],
  "instructions": 23,
  "stackBytes": 3,
  "returns": [
    {
      "at": "81:DD53",
      "m": 0,
      "x": 0,
      "dbr": "entry"
    }
  ],
  "externalReturns": [
    "80:F290"
  ]
},
{
  "name": "title-nmi-d93e",
  "entry": 8509758,
  "rootReturn": "RTL",
  "windows": [
    {
      "start": 8509758,
      "hex": "228BED81A51EC90104D0034CD5D948A51C1869D0079003A9FFFF851C18651A851AA51E690000851E68E2208D0D21EB8D0D21EBC2204A4AE2208D0F21EB8D0F21EBC2204AE2208D1121EB8D1121EBC2204BABA20000BD92DC303DC51EF0088A18690600AA80EFE8E8E210A0808C1521A0018C0043A0188C0143BD92DCE8E88D0243A07E8C0443A900088D0543BD92DC8D1621A0018C0B42",
      "finalX": 1
    },
    {
      "start": 8509909,
      "hex": "4BABC23022D7ED81642CA51E4A4A8532A20E00A900208524BD3E113037A8B9DDDADA48BC7E11BD5E1138E532AA68223AE881FAADA211290300D019BD3E111A1A9D3E11A8B9DDDA100BC9FEFFD003A93C009D3E11CACA10BBA51E4A4A4A8532A20E00A900128524BD4E11302FA8B9DDDADA48BC8E11BD6E1138E532AA68223AE881FAADA211290700D011BD4E111A1A9D4E11A8B9DDDA10039D4E11CACA10C3220CEE81AE9E11ADA211DD8BDBD01FDABD8FDB4A18693800A8BD8DDB4AAAA51E4A4A2200E9816818690600AA80D98E9E11AEA011ADA211DDE1DBD01BDABDE5DB4A18693500A8BDE3DB4AAA2271E9816818690600AA80DD8EA011EEA2112290F2806B"
    }
  ],
  "instructions": 199,
  "stackBytes": 7,
  "returns": [
    {
      "at": "81:DAD5",
      "m": 0,
      "x": 0,
      "dbr": 129
    }
  ],
  "externalReturns": [
    "80:F290",
    "81:E83A",
    "81:E900",
    "81:E971",
    "81:ED8B",
    "81:EDD7",
    "81:EE0C"
  ]
},
{
  "name": "title-nmi-dcac",
  "entry": 8510636,
  "rootReturn": "RTL",
  "windows": [
    {
      "start": 8510636,
      "hex": "228BED81A51CC51AF00890033A80011A851C4A4A18651E851E4A4AE2208D0E21EB8D0E21EBC2204AC97800B00EE2208D1021EB8D1021EBC2208029E210A0108C2121A0008C0043A0228C0143A9A87E8D0243A07E8C0443A960008D0543A0018C0B42C2104BABA618BD8BDDC51EB0348A186906008518E210A0808C1521A0018C0043A0188C0143BD8DDD8D0243A07E8C0443A900088D0543BD8FDD8D1621A0018C0B422290F2806B",
      "finalX": 1
    }
  ],
  "instructions": 77,
  "stackBytes": 4,
  "returns": [
    {
      "at": "81:DD53",
      "m": 0,
      "x": 1,
      "dbr": 129
    },
    {
      "at": "81:DD53",
      "m": 0,
      "x": 0,
      "dbr": 129
    }
  ],
  "externalReturns": [
    "80:F290",
    "81:ED8B"
  ]
},
{
  "name": "main-scene-entry-9699",
  "entry": 8427161,
  "rootReturn": "RTS",
  "windows": [
    {
      "start": 8427161,
      "hex": "482029966820BFA49CD81F9CDA1F2261888122A1B0812277888122768081201A9E206DBE203BBF20E3C1200080B0E3204BCCB0DE2094DE20C4AF20D5BA222E8C8122918A8120DEB82014FF2070E2ADDA1FF00160ADD81FF0B960"
    }
  ],
  "instructions": 32,
  "stackBytes": 4,
  "returns": [
    {
      "at": "80:96EC",
      "m": 0,
      "x": 0,
      "dbr": "entry"
    },
    {
      "at": "80:96F2",
      "m": 0,
      "x": 0,
      "dbr": "entry"
    }
  ],
  "externalReturns": [
    "80:8000",
    "80:9629",
    "80:9E1A",
    "80:A4BF",
    "80:AFC4",
    "80:B8DE",
    "80:BAD5",
    "80:BE6D",
    "80:BF3B",
    "80:C1E3",
    "80:CC4B",
    "80:DE94",
    "80:E270",
    "80:FF14",
    "81:8076",
    "81:8861",
    "81:8877",
    "81:8A91",
    "81:8C2E",
    "81:B0A1"
  ]
}
];

// Source lemmas: PLX E1C9 takes the initial WORD PHA E14D; SEP E1FB
// joins already-BYTE and WORD paths. E783/E787 are width-independent
// JSL F290/RTL: F290's PHP/REP30/PLP preserves each incoming X width.
// Explicit DBR results come from the separately pinned callee contracts.
export function proveFrontend(map,s){assertPinnedTaskSource(map,s.windows);
 const externalReturns=new Map([...map.values()].filter(i=>['JSR','JSL'].includes(i.mnemonic)&&!map.has(i.target))
   .map(i=>[i.target,i.mnemonic==='JSL'?'RTL':'RTS']));
 const knownBanks=new Map([[0x81D60F,0x81],[0x81D87C,0x81],[0x81D694,['entry',0x81]],[0x81DDB1,0x81],
   [0x81E14A,0x81],[0x81E38D,0x81],[0x81E3DA,0x81],[0x81E446,0x81],[0x81E50C,0x81],[0x81EF63,0x80]]);
 return proveWordStack(map,s.entry,s.rootReturn,{measureStack:true,initialM:s.initialM??0,
   externalReturns,externalReturnBanks:new Map([...knownBanks].filter(([target])=>externalReturns.has(target))),
   programBankPushes:new Set([...map.values()].filter(i=>i.mnemonic==='PHK').map(i=>i.cpu)),
   dataPulls:new Set(s.entry===0x81E14A?[0x81E1C9]:[]),widthJoins:new Set(s.entry===0x81E14A?[0x81E1FB]:s.entry===0x81D93E?[0x81D9D7]:[]),
   indexPulls:new Set(s.entry===0x81D93E?[0x81DA9A,0x81DAC3]:[]),
   controlWidthJoins:new Set(s.entry===0x81E6AE?[0x81E783,0x81E787]:s.entry===0x81D93E?[0x81D9D5,0x81D9D6]:s.entry===0x81DCAC?[0x81DD4F,0x81DD53]:[])});
}

// Original callback programs, menu labels and palette/transfer tables.
export const frontendDataWindows=[
  {
    "start": 8517343,
    "hex": "023ED981000002ACDC81000507210200"
  },
  {
    "start": 8517480,
    "hex": "0254DD8100030020B8F88100E01F05212101052221F70522215E052221F70522215E052221FF0522217F05092111050C2102052C210400"
  },
  {
    "start": 8517557,
    "hex": "02AEE68100030000DDD884000008030004B1D885000008030040F2DA8400E01F030020F8DF85000032030010B8F88100E01F0480008500C0EB04108084000BFD03000803F881000001052C210600"
  },
  {
    "start": 8512434,
    "hex": "5354415254204E45572047414D450053544152542053415645442047414D45004F5054494F4E5300"
  },
  {
    "start": 8512549,
    "hex": "524553554D452047414D45203100524553554D452047414D452032004558495400"
  },
  {
    "start": 8512673,
    "hex": "53544552454F50484F4E4943004D4F4E4F50484F4E494300434F4E54524F4C2054595045204100434F4E54524F4C20545950452042004558495400422E472E204D555349432046554C4C00422E472E204D55534943204556454E5400422E472E204D55534943204F464600"
  },
  {
    "start": 8512971,
    "hex": "70230030A23A043040220830C0220C30"
  },
  {
    "start": 8513035,
    "hex": "0500040003000200010000000000104218639C73DE7BFF7F"
  },
  {
    "start": 8513440,
    "hex": "006040608060806180628063C060C061C062C0630077016802A4034A"
  },
  {
    "start": 8510610,
    "hex": "0001A84E00000002A85600040003A85E00000004A8660004FFFF"
  },
  {
    "start": 8510859,
    "hex": "E803A8660000D007A84600101008A84E00145008A85600189008A85E001CB80BA876000CFFFF"
  },
  {
    "start": 8509711,
    "hex": "0500040003000200010000000000104218639C73DE7BFF7F"
  }
];
