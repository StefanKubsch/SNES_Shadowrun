// Pinned European-ROM windows, independent of the native equations. External callees have separate proofs.
import {assertPinnedTaskSource} from './pinned-task-source.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
export const mainCameraSpecs = [
  {
    "name": "camera-8a05",
    "entry": 8489477,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489477,
        "hex": "ADDB0CD0016B853FADDA0C853EA50E38E900048541A9400938E5110A85471865414A4A4A8544A54738E5414A4A4A8541644AA00100B73EC9FFFFF04FA541D73EB004B73E844AC8C8D73E9004B73E844AC8C88541A544D73EB004B73E844AC8C8D73E9004B73E844A8544A54AF01DA54438E5410A0A18690004850EA5441865410A8511A9400938E51185116B"
      }
    ],
    "externalReturns": [],
    "instructions": 79,
    "maximumLocalStackBytes": 0,
    "protectedStackBytes": 3,
    "returns": [
      "81:8A0A",
      "81:8A90"
    ]
  },
  {
    "name": "camera-8c2e",
    "entry": 8490030,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8490030,
        "hex": "ACC20C10034CB88CA9100938F9300F8511A900041879800E38F9280E850E5A22058A817AA5111869000138F9D80E38EDC60C29F8FFF01E300C4A4AC921009015A9200080104A4A0900C0690000C9E0FFB003A9E0FF29FCFF8DCA0CA50E38EDC40C29F8FFF01E300C4A4AC921009015A9200080104A4A0900C0690000C9E0FFB003A9E0FF29FCFF8DC80C6B"
      },
      {
        "start": 8489477,
        "hex": "ADDB0CD0016B853FADDA0C853EA50E38E900048541A9400938E5110A85471865414A4A4A8544A54738E5414A4A4A8541644AA00100B73EC9FFFFF04FA541D73EB004B73E844AC8C8D73E9004B73E844AC8C88541A544D73EB004B73E844AC8C8D73E9004B73E844A8544A54AF01DA54438E5410A0A18690004850EA5441865410A8511A9400938E51185116B"
      }
    ],
    "externalReturns": [],
    "instructions": 142,
    "maximumLocalStackBytes": 5,
    "protectedStackBytes": 8,
    "returns": [
      "81:8CB8"
    ]
  },
  {
    "name": "camera-8a91",
    "entry": 8489617,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489617,
        "hex": "ADC40C4A4A4A4A4A851118ADC40C6DC80C10089CC80CA90000800BC9000890069CC80CA900088DC40CADC60C4A4A4A4A4A851718ADC60C6DCA0C10089CCA0CA90000800BC97C0490069CCA0CA97C048DC60C4A4A4A4A4AAECA0C1003E6171A85140A851AADC40C4A4A4A4A4AAEC80C1003E6111A850EEB4A851DA50EC511F05D291F00186900708DCC0C6900048DCE0CA50EEB4AAEC80C3003690010651AACCA0C30021A1AAA8BF47E7EABABA514C0000030011A291F000A8520A8BFA8467E99602DBFA8767E99A02DE8E8C8C8C04000D003A00000C420D0E2ABEED00CA514C517F064291F00EB4A4A4A6900708DD20C6900048DD40CA5140AAECA0C3003694000651DACC80C3003698000AA8BF47E7EABABA50EC0000030011A291F000A850EA8BFA8467E99E02CBFA8767E99202D8A18698000AAC8C8C04000D003A00000C40ED0DEABEED60C6B"
      }
    ],
    "externalReturns": [],
    "instructions": 164,
    "maximumLocalStackBytes": 3,
    "protectedStackBytes": 6,
    "returns": [
      "81:8BD8"
    ]
  },
  {
    "name": "main-8877",
    "entry": 8489079,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8489066,
        "hex": "E220A9E08D32219C3121C2206BADDC1F100829FC7F8DDC1F80E6D0016B890100F019E220A9E58D3221A9E38D3121C220A901001CDC1F8077"
      },
      {
        "start": 8489125,
        "hex": "890200F03AADDE1F1869400029FF018DDE1FAAE220BDD1D34A4A4AF00338E90109E08D3221A9238D3121C220ADDE1FC98001D006A902001CDC1F8038"
      },
      {
        "start": 8489188,
        "hex": "890400F030ADDE1F1869100029FF018DDE1FAAE220BDD1D34A4A4A4AF00338E90109208D3221A9C08D3221A9238D3121C220ADDC1F6B"
      }
    ],
    "externalReturns": [],
    "instructions": 77,
    "maximumLocalStackBytes": 0,
    "protectedStackBytes": 3,
    "returns": [
      "81:8876",
      "81:8886",
      "81:8919"
    ]
  },
  {
    "name": "main-8076",
    "entry": 8487030,
    "rootReturn": "RTL",
    "windows": [
      {
        "start": 8487030,
        "hex": "A20000BDBE1CF045187DC21C898000F032297F009DC21CBDC61C300EBDD61C1ADDD21CD00EA900008009BDD61CD003BDD21C3A9DD61C0A7DCE1C8DDA1C8A8DDC1C800A9DC21CE8E8E00400D0B66B"
      }
    ],
    "externalReturns": [],
    "instructions": 34,
    "maximumLocalStackBytes": 0,
    "protectedStackBytes": 3,
    "returns": [
      "81:80C3"
    ]
  },
  {
    "name": "main-ff14",
    "entry": 8453908,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8453908,
        "hex": "A20600BF16027E301BBD1E023A9D1E02D012BF16027E8500DA203EFAFAA9FFFF9F16027ECACA10DBAD0202F0313A8D02022060C5A500C93333B023A903008500201FC5A5000AAABD73FF8502A9FFFF8500A920008504A903008506206EC460"
      }
    ],
    "externalReturns": [
      [
        8452670,
        "RTS"
      ],
      [
        8439136,
        "RTS"
      ],
      [
        8439071,
        "RTS"
      ],
      [
        8438894,
        "RTS"
      ]
    ],
    "instructions": 41,
    "maximumLocalStackBytes": 2,
    "protectedStackBytes": 4,
    "returns": [
      "80:FF72"
    ]
  },
  {
    "name": "main-e270",
    "entry": 8446576,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8446576,
        "hex": "AD891D10034C0EE30D871DF0F8AD871DD055A9D40D8D871DA908008500A902008502A911008504A904008506A900008508A90400850AA9B400850C20C1FE85006402640420ACFAAD891D85023A8D891D2080FDAD891DF005A92F748003A9467485022069FE80373A8D871DAD891DD00FAD871DC9100EB007291F00D0218008AD871D293F00D017A9FFFF8500A9FF008504A907008506A926008502206EC460"
      }
    ],
    "externalReturns": [
      [
        8453825,
        "RTS"
      ],
      [
        8452780,
        "RTS"
      ],
      [
        8453504,
        "RTS"
      ],
      [
        8453737,
        "RTS"
      ],
      [
        8438894,
        "RTS"
      ]
    ],
    "instructions": 64,
    "maximumLocalStackBytes": 0,
    "protectedStackBytes": 2,
    "returns": [
      "80:E30E"
    ]
  },
  {
    "name": "main-bf3b",
    "entry": 8437563,
    "rootReturn": "RTS",
    "windows": [
      {
        "start": 8437563,
        "hex": "AD5D1D0D5F1DD005ADDA0110034CE7BFADCE01293080F0F59CA61FACDE01BE501330EA856BBDA20B1006BD7203AA80F5A56BC90080D011BDA20B290260F009BDA20B2982668DA61FAEC20C38BD280EF9280E100449FFFF1A856B38BD800EF9800E100449FFFF1A18656BC9A100B01238BDD80EF9D80E100449FFFF1AC98100902CADA61FD02AA9020085008502A90C008504A903008506A900008508640AA93C00850C20C1FE20B2BC201A9E609CA61FBE501330F7BDA20B1006BD7203AA80F529F267F0E7AAADCE01890080F00D8A5A20EB997A890200D00D8036892000F0258A298000802BDABBBF50447EFAC90000F00E5A84008502206C937AA900008011A90200800C8A291006C90006D003A90000BE5013309648BDA20B1006BD7203AA80F5681D620C9D620C20B2BC201A9E60"
      }
    ],
    "externalReturns": [
      [
        8453825,
        "RTS"
      ],
      [
        8436914,
        "RTS"
      ],
      [
        8429082,
        "RTS"
      ],
      [
        8428011,
        "RTS"
      ],
      [
        8426348,
        "RTS"
      ]
    ],
    "instructions": 132,
    "maximumLocalStackBytes": 2,
    "protectedStackBytes": 4,
    "returns": [
      "80:BFE7",
      "80:C06A"
    ]
  }
];
export function proveMainCameraSource(map,spec) {
 assertPinnedTaskSource(map,spec.windows);
 const p=proveWordStack(map,spec.entry,spec.rootReturn,{measureStack:true,externalReturns:new Map(spec.externalReturns)});
 if(map.size!==spec.instructions||p.reachable_instructions!==map.size||p.maximum_local_stack_bytes!==spec.maximumLocalStackBytes||p.minimum_protected_stack_bytes!==spec.protectedStackBytes||p.external_return_assumptions!==spec.externalReturns.length||JSON.stringify(p.returns.map(r=>r.at).sort())!==JSON.stringify(spec.returns)||p.returns.some(r=>r.m!==0||r.x!==0||r.dbr!=='entry'))throw Error(spec.name+' source drift');
 return p;
}
