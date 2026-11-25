// Random per-function tests of the lifted topic list natives (src/game/topic-list.mjs
// through their natives in src/task) against their register-level references
// (proof/game-reference/topic-list.mjs): 80:9159 (known), 80:913C (mark) and 80:90EB
// (add). Both sides run the native from its script call (data bank 80, direct page 0, the
// RTS frame). Game state only (docs/STRATEGY.md, 2026-11-14): WRAM outside the stacks,
// the device writes and the return must be equal.
import { prng } from './task-native-dialog-harness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSide, registerCases, useLiftVectors } from './lift-function-harness.mjs';
import {
  addTopicReference,
  isTopicKnownReference,
  markTopicReference,
} from '../proof/game-reference/topic-list.mjs';
import { isTopicKnown } from '../src/script/native-topic-known.mjs';
import { markTopic } from '../src/script/native-topic-mark.mjs';
import { addTopic } from '../src/script/native-topic-add.mjs';
import { TOPIC_LIST, TOPIC_FLAGS, TOPIC_MARKED } from '../src/data/wram.mjs';
import { addTopic as addKnownTopic, markTopic as markKnownTopic } from '../src/game/topic-list.mjs';

useLiftVectors(import.meta.url);

const WRAM_BYTES = 0x20000,
  HEX = 16,
  BYTE = 0x100,
  CODE_BANK = 0x80,
  CALLER_RETURN = 0x1234,
  // The game's lists hold at most 50 topics.
  TOPICS = 50;

function sample(seed) {
  const random = prng(seed),
    rnd = (n) => Math.floor(random() * n),
    wram = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < wram.length; i++) wram[i] = rnd(BYTE);
  // Mostly a sorted list of distinct topics ended by FF (sometimes empty), else random
  // bytes; the topic one of the list's, a new one or FF.
  const list = [...new Set(Array.from({ length: rnd(TOPICS) }, () => rnd(0xff)))].sort(
    (a, b) => a - b,
  );
  if (rnd(4)) {
    list.forEach((topic, n) => (wram[TOPIC_LIST + n] = topic));
    wram[TOPIC_LIST + list.length] = 0xff;
  }
  wram[0] = [list.length ? list[rnd(list.length)] : 0, rnd(0xff), 0xff][rnd(3)];
  return { seed, wram, rnd };
}
const returned = (h) => [h.ctx.pc, h.ctx.s].map((v) => v.toString(HEX)).join();
const topic = (name, entry, reference, run) => ({
  name,
  entry,
  samples: 400,
  reference: (h) => reference(h.a, false),
  prepare: (s) => ({ bank: CODE_BANK, status: s.rnd(BYTE) & 0xc3 }),
  result: returned,
  lifted: (h, input) => {
    Object.assign(h.ctx, input);
    h.ctx.programBank = CODE_BANK;
    h.push(CALLER_RETURN, 2);
    run(h.a, false);
    return returned(h);
  },
});
registerCases(
  [
    topic('isTopicKnown 80:9159', 0x809159, isTopicKnownReference, isTopicKnown),
    topic('markTopic 80:913C', 0x80913c, markTopicReference, markTopic),
    topic('addTopic 80:90EB', 0x8090eb, addTopicReference, addTopic),
  ],
  { sample, side: (s) => createSide(s, new Map()), runtime: (h) => h, ignored: [] },
);

test('marking a topic hides it without freeing list storage', () => {
  const { mem } = createSide({ seed: 1, wram: new Uint8Array(WRAM_BYTES) }, new Map());
  mem.wram.set([1, 3, 0xff], TOPIC_LIST);
  markKnownTopic(mem, 1);
  assert.deepEqual([...mem.wram.subarray(TOPIC_LIST, TOPIC_LIST + 3)], [1, 3, 0xff]);
  assert.equal(mem.wram[TOPIC_FLAGS], TOPIC_MARKED);
});

test('a synthetic 51st topic overwrites the oldest flag column in both source and lifted paths', () => {
  const state = new Uint8Array(WRAM_BYTES);
  for (let i = 0; i < 50; i++) state[TOPIC_LIST + i] = i;
  state[TOPIC_LIST + 50] = 0xff;
  state[0] = 50;
  const actual = createSide({ seed: 1, wram: state.slice() }, new Map());
  const reference = createSide({ seed: 1, wram: state.slice() }, new Map());
  Object.assign(reference.h.ctx, { bank: CODE_BANK, status: 0 });
  reference.h.push(CALLER_RETURN, 2);
  addTopicReference(reference.a, false);
  addKnownTopic(actual.mem);
  for (const side of [actual, reference]) {
    assert.equal(side.mem.wram[TOPIC_LIST + 50], 50, 'new topic occupies the former terminator');
    assert.equal(side.mem.wram[TOPIC_FLAGS], 0xff, 'terminator spills into the first topic flag');
    assert.equal(side.mem.wram[TOPIC_LIST], 0, 'the old topic is retained but now hidden');
  }
});
