import {nativeD15CSpec} from './task-native-d15c-spec.mjs';
export const selectionNativeSpec={name:'native-a985',id:0xD1,entry:0x80A985,
 windows:nativeD15CSpec.windows.filter(w=>w.start===0x80A985),
 anchors:[{kind:'pointer',start:0x82D95A,hex:'85A9'},{kind:'argument-metadata',start:0x82DB1D,hex:'0203'},{kind:'return-metadata',start:0x82DA41,hex:'0000'}],
 contract:'Original NativeD1 whole A985 source as separately owned RTS root, no D15C PEI/argument restore or action substituted. Fresh full slot/definition/selection and original table/indirect WORDs before low masks. Retain actual ASL carry and chained ADC carry. Signed field expansion and all real bank00 scratch bytes remain visible, including replacement of DP00 by record pointer. Atomic budgets and original return owners, no initialized scene/slot inferred.'};
