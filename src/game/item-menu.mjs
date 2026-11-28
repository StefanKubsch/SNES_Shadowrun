import { actorContent, actorDetails, kindDetails } from '../content/actors.mjs';
import { actorRecordState } from '../state/actor-records.mjs';
import { memberMenuState } from '../state/member-menu.mjs';
import { readStateByte, writeStateByte } from '../state/objects.mjs';
// Inventory by story stage, item class and holder; item use creates its actor object
// and visits its script before notices, equipment and portrait cleanup.
import { releaseNoticeWindowsSequence, releaseWindowSequence } from './window-release.mjs';
import { openWindow, requestTileClear } from './window-open.mjs';
import { chooseFromMenu, MENU_WITH_NUMBERS } from './menu-choice.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { equipmentRows } from './equipment-window.mjs';
import { memberPortrait } from './member-portrait.mjs';
import { resetWindowList } from './window-list.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { dataBankWord, setDataBankWord } from '../system/data-bank.mjs';
import { scriptVisitSequence } from '../system/script-visit.mjs';
import { createActorItem } from './object-create.mjs';
import { itemCountColumns, ITEM_WINDOW } from '../system/native-status-screen.mjs';
import {
  DP_LIST_TOKEN_BANK,
  DP_LIST_TOKENS,
  DP_LIST_VALUES,
  DP_MENU_COLUMN,
  DP_MENU_ROW,
  DP_MENU_VISIBLE_ROWS,
  DP_WINDOW_ATTRIBUTES,
  DP_WINDOW_COLUMNS,
  DP_WINDOW_LEFT,
  DP_WINDOW_ROWS,
  DP_WINDOW_TOP,
  ITEM_MENU_ACTORS,
  ITEM_MENU_COUNTS,
  MEMBER_MENU_NAMES,
} from '../data/wram.mjs';
import { ACTOR_STAGE_FLAGS } from '../data/actors.mjs';
import { KIND_ITEM_CLASS_MASK } from '../data/kinds.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { BYTE_BITS, BYTE_MASK, WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { WRAM_BANK } from '../constants/memory-map.mjs';
import { objectWord, setObjectWord } from '../state/objects.mjs';

// The entries and their item classes.
export const ITEM_ENTRIES = Object.freeze({ 0x80e572: 0, 0x80e577: 1, 0x80e57f: 2 });
// The list starts after Exit; a count of one is shown as none; the menu's first column.
const FIRST_ITEM = 2,
  MENU_COLUMN = 1,
  CANCELLED = WORD_MASK,
  POSITION_SHIFT = 2;

const word = (wram, at) => readStateByte(wram, at) | (readStateByte(wram, at + 1) << BYTE_BITS);
const setWord = (wram, at, value) => {
  writeStateByte(wram, at, value & BYTE_MASK);
  writeStateByte(wram, at + 1, (value >>> BYTE_BITS) & BYTE_MASK);
};
const negative = (value) => (value & WORD_SIGN) !== 0;
// Re-read class and member for each actor: an overflowing list can alias them.
export function buildInventoryRows(mem) {
  const state = memberMenuState(mem),
    actors = actorContent(mem).actors;
  state.inventoryRow(0).text = TEXT_EXIT;
  state.inventoryRow(0).count = 0;
  let rows = 1;
  for (let index = actors.length - 1; index >= 0; index--) {
    const actor = actors[index];
    if (!(actor.flags & state.storyStage & ACTOR_STAGE_FLAGS) || !actor.record) continue;
    const kind = kindDetails(mem, actor.kind);
    if ((kind.flags & KIND_ITEM_CLASS_MASK) !== state.itemClass) continue;
    const record = actorRecordState(mem, actor.record);
    if (record.holder !== state.number) continue;
    const row = state.inventoryRow(rows++);
    row.text = kind.name;
    row.actor = actor.number;
    row.count = record.count === 1 ? 0 : record.count;
  }
  return rows;
}

// 80:E572, 80:E577 or 80:E57F: the item submenu (see above), for lifted callers without
// the JSR frame; the menu choice and the confirm key keep their own.
export function* itemMenu(h, events, entry, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    { wram } = mem;
  yield () => {
    memberMenuState(mem).itemClass = ITEM_ENTRIES[entry];
    memberMenuState(mem).submenuWindow = WORD_MASK;
  };
  for (;;) {
    let empty, open;
    yield () => {
      const offset = buildInventoryRows(mem) * 2;
      if (!memberMenuState(mem).itemsAtOnce) {
        empty = offset === FIRST_ITEM;
        if (empty) return;
      }
      setDataBankWord(mem, MEMBER_MENU_NAMES, offset, 0);
      open = negative(memberMenuState(mem).submenuWindow);
      if (!open) return;
      let window = ITEM_WINDOW;
      if (mem.language) {
        const ids = [],
          counts = [];
        for (let at = 0; at < offset; at += 2) {
          ids.push(dataBankWord(mem, MEMBER_MENU_NAMES, at));
          counts.push(dataBankWord(mem, ITEM_MENU_COUNTS, at));
        }
        window = translatedListWindow(mem, ITEM_WINDOW, ids, {
          valueColumns: itemCountColumns(counts),
        });
      }
      setWord(wram, DP_WINDOW_LEFT, window.left);
      setWord(wram, DP_WINDOW_TOP, window.top);
      setWord(wram, DP_WINDOW_COLUMNS, window.columns);
      setWord(wram, DP_WINDOW_ROWS, window.rows);
      setWord(wram, DP_WINDOW_ATTRIBUTES, 0);
    };
    if (empty) return;
    if (open) {
      yield* openWindow(h, events);
      yield () => (memberMenuState(mem).submenuWindow = word(wram, 0));
    }
    yield () => {
      setWord(wram, DP_MENU_COLUMN, MENU_COLUMN);
      setWord(wram, DP_MENU_ROW, 0);
      setWord(wram, DP_MENU_VISIBLE_ROWS, ITEM_WINDOW.visibleRows);
      setWord(wram, DP_LIST_TOKENS, MEMBER_MENU_NAMES);
      setWord(wram, DP_LIST_TOKEN_BANK, WRAM_BANK);
      setWord(wram, DP_LIST_VALUES, ITEM_MENU_COUNTS);
    };
    yield* chooseFromMenu(h, events, renderBuffer, MENU_WITH_NUMBERS);
    let actor = null;
    yield () => {
      const row = word(wram, 0);
      if (row === CANCELLED) {
        memberMenuState(mem).endWord = row;
        return;
      }
      const index = (row << 1) & WORD_MASK;
      if (index) actor = dataBankWord(mem, ITEM_MENU_ACTORS, index);
    };
    if (actor === null) break;
    yield* useItem(h, events, renderBuffer, actor);
    let ended;
    yield () => {
      ended = memberMenuState(mem).endWord !== 0;
      if (!ended) setWord(wram, 0, memberMenuState(mem).submenuWindow);
    };
    if (ended) break;
    yield* requestTileClear(h, events);
  }
  yield () => setWord(wram, 0, memberMenuState(mem).submenuWindow);
  yield* releaseWindowSequence(h, events);
}

// 80:E4F3: use the item of the actor (X in the original; see above), without the JSR
// frame; the object creation 80:A835 runs without one as well, the script visit keeps
// its frame.
export function* useItem(h, events, renderBuffer, actor) {
  const { mem } = h.a;
  let actorRecord, slot;
  yield () => {
    const member = memberMenuState(mem).object,
      details = actorDetails(mem, actor);
    actorRecord = details;
    slot = createActorItem(mem, h.a, details, {
      x: objectWord(mem, 'x', member) >>> POSITION_SHIFT,
      y: objectWord(mem, 'y', member) >>> POSITION_SHIFT,
      height: objectWord(mem, 'height', member) >>> POSITION_SHIFT,
    });
  };
  yield () => {
    setObjectWord(mem, 'number', slot, actor);
    setObjectWord(
      mem,
      'depthOrder',
      slot,
      ((actorRecord.flags & 0x40) << 9) | ((actorRecord.flags & 0x80) >>> 7),
    );
    setObjectWord(mem, 'record', slot, actorRecord.record);
    memberMenuState(mem).redrawPortrait = 0;
  };
  yield* scriptVisitSequence(events);
  let ended, redraw;
  yield () => {
    ended = memberMenuState(mem).endWord !== 0;
    if (!ended) redraw = memberMenuState(mem).redrawPortrait;
  };
  if (ended) return;
  if (redraw) {
    yield* resetWindowList(h, events);
    yield* memberPortrait(h, events);
  }
  const pending = memberMenuState(mem).hasNotices;
  if (pending) {
    yield* waitForConfirmKey(h, events);
    yield* releaseNoticeWindowsSequence(h, events);
  }
  yield* equipmentRows(h, events, renderBuffer);
}
