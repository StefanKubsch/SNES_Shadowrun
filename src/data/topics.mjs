// Dialog topics (docs/ROM-FREE.md, step 2). 80:9215 (src/task/
// native-dialog-text.mjs, proof/render/selection-9215.mjs) lists the topics
// of the sorted list 7E:3CA3 whose flag in 7E:3CD6 is 0: for topic t it
// copies the word at 8D:8000 + 2 t to 0154, the text pointers of the topic
// menu (bit 15 selects bank 9E instead of 9D; src/data/texts.mjs).
// The 64 words from 8D:8000 are all text starts and the word at 8D:8080 is
// none; no code bound for t is known, so the count rests on the data.
// The table keeps its count (topic_layout_changed).
// Native form assets/vm-topics.json: the text address per topic.
import { VmFault } from '../vm/memory.mjs';
import { romWriter, textPointerLabel, textPointerWord } from './rom-bytes.mjs';
import { BYTE_MASK, BYTE_BITS, HEX_RADIX } from '../constants/bits.mjs';

export const TOPIC_TABLE = 0x8d8000,
  TOPICS = 64,
  TOPIC_END = TOPIC_TABLE + 2 * TOPICS;

export const readTopics = (read8) =>
  Array.from({ length: TOPICS }, (_, t) => {
    const w = read8(TOPIC_TABLE + 2 * t) | (read8(TOPIC_TABLE + 2 * t + 1) << BYTE_BITS);
    return textPointerLabel(w);
  });

export function placeTopics(rom, present, { topics }) {
  const put = romWriter(rom, present, 'topic_layout_changed');
  if (topics?.length !== TOPICS) throw new VmFault('topic_layout_changed', TOPIC_TABLE);
  topics.forEach((t, n) => {
    const m = /^(9D|9E):([89A-F][0-9A-F]{3})$/.exec(t ?? '');
    if (!m) throw new VmFault('topic_value_required', TOPIC_TABLE + 2 * n);
    const w = textPointerWord(m[1], m[2]);
    [w & BYTE_MASK, w >> BYTE_BITS].forEach((v, k) => {
      put(TOPIC_TABLE + 2 * n + k, v);
    });
  });
}
