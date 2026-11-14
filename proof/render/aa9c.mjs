import { isWord } from '../script/runtime.mjs';
import { prepareRenderView } from '../../src/render/data.mjs';
import { renderEntryBoundary, unpackRender9F49 } from './unpack-9f49.mjs';
import { renderA9B2 } from './a9b2.mjs';

// Manual atomic AA9C data plan. I/O metadata records the reached stores,
// without executing devices or acknowledging a DMA/CGRAM transfer.
export function prepareRenderAA9C({
  data,
  request,
  bank = null,
  status = null,
  x = null,
  y = null,
  emulation = null,
  directPage = null,
  stackWindow = null,
  maxWork = 1000000,
  maxOutputBytes = 65536,
  ioMode = null,
  divisionMode = null,
} = {}) {
  if (
    !isWord(request) ||
    (x !== null && !isWord(x)) ||
    (y !== null && !isWord(y)) ||
    (ioMode !== null && ioMode !== 'record-requests') ||
    (divisionMode !== null && divisionMode !== 'stable-native')
  )
    throw Error('Invalid render loader context');
  const context = {
    data,
    bank,
    status,
    emulation,
    directPage,
    stackWindow,
    maxWork,
    maxOutputBytes,
  };
  const entry = renderEntryBoundary(context, 0);
  if (entry) return entry;
  const view = prepareRenderView(
    data,
    stackWindow?.map((a) => 0x7e0000 + a),
  );
  const result = renderAA9C(
    view,
    { request, bank, status, x, y, ioMode, divisionMode },
    { work: 0, maxWork, maxOutputBytes },
    () => renderEntryBoundary(context, 21),
  );
  return result.handled ? view.finish(result) : result;
}

// Same loader algorithm on an outer owner's view and budget. The outer
// initializer validates its full stack footprint before any effects.
export function renderAA9C(
  view,
  { request, bank, status, x = null, y = null, ioMode = null, divisionMode = null },
  budget,
  activeBoundary = () => null,
) {
  const ioWrites = [];
  let phase = 'cache';
  const readWord = (a) => view.read(a) | (view.read(a + 1) << 8);
  const writeWord = (a, value) => {
    view.write(a, value & 255);
    view.write(a + 1, value >>> 8);
  };
  const tick = () => {
    if (++budget.work > budget.maxWork)
      throw { renderBoundary: true, reason: 'render_work_budget_required' };
  };
  const registerWrite = (localBank, offset, value, bytes) => {
    tick();
    const address = localBank * 0x10000 + offset;
    if (localBank === 0x7e || localBank === 0x7f) {
      if (bytes === 2) writeWord(address, value);
      else view.write(address, value);
    } else if (!(localBank & 0x40)) {
      if (ioMode !== 'record-requests')
        throw { renderBoundary: true, reason: 'render_io_context_required', address };
      ioWrites.push(Object.freeze({ phase, address, value, bytes }));
    } else throw { renderBoundary: true, reason: 'render_address_required', address };
  };
  try {
    const cacheAddress = bank * 0x10000 + 0x214;
    if (readWord(cacheAddress) === request) {
      // Equal CMP: C1/N0/Z1, V intact; no stack, source or I/O access.
      return {
        handled: true,
        outcome: 'cache_equal',
        a: request,
        x,
        y,
        bank,
        status: (status & ~0x83) | 3,
        carry: 1,
        overflow: (status >>> 6) & 1,
        work: budget.work,
        ioWrites: Object.freeze([]),
      };
    }
    const activeEntry = activeBoundary();
    if (activeEntry) return activeEntry;
    writeWord(cacheAddress, request);
    writeWord(0xd8, request);
    const shifted = (request << 1) & 0xffff,
      addend = readWord(0xd8);
    const sum = shifted + addend + (request >>> 15),
      index = sum & 0xffff;
    const carry = sum >>> 16;
    const overflow = ~(shifted ^ addend) & (shifted ^ index) & 0x8000 ? 1 : 0;
    phase = 'first_unpack';
    const sourceBankWord = readWord(0x80ffaf + index);
    const sourceOffset = readWord(0x80ffad + index);
    const callStatus = (status & ~0xc3) | carry | (overflow << 6);
    const firstUnpack = unpackRender9F49(
      view,
      { sourceOffset, sourceBankWord, destination: 0x23a0, bank, status: callStatus },
      budget,
    );
    phase = 'first_requests';
    registerWrite(bank, 0x4375, firstUnpack.a, 2);
    registerWrite(bank, 0x4372, 0x23a0, 2);
    registerWrite(bank, 0x2116, 0x50b8, 2);
    registerWrite(bank, 0x2115, 0x80, 1);
    registerWrite(bank, 0x420b, 0x80, 1);
    phase = 'palette';
    const paletteBank = readWord(0x80ffb2 + index) & 255;
    writeWord(bank * 0x10000 + 0x1f4, paletteBank);
    const palettePointer = readWord(0x80ffb0 + index);
    let cursor = palettePointer;
    registerWrite(paletteBank, 0x2121, 0x0d, 1);
    const paletteBytes = [];
    for (let i = 0; i < 6; i++) {
      const value = view.read(paletteBank * 0x10000 + cursor);
      paletteBytes.push(value);
      registerWrite(paletteBank, 0x2122, value, 1);
      cursor = (cursor + 1) & 0xffff;
    }
    writeWord(paletteBank * 0x10000 + 0x1fe, cursor);
    phase = 'second_a9b2';
    const second = renderA9B2(
      view,
      {
        bank: paletteBank,
        status: callStatus | (cursor & 0x8000 ? 0x80 : 0) | (cursor === 0 ? 2 : 0),
      },
      budget,
      divisionMode,
    );
    const finalStatus = (second.status & ~0x82) | (bank & 0x80) | (bank === 0 ? 2 : 0);
    return {
      handled: true,
      outcome: 'loaded',
      a: second.a,
      x: second.x,
      y: second.y,
      bank,
      status: finalStatus,
      carry: second.carry,
      overflow: second.overflow,
      index,
      work: budget.work,
      firstUnpack: Object.freeze(firstUnpack),
      palette: Object.freeze({
        bank: paletteBank,
        pointer: palettePointer,
        next: cursor,
        bytes: Object.freeze(paletteBytes),
      }),
      second: Object.freeze(second),
      ioWrites: Object.freeze(ioWrites),
    };
  } catch (error) {
    if (!error?.renderBoundary) throw error;
    const { renderBoundary, phase: innerPhase, ...result } = error;
    return { handled: false, ...result, phase, ...(innerPhase ? { innerPhase } : {}) };
  }
}
