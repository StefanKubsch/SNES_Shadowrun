// Independent matrix work fields and decker state. Object-backed prefixes and
// scene-backed fonts, maps, text rows and gauges retain their existing owners.
// Speed/position tails split at those owners; draw-list and NMI/VRAM queues
// overlay these same fields in ordinary rooms. No duplicated matrix byte store.
import * as W from '../data/wram.mjs';
import { BYTE_BITS, BYTE_MASK } from '../constants/bits.mjs';
const field = (base, count = 1, bytes = 2, stride = bytes) =>
  Object.freeze({ base, count, bytes, stride });
export const MATRIX_FIELDS = Object.freeze({
  textBusy: field(W.MATRIX_TEXT_BUSY),
  textQueueEnd: field(W.MATRIX_TEXT_QUEUE_END),
  textQueueStart: field(W.MATRIX_TEXT_QUEUE_START),
  scrollX: field(W.MATRIX_SCROLL_X),
  scrollY: field(W.MATRIX_SCROLL_Y),
  farScrollX: field(W.MATRIX_FAR_SCROLL_X),
  farScrollY: field(W.MATRIX_FAR_SCROLL_Y),
  mapEdit: field(W.MATRIX_MAP_EDIT),
  state: field(W.MATRIX_STATE),
  clock: field(W.MATRIX_STATE_CLOCK),
  frames: field(W.MATRIX_STATE_FRAMES),
  foughtIc: field(W.MATRIX_FOUGHT_IC),
  icCounted: field(W.MATRIX_IC_COUNTED),
  dmaEnd: field(W.MATRIX_DMA_END),
  dmaRecords: field(W.MATRIX_DMA_RECORDS),
  memoryLimit: field(W.MATRIX_MEMORY_LIMIT),
  memoryShown: field(W.MATRIX_MEMORY_SHOWN),
  memory: field(W.MATRIX_MEMORY),
  deathCounter: field(W.MATRIX_DEATH_COUNTER),
  health: field(W.MATRIX_HEALTH),
  cpuBits: field(W.MATRIX_CPU_BITS),
  dataBits: field(W.MATRIX_DATA_BITS),
  downloadBits: field(W.MATRIX_DOWNLOAD_BITS),
  mapOffset: field(W.MATRIX_MAP),
  blink: field(W.MATRIX_BLINK),
  deckerRecord: field(W.DECKER_RECORD),
  speedXTail: field(W.DRAW_LIST_INDEX, (W.MATRIX_SPEED_Y - W.DRAW_LIST_INDEX) / 2),
  speedYHead: field(W.MATRIX_SPEED_Y, (W.OBJECT_NUMBER - W.MATRIX_SPEED_Y) / 2),
  personaXTail: field(W.NMI_JOB_LISTS, (W.MATRIX_PERSONA_Y - W.NMI_JOB_LISTS) / 2),
  personaY: field(W.MATRIX_PERSONA_Y, W.MATRIX_OBJECT_END / 2),
  animation: field(W.MATRIX_ANIMATION, W.MATRIX_OBJECT_END / 2),
  animationStep: field(W.MATRIX_ANIMATION_STEP, W.MATRIX_OBJECT_END / 2),
  animationClock: field(W.MATRIX_ANIMATION_CLOCK, W.MATRIX_OBJECT_END / 2),
  animationSpeed: field(W.MATRIX_ANIMATION_SPEED, W.MATRIX_OBJECT_END / 2),
  uploadBanksTail: field(W.MATRIX_BLINK + 2, (W.VRAM_UPLOAD_SOURCES - W.MATRIX_BLINK - 2) / 2),
  uploadSourcesHead: field(
    W.VRAM_UPLOAD_SOURCES,
    (W.MATRIX_NODE_COLUMNS - W.VRAM_UPLOAD_SOURCES) / 2,
  ),
  nodeColumns: field(W.MATRIX_NODE_COLUMNS, (W.MATRIX_NODE_ROWS - W.MATRIX_NODE_COLUMNS) / 2),
  nodeRows: field(W.MATRIX_NODE_ROWS, (W.MATRIX_TEXT_BUSY - W.MATRIX_NODE_ROWS) / 2),
  textQueueAddresses: field(W.MATRIX_TEXT_QUEUE, 8, 2, 4),
  textQueueBanks: field(W.MATRIX_TEXT_QUEUE_BANK, 8, 2, 4),
  uploadAddressesTail: field(
    W.MATRIX_MAP + 2,
    (W.PALETTE_UPLOAD_LIST_BYTES - W.MATRIX_MAP - 2) / 2,
  ),
  deckerHealth: field(W.DECKER_HEALTH, 1, 1),
  computerSkill: field(W.DECKER_COMPUTER_SKILL, 1, 1),
  deckerMemory: field(W.DECKER_MEMORY, 1, 1),
  extraNodes: field(W.MATRIX_EXTRA_NODES, 1, 1),
  system: field(W.MATRIX_SYSTEM, 1, 1),
  messages: field(W.MATRIX_MESSAGES, 1, 1),
  deckerDownloads: field(W.DECKER_DOWNLOAD_BITS, 1, 1),
  deckerData: field(W.DECKER_DATA_BITS, 1, 1),
});
const tables = new WeakMap(),
  byteFields = [];
for (const [name, { base, count, bytes, stride }] of Object.entries(MATRIX_FIELDS))
  for (let index = 0; index < count; index++)
    for (let byte = 0; byte < bytes; byte++)
      byteFields[base + index * stride + byte] = { name, index, shift: byte * BYTE_BITS };
export const matrixState = (wram) => tables.get(wram);
export function detachMatrix(wram) {
  let table = tables.get(wram);
  if (!table) {
    table = {};
    for (const [name, { base, count, bytes, stride }] of Object.entries(MATRIX_FIELDS)) {
      const values = bytes === 1 ? new Uint8Array(count) : new Uint16Array(count);
      for (let i = 0; i < count; i++)
        values[i] =
          wram[base + i * stride] | (bytes === 2 ? wram[base + i * stride + 1] << BYTE_BITS : 0);
      table[name] = values;
    }
    tables.set(wram, table);
  }
  return table;
}
export function matrixByte(wram, at) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  return f ? (table[f.name][f.index] >>> f.shift) & BYTE_MASK : undefined;
}
export function setMatrixByte(wram, at, value) {
  const table = tables.get(wram),
    f = table && byteFields[at];
  if (!f) return false;
  const values = table[f.name],
    mask = BYTE_MASK << f.shift;
  values[f.index] = (values[f.index] & ~mask) | ((value & BYTE_MASK) << f.shift);
  return true;
}
