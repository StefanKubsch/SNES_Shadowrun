// Read-only inventory of original Huffman text references and numeric matches.
// Usage: node tools/text-reference-inventory.mjs > analysis/text-references.json
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { inspectRom, cpuToOffset, offsetToCpu, cpuLabel } from './rom.mjs';
import { decode } from './disassemble.mjs';
import { auditInstructionStarts } from './rom-unread-audit.mjs';
import { NATIVE_TEXT_GROUPS } from './text-reference-contracts.mjs';
import { decodeScript } from '../src/script/codec.mjs';
import { textPointerWord } from '../src/data/rom-bytes.mjs';
import { LOOKUP_TABLES } from '../src/data/tables.mjs';
import { KIND_TABLE, KINDS } from '../src/data/kinds.mjs';
import { RUNNER_NAMES, RUNNERS } from '../src/data/runners.mjs';
import { TOPIC_TABLE, TOPICS } from '../src/data/topics.mjs';
import { DIALOG_DATA, DIALOG_END } from '../src/data/dialogs.mjs';
import { DIALOGS, DIALOG_TABLE } from '../src/data/portraits.mjs';
import { CODE_BANK_BASE, LOROM_OFFSET } from '../src/constants/memory-map.mjs';
import { HEX_RADIX, BYTE_BITS, WORD_BITS, WORD_MASK } from '../src/constants/bits.mjs';

const WORD_BYTES = 2;
const KIND_RECORD_BYTES = 6;
const DIALOG_HEADER_BYTES = 4;
const DIALOG_ENTRY_HEADER_BYTES = 3;
const WORD_OPERAND_INSTRUCTION_BYTES = 3;
const SCRIPT_HEADER_BYTES = 2;
const TEXT_BANK_MIRROR_MASK = 0x7fffff;
// Resolve ESLint's own parser through the declared development dependency,
// including installations that keep its dependencies nested.
const { parse } = createRequire(import.meta.resolve('eslint'))('espree');
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url));
const json = (file) => JSON.parse(read(file));
const address = (label) => parseInt(label.replace(':', ''), HEX_RADIX);
const wordOf = (label) => textPointerWord(...label.split(':'));
const wordAt = (bytes, cpu) => bytes.readUInt16LE(cpuToOffset(cpu, bytes.length));

export function typedTextReferences(bytes, texts, assets) {
  const starts = new Set(texts.map((t) => t.address));
  const refs = [];
  const add = (asset, path, slot, target, reader) => {
    if (!starts.has(target)) throw new Error(`Unknown text start ${target} at ${asset}${path}`);
    if (wordAt(bytes, slot) !== wordOf(target))
      throw new Error(`Text reference differs from ROM at ${cpuLabel(slot)}`);
    refs.push({ kind: 'decoded_data_word', asset, path, slot: cpuLabel(slot), target, reader });
  };
  if (
    assets.kinds.kinds.length !== KINDS ||
    assets.runners.runners.length !== RUNNERS ||
    assets.topics.topics.length !== TOPICS ||
    assets.dialogs.dialogs.length !== DIALOGS
  )
    throw new Error('Text reference source table count changed');
  assets.kinds.kinds.forEach((k, i) => {
    if (k.name === null && wordAt(bytes, KIND_TABLE + KIND_RECORD_BYTES * i) !== WORD_MASK)
      throw new Error('Kind name sentinel differs from ROM');
    if (k.name !== null)
      add(
        'vm-kinds.json',
        `/kinds/${i}/name`,
        KIND_TABLE + KIND_RECORD_BYTES * i,
        k.name,
        '80:9BC6 / 80:BE6D',
      );
  });
  assets.runners.runners.forEach((r, i) =>
    add(
      'vm-runners.json',
      `/runners/${i}/name`,
      CODE_BANK_BASE | (RUNNER_NAMES + WORD_BYTES * i),
      r.name,
      '80:9782 column readers',
    ),
  );
  assets.topics.topics.forEach((t, i) =>
    add('vm-topics.json', `/topics/${i}`, TOPIC_TABLE + WORD_BYTES * i, t, '80:9241'),
  );
  for (const table of LOOKUP_TABLES.filter((t) => t.size === 'text')) {
    const index = assets.tables.tables.findIndex((t) => t.name === table.name);
    const data = assets.tables.tables[index];
    if (!data || data.values.length !== table.count || address(data.address) !== table.address)
      throw new Error(`Text reference table layout changed: ${table.name}`);
    data.values.forEach((target, i) => {
      if (target === 0 && wordAt(bytes, table.address + WORD_BYTES * i) !== 0)
        throw new Error('Text table sentinel differs from ROM');
      if (target !== 0)
        add(
          'vm-tables.json',
          `/tables/${index}/values/${i}`,
          table.address + WORD_BYTES * i,
          target,
          table.name,
        );
    });
  }
  let at = DIALOG_DATA;
  assets.dialogs.dialogs.forEach((dialog, i) => {
    if (wordAt(bytes, DIALOG_TABLE + WORD_BYTES * dialog.dialog) !== (at & WORD_MASK))
      throw new Error('Dialog record pointer differs from ROM');
    at += DIALOG_HEADER_BYTES;
    dialog.entries.forEach((entry, k) => {
      at +=
        DIALOG_ENTRY_HEADER_BYTES +
        entry.topics.length +
        (entry.script === undefined ? 0 : WORD_BYTES);
      add('vm-dialogs.json', `/dialogs/${i}/entries/${k}/text`, at, entry.text, '80:9178');
      at += WORD_BYTES;
    });
    at++;
  });
  if (at !== DIALOG_END) throw new Error('Dialog text reference layout changed');
  return refs;
}

export function scriptTextCandidates(bundle, orphans, layout, words) {
  const candidates = [],
    coverage = [];
  const scan = (asset, path, code, base, entry = 0) => {
    const decoded = decodeScript(code, entry);
    coverage.push({
      asset,
      path,
      bytes: code.length,
      scope_start: entry,
      decoded_bytes: decoded.byteLength,
      gaps: decoded.gaps,
      unit_gaps: decoded.gaps
        .filter((g) => g.end > entry)
        .map((g) => ({ start: Math.max(entry, g.start), end: g.end })),
    });
    for (const ins of decoded.instructions) {
      if (
        ins.length !== WORD_OPERAND_INSTRUCTION_BYTES ||
        ins.operand === null ||
        !words.has(ins.operand)
      )
        continue;
      candidates.push({
        kind: 'script_operand_candidate',
        asset,
        path: `${path}/${ins.pc - entry + 1}`,
        instruction: ins.name,
        pc: ins.pc,
        slot: cpuLabel(base + ins.pc + 1),
        target: words.get(ins.operand),
        value: ins.operand,
        status: 'Numeric match only; no text-argument flow is inferred.',
      });
    }
  };
  bundle.scripts.forEach((s, i) =>
    scan(
      'scripts.json',
      `/scripts/${i}/bytecode`,
      Uint8Array.from(s.bytecode),
      layout.scriptAddresses[i] + SCRIPT_HEADER_BYTES,
    ),
  );
  orphans.scripts.forEach((s, i) =>
    scan(
      'vm-orphan-scripts.json',
      `/scripts/${i}/bytecode`,
      Uint8Array.from(s.bytecode),
      address(s.address) + SCRIPT_HEADER_BYTES,
    ),
  );
  orphans.tails.forEach((tail, i) => {
    const owner = bundle.scripts[tail.script].bytecode;
    const code = Uint8Array.from([...owner, ...tail.bytecode]);
    // Branches retain the owner's PC; the physical slot uses the same origin.
    scan(
      'vm-orphan-scripts.json',
      `/tails/${i}/bytecode`,
      code,
      address(tail.address) - owner.length,
      tail.entry,
    );
  });
  return { candidates, coverage };
}

export function javascriptTextCandidates(source, words, file) {
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module', loc: true });
  const sites = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Literal' && typeof node.value === 'number' && words.has(node.value))
      sites.push({
        file,
        line: node.loc.start.line,
        column: node.loc.start.column,
        value: node.value,
        target: words.get(node.value),
        status: 'JavaScript numeric literal; semantic use is not inferred.',
      });
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value?.type) visit(value);
    }
  };
  visit(tree);
  return sites;
}

const sourceFiles = (folder) =>
  readdirSync(new URL(`../${folder}/`, import.meta.url), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? sourceFiles(`${folder}/${entry.name}`)
        : entry.name.endsWith('.mjs')
          ? [`${folder}/${entry.name}`]
          : [],
    )
    .sort();

export function rawTextMatches(bytes, words, classOf, refs) {
  const slots = new Set(refs.map((r) => cpuToOffset(address(r.slot), bytes.length)));
  const longStarts = new Map(
    [...words.values()].map((t) => [address(t) & TEXT_BANK_MIRROR_MASK, t]),
  );
  const matches = [];
  for (let at = 0; at + 1 < bytes.length; at++) {
    const word = bytes[at] | (bytes[at + 1] << BYTE_BITS);
    if (words.has(word))
      matches.push({
        slot: cpuLabel(offsetToCpu(at)),
        encoding: 'text_word',
        target: words.get(word),
        source_class: classOf[at],
        bank_crossing: (at + 1) % LOROM_OFFSET === 0,
        status: slots.has(at) ? 'proven_reference' : 'numeric_match_only',
      });
    if (at + WORD_BYTES >= bytes.length) continue;
    const long = word | (bytes[at + WORD_BYTES] << WORD_BITS);
    const target = longStarts.get(long & TEXT_BANK_MIRROR_MASK);
    if (target)
      matches.push({
        slot: cpuLabel(offsetToCpu(at)),
        encoding: 'long_address',
        target,
        source_class: classOf[at],
        status: 'numeric_match_only',
      });
  }
  return matches;
}

export function inventoryTextReferences() {
  const { bytes, metadata } = inspectRom(read('Shadowrun (E).smc'));
  const texts = json('assets/vm-texts.json');
  const manifest = json('assets/vm-cartridge.json');
  const map = json('analysis/vm-rom-map.json');
  const observed = json('analysis/rom-code-observed.json');
  if (
    [texts.source_rom_sha256, manifest.source_rom_sha256, map.rom_sha256].some(
      (sha) => sha !== metadata.rom_sha256,
    )
  )
    throw new Error('Text inventory inputs must belong to the same European ROM');
  const words = new Map(texts.texts.map((t) => [wordOf(t.address), t.address]));
  const refs = typedTextReferences(bytes, texts.texts, {
    kinds: json('assets/vm-kinds.json'),
    runners: json('assets/vm-runners.json'),
    topics: json('assets/vm-topics.json'),
    tables: json('assets/vm-tables.json'),
    dialogs: json('assets/vm-dialogs.json'),
  });
  const native = [];
  for (const group of NATIVE_TEXT_GROUPS) {
    for (const pc of group.instructions) {
      const ins = decode(bytes, pc, { e: 0, m: 0, x: 0 });
      if (ins.mnemonic !== 'LDA' || ins.mode !== 'immM' || !words.has(ins.value))
        throw new Error(`Native text literal changed at ${cpuLabel(pc)}`);
      native.push({
        kind: 'native_text_id',
        source: group.source,
        instruction: cpuLabel(pc),
        slot: cpuLabel(pc + 1),
        target: words.get(ins.value),
        product_storage: 'Native JavaScript, not the original code operand.',
      });
    }
  }
  const nativeCandidates = [];
  const nativeSlots = new Set(native.map((r) => r.slot));
  for (const start of auditInstructionStarts(map, observed)) {
    const [at, flags] = start.split(':');
    const ins = decode(bytes, offsetToCpu(parseInt(at, HEX_RADIX)), {
      e: +flags[0],
      m: +flags[1],
      x: +flags[2],
    });
    if (['immM', 'immX', 'word'].includes(ins.mode) && words.has(ins.value))
      nativeCandidates.push({
        slot: cpuLabel(ins.cpu + 1),
        pc: cpuLabel(ins.cpu),
        state: flags,
        instruction: `${ins.mnemonic} ${ins.operand}`,
        target: words.get(ins.value),
        status: nativeSlots.has(cpuLabel(ins.cpu + 1)) ? 'proven_reference' : 'numeric_match_only',
      });
  }
  const script = scriptTextCandidates(
    json('assets/scripts.json'),
    json('assets/vm-orphan-scripts.json'),
    manifest.scripts,
    words,
  );
  const files = sourceFiles('src');
  const javascript = files.flatMap((f) =>
    javascriptTextCandidates(read(f).toString('utf8'), words, f),
  );
  const classOf = new Array(bytes.length);
  for (const r of map.ranges)
    classOf.fill(
      r.class,
      parseInt(r.rom_offset, HEX_RADIX),
      parseInt(r.rom_offset, HEX_RADIX) + r.length,
    );
  const allRefs = [...refs, ...native];
  const matches = rawTextMatches(bytes, words, classOf, allRefs);
  const identityBindings = json('assets/vm-texts-de.json').texts.map((text, i) => {
    const word = wordOf(text.address);
    if (words.get(word) !== text.address)
      throw new Error(`Unknown language text identity ${text.address}`);
    return { asset: 'vm-texts-de.json', path: `/texts/${i}/address`, target: text.address, word };
  });
  const referenced = new Set(allRefs.map((r) => r.target));
  const byAsset = {};
  for (const r of refs) byAsset[r.asset] = (byAsset[r.asset] ?? 0) + 1;
  return {
    source_rom_sha256: metadata.rom_sha256,
    scope:
      'Original Huffman texts only. All matching ROM words/long addresses and source numeric literals are enumerated; numeric matches are not permission to rewrite.',
    text_count: texts.texts.length,
    proven_references: allRefs.length,
    decoded_data_references: refs.length,
    native_references: native.length,
    referenced_texts: referenced.size,
    unreferenced_texts: texts.texts.filter((t) => !referenced.has(t.address)).map((t) => t.address),
    by_asset: byAsset,
    script_units: script.coverage.length,
    javascript_modules: files.length,
    references: allRefs,
    language_identity_bindings: identityBindings,
    script_candidates: script.candidates,
    script_coverage: script.coverage,
    native_operand_candidates: nativeCandidates,
    javascript_numeric_candidates: javascript,
    raw_numeric_matches: matches,
    text_ids: texts.texts.map((t) => ({
      address: t.address,
      word: wordOf(t.address),
      references: allRefs.filter((r) => r.target === t.address).map((r) => r.slot),
    })),
    relocation_ready: false,
    limits: [
      'Target coverage is not proof of every incoming use; runtime-computed pointers and saved state need a separate contract.',
      'Script and JavaScript numeric candidates require semantic review; no generic stack or call argument flow is inferred.',
      'Original text words are also identity keys for German language overrides, port text menus and runtime WRAM. Keep them stable unless all consumers migrate.',
      'FE69 and FADD both read Huffman streams; both must resolve relocated content consistently, including read-ahead, bank limits and window fitting.',
      'ASCII menu and matrix texts, packed intro/credits text, browser UI and original tool/proof fixtures are separate text domains.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(inventoryTextReferences(), null, 2));
