import { actorContent, actorDetails, kindDetails } from '../content/actors.mjs';
import { actorRecordState } from '../state/actor-records.mjs';
import { memberMenuState } from '../state/member-menu.mjs';
// Inventory by story stage, item class and holder; item use creates its actor object
// and visits its script before notices, equipment and portrait cleanup.
import { releaseNoticeWindowsSequence, releaseWindowAt } from './window-release.mjs';
import { openWindowAt, clearWindowText } from './window-open.mjs';
import { chooseFromList } from './menu-choice.mjs';
import { waitForConfirmKey } from './confirm-key.mjs';
import { equipmentRows } from './equipment-window.mjs';
import { memberPortrait } from './member-portrait.mjs';
import { resetWindowList } from './window-list.mjs';
import { drawTextBuffer } from './text-draw.mjs';
import { scriptVisitSequence } from '../system/script-visit.mjs';
import { createActorItem } from './object-create.mjs';
import { itemCountColumns, ITEM_WINDOW } from '../system/native-status-screen.mjs';
import { ACTOR_STAGE_FLAGS } from '../data/actors.mjs';
import { KIND_ITEM_CLASS_MASK } from '../data/kinds.mjs';
import { TEXT_EXIT } from '../data/port-extension.mjs';
import { translatedListWindow } from '../data/menu-layout.mjs';
import { WORD_MASK, WORD_SIGN } from '../constants/bits.mjs';
import { objectWord, setObjectWord } from '../state/objects.mjs';

// The entries and their item classes.
export const ITEM_ENTRIES = Object.freeze({ 0x80e572: 0, 0x80e577: 1, 0x80e57f: 2 });
// The list starts after Exit; a count of one is shown as none; the menu's first column.
const POSITION_SHIFT = 2;

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

// Show the requested item class and reuse its window between item scripts.
export function* itemMenu(h, events, entry, renderBuffer = drawTextBuffer) {
  const { mem } = h.a,
    state = memberMenuState(mem);
  yield () => {
    state.itemClass = ITEM_ENTRIES[entry];
    state.submenuWindow = WORD_MASK;
  };
  for (;;) {
    let count;
    yield () => {
      count = buildInventoryRows(mem);
    };
    if (!state.itemsAtOnce && count === 1) return;
    yield () => {
      state.inventoryRow(count).text = 0;
    };
    if (state.submenuWindow & WORD_SIGN) {
      const rows = Array.from({ length: count }, (_, index) => state.inventoryRow(index)),
        shape = mem.language
          ? translatedListWindow(
              mem,
              ITEM_WINDOW,
              rows.map((row) => row.text),
              { valueColumns: itemCountColumns(rows.map((row) => row.count)) },
            )
          : ITEM_WINDOW;
      state.submenuWindow = yield* openWindowAt(h, events, [
        shape.left,
        shape.top,
        shape.columns,
        shape.rows,
      ]);
    }
    const rows = Array.from({ length: count }, (_, index) => state.inventoryRow(index)),
      chosen = yield* chooseFromList(h, events, renderBuffer, {
        window: state.submenuWindow,
        column: 1,
        row: 0,
        visibleRows: ITEM_WINDOW.visibleRows,
        items: rows.map((row) => row.text),
        values: rows.map((row) => row.count),
        storage: 'member',
      });
    if (chosen === WORD_MASK) {
      yield () => {
        state.endWord = chosen;
      };
      break;
    }
    const index = (chosen << 1) & WORD_MASK;
    if (!index) break;
    yield* useItem(h, events, renderBuffer, state.inventoryRow(index / 2).actor);
    if (state.endWord) break;
    yield* clearWindowText(h, events, state.submenuWindow);
  }
  yield* releaseWindowAt(h, events, state.submenuWindow);
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
