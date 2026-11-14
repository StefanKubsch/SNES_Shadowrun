// Pinned European ROM scene loader; external callees keep their own contracts.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const sceneLoadSpecs=[
  {
    "name": "81a117",
    "entry": 8495383,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8495383,
        "hex": "8BF47E7EABAB856B0A656BAAE220A97F85108579C220BFE5F98BA8BFE3F98BA214DA860E22699F80A70E8D120DE60EE60EA70EE60E29FF000AAAA98D0085138516BFA0F18D8511BFACF18D8514A70EE60E29FF00851720E28D20C28F22B98C8120229020DF8E202D90A50E8577A70EE60E29FF00F00F8517A9A876855C6465203E90202D90A70EE60E29FF00F0128517A9A846855CA90020856520F08F203E90200A94AB6B"
      }
    ],
    "externalReturns": [
      [
        8429417,
        "RTL"
      ],
      [
        8490466,
        "RTS"
      ],
      [
        8490946,
        "RTS"
      ],
      [
        8490169,
        "RTL"
      ],
      [
        8491042,
        "RTS"
      ],
      [
        8490719,
        "RTS"
      ],
      [
        8491053,
        "RTS"
      ],
      [
        8491070,
        "RTS"
      ],
      [
        8490992,
        "RTS"
      ],
      [
        8492042,
        "RTS"
      ]
    ],
    "instructions": 71,
    "reachable": 71,
    "stackBytes": 6,
    "returns": [
      {
        "at": "81:A1BB",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81801a",
    "entry": 8486938,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8486938,
        "hex": "088BF48B8BABABA20000E220E01200F048DD75FDF005E8E8E880F1C220E8BD75FD85A2ADBC1CAAE00400F02D980A0A0A0AA4A21900009DC61CB902009DCA1CB904009DBE1CB906009DD21C98186908009DCE1CE8E88A8DBC1CAB286B"
      }
    ],
    "externalReturns": [],
    "statusRestoreJoins": [
      8487027,
      8487028
    ],
    "instructions": 48,
    "reachable": 48,
    "stackBytes": 7,
    "returns": [
      {
        "at": "81:8075",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818ce0",
    "entry": 8490208,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490208,
        "hex": "0AAABF80C97F101CAD100D1A9F80C97F8D100D0AA88A4A99FE0CAC100D221A8081AD100D60"
      }
    ],
    "externalReturns": [
      [
        8486938,
        "RTL"
      ]
    ],
    "instructions": 17,
    "reachable": 17,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:8D04",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818d09",
    "entry": 8490249,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490249,
        "hex": "A5263015E0FF0FB006A5239F14CA7F8A18697E00AAC62610EB60"
      }
    ],
    "externalReturns": [],
    "instructions": 13,
    "reachable": 13,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:8D22",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818d23",
    "entry": 8490275,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490275,
        "hex": "A5263015E0FF0FB006A5239F14CA7F8A18698200AAC62610EB60"
      }
    ],
    "externalReturns": [],
    "instructions": 13,
    "reachable": 13,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:8D3C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818d3d",
    "entry": 8490301,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490301,
        "hex": "A523481A8523E080009008186906009F94C97FDA8A38E90200AAA52C3A852620098DA5231A8523E0FF0FB0076903009F14CA7F188A698200AAA5293A48852620238DE623688526A30118690200AA20238DA5231A8523E0FF0FB0076902009F14CA7F188A697E00AAA52C3A852620098DE0FF0FB009A5236904009F14CA7FFA68852360"
      }
    ],
    "externalReturns": [
      [
        8490249,
        "RTS"
      ],
      [
        8490275,
        "RTS"
      ]
    ],
    "instructions": 66,
    "reachable": 66,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:8DBF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818dc0",
    "entry": 8490432,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490432,
        "hex": "A52C8526DA20098DFAC6293014A52C3A85268A18698000AADA20098DFAE8E880DF60"
      }
    ],
    "externalReturns": [
      [
        8490249,
        "RTS"
      ]
    ],
    "instructions": 21,
    "reachable": 21,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:8DE1",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818de2",
    "entry": 8490466,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490466,
        "hex": "A2FE0FA900009F14CA7FCACA10F8A517F062A00000B70EC8C8856BAA302429FE3FAAB70EC8C88523EB29FF008526A900FF1423A56B0A300520098D802D20238D802829FE3FAAB70EC829FF008523B70EC8C8852CEB29FF008529A900FF142CA56B0A1003203D8D20C08DC617D0A79818650E850E60"
      }
    ],
    "externalReturns": [
      [
        8490249,
        "RTS"
      ],
      [
        8490275,
        "RTS"
      ],
      [
        8490301,
        "RTS"
      ],
      [
        8490432,
        "RTS"
      ]
    ],
    "instructions": 60,
    "reachable": 60,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:8E56",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818e57",
    "entry": 8490583,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490583,
        "hex": "18A51A651C651E29FF000AAABF80C77F303CA8B9A8A6451A856B29FF3FD029B9A8AE051CF019B9A8AE451CC56BD019B9A8B6051EF009B9A8B6451EC56BD009BBFEA8CE984A056B60B9A8BEA810C5A420B9A8D688888420A8A9000099A8CE8A09008099A8C6A51A99A8A6A51C99A8AEA51E99A8B6BF80C77F99A8BE989F80C77FBEA8BE9DA8C64A60"
      }
    ],
    "externalReturns": [],
    "instructions": 63,
    "reachable": 63,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:8E9E",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      },
      {
        "at": "81:8EDE",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818edf",
    "entry": 8490719,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490719,
        "hex": "A2BE0BBF14CE7FD0034CB58FA88623B71429FF005A20E08CEB0A0A8529680A0A0A0AA8A523293F000A856BA5232980FF0A0A056B8526B711F00E851A5A20578E7A0529A6269DA876C8C8B711F00E851A5A20578E7A0529A6269D2877C8C8B711F00E851A5A20578E7A0529A6269DA877C8C8B711F00E851A5A20578E7A0529A6269D2878C8C8B711F00E851A5A20578E7A0529A6269DAA76C8C8B711F00E851A5A20578E7A0529A6269D2A77C8C8B711F00E851A5A20578E7A0529A6269DAA77C8C8B711F00E851A5A20578E7A0529A6269D2A78A623CACA30088A29BFFFAA4CE28E60"
      }
    ],
    "externalReturns": [
      [
        8490208,
        "RTS"
      ],
      [
        8490583,
        "RTS"
      ]
    ],
    "indexPulls": [
      8490748
    ],
    "instructions": 125,
    "reachable": 125,
    "stackBytes": 4,
    "returns": [
      {
        "at": "81:8FC1",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818fc2",
    "entry": 8490946,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490946,
        "hex": "A2FE0786208A9DA6D6A9FFFF9DA8CECACAD0F28DA8CE9CA6DEA2FE019F80C77FCACA10F8641A641C641E20578E60"
      }
    ],
    "externalReturns": [
      [
        8490583,
        "RTS"
      ]
    ],
    "instructions": 21,
    "reachable": 21,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:8FEF",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "818ff0",
    "entry": 8490992,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8490992,
        "hex": "A2FE078620A902009DA6D61A1ACACAD0F7A9FFFF8DA8CE9CA6DEA2FE01A9FFFF9F80C77FCACA10F8641A641C641E20578E60"
      }
    ],
    "externalReturns": [
      [
        8490583,
        "RTS"
      ]
    ],
    "instructions": 23,
    "reachable": 23,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:9021",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "819022",
    "entry": 8491042,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8491042,
        "hex": "A2FE5F9EA846CACA10F960"
      }
    ],
    "externalReturns": [],
    "instructions": 6,
    "reachable": 6,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:902C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81902d",
    "entry": 8491053,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8491053,
        "hex": "6423A2FE0BA9FFFF9F00007FCACA10F860"
      }
    ],
    "externalReturns": [],
    "instructions": 8,
    "reachable": 8,
    "stackBytes": 2,
    "returns": [
      {
        "at": "81:903D",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "81903e",
    "entry": 8491070,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8491070,
        "hex": "E220A98A8513C220A00000B70E0A853E29FF3FC8C8AABF6AC38A8511B005A900008003A90040852964386435A200FFA53E0A900286380A90028635B70E29FF00898000F0030900FF0A0A0A853BC8B70E29FF0005350A0A8535C8B70E29FF0005380A0A8538C85AA5351865384A852F18653B38E9000349FFFF1A4A4A4A890010F0030900E00A852CA53838E535186980024A4A4AEB18652C852CA00100A529F003A00300B71118652C852CA00500B71118652F852FA00800A71129FF00D0034CFB938532B7110A0818771129FF7FAAC8C8E220BFFCC396851628",
        "finalM": 1
      },
      {
        "start": 8491288,
        "hex": "BFFAC3968514B005A900008003A9004045298535B71129FF0018652C8538B7112900FFC8C824297005186538800738856BA538E56B8538853BB711C829FF0018652F853E85505AA714290F008541A71429F0004A4A4A4A85448547A00100B714298000F003A9FE7F8D140DB714C8297F005A20E08C7AEB0A0A854AEE140DAD140D300AB71429FF0018653E8550A538C90020B0034CA493C9008090034CA493298000F0034CA493AD140D3001C8B714D0034CAA93C8C84535854D8453A5382900FF4A856BA538297F00056B38E90010855929F8FF4A4AAAA559290600856B0A656B8556BF00007F1020A5239F00007FAA6918008523A9FFFF9F000C7F9F060C7F9F0C0C7F9F120C7F8A65568556A459B15C8562D013641C641EA00000A656A9FFFF9F020C7F4C3C9329FF030AAAA56229001C8568A5622900C0F022856BBDA8A6456B851ABDA8AEF037456B851CBDA8B6F025456B851EA00300845F802CBDA8A6851ABDA8AEF019851CBDA8B6F009851EA00300845F8012641EA00200645F8009641C641EA00100645FA656A550DF000C7FB009E8E888D0F5A54A8568A55FF047C00300D0034CAE93CACAC00200F031C00100F01EA51C851AA51E851CBFFE0B7F9FFC0B7FBF000C7F9FFE0B7FA54A8568800EA51C851ABF000C7F9FFE0B7F80008A38E556A880418A38E556C9060090034CAE93A8C90400F02BA8F00EBF000C7F9F020C7FA51C851E801EBF020C7F9F040C7FBF000C7F9F020C7FA51C851EA51A851C8004A54A8568A5509F000C7FA54D991A00A562F02D29FF030AAADEA8CE1023A620E8E89FA8D67E8620A8B9A8BEBEA8C610069F80477F80039DA8BEA830048A99A8C620578E05680565A459915C8025"
      },
      {
        "start": 8491940,
        "hex": "AD140D3001C8C8C88453C6471036AD140D1A1006A9FE7F8D140DC6413031A5448547A535D00F18A53B690001853B8538A4534C939138A53BE90001853B8538A4534C9391A5381A1A8538A4534C93917AC632F0034C02917AC617F0034C49909818650E850E60"
      }
    ],
    "externalReturns": [
      [
        8490208,
        "RTS"
      ],
      [
        8490583,
        "RTS"
      ]
    ],
    "instructions": 452,
    "reachable": 452,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:9409",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ],
    "unreachableWindows": [
      {
        "start": 8491913,
        "hex": "A5509F000C7FA54D851A641C641E20578E05680565A459915C800A"
      }
    ]
  },
  {
    "name": "81940a",
    "entry": 8492042,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8492042,
        "hex": "641EA2FE0BA0FE2FBF00007F306DDA18691200AAA904008565B9A846F04429FFC39FC0697F2900C08568B9A8465A29FF030AA8B9A8AEF0274568851AB9A8B6F0024568851CDA20578EFA9FC2697FA51CF00D851A641CDA20578EFA9FC4697F7A80049FC0697F8888C665F0088A38E90600AA80A5FACACA108F800A9838E90800A8CACA108360"
      }
    ],
    "externalReturns": [
      [
        8490583,
        "RTS"
      ]
    ],
    "instructions": 67,
    "reachable": 67,
    "stackBytes": 8,
    "returns": [
      {
        "at": "81:948F",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  },
  {
    "name": "809f69",
    "entry": 8429417,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8429417,
        "hex": "206D9F6B"
      }
    ],
    "externalReturns": [
      [
        8429421,
        "RTS"
      ]
    ],
    "instructions": 2,
    "reachable": 2,
    "stackBytes": 3,
    "returns": [
      {
        "at": "80:9F6C",
        "m": 0,
        "x": 0,
        "dbr": "entry"
      }
    ]
  }
];
export function proveSceneLoad(map,s){
 assertPinnedTaskSource(map,s.windows);
 const p=proveWordStack(map,s.entry,s.rootReturn,{externalReturns:new Map(s.externalReturns),measureStack:true,indexPulls:new Set(s.indexPulls),statusRestoreJoins:new Set(s.statusRestoreJoins)});
 if(map.size!==s.instructions||p.reachable_instructions!==s.reachable||p.minimum_protected_stack_bytes!==s.stackBytes||JSON.stringify(p.returns)!==JSON.stringify(s.returns)||p.external_return_assumptions!==s.externalReturns.length)throw Error(s.name+' scene source drift');
 return p;
}
