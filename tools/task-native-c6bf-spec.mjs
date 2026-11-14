export const nativeC6BFSpec={name:'native-c6bf',id:0x81,entry:0x80C6BF,
 windows:[{start:0x80C6BF,hex:'A900008003'},
  {start:0x80C6C7,hex:'A6009F38417EA5020A0A0A38E502E502A8C8B7F30A0A9F90417EC8C8B7F30A0A9FE8417EA901009FE0407E60'}],
 anchors:[{kind:'pointer',start:0x82D8BA,hex:'BFC6'},{kind:'argument-metadata',start:0x82DACD,hex:'0200'},
  {kind:'return-metadata',start:0x82D9F1,hex:'0000'}],
 contract:'Whole original Native81/C6BF zero-load/BRA and shared C6C7..C6F2, 49 reachable code bytes/26 instructions. Skipped C6C4 LDA1 belongs to independently proved Native1D, not this root. Full DP00/X and zero WORDstore7E4138+X; fresh DP02 triple-ASL/SEC/two carry-dependent WORD-SBCs, retaining first borrow and full index wrap. INY, each fresh DP:F3/F5 long pointer and full indexed WORD read, two ASLs and stores7E4190/41E8+X; final1 to7E40E0+X. Full24bit addressing, actual N/Z/C/V, protected RTS and atomic physical/source/output/work budgets; binary SBC required. Own Native58 original0002 argument means two WORDpops and0000 return no PHA. No coordinate/motion/caller/initialization/Task/scene/frame inference.'};
