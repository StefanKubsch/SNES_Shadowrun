// Matrix edits follow the original ring slots, not a second content queue.
import { VmFault } from '../../src/vm/memory.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_BITS, WORD_MASK } from '../../src/constants/bits.mjs';
import { MATRIX_COUNT_TEXT } from '../../src/data/matrix-text-edits.mjs';
import {
  MATRIX_TEXT_QUEUE_END,
  MATRIX_IC_TEXT_BUFFER,
  MATRIX_IC_TEXT_COUNT,
  MATRIX_IC_TEXT_END,
} from '../../src/task/wram.mjs';

const QUEUE_ENTRY_BYTES = 4,
  QUEUE_ENTRIES = 8,
  DP_TEXT = 0x34,
  FIRST_COUNT = 0x31,
  LAST_COUNT = 0x38;

function slotOf(index) {
  const slot = index / QUEUE_ENTRY_BYTES;
  if (!Number.isInteger(slot) || slot < 0 || slot >= QUEUE_ENTRIES)
    throw new VmFault('matrix_edit_queue_required');
  return slot;
}

export function captureMatrixText(h) {
  const memory = h.a.mem;
  if (!memory.matrixTextEdits && !memory.matrixTextState) return;
  const pointer = h.ctx.x | ((h.ctx.y & BYTE_MASK) << WORD_BITS);
  const edit = memory.matrixTextEdits?.get(
    pointer === MATRIX_IC_TEXT_BUFFER ? MATRIX_COUNT_TEXT : pointer,
  );
  const slot = slotOf(memory.read16(h.abs(MATRIX_TEXT_QUEUE_END)));
  if (!memory.matrixTextState && !edit) return;
  let stream = null;
  if (edit) {
    let bytes = edit.bytes;
    if (edit.countIndex !== -1) {
      const digit = memory.read8(MATRIX_IC_TEXT_COUNT);
      if (digit < FIRST_COUNT || digit > LAST_COUNT)
        throw new VmFault('matrix_edit_count_required');
      bytes = bytes.slice();
      bytes[edit.countIndex] = digit;
    }
    stream = {
      bytes,
      position: 0,
      originalEnd: pointer === MATRIX_IC_TEXT_BUFFER ? MATRIX_IC_TEXT_END : edit.originalEnd,
    };
  }
  memory.matrixTextState ??= { slots: Array(QUEUE_ENTRIES).fill(null), active: null };
  // An unedited overwrite must also discard the previous edited slot.
  memory.matrixTextState.slots[slot] = stream;
}

export function beginMatrixText(memory, index) {
  const state = memory.matrixTextState;
  if (!state) return;
  const slot = slotOf(index);
  state.active = state.slots[slot];
  state.slots[slot] = null;
}

export function readMatrixText(h) {
  const active = h.a.mem.matrixTextState?.active;
  if (!active) return h.read(h.indirect(DP_TEXT));
  if (active.position >= active.bytes.length - 1) throw new VmFault('matrix_edit_stream_required');
  return active.bytes[active.position] | (active.bytes[active.position + 1] << BYTE_BITS);
}

export function advanceMatrixText(h) {
  const active = h.a.mem.matrixTextState?.active;
  if (active) active.position++;
  else h.modify(DP_TEXT, 'inc', true);
}

export function resetMatrixText(memory) {
  memory.matrixTextState = null;
}

export function finishMatrixText(h) {
  const state = h.a.mem.matrixTextState;
  if (!state?.active) return;
  // Park the original pointer at its known terminator. Idle calls and a
  // later B2A0 reset must not replay the original start of the edited text.
  h.dpWrite(DP_TEXT, state.active.originalEnd & WORD_MASK, 2);
  state.active = null;
}
