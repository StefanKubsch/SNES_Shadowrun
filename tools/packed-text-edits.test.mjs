import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cartridge, readAsset } from './cartridge-harness.mjs';
import { loadCartridge } from '../src/data/cartridge.mjs';
import { buildTextEdits, TEXT_EDITS_FORMAT, TEXT_EDITS_FILE } from '../src/data/text-edits.mjs';
import {
  beginPackedTextEdit,
  endPackedTextEdit,
  PROLOGUE_EDIT,
  CREDITS_EDIT,
  PACKED_TEXT_DOMAINS,
} from '../src/data/packed-text-edits.mjs';
import { buildLanguage, installLanguage, redirectLanguageStream } from '../src/data/language.mjs';
import { VmMemory, PACKED_TEXT_BANK } from '../src/vm/memory.mjs';
import { lzBits, lzDecode } from '../src/data/lz.mjs';
import { LiveGame } from '../src/video/live-game.mjs';
import { requestCredits, startMenuWaiting } from '../src/game/credits.mjs';

const german = buildLanguage(JSON.parse(readFileSync('assets/vm-texts-de.json', 'utf8')));
const asset = (en = [], de = []) => ({ format: TEXT_EDITS_FORMAT, en, de });
const intro = (line, code = 'en') => ({
  address: '81:F5CE',
  lines: Array(code === 'en' ? 28 : 29).fill(line),
});
const credits = (lines) => ({
  address: '81:F2BD',
  groups: Array.from({ length: 14 }, () => [...lines]),
});
const build = (edits) => buildTextEdits(edits, []);
function memoryFor(edits, language = null) {
  const memory = new VmMemory(cartridge.rom, undefined, null, cartridge.present);
  memory.textEdits = structuredClone(build(edits));
  installLanguage(memory, language);
  return memory;
}
function unpack(memory, cpu) {
  const dp = new Map([
    [0xe1, cpu & 0xffff],
    [0xe3, cpu >>> 16],
  ]);
  redirectLanguageStream(memory, {
    dp: (at) => dp.get(at),
    dpWrite: (at, value) => dp.set(at, value),
  });
  const source = (dp.get(0xe3) << 16) | dp.get(0xe1);
  const bits = lzBits((i) => memory.read8(0x80a033 + i));
  return {
    source,
    data: Buffer.from(
      lzDecode((i) => memory.read8(source + 2 + i), memory.read16(source), bits).data,
    ),
  };
}

test('shared loader validates packed entries without replacing original assets and survives worker cloning', async () => {
  const edits = asset([intro('Changed intro'), credits(['Changed credits'])]);
  const loaded = await loadCartridge((name) =>
    name === TEXT_EDITS_FILE ? new TextEncoder().encode(JSON.stringify(edits)) : readAsset(name),
  );
  assert.deepEqual(loaded.rom, cartridge.rom);
  assert.deepEqual(loaded.present, cartridge.present);
  const clone = structuredClone(loaded);
  assert.deepEqual(clone.textEdits.packed, loaded.textEdits.packed);
  assert.equal(clone.textEdits.packed.en.size, 2);
  assert.equal(clone.textEdits.en.size, 0);
});

test('authoring validates identities, structures, timing counts, row edges and actual glyphs', () => {
  const invalid = [
    asset([{ ...intro('x'), address: '81:f5ce' }]),
    asset([{ ...intro('x'), address: '81:F5CF' }]),
    asset([intro('x'), intro('y')]),
    asset([{ address: '81:F5CE', text: 'wrong shape' }]),
    asset([{ ...intro('x'), text: 'ambiguous' }]),
    asset([{ address: '81:F5CE', lines: ['x'] }]),
    asset([intro('')]),
    asset([intro('x'.repeat(33))]),
    asset([], [intro('x')]), // German has 29 lines, not 28.
    asset([{ address: '81:F2BD', groups: [['only one page']] }]),
    asset([credits([])]),
    asset([credits(Array(5).fill('x'))]),
    asset([credits(['x'.repeat(32)])]),
    ...['\0', '\n', '{wait 1}', '\\x41', '$', '%', 'ä', '😀', '~'].map((c) => asset([intro(c)])),
    ...['Ö', 'ß', '$', '"', '\\'].map((c) => asset([], [credits([c])])),
    ...['Ä', 'ö', 'ü', 'Ü'].map((c) => asset([], [intro(c, 'de')])),
  ];
  for (const edits of invalid) assert.throws(() => build(edits), JSON.stringify(edits));
  for (const edits of [
    asset([intro('x'.repeat(32)), credits(Array(4).fill('x'.repeat(31)))]),
    asset([], [intro('ä ß', 'de'), credits(['abc ÄÜäü'])]),
    asset([credits([''])]),
    asset([
      { address: '81:F5CE', lines: [] },
      { address: '81:F2BD', groups: [] },
    ]),
  ])
    assert.doesNotThrow(() => build(edits));
  const bytes = build(asset([], [credits(['a u Ä Ü'])])).packed.de.get(CREDITS_EDIT);
  assert.equal(Buffer.from(bytes).subarray(1, 9).toString('latin1'), 'A U a u\0');
});

test('snapshot resolution keeps translation precedence and uses a coherent English fallback', () => {
  const edits = asset([intro('EN'), credits(['EN'])], [intro('DE ä', 'de')]);
  const memory = memoryFor(edits, german);
  const translated = beginPackedTextEdit(memory, CREDITS_EDIT);
  assert.equal(translated.bank, null, 'existing German credits beat English edit without A2');
  assert.equal(unpack(memory, CREDITS_EDIT).source >>> 16, 0xa1);
  installLanguage(memory, null);
  assert.match(unpack(memory, CREDITS_EDIT).data.toString('latin1'), /SYSTEMPROGRAMMIERUNG/);
  endPackedTextEdit(memory, translated);
  installLanguage(memory, german);
  const active = beginPackedTextEdit(memory, PROLOGUE_EDIT);
  assert.ok(active);
  assert.match(unpack(memory, PROLOGUE_EDIT).data.toString('latin1'), /^DE \$/);
  installLanguage(memory, null);
  const domain = PACKED_TEXT_DOMAINS[0];
  const capturedMap = unpack(memory, domain.map);
  assert.equal(capturedMap.source >>> 16, PACKED_TEXT_BANK);
  assert.equal(capturedMap.data.readUInt16LE(2 * ('$'.charCodeAt(0) - 32)), 4);
  assert.equal(unpack(memory, domain.font).data.length, 1344);
  assert.throws(() => beginPackedTextEdit(memory, PROLOGUE_EDIT), /packed_edit_snapshot_active/);
  endPackedTextEdit(memory, {});
  assert.equal(memory.packedTextSnapshot, active, 'a stale release cannot clear another owner');
  endPackedTextEdit(memory, active);
  assert.equal(memory.packedTextSnapshot, null);
  assert.throws(() => memory.read8(0xa28000), /unmapped_read/);
  const incomplete = { ...german, streams: new Map(german.streams) };
  incomplete.streams.delete(CREDITS_EDIT);
  installLanguage(memory, incomplete);
  const fallback = beginPackedTextEdit(memory, CREDITS_EDIT);
  assert.deepEqual([...unpack(memory, CREDITS_EDIT).data.subarray(0, 3)], [1, 69, 78]);
  assert.equal(
    unpack(memory, PACKED_TEXT_DOMAINS[1].font).data.length,
    864,
    'English font, not German font',
  );
  assert.equal(
    unpack(memory, PACKED_TEXT_DOMAINS[1].map).data.readUInt16LE(2 * ('a'.charCodeAt(0) - 32)),
    17,
  );
  endPackedTextEdit(memory, fallback);
  for (const memory of [memoryFor(asset()), memoryFor(asset([], [intro('DE', 'de')]))]) {
    const snapshot = beginPackedTextEdit(memory, PROLOGUE_EDIT);
    assert.equal(snapshot.bank, null);
    installLanguage(memory, german);
    assert.equal(
      unpack(memory, PROLOGUE_EDIT).source,
      PROLOGUE_EDIT,
      'original English source is pinned even if German is selected mid-setup',
    );
    endPackedTextEdit(memory, snapshot);
  }
});

test('bounded providers admit maximum layouts, hide empty edits and fail before publishing invalid sources', () => {
  const edits = asset([intro('Q'.repeat(32)), credits(Array(4).fill('Q'.repeat(31)))]);
  const memory = memoryFor(edits);
  for (const domain of PACKED_TEXT_DOMAINS) {
    const snapshot = beginPackedTextEdit(memory, domain.id);
    assert.ok(snapshot.bank.length < 0x8000);
    const data = unpack(memory, domain.id).data;
    assert.equal(data.length, domain.id === PROLOGUE_EDIT ? 925 : 1807);
    assert.ok(0x62a8 + data.length < 0x76a8, 'output stays below the next scene layer');
    assert.throws(() => memory.read8(0xa28000 + snapshot.bank.length), /unmapped_read/);
    assert.throws(() => memory.write8(0xa28000, 1));
    endPackedTextEdit(memory, snapshot);
  }
  const empty = memoryFor(
    asset([
      { address: '81:F5CE', lines: [] },
      { address: '81:F2BD', groups: [] },
    ]),
  );
  for (const domain of PACKED_TEXT_DOMAINS) {
    const snapshot = beginPackedTextEdit(empty, domain.id);
    assert.deepEqual(unpack(empty, domain.id).data, Buffer.from([0]));
    endPackedTextEdit(empty, snapshot);
  }
  const broken = { ...german, streams: new Map(german.streams) };
  broken.streams.delete(PACKED_TEXT_DOMAINS[0].font);
  const bad = memoryFor(asset([], [intro('DE', 'de')]), broken);
  const before = bad.wram.slice();
  assert.throws(() => beginPackedTextEdit(bad, PROLOGUE_EDIT), /packed_edit_source_required/);
  assert.equal(bad.packedTextSnapshot, null);
  assert.deepEqual(bad.wram, before);
  assert.deepEqual(cartridge.rom, memory.rom);
});

for (const language of ['en', 'de'])
  test(
    `native ${language} intro and menu credits load edited text and matching fonts`,
    { timeout: 120000 },
    () => {
      const edits = asset(
        [intro('EN Intro'), credits(['EN CREDITS'])],
        [intro('DE ä ß', 'de'), credits(['DE Ä Ü'])],
      );
      const textEdits = build(edits);
      const introBytes = Buffer.from(textEdits.packed[language].get(PROLOGUE_EDIT));
      const creditBytes = Buffer.from(textEdits.packed[language].get(CREDITS_EDIT));
      let game,
        requested = false,
        introSeen = false,
        creditsSeen = false;
      const wordsVisible = (codes, base, mask) => {
        const vram = game.bus.ppu.vram;
        const words = [...codes].map(
          (c) =>
            (game.memory.read16(0x7e56a8 + 2 * (c - 32)) & mask) | (mask === 0xff ? 0x2000 : 0),
        );
        for (let at = base; at < base + 0x800; at += 2)
          if (
            words.every(
              (w, n) =>
                at + 2 * n < base + 0x800 && (vram[at + 2 * n] | (vram[at + 2 * n + 1] << 8)) === w,
            )
          )
            return true;
        return false;
      };
      game = new LiveGame(
        { ...cartridge, textEdits },
        {
          languages: { de: german },
          language,
          pad: (k) => {
            if (k > 700 && !requested) {
              const buffer = Buffer.from(
                game.memory.wram.subarray(0x62a8, 0x62a8 + introBytes.length),
              );
              if (
                !introSeen &&
                buffer.equals(introBytes) &&
                wordsVisible(introBytes.subarray(0, introBytes.indexOf(0)), 0x2000, 0xc0ff)
              ) {
                introSeen = true;
                game.setLanguage(language);
                assert.deepEqual(
                  Buffer.from(game.bus.ppu.vram.subarray(0x4000, 0x4000 + 1312)),
                  unpack(game.memory, PACKED_TEXT_DOMAINS[0].font).data.subarray(0, 1312),
                );
              }
            }
            if (startMenuWaiting(game) && !requested) {
              assert.equal(introSeen, true, 'edited intro reached VRAM through its NMI');
              requested = true;
              requestCredits(game.vm);
            }
            if (
              requested &&
              Buffer.from(game.memory.wram.subarray(0x62a8, 0x62a8 + creditBytes.length)).equals(
                creditBytes,
              )
            )
              creditsSeen ||= wordsVisible(
                creditBytes.subarray(1, creditBytes.indexOf(0)),
                0x1000,
                0xff,
              );
            return !requested && k >= 3000 && k % 150 < 4 ? 0x1000 : 0;
          },
        },
      );
      const seen = new WeakSet();
      let switches = 0;
      const read8 = game.memory.read8.bind(game.memory);
      game.memory.read8 = (address) => {
        const snapshot = game.memory.packedTextSnapshot;
        if (address >>> 16 === PACKED_TEXT_BANK && snapshot && !seen.has(snapshot)) {
          seen.add(snapshot);
          switches++;
          game.setLanguage(language === 'en' ? 'de' : 'en');
        }
        return read8(address);
      };
      while (game.nmis < 6500 && !creditsSeen) game.step();
      assert.equal(introSeen, true);
      assert.equal(
        creditsSeen,
        true,
        'edited credits reached VRAM through the original animation DMA',
      );
      assert.equal(game.memory.packedTextSnapshot, null, 'provider released after setup');
      assert.equal(switches, 2, 'UI language changed during both native source loads');
      assert.notEqual(game.language, language);
      game.setLanguage(language);
      assert.deepEqual(
        Buffer.from(game.memory.wram.subarray(0x62a8, 0x62a8 + creditBytes.length)),
        creditBytes,
        'switches do not rewrite the active sequence',
      );
      const fontIdentity = PACKED_TEXT_DOMAINS[1].font;
      assert.equal(
        unpack(game.memory, fontIdentity).source,
        fontIdentity,
        'shared graphics are no longer redirected after their owner releases',
      );
      const fontSource = language === 'de' ? german.streams.get(fontIdentity) : fontIdentity;
      const expectedFont = unpack(game.memory, fontSource).data;
      assert.equal(expectedFont.length, language === 'en' ? 864 : 896);
      assert.deepEqual(
        Buffer.from(game.bus.ppu.vram.subarray(0x2000, 0x2000 + 864)),
        expectedFont.subarray(0, 864),
        'the original scene-list DMA installs the credits glyph range in VRAM',
      );
    },
  );
