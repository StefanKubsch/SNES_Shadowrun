import {taskFixture} from './task-native-fixtures.mjs';

export function taskControlFixture(entry, patch = {}) {
  const f = taskFixture(entry, patch);
  const {data, context: c} = f;
  const seedWord = (address, value) => {data.seed(address, [value & 255]); data.seed((address + 1) & 0xFFFFFF, [value >>> 8]);};
  const stream = (c.bank * 65536 + (patch.pointer ?? 0x1200) + c.y) & 0xFFFFFF;
  if ([0x80F8D4, 0x80F8E4, 0x80F8F1, 0x80F902, 0x80F90F].includes(entry)) {
    seedWord(stream, 0x400); data.seed(0x7E0400, [0x80, 0xAB]);
  }
  if ([0x80F420, 0x80F42E, 0x80F43C, 0x80F442].includes(entry)) {
    seedWord(stream, 0x20); seedWord(c.bank * 65536 + (patch.pointer ?? 0x1200) + 0x20, 0xA514);
  }
  if (entry === 0x80F442) seedWord((c.d + 5) & 65535, 0x500);
  if (entry === 0x80F454) {
    seedWord((c.d + 5) & 65535, 0x4FE); seedWord(c.bank * 65536 + 0x500, 0x20);
    seedWord(c.bank * 65536 + (patch.pointer ?? 0x1200) + 0x20, 0xA514);
  }
  return f;
}
