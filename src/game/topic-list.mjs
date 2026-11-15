// The topic list scripts ask about, mark and extend (lifted from the script natives
// 80:9159, 80:913C and 80:90EB; register-level references in
// proof/game-reference/topic-list.mjs).
//
// The known topics are bytes in ascending order at 7E:3CA3, ended by FF, each with a flag
// byte at the same index from 7E:3CD6 (FF: marked). The list index is a 16-bit word, so a
// list without FF reaches bank 7F; a scan of such a list stops the task after 65536
// entries (the original would run on forever). Adding a topic inserts it with flag 0 before the first
// greater one, shifting the rest (its FF included) up by one; the shifted flag is carried
// in the direct page bytes 23 and 24, which keep their last values as in the original.
import { taskStop } from '../system/task-stop.mjs';
import {
  DP_TOPIC_NEXT_FLAGS,
  DP_TOPIC_SHIFT_FLAGS,
  TOPIC_FLAGS,
  TOPIC_LIST,
  TOPIC_LIST_END,
  TOPIC_MARKED,
  WRAM,
} from '../data/wram.mjs';
import { BANK_SIZE, LONG_MASK, WORD_MASK } from '../constants/bits.mjs';

const TRUE = WORD_MASK,
  SCAN_LIMIT = BANK_SIZE;

const listAddress = (entry) => (WRAM + TOPIC_LIST + entry) & LONG_MASK;
const flagAddress = (entry) => (WRAM + TOPIC_FLAGS + entry) & LONG_MASK;

// The index of topic in the list, or -1 when FF comes first. A list with neither in all
// 65536 entries would keep the original scanning forever; it stops the task instead.
function findTopic(mem, topic) {
  for (let entry = 0, steps = 0; steps < SCAN_LIMIT; entry = (entry + 1) & WORD_MASK, steps++) {
    const known = mem.read8(listAddress(entry));
    if (known === TOPIC_LIST_END) return -1;
    if (known === topic) return entry;
  }
  return taskStop('task_native_topic_list_unbounded');
}

// 80:9159: TRUE (FFFF) when the topic is known, else 0.
export const isTopicKnown = (mem, topic) => (findTopic(mem, topic) < 0 ? 0 : TRUE);
// 80:913C: mark the known topic (its flag FF); an unknown topic changes nothing.
export function markTopic(mem, topic) {
  const entry = findTopic(mem, topic);
  if (entry >= 0) mem.write8(flagAddress(entry), TOPIC_MARKED);
}

// 80:90EB: add the topic (the low byte of the first argument word at 7E:0000, reread as
// the original does) unless it is known.
export function addTopic(mem) {
  const { wram } = mem;
  let steps = 0;
  const step = () => {
    if (++steps > SCAN_LIMIT) taskStop('task_native_90eb_list_unbounded');
  };
  let entry = 0;
  for (; ; entry = (entry + 1) & WORD_MASK) {
    step();
    const known = mem.read8(listAddress(entry));
    if (known === TOPIC_LIST_END) break;
    if (known === wram[0]) return;
    if (known > wram[0]) break;
  }
  let displaced = mem.read8(listAddress(entry));
  wram[DP_TOPIC_SHIFT_FLAGS] = mem.read8(flagAddress(entry));
  mem.write8(listAddress(entry), wram[0]);
  mem.write8(flagAddress(entry), 0);
  for (;;) {
    entry = (entry + 1) & WORD_MASK;
    step();
    const next = mem.read8(listAddress(entry));
    mem.write8(listAddress(entry), displaced);
    if (displaced === TOPIC_LIST_END) return;
    wram[DP_TOPIC_NEXT_FLAGS] = mem.read8(flagAddress(entry));
    mem.write8(flagAddress(entry), wram[DP_TOPIC_SHIFT_FLAGS]);
    wram[DP_TOPIC_SHIFT_FLAGS] = wram[DP_TOPIC_NEXT_FLAGS];
    displaced = next;
  }
}
