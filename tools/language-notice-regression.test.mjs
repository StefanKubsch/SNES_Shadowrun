import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLanguage, installLanguage, noticeSize, wrappedLines } from '../src/data/language.mjs';
import { showNoticeSequence } from '../src/game/notice-show.mjs';
import { NOTICE_WINDOWS, WINDOW_COLUMNS, WINDOW_ROWS } from '../src/data/wram.mjs';
import { textWindowSide, finishTextWindow } from './text-window-caller-harness.mjs';

const asset = JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8'));
const german = buildLanguage(asset);
const TEXT_NUMBERS = 0x80d9b8;
const GLYPH_WIDTHS = 0x81ac0c;

test('every cartridge-sized German notice fits its complete translated text', (t) => {
  const { mem } = textWindowSide();
  installLanguage(mem, german);
  const repaired = [];
  for (const { english: args, german: original } of asset.notices) {
    const codes = german.texts.get(mem.read16(TEXT_NUMBERS + 2 * args[1]));
    assert.ok(codes, `translated text number ${args[1]}`);
    const width = (c) => mem.read8(GLYPH_WIDTHS + c);
    const size = noticeSize(german, args, codes, width);
    assert.ok(
      wrappedLines(codes, (size[1] - 2) * 8, width) <= size[0] - 2,
      `text number ${args[1]} fits without losing a line`,
    );
    if (wrappedLines(codes, (original[1] - 2) * 8, width) <= original[0] - 2)
      assert.deepEqual(size, original, 'retain cartridge geometry when it fits');
    else repaired.push(args[1]);
  }
  assert.ok(repaired.length > 0, 'the cartridge contains undersized translated windows');
  t.diagnostic(
    `Checked ${asset.notices.length} cartridge sizes; repaired text numbers: ${repaired.join(', ')}`,
  );
});

for (const translated of [false, true])
  test(`amulet description through the real notice caller, German ${translated}`, () => {
    const side = textWindowSide();
    const { mem, put, h, events } = side;
    if (translated) installLanguage(mem, german);
    for (let slot = 0; slot <= 6; slot += 2) put(NOTICE_WINDOWS + slot, 0xffff);
    const args = [240, 131, 2048, 3, 25, 20, 2];
    args.forEach((value, i) => put(12 - 2 * i, value));
    const actual = finishTextWindow(side, showNoticeSequence(h, events, side.render), 1);
    const window = mem.read16(0x7e0000 + NOTICE_WINDOWS + 6);
    const rows = mem.read16(0x7e0000 + WINDOW_ROWS + window);
    const columns = mem.read16(0x7e0000 + WINDOW_COLUMNS + window);
    assert.equal(actual.calls.length, 1);
    const buffer = actual.calls[0][2];
    const text = buffer.subarray(0, buffer.indexOf(0));
    if (translated) {
      assert.equal(
        Buffer.from(text).toString('ascii'),
        'In das Amulett ist eine Fledermaus eingraviert.',
      );
      assert.ok(
        wrappedLines(text, (columns - 2) * 8, (c) => mem.read8(GLYPH_WIDTHS + c)) <= rows - 2,
      );
      assert.ok(rows > 3, 'the entire sentence needs another text row');
    } else assert.deepEqual([rows, columns], [3, 25], 'original English geometry');
  });
