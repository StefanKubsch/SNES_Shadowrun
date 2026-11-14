export const releaseLeafSpec={name:'native-a8f5',id:0xB9,entry:0x80A8F5,maximumLocalStackBytes:2,peiWordPushes:[],
 windows:[{start:0x80A8F5,hex:'204CAAA600A9FFFF9F283F7EAEB014CEB014CEB014BDB214C500F00BCACABCB2149DB2149880F160'},
 {start:0x80AA4C,hex:'A600A900009F40427E9F98427E9FF0427E9F48437E9FA0437E9FE0407E9D40119F803F7E9D9010A9FFFF9D3810A980009F30407EA901009FD83F7EBDA012F0228517186D1C0D8D1C0DBCF812B964159DF812AD1E0D8C1E0D996415C617D0EA9EA01260'}],
 anchors:[{kind:'pointer',start:0x82D92A,hex:'F5A8'},{kind:'argument-metadata',start:0x82DB05,hex:'0103'},
 {kind:'return-metadata',start:0x82DA29,hex:'0000'}],
 contract:'Original B9 A8F5 and AA4C. Real inner A8F7 JSR/RTS under two local bytes. Fresh linked release count DP17, moduloWORD DEC, binary CLC/ADC; fresh list/pointer/index aliases. Tail14B0 decremented twice from fresh memory, loaded X retained; unguarded removal shifts full indices until actual fresh DP00 matches. No capacity, termination, ownership or initialization inferred; atomic budgets remain mandatory.'};
