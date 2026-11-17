// Register-level leaf helpers (object record field, actor state and kind, kind
// value) that only the leaf references and comparisons use; the shared leaf
// frame helpers stay in src/system/native-leaf-support.mjs.
import { FIRST_ARGUMENT } from '../../src/system/native-leaf-support.mjs';
import { KIND_VALUE_OFFSET, KIND_TABLE } from '../../src/data/kinds.mjs';
import { ACTOR_TABLE, ACTOR_RECORD, ACTOR_KIND } from '../../src/data/actors.mjs';
import { BYTE_MASK, BANK_WRAP } from '../../src/constants/bits.mjs';
import { OBJECT_RECORD, WRAM } from '../../src/data/wram.mjs';

// Record of the object in the first argument: LDY DP00, LDX OBJECT_RECORD,Y (long,
// at DBR). Returns the record's WRAM offset (0: none), which stays in X.
export function indexObjectRecord(h) {
  const object = h.index('y', h.dp(FIRST_ARGUMENT));
  return h.index('x', h.longRead(h.abs(OBJECT_RECORD) + object));
}
export function readRecordField(h, offset, width = 2) {
  const record = indexObjectRecord(h);
  h.load(h.longRead(WRAM + offset + record));
  if (width === 1) h.load(h.ctx.a & BYTE_MASK);
  h.a.writeWord(0, h.ctx.a, BANK_WRAP, 'leaf-result-DP00');
}
// Actor table entry (src/data/actors.mjs) at the offset `actor`: the WRAM address of
// its state record (flags, count and property; 0 for none), loaded into A.
export const readActorState = (h, actor) => h.load(h.longRead(ACTOR_TABLE + ACTOR_RECORD + actor));
// Kind of the actor entry at the offset `actor`, loaded into A.
export const readActorKind = (h, actor) => h.load(h.longRead(ACTOR_TABLE + ACTOR_KIND + actor));
// Word `field` (default: the value) of the kind in A (kind table, src/data/kinds.mjs),
// returned in DP00: 6 * kind by ASL, STA DP00, ASL, ADC DP00 (no CLC; the carry of the
// second ASL is zero for every kind). The two DP00 stores keep their original trace labels.
export function returnKindValue(h, scaledLabel, resultLabel, field = KIND_VALUE_OFFSET) {
  h.asl();
  h.a.writeWord(FIRST_ARGUMENT, h.ctx.a, BANK_WRAP, scaledLabel);
  h.asl();
  h.arithmetic(h.dp(FIRST_ARGUMENT));
  const entry = h.index('x', h.ctx.a);
  h.result(h.load(h.longRead(KIND_TABLE + field + entry)), resultLabel);
}
