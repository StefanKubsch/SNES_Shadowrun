import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { encodeMatrixText, readMatrixTexts } from '../src/data/matrix-texts.mjs';
import {
  MATRIX_SETUP_ROUTINES,
  CHARACTER_TILES,
  TEXT_BUFFER,
  TEXT_ROW,
} from '../proof/matrix-reference/main-scene-matrix.mjs';
import { matrixSetupSpecs } from './main-scene-matrix-source.mjs';
import { matrixControlSpecs } from './main-matrix-control-source.mjs';
import { mainSceneSpecs } from './main-scene-source.mjs';
import {SCENE_REFERENCE_ROUTINES as MAIN_SCENE_ROUTINES} from '../proof/scene-reference-routines.mjs';
import {
  compareDialog,
  decodeWindows,
  rom,
  DialogTestMemory,
} from './task-native-dialog-harness.mjs';
import { dialogAccess } from '../src/task/native-dialog-support.mjs';
import { cpuToOffset } from './rom.mjs';

const asset = JSON.parse(readFileSync('assets/vm-matrix-texts.json'));
const spec = matrixSetupSpecs.find((s) => s.name === 'b2d1');
const instructions = decodeWindows(spec.windows);

// Synthetic text and font isolate the writer's bounds. Every step still
// compares registers, WRAM and traces with the pinned original instructions.
function writer(bytes, columns = 32) {
  let wram = new Uint8Array(0x20000);
  wram.set(bytes, 0x6000);
  const memory = new DialogTestMemory(wram);
  for (const [at, value] of [
    [0x34, 0x6000],
    [0x36, 0x7e],
    [0x170e, 1],
    [0x1354, 1],
    [0x1350, 0x802],
    [0x1342, columns],
    [0x134c, 9],
  ])
    memory.write16(at, value);
  for (let c = 0x20; c <= 0x7e; c++) memory.write16(CHARACTER_TILES + 2 * c, c);
  return {
    step() {
      let completed;
      const result = compareDialog(
        instructions,
        {
          entry: 0x81b2d1,
          wram,
          a: 0,
          x: 0,
          y: 0,
          dbr: 0x81,
          p: 0,
        },
        {
          native(h, e) {
            MATRIX_SETUP_ROUTINES.get(0x81b2d1)(h, e, MAIN_SCENE_ROUTINES);
            wram = h.a.mem.wram.slice();
            completed = !(h.ctx.status & 1);
          },
          calls(a, e) {
            return new Map([
              [
                0x81b259,
                () => ({
                  rawReturnWord: MATRIX_SETUP_ROUTINES.get(0x81b259)(
                    dialogAccess(a),
                    e,
                    MAIN_SCENE_ROUTINES,
                  ),
                }),
              ],
            ]);
          },
        },
      );
      assert.deepEqual(result.differences, []);
      return completed;
    },
    word(at) {
      return wram[at] | (wram[at + 1] << 8);
    },
  };
}

test('all 22 matrix identities reconstruct their original bytes, including wait operands and list pointers', () => {
  assert.equal(asset.texts.length, 22);
  assert.deepEqual(
    readMatrixTexts((a) => rom[cpuToOffset(a, rom.length)]),
    {
      lists: asset.lists,
      texts: asset.texts,
    },
  );
  for (const { address, text } of asset.texts) {
    const start = parseInt(address.replace(':', ''), 16);
    const bytes = encodeMatrixText(text);
    assert.deepEqual(
      bytes,
      Array.from(
        rom.subarray(cpuToOffset(start, rom.length), cpuToOffset(start, rom.length) + bytes.length),
      ),
    );
  }
});

test('reviewed native references cover 21 identities; C6F5 has no caller in these source groups', () => {
  const starts = new Set(asset.texts.map(({ address }) => parseInt(address.replace(':', ''), 16)));
  const targets = new Set(asset.lists.flat().map((s) => parseInt(s.replace(':', ''), 16)));
  const sites = [];
  for (const group of [matrixSetupSpecs, matrixControlSpecs, mainSceneSpecs]) {
    for (const s of group) {
      const map = decodeWindows(s.windows);
      for (const i of map.values()) {
        if (i.mnemonic !== 'LDX' || i.mode !== 'immX' || !starts.has(0x810000 | i.value)) continue;
        const bank = map.get(i.next);
        assert.equal(bank.mnemonic, 'LDY');
        assert.equal(bank.mode, 'immX');
        assert.equal(bank.value, 0x81);
        const call = map.get(bank.next);
        assert.ok(['JSR', 'JMP'].includes(call.mnemonic));
        assert.equal(call.value, 0xb282);
        sites.push(i.cpu);
        targets.add(0x810000 | i.value);
      }
    }
  }
  assert.deepEqual(
    sites,
    [
      0x81c0db, 0x81ba2e, 0x81c108, 0x81c167, 0x81c179, 0x81c1c8, 0x81c1ea, 0x81c232, 0x81c271,
      0x81c280, 0x81c2ca, 0x81c326, 0x81c365, 0x81c38c, 0x81c4d0,
    ],
  );
  const setup = decodeWindows(matrixSetupSpecs.find((s) => s.name === 'c029').windows);
  assert.equal(setup.get(0x81c0e7).mnemonic, 'LDA');
  assert.equal(setup.get(0x81c0e7).value, 0x81c60d);
  assert.equal(setup.get(0x81c0eb).value, TEXT_BUFFER);
  assert.equal(setup.get(0x81c0f1).value, 16);
  targets.add(0x81c60d);
  assert.equal(targets.size, 21);
  assert.deepEqual(
    [...starts].filter((s) => !targets.has(s)),
    [0x81c6f5],
  );
});

test('matrix glyph lookup folds lowercase and maps many printable ASCII characters to the cursor tile', () => {
  const streams = JSON.parse(readFileSync('assets/vm-lz.json')).streams;
  const font = streams.find((s) => s.address === '85:FD38');
  const words = font.words
    .join(' ')
    .split(/\s+/)
    .map((s) => parseInt(s, 16));
  const glyph = (c) => words[c.charCodeAt(0) - 0x20];
  assert.equal(words.length, 160);
  for (let c = 0x41; c <= 0x5a; c++) assert.equal(words[c - 0x20], words[c + 0x20 - 0x20]);
  for (const c of '"#$%&\'()*+,/;<=>@[]^_`{|}~') assert.equal(glyph(c), 2, c);
  assert.equal(glyph(' '), 0);
  assert.equal(glyph('!'), 1);
  assert.equal(glyph('?'), 0x10);
  assert.equal(glyph('\\'), 0x2b);
  assert.equal(words[0x7f - 0x20], 2);
});

test('29 characters preserve the right margin; 30 skip a row at newline and 31 spill in either mode', () => {
  for (const columns of [16, 32]) {
    for (const count of [29, 30, 31]) {
      const w = writer([...Array(count).fill(0x41), 4, 0], columns);
      w.step();
      if (columns === 16) {
        // No NMI is run here. Inspect the second queued DMA destination;
        // the writer itself never wraps or changes to the next row.
        w.step();
        assert.equal(w.word(0x1748), 16);
        assert.equal(w.word(0x114c), 0x812);
        assert.equal(w.word(0x1146), (count - 16) * 2);
      } else {
        assert.equal(w.word(0x1748), 8);
        assert.equal(w.word(0x1144), 0x802);
        assert.equal(w.word(0x113e), count * 2);
      }
      assert.equal(w.word(TEXT_ROW - 0x7e0000), 0x2041);
      assert.equal(
        w.word(0x1350),
        count === 29 ? 0x822 : 0x842,
        'newline derives its row from the advanced cursor, not the start of the text',
      );
    }
  }
});

test('terminating a partial text batch loses its DMA; an explicit newline flushes it', () => {
  const bare = writer([0x41, 0x42, 0]);
  assert.equal(bare.step(), true);
  assert.equal(bare.word(0x1748), 0);
  assert.equal(bare.word(0x1344), 4);
  assert.equal(bare.word(0x1350), 0x804);
  const flushed = writer([0x41, 0x42, 4, 0]);
  assert.equal(flushed.step(), false);
  assert.equal(flushed.word(0x1748), 8);
  assert.equal(flushed.word(0x113e), 4);
  assert.equal(flushed.word(0x1354), 3);
});

test('palette commands continue the batch; wait and back commands yield, with no left-edge guard', () => {
  const w = writer([3, 0x41, 5, 2, 6, 0]);
  w.step();
  assert.equal(w.word(TEXT_ROW - 0x7e0000), 0x2841);
  assert.equal(w.word(0x1354), 2);
  assert.equal(w.word(0x1350), 0x803);
  assert.equal(w.word(0x34), 0x6004);
  w.step();
  assert.equal(w.word(0x1354), 1);
  w.step();
  assert.equal(w.word(0x1350), 0x802);
  const underflow = writer([6, 0]);
  underflow.step();
  assert.equal(underflow.word(0x1350), 0x801);
});

test('wait zero is a 65536-call delay, not no delay; unsupported commands remain frontiers', () => {
  const w = writer([5, 0, 0]);
  w.step();
  assert.equal(w.word(0x1354), 0);
  w.step();
  assert.equal(w.word(0x1354), 0xffff);
  assert.equal(w.word(0x34), 0x6002);
  for (const command of [7, 31])
    assert.throws(
      () => writer([command, 0]).step(),
      (error) =>
        error.taskBoundary &&
        error.reason === 'matrix_text_command_frontier' &&
        error.commandIndex === command * 2,
    );
});

test('the found-IC template overwrites a fixed byte and reads one byte beyond its terminator', () => {
  const text = asset.texts.find((t) => t.address === '81:C60D');
  const bytes = encodeMatrixText(text.text);
  assert.equal(bytes.length, 15);
  assert.equal(bytes[8], 'X'.charCodeAt(0));
  assert.equal(rom[cpuToOffset(0x81c60d, rom.length) + 15], 3);
  const map = decodeWindows(matrixControlSpecs.find((s) => s.name === 'b959').windows);
  const stores = [...map.values()].filter(
    (i) => i.mnemonic === 'STA' && i.value === TEXT_BUFFER + 8,
  );
  assert.equal(stores.length, 1);
  assert.equal(stores[0].mode, 'long');
});
