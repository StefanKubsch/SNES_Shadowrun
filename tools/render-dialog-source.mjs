// ROM-only source contracts shared by BF3B and its selected render callees.
// Report paths remain provenance references; no generated reports are read here.
import {createHash} from 'node:crypto';
import {cpuLabel, cpuToOffset} from './rom.mjs';
import {decode} from './disassemble.mjs';
import {proveWordStack} from './static-word-stack-proof.mjs';
import {proveAudioStack} from './render-audio-stack-proof.mjs';

const romHash = '91dbfecf9017264b01885e065cf015840223b8e8d2f95dfa62c4c0d654c2f690';
const hash = raw => createHash('sha256').update(raw).digest('hex');
const word = {e: 0, m: 0, x: 0};
const unpackStop = 'Complete selected source window. Closed root/helper typed stack graph; input termination not proved. No CPU execution.';
const rowsStop = 'Complete selected source window. Only 8F20 root has a closed WORD/DBR/stack and bounded loop proof. No CPU execution.';
const fieldsStop = 'Complete selected source window. 9022/8FF5 local typed graph closed; actual0140 wait termination not proved. No CPU execution.';
const furtherFieldsStop = 'Complete selected source window. Local typed graph closed; actual0140 wait termination unproved. No CPU execution.';
const transferStop = 'Complete code window; adjacent table separate. Typed stack proof restores PHP/PLP; no CPU execution.';
const commonForbidden = ['XCE', 'TCD', 'PLD', 'SED', 'RTI', 'BRK', 'COP'];
const forbiddenByPolicy = {
  default: commonForbidden,
  fixedWord: [...commonForbidden, 'REP', 'SEP', 'PLP'],
  fields: [...commonForbidden, 'PLP', 'PLB', 'TCS'],
  transfer: [...commonForbidden, 'TCS'],
};

function checkRom(bytes) {
  if (hash(bytes) !== romHash) throw Error('Wrong European ROM revision');
}

function block(bytes, name, entry, end, stop, policy = 'default') {
  const state = {...word}, instructions = [];
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || forbiddenByPolicy[policy].includes(i.mnemonic)) throw Error('Renew ' + name + ' at ' + cpuLabel(pc));
    instructions.push(i); pc = i.next;
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
    // The transfer helper restores its paired entry PHP. The independent
    // typed-stack proof still checks every push, pop and return path.
    if (policy === 'transfer' && i.mnemonic === 'PLP') { state.m = 0; state.x = 0; }
  }
  return {name, entry, initialState: {...word}, instructions, stop};
}

export function describeRenderDialogBlock(b) {
  const raw = Buffer.concat(b.instructions.map(i => i.raw));
  return {name: b.name, entry: cpuLabel(b.entry), end_exclusive: cpuLabel(b.instructions.at(-1).next),
    covered_bytes: raw.length, instruction_count: b.instructions.length,
    sha256: hash(raw), machine_bytes: raw.toString('hex').toUpperCase()};
}

export function checkDialogCaller(bytes, b) {
  // Pin the whole existing owner window, then validate the selected decoded
  // instruction slices against it. This does not close the whole dialog graph.
  const start = cpuToOffset(0x80936C, bytes.length), owner = bytes.subarray(start, start + 0x17E);
  if (hash(owner) !== '09a59c53aea3b19534147e8079d09d34a7840933d521a9466d6c1707d30f0e4b') throw Error('Dialog source drift');
  const w = describeRenderDialogBlock(b), offset = b.entry - 0x80936C;
  if (offset < 0 || offset + w.covered_bytes > owner.length
    || owner.subarray(offset, offset + w.covered_bytes).toString('hex').toUpperCase() !== w.machine_bytes) {
    throw Error('Selected caller drift');
  }
  return b;
}

function dialogCaller(bytes, name, entry, end, stop, policy) {
  return checkDialogCaller(bytes, block(bytes, name, entry, end, stop, policy));
}

function dialogCallers(bytes, kind, stop, policy) {
  return [
    ['selectedDialogFirst' + kind, 0x80943F, 0x809456],
    ['selectedDialogSecond' + kind, 0x809465, 0x809479],
  ].map(([name, entry, end]) => dialogCaller(bytes, name, entry, end, stop, policy));
}

function closedGraph(blocks, entry) {
  const map = new Map(blocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
  const proof = proveWordStack(map, entry, 'RTS', {measureStack: true});
  if (proof.reachable_instructions !== map.size) throw Error('Unused dialog dependency source');
  const windows = blocks.map(describeRenderDialogBlock);
  return {rom_sha256: romHash, map, proof, windows,
    full_graph: {closed: true, code_bytes: windows.reduce((n, w) => n + w.covered_bytes, 0), instructions: map.size, proof}};
}

export function proveRender9F6DSource(bytes) {
  checkRom(bytes);
  const root = block(bytes, 'unpack9F6D', 0x809F6D, 0x80A033, unpackStop);
  const helper = block(bytes, 'bit9E65', 0x809E65, 0x809E7E, unpackStop);
  const callers = dialogCallers(bytes, 'Unpack', unpackStop);
  const graph = closedGraph([root, helper], root.entry);
  const tableEntry = 0x80A033, offset = cpuToOffset(tableEntry, bytes.length), raw = bytes.subarray(offset, offset + 256);
  const table = {name: 'offsetWidthA033', entry: cpuLabel(tableEntry), covered_bytes: raw.length,
    sha256: hash(raw), machine_bytes: raw.toString('hex').toUpperCase(),
    qualification: 'All256 original bytes addressed by BYTE X. Fixedlong80A033+X; no semantic output capacity or initialized buffer inferred.'};
  return {...graph, root, helper, callers, table};
}

export function proveRender8F20Source(bytes) {
  checkRom(bytes);
  const root = block(bytes, 'rows8F20', 0x808F20, 0x808F3A, rowsStop, 'fixedWord');
  const callers = dialogCallers(bytes, 'Rows', rowsStop, 'fixedWord');
  return {...closedGraph([root], root.entry), root, callers};
}

function setupWait(bytes, stop) {
  return block(bytes, 'setupWait8FF5', 0x808FF5, 0x809022, stop, 'fields');
}

export function proveRender9022Source(bytes) {
  checkRom(bytes);
  const root = block(bytes, 'fields9022', 0x809022, 0x80905E, fieldsStop, 'fields');
  const helper = setupWait(bytes, fieldsStop);
  const caller = dialogCaller(bytes, 'selectedDialogFields9022', 0x809450, 0x809459, fieldsStop, 'fields');
  const helperProof = proveWordStack(new Map(helper.instructions.map(i => [i.cpu, i])), helper.entry, 'RTS', {measureStack: true});
  return {...closedGraph([root, helper], root.entry), root, helper, caller, helperProof};
}

export function proveRender905ESource(bytes) {
  checkRom(bytes);
  const root = block(bytes, 'fields905E', 0x80905E, 0x80908C, furtherFieldsStop, 'fields');
  const helper = setupWait(bytes, furtherFieldsStop);
  const increment = block(bytes, 'gateIncrementA954', 0x81A954, 0x81A958, furtherFieldsStop, 'fields');
  const caller = dialogCaller(bytes, 'selectedDialogFields905E', 0x809470, 0x80947C, furtherFieldsStop, 'fields');
  const incrementProof = proveWordStack(new Map(increment.instructions.map(i => [i.cpu, i])), increment.entry, 'RTL', {measureStack: true});
  return {...closedGraph([root, helper, increment], root.entry), root, helper, increment, caller, incrementProof};
}

export function proveRender8F3ASource(bytes) {
  checkRom(bytes);
  const root = block(bytes, 'transfer8F3A', 0x808F3A, 0x808F87, transferStop, 'transfer');
  const helper = block(bytes, 'window8EFE', 0x808EFE, 0x808F20, transferStop, 'transfer');
  const wait = block(bytes, 'waitB0A1', 0x81B0A1, 0x81B0AC, transferStop, 'transfer');
  const callers = [dialogCaller(bytes, 'selectedDialogTransfer', 0x809476, 0x80947C, transferStop, 'transfer')];
  const helperProof = proveWordStack(new Map(helper.instructions.map(i => [i.cpu, i])), helper.entry, 'RTS', {measureStack: true});
  const offset = cpuToOffset(0x808F87, bytes.length), raw = bytes.subarray(offset, offset + 16);
  return {...closedGraph([root, helper, wait], root.entry), root, helper, wait, callers, helperProof, raw};
}

export function proveRenderFF79Source(bytes) {
  checkRom(bytes);
  const stop = 'Complete source window; static control/stack proof, no CPU execution.';
  const root = block(bytes, 'clearFF79', 0x80FF79, 0x80FF98, stop);
  const caller = dialogCaller(bytes, 'selectedDialogFF79', 0x80937A, 0x80939E, stop);
  // Retain the established dependency order for proof traversal and reports.
  const reused = [
    ['requestACB5', 0x81ACB5, 0x81ACBD], ['waitACAF', 0x81ACAF, 0x81ACB5],
    ['entryACCF', 0x81ACCF, 0x81AD92], ['renderAD92', 0x81AD92, 0x81ADBA],
    ['renderA9B2', 0x81A9B2, 0x81A9E1], ['copy9F49', 0x809F49, 0x809F69],
    ['unpack9E9B', 0x809E9B, 0x809F49], ['bits9E65', 0x809E65, 0x809E7E],
    ['overlayAF1F', 0x81AF1F, 0x81B026], ['removeFA3E', 0x80FA3E, 0x80FA67],
  ].map(([name, entry, end]) => block(bytes, name, entry, end, stop));
  return {...closedGraph([root, ...reused], root.entry), root, caller, reused,
    windows: [root, caller].map(describeRenderDialogBlock)};
}

function audioBlock(bytes, name, entry, end, entryM = 0) {
  const initialState = {e: 0, m: entryM, x: 0}, saved = [], instructions = [];
  let state = {...initialState};
  for (let pc = entry; pc < end;) {
    const i = decode(bytes, pc, state);
    if (i.next > end || commonForbidden.includes(i.mnemonic)) throw Error('Renew EF47 window ' + cpuLabel(pc));
    instructions.push(i); pc = i.next;
    if (i.mnemonic === 'PHP') saved.push({...state});
    if (i.mnemonic === 'PLP') { state = saved.pop(); if (!state) throw Error('Unpaired EF47 local status'); }
    if (['REP', 'SEP'].includes(i.mnemonic)) {
      if (i.value & 32) state.m = Number(i.mnemonic === 'SEP');
      if (i.value & 16) state.x = Number(i.mnemonic === 'SEP');
    }
  }
  if (saved.length) throw Error('Unbalanced EF47 local status');
  return {name, entry, initialState, instructions,
    stop: 'Static original source window; control/stack proof separate. No CPU or device execution.'};
}

export function proveRenderEF47Source(bytes) {
  checkRom(bytes);
  const roots = [audioBlock(bytes, 'selectEF47', 0x81EF47, 0x81EF63),
    audioBlock(bytes, 'modeF25A', 0x81F25A, 0x81F28F), audioBlock(bytes, 'modeEntriesF1FA', 0x81F1FA, 0x81F229, 1)];
  const callers = [
    checkDialogCaller(bytes, audioBlock(bytes, 'selectedDialogMode', 0x80939B, 0x8093C5)),
    checkDialogCaller(bytes, audioBlock(bytes, 'selectedDialogRestore', 0x8094E2, 0x8094EA)),
    audioBlock(bytes, 'selectedACCall', 0x808559, 0x80855D), audioBlock(bytes, 'selectedTransitionCall', 0x80A580, 0x80A584),
  ];
  const reused = [
    ['samplesF130', 0x81F130, 0x81F1E8], ['repeatWordF1E8', 0x81F1E8, 0x81F1FA],
    ['subtractLengthF100', 0x81F100, 0x81F10A], ['sendWordF122', 0x81F122, 0x81F130],
    ['sendPairF03A', 0x81F03A, 0x81F067, 1], ['apuF007', 0x81F007, 0x81F024],
  ].map(([name, entry, end, entryM]) => audioBlock(bytes, name, entry, end, entryM));
  const ownerBlocks = [audioBlock(bytes, 'directoryLoaderF092', 0x81F092, 0x81F100),
    audioBlock(bytes, 'selectedInitEF63', 0x81EF63, 0x81EF94)];
  const graphBlocks = [...roots, ...reused], map = new Map(graphBlocks.flatMap(b => b.instructions.map(i => [i.cpu, i])));
  const proofs = [[0x81EF47, 'RTL', 0], [0x81F25A, 'RTL', 0], [0x81F25A, 'RTL', 1], [0x81F1FA, 'RTS', 1]]
    .map(([entry, ret, entryM]) => proveAudioStack(map, entry, ret, {entryM}));
  if (proofs[0].reachable_instructions !== map.size) throw Error('Unreachable EF47 dependency');
  return {rom_sha256: romHash, roots, root: roots[0], callers, reused, ownerBlocks, graphBlocks, map, proofs, proof: proofs[0],
    windows: [...roots, ...callers].map(describeRenderDialogBlock),
    full_graph: {closed: true, code_bytes: graphBlocks.reduce((n, b) => n + describeRenderDialogBlock(b).covered_bytes, 0),
      instructions: map.size, proof: proofs[0]}};
}

export function proveRenderFA92Source(bytes) {
  checkRom(bytes);
  const stop = 'Complete selected source window; only FA92 root has a closed control/stack proof. No CPU execution.';
  const root = block(bytes, 'positionFA92', 0x80FA92, 0x80FAAC, stop, 'fixedWord');
  const caller = dialogCaller(bytes, 'selectedDialogPosition', 0x8093DB, 0x8093F4, stop, 'fixedWord');
  const owners = [block(bytes, 'selectedDimensionWriter', 0x80F9B1, 0x80F9C0, stop, 'fixedWord'),
    block(bytes, 'selectedFieldZeroWriter', 0x80F9CC, 0x80F9DF, stop, 'fixedWord')];
  return {...closedGraph([root], root.entry), root, caller, owners,
    windows: [root, caller].map(describeRenderDialogBlock)};
}
