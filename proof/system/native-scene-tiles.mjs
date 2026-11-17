// Register-level object tile reload 80:ADF4 that only the dialog references and
// comparisons call; the game reloads object tiles through src/game/object-tiles.mjs.
import { waitWord, nmiWords } from '../../src/system/native-dialog-portrait.mjs';
import { observeRandomStateWait } from './native-dialog-portrait.mjs';
import { FLAG_NEGATIVE, FLAG_ZERO, FLAG_CARRY } from '../../src/constants/cpu-flags.mjs';
import {
  DRAW_LIST_INDEX,
  DRAW_LIST,
  NMI_JOB_LISTS,
  DP_VRAM_UPLOAD_INDEX,
  OBJECT_PICTURE_CHANGE,
  OBJECT_ACTION_DIRECTIONS,
  OBJECT_FRAME_OFFSET,
  OBJECT_VRAM_SLOT_COUNT,
  OBJECT_VRAM_SLOT_HEAD,
} from '../../src/data/wram.mjs';
import {
  FRAME_BANK,
  stepObjectAnimation,
  DP_STREAM,
  PICTURE_BANK,
  PICTURE_HIGH_BANK,
  VRAM_UPLOAD_INDEX_LIMIT,
  queueTiles,
  SLOT_VRAM_FIRST,
  SLOT_VRAM_SECOND,
} from '../../src/system/native-scene-tiles.mjs';

// Direct page bank byte of the picture stream.
const DP_STREAM_BANK = 0x40;
// Direct page words of AE12: the picture pointer, its bank and the tile count.
const DP_RELOAD_POINTER = 0x41,
  DP_RELOAD_BANK = 0x43,
  DP_RELOAD_COUNT = 0x44;
// 81:A954 as JSL: count the open NMI job lists up.
const incrementJobLists = (h, pc) =>
  h.call(
    pc,
    0x81a954,
    () => {
      h.modify(h.abs(NMI_JOB_LISTS), 'inc');
      return h.rtl();
    },
    true,
  );

// 80:ADF4: request the tiles of all objects of the draw list $14B2 again, then wait for the NMI.
export function reloadObjectTiles(h, events) {
  const { ctx } = h;
  h.load(FRAME_BANK);
  h.dpWrite(DP_STREAM_BANK, ctx.a);
  h.index('y', h.read(h.abs(DRAW_LIST_INDEX)));
  do {
    h.index('x', h.read(h.abs(DRAW_LIST) + ctx.y));
    h.phy();
    h.call(0x80ae00, 0x80ae12, () => runObjectTilesReload(h, events));
    h.ply();
    h.index('y', ctx.y - 1);
    h.index('y', ctx.y - 1);
  } while (!(ctx.status & FLAG_NEGATIVE));
  incrementJobLists(h, 0x80ae08);
  waitWord(h, events, 0x80ae0c, NMI_JOB_LISTS, (v) => v === 0, [DP_VRAM_UPLOAD_INDEX]);
  return h.rts();
}

// 80:AE12: request the tiles of object X again. If a picture change is running ($1140+X), it continues every
// frame via AC2F (1562 += 1, B0A1); otherwise the current picture is loaded again from the animation stream.
export function runObjectTilesReload(h, events) {
  const { ctx } = h;
  h.load(h.read(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x));
  if (!(ctx.status & FLAG_ZERO)) {
    for (;;) {
      h.call(0x80ae17, 0x80ac2f, () => stepObjectAnimation(h, events));
      h.load(h.read(h.abs(OBJECT_PICTURE_CHANGE) + ctx.x));
      if (ctx.status & FLAG_ZERO) return h.rts();
      // One frame later the NMI has processed the job list (DP82, $1562 observed).
      incrementJobLists(h, 0x80ae1f);
      observeRandomStateWait(h, events, 0x80ae23);
      nmiWords(h, events, 0x80ae23, [DP_VRAM_UPLOAD_INDEX, NMI_JOB_LISTS]);
    }
  }
  h.load(h.read(h.abs(OBJECT_ACTION_DIRECTIONS) + ctx.x));
  h.dpWrite(DP_STREAM, ctx.a);
  h.index('y', h.read(h.abs(OBJECT_FRAME_OFFSET) + ctx.x));
  h.index('y', ctx.y - 1);
  h.index('y', ctx.y - 1);
  h.load(h.read(h.indirect(DP_STREAM, ctx.y)));
  h.load(ctx.a + 1);
  h.dpWrite(DP_RELOAD_POINTER, ctx.a);
  h.load(PICTURE_BANK);
  h.dpWrite(DP_RELOAD_BANK, ctx.a);
  h.load(PICTURE_HIGH_BANK);
  h.testBits(DP_RELOAD_POINTER, true, true);
  if (!(ctx.status & FLAG_ZERO)) h.modify(DP_RELOAD_BANK, 'inc', true);
  h.load(h.read(h.abs(OBJECT_VRAM_SLOT_COUNT) + ctx.x));
  if (ctx.status & FLAG_ZERO) return h.rts();
  h.dpWrite(DP_RELOAD_COUNT, ctx.a);
  h.asl();
  h.asl();
  ctx.status &= ~FLAG_CARRY;
  h.adc(h.dp(DP_VRAM_UPLOAD_INDEX));
  if (!(ctx.status & FLAG_CARRY)) {
    h.cmp(VRAM_UPLOAD_INDEX_LIMIT);
    if (ctx.status & FLAG_CARRY) {
      incrementJobLists(h, 0x80ae5a);
      waitWord(h, events, 0x80ae5e, NMI_JOB_LISTS, (v) => v === 0, [DP_VRAM_UPLOAD_INDEX]);
    }
  }
  h.index('y', h.dp(DP_VRAM_UPLOAD_INDEX));
  h.load(h.read(h.abs(OBJECT_VRAM_SLOT_HEAD) + ctx.x));
  h.index('x', ctx.a);
  queueTiles(h, DP_RELOAD_POINTER, DP_RELOAD_COUNT, SLOT_VRAM_FIRST, SLOT_VRAM_SECOND);
  h.dpWrite(DP_VRAM_UPLOAD_INDEX, ctx.y);
  return h.rts();
}
