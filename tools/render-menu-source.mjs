// ROM-only conditional source contracts. Explicit ranges retain the established
// report order; no generated report is read to discover code or prove returns.
import {createHash} from 'node:crypto';
import {cpuLabel, cpuToOffset} from './rom.mjs';
import {decode} from './disassemble.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {proveMenuStack, proveSelectionStack} from './render-menu-stack-proof.mjs';
import {proveText9178Stack} from './render-9178-stack-proof.mjs';
import {describeRenderDialogBlock as describe, checkDialogCaller} from './render-dialog-source.mjs';

const windows = new Map([
  ['menuA6A5', 0x80A6A5, 0x80A835],
  ['unmarkA5DB', 0x80A5DB, 0x80A5F9],
  ['markA5F9', 0x80A5F9, 0x80A617],
  ['listA617', 0x80A617, 0x80A6A5],
  ['cursorFAAC', 0x80FAAC, 0x80FADD],
  ['numberFD80', 0x80FD80, 0x80FDCF],
  ['actionCaller9B5B', 0x809B5B, 0x809B80],
  ['selectedAudioC46E', 0x80C46E, 0x80C4B3],
  ['textFE69', 0x80FE69, 0x80FEC1],
  ['composeFB39', 0x80FB39, 0x80FD80],
  ['waitACC3', 0x81ACC3, 0x81ACC9],
  ['waitACC9', 0x81ACC9, 0x81ACCF],
  ['cursorADBA', 0x81ADBA, 0x81AE14],
  ['remainingAE14', 0x81AE14, 0x81AE4C],
  ['noopAE4C', 0x81AE4C, 0x81AE4D],
  ['newlineAE4D', 0x81AE4D, 0x81AEB0],
  ['maskAEC8', 0x81AEC8, 0x81AEF4],
  ['requestAEF4', 0x81AEF4, 0x81AEFC],
  ['requestAEFC', 0x81AEFC, 0x81AF04],
  ['bitAF04', 0x81AF04, 0x81AF1F],
  ['requestFA67', 0x80FA67, 0x80FA89],
  ['waitACBD', 0x81ACBD, 0x81ACC3],
  ['consumer9E1A', 0x809E1A, 0x809E59],
  ['waitB0A1', 0x81B0A1, 0x81B0AC],
  ['audioC46E', 0x80C46E, 0x80C4B3],
  ['panC416', 0x80C416, 0x80C461],
  ['samplesF130', 0x81F130, 0x81F1E8],
  ['repeatWordF1E8', 0x81F1E8, 0x81F1FA],
  ['subtractLengthF100', 0x81F100, 0x81F10A],
  ['sendWordF122', 0x81F122, 0x81F130],
  ['sendPairF03A', 0x81F03A, 0x81F067],
  ['apuF007', 0x81F007, 0x81F024],
  ['choice91E2', 0x8091E2, 0x80920D],
  ['choice9215', 0x809215, 0x8092C5],
  ['allocateF963', 0x80F963, 0x80FA3E],
  ['requestACB5', 0x81ACB5, 0x81ACBD],
  ['waitACAF', 0x81ACAF, 0x81ACB5],
  ['entryACCF', 0x81ACCF, 0x81AD92],
  ['renderAD92', 0x81AD92, 0x81ADBA],
  ['renderA9B2', 0x81A9B2, 0x81A9E1],
  ['copy9F49', 0x809F49, 0x809F69],
  ['unpack9E9B', 0x809E9B, 0x809F49],
  ['bits9E65', 0x809E65, 0x809E7E],
  ['overlayAF1F', 0x81AF1F, 0x81B026],
  ['removeFA3E', 0x80FA3E, 0x80FA67],
  ['text9178', 0x809178, 0x8091E2],
  ['insert908C', 0x80908C, 0x8090EB],
  ['appendC34A', 0x80C34A, 0x80C366],
  ['visitC1CA', 0x80C1CA, 0x80C1E3],
  ['dynamicTaskDispatch', 0x80C1F9, 0x80C20B],
  ['caller9483', 0x80947C, 0x809486],
  ['caller94B8', 0x8094B1, 0x8094BB],
  ['caller94C5', 0x8094C2, 0x8094C8],
  ['selectedDialogChoices', 0x80948D, 0x8094A5],
].map(([name, start, end]) => [name, [start, end]]));

const romHash = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const word = {e: 0, m: 0, x: 0};
const stops = {
  menu: 'Complete local source; only explicitly closed helper graphs prove return widths/DBR/stack. No CPU execution.',
  selection: 'Complete code window, adjacent data separate. Actual transitive bodies followed under explicit normal-menu/reset exclusions. No CPU execution.',
  text: 'Complete local source. Actual render callees followed; task excerpts separate, no assumed task return. No CPU execution.',
};
const menuNames = ['menuA6A5', 'unmarkA5DB', 'markA5F9', 'listA617', 'cursorFAAC', 'numberFD80', 'actionCaller9B5B', 'selectedAudioC46E'];
const textNames = ['textFE69', 'composeFB39', 'waitACC3', 'waitACC9', 'cursorADBA', 'remainingAE14', 'noopAE4C',
  'newlineAE4D', 'maskAEC8', 'requestAEF4', 'requestAEFC', 'bitAF04'];
const audioNames = ['audioC46E', 'panC416', 'samplesF130', 'repeatWordF1E8', 'subtractLengthF100', 'sendWordF122', 'sendPairF03A', 'apuF007'];
const releaseNames = ['requestACB5', 'waitACAF', 'entryACCF', 'renderAD92', 'renderA9B2', 'copy9F49',
  'unpack9E9B', 'bits9E65', 'overlayAF1F', 'removeFA3E'];

function checkRom(bytes) {
  if (createHash('sha256').update(bytes).digest('hex') !== romHash) throw Error('Wrong European ROM revision');
}

function block(bytes, name, profile) {
  const [entry, end] = windows.get(name);
  const entryM = Number(profile === 'text' ? entry === 0x80908C : entry === 0x81F03A);
  let state = {...word, m: entryM};
  const instructions = [], statuses = [];
  const trackStatus = profile === 'text' ? entry === 0x809178 : [0x81F130, 0x81F007].includes(entry);
  for (let pc = entry; pc < end;) {
    if (pc === 0x80FC5F || (profile === 'text' && pc === 0x8091D8)) state.m = 1;
    const i = decode(bytes, pc, state);
    const forbidden = profile === 'text' ? false
      : ['TCD', 'PLD', 'SED', 'RTI', 'BRK', 'COP'].includes(i.mnemonic)
        || (profile === 'menu' && i.mnemonic === 'XCE' && i.cpu !== 0x809E54);
    if (i.next > end || forbidden) throw Error('Renew ' + profile + ' source at ' + cpuLabel(pc));
    instructions.push(i); pc = i.next;
    if (trackStatus && i.mnemonic === 'PHP') statuses.push({...state});
    if (trackStatus && i.mnemonic === 'PLP') { state = statuses.pop(); if (!state) throw Error('Unpaired source status'); }
    if (profile !== 'text' && i.cpu === 0x809E54) state.e = 1;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  if (statuses.length) throw Error('Unbalanced source status');
  return {name, entry, initialState: {...word, m: profile === 'text' ? entryM : 0}, instructions, stop: stops[profile]};
}

const blocksFor = (bytes, names, profile) => names.map(name => block(bytes, name, profile));
const makeMap = blocks => new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
const codeBytes = map => [...map.values()].reduce((n, i) => n + i.raw.length, 0);

function dependencyGroups(bytes, profile) {
  return [
    ['analysis/render-be6d.json', ['requestFA67', 'waitACBD']],
    ['analysis/render-9e1a.json', ['consumer9E1A']],
    ['analysis/render-input-flow.json', ['waitB0A1']],
    ['analysis/render-audio.json', audioNames],
  ].map(([report, names]) => ({report, windows: blocksFor(bytes, names, profile).map(describe)}));
}

function checkActionCaller(bytes, b) {
  const start = cpuToOffset(0x8099EB, bytes.length), owner = bytes.subarray(start, start + 0x1B5);
  if (createHash('sha256').update(owner).digest('hex') !== '3e5aef83a620e227ff194a44806c9af9bbc8cc29618e616300636d501c33d3b1') throw Error('Action source drift');
  const w = describe(b), offset = b.entry - 0x8099EB;
  if (offset < 0 || offset + w.covered_bytes > owner.length
    || owner.subarray(offset, offset + w.covered_bytes).toString('hex').toUpperCase() !== w.machine_bytes) throw Error('Action caller drift');
}

// One menu-owned window under the menu decode policy, for analyzers that
// previously compared their own decode against the A6A5 report.
export function describeRenderMenuWindow(bytes, name) {
  checkRom(bytes);
  if (!menuNames.includes(name)) throw Error('Unknown menu source window ' + name);
  return describe(block(bytes, name, 'menu'));
}

export function proveRenderMenuSource(bytes) {
  checkRom(bytes);
  const blocks = blocksFor(bytes, menuNames, 'menu'); checkActionCaller(bytes, blocks[6]);
  const reused = blocksFor(bytes, textNames, 'menu'), reusedWindows = reused.map(describe);
  const graphBlocks = [...blocks.slice(1, 6), ...reused], map = makeMap(graphBlocks);
  const proofs = [0x80A617, 0x80A5DB, 0x80A5F9, 0x80FAAC, 0x80FD80]
    .map(entry => proveWordStack(map, entry, 'RTS', {measureStack: true, widthJoins: new Set([0x80FC36])}));
  const menuMap = makeMap([blocks[0]]), roots = [0x80A6A5, 0x80A6AD, 0x80A6B8, 0x80A6C7];
  const pending = [...roots], seen = new Set();
  while (pending.length) {
    const pc = pending.pop(); if (seen.has(pc)) continue;
    const i = menuMap.get(pc); if (!i) throw Error('Uncovered menu local edge ' + cpuLabel(pc)); seen.add(pc);
    if (i.mnemonic === 'RTS') continue;
    if (['BRA', 'JMP'].includes(i.mnemonic)) pending.push(i.target);
    else { if (i.mode === 'rel8') pending.push(i.target); pending.push(i.next); }
  }
  if (seen.size !== menuMap.size) throw Error('Unreachable menu source');
  const calls = blocks[0].instructions.filter(i => ['JSR', 'JSL'].includes(i.mnemonic))
    .map(i => ({from: cpuLabel(i.cpu), kind: i.mnemonic, to: cpuLabel(i.target)}));
  const menuDependencies = dependencyGroups(bytes, 'menu');
  const menuCallees = blocksFor(bytes, ['requestFA67', 'waitACBD', 'consumer9E1A', 'waitB0A1', ...audioNames], 'menu');
  const closedMap = new Map([...map, ...menuMap]);
  for (const b of menuCallees) for (const i of b.instructions) {
    if (closedMap.has(i.cpu) && !closedMap.get(i.cpu).raw.equals(i.raw)) throw Error('Menu overlap drift');
    closedMap.set(i.cpu, i);
  }
  const sound = cpuToOffset(0x80C4FF, bytes.length);
  if (bytes.subarray(sound, sound + 2).toString('hex').toUpperCase() !== '2D00') throw Error('Renew original menu sound');
  const menuProofs = roots.map(entry => proveMenuStack(closedMap, entry));
  const originalMenuProofs = roots.map(entry => proveMenuStack(closedMap, entry, {sound: 'original-002D'}));
  return {rom_sha256: romHash, blocks, reused, reusedWindows, graphBlocks, map, proofs, menuMap, roots, seen, calls,
    menuDependencies, menuCallees, closedMap, menuProofs, originalMenuProofs, menuCodeBytes: codeBytes(closedMap),
    windows: blocks.map(describe), dependencies: [{report: 'analysis/render-be6d.json', windows: reusedWindows}],
    conditional_menu_graph: {proofs: menuProofs, original_sound_proofs: originalMenuProofs,
      full_reset_graph_closed: false, actual_termination_proven: false},
    menu: {full_graph_closed: false, minimum_protected_stack_bytes: null}};
}

export function proveRenderSelectionSource(bytes) {
  checkRom(bytes);
  const profile = 'selection', roots = blocksFor(bytes, ['choice91E2', 'choice9215'], profile);
  const dependencies = [
    {report: 'analysis/render-a6a5.json', windows: blocksFor(bytes, menuNames.slice(0, 6), profile).map(describe)},
    {report: 'analysis/render-be6d.json', windows: blocksFor(bytes, textNames, profile).map(describe)},
    ...dependencyGroups(bytes, profile),
    {report: 'analysis/render-be6d.json', windows: [describe(block(bytes, 'allocateF963', profile))]},
    {report: 'analysis/render-ad92.json', windows: blocksFor(bytes, releaseNames, profile).map(describe)},
  ];
  const map = makeMap(roots), reused = [];
  for (const d of dependencies) for (const w of d.windows) {
    const b = block(bytes, w.name, profile); let added = false;
    for (const i of b.instructions) {
      const previous = map.get(i.cpu);
      if (previous && (!previous.raw.equals(i.raw) || JSON.stringify(previous.state) !== JSON.stringify(i.state))) throw Error('Overlapping source drift');
      if (!previous) added = true; map.set(i.cpu, i);
    }
    if (added) reused.push(b);
  }
  const proofs = roots.map(b => proveSelectionStack(map, b.entry));
  const originalProofs = roots.map(b => proveSelectionStack(map, b.entry, {sound: 'original-002D'}));
  const caller = checkDialogCaller(bytes, block(bytes, 'selectedDialogChoices', profile));
  return {rom_sha256: romHash, roots, dependencies, map, reused, proofs, originalProofs, caller, codeBytes: codeBytes(map),
    windows: roots.map(describe), conditional_graph: {conditional_graph_closed: true, full_reset_graph_closed: false, actual_termination_proven: false},
    choice91e2_graph: {entry: '80:91E2', proof: proofs[0], native_binding: true},
    choice9215_graph: {entry: '80:9215', proof: proofs[1], native_binding: true}};
}

export function proveRenderText9178Source(bytes) {
  checkRom(bytes);
  const profile = 'text', roots = blocksFor(bytes, ['text9178', 'insert908C'], profile);
  const dependencies = [
    {report: 'analysis/render-a6a5.json', windows: [describe(block(bytes, 'cursorFAAC', profile))]},
    {report: 'analysis/render-be6d.json', windows: blocksFor(bytes, textNames, profile).map(describe)},
    {report: 'analysis/render-be6d.json', windows: blocksFor(bytes, ['requestFA67', 'waitACBD'], profile).map(describe)},
  ];
  const map = makeMap(roots), reused = [];
  for (const d of dependencies) for (const w of d.windows) {
    const b = block(bytes, w.name, profile);
    for (const i of b.instructions) {
      if (map.has(i.cpu) && !map.get(i.cpu).raw.equals(i.raw)) throw Error('Source overlap drift');
      map.set(i.cpu, i);
    }
    reused.push(b);
  }
  const proof = proveText9178Stack(map), helperProof = proveText9178Stack(map, 0x80908C);
  const excerpts = blocksFor(bytes, ['appendC34A', 'visitC1CA', 'dynamicTaskDispatch', 'caller9483', 'caller94B8', 'caller94C5'], profile);
  for (const b of excerpts.slice(3)) checkDialogCaller(bytes, b);
  return {rom_sha256: romHash, roots, dependencies, map, reused, proof, helperProof, excerpts, windows: roots.map(describe),
    render_graph: {conditional_graph_closed: true, native_binding: false, actual_termination_proven: false, proof},
    full_graph: {closed: false, native_binding: false, minimum_protected_stack_bytes: null, unresolved_nested_callees: ['80:C1CA']}};
}
