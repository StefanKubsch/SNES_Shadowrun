// Source-specific atomic plans for proof tools. The game executes the shared routines directly.
import { isRenderData, prepareRenderView, renderAddress } from '../../src/render/data.mjs';
import { taskStop } from '../../src/task/plan.mjs';

// Manual, source-specific byte plans over the existing versioned owner. This
// module never decodes or executes instructions, dispatches a task or creates
// a CPU state. The frozen context is an explicit caller observation.
const taskPlans = new WeakMap();

const latestCommittedPlans = new WeakMap();

export const isLatestCommittedTaskPlan = (data, plan) => latestCommittedPlans.get(data) === plan;

const word = (v) => Number.isInteger(v) && v >= 0 && v <= 65535;

const byte = (v) => Number.isInteger(v) && v >= 0 && v <= 255;

const wram = (a) => Number.isInteger(a) && a >= 0x7e0000 && a <= 0x7fffff;

export function prepareTaskPlan(options, entries, algorithm, deviceRegisters = null) {
  // A shared live interrupt cursor belongs to direct execution. Speculative
  // plans must never consume it before their outer commit succeeds.
  if (options?.interruptEvents?.interrupts !== undefined)
    return { handled: false, reason: 'task_interrupt_direct_execution_required' };
  const {
    data,
    context,
    entry,
    protectedStackBytes,
    maxWork,
    maxOutputBytes,
    ioMode = null,
    ioObservations = null,
  } = options ?? {};
  if (!entries.includes(entry)) return { handled: false, reason: 'task_entry_required' };
  if (!isRenderData(data)) return { handled: false, reason: 'task_data_required' };
  if (
    !context ||
    !Object.isFrozen(context) ||
    context.e !== 0 ||
    context.programBank !== entry >>> 16 ||
    context.pc !== (entry & 65535) ||
    !['a', 'x', 'y', 's', 'd'].every((k) => word(context[k])) ||
    !byte(context.bank) ||
    !byte(context.status) ||
    context.status & 0x30
  )
    return { handled: false, reason: 'task_context_required' };
  if (
    !Array.isArray(protectedStackBytes) ||
    protectedStackBytes.length < 2 ||
    protectedStackBytes.some((a) => !wram(a)) ||
    new Set(protectedStackBytes).size !== protectedStackBytes.length
  )
    return { handled: false, reason: 'task_protected_stack_required' };
  if (![maxWork, maxOutputBytes].every((v) => Number.isSafeInteger(v) && v >= 0))
    return { handled: false, reason: 'task_budget_required' };
  if (ioMode !== null && ioMode !== 'record-requests')
    return { handled: false, reason: 'task_io_mode_required' };
  if (
    ioObservations !== null &&
    (!Array.isArray(ioObservations) ||
      !Object.isFrozen(ioObservations) ||
      !Array.from(ioObservations).every(
        (o) =>
          o &&
          Object.isFrozen(o) &&
          Number.isInteger(o.pc) &&
          (deviceRegisters?.observationPcs
            ? deviceRegisters.observationPcs.includes(o.pc)
            : o.pc >= 0x800000 && o.pc <= 0x80ffff) &&
          Number.isInteger(o.address) &&
          o.address >= 0 &&
          o.address <= 0xffffff &&
          [1, 2].includes(o.width) &&
          (o.width === 1 ? byte(o.value) : word(o.value)),
      ))
  )
    return { handled: false, reason: 'task_io_observations_required' };
  const view = prepareRenderView(data),
    ctx = { ...context },
    protectedBytes = new Set(protectedStackBytes),
    windows = data.snapshot().writeWindows;
  const accesses = [],
    ioRequests = [];
  let work = 0,
    outputBytes = 0,
    observationIndex = 0;
  const tick = (n = 1) => {
    if (work + n > maxWork) taskStop('task_work_budget_required');
    work += n;
  };
  const owner = (address, outerReturn = false) => {
    const physical = renderAddress(address);
    if (physical === null) taskStop('render_address_required', { address });
    if (protectedBytes.has(physical) && !outerReturn)
      taskStop('task_stack_alias_required', { address: physical });
    if (outerReturn && !protectedBytes.has(physical))
      taskStop('task_outer_return_required', { address: physical });
    return physical;
  };
  const read = (address, label, outerReturn = false) => {
    tick();
    owner(address, outerReturn);
    const value = view.read(address);
    accesses.push({ kind: 'read', label, address, value });
    return value;
  };
  const write = (address, value, label) => {
    tick();
    const physical = owner(address);
    // A write to the LoROM has no effect on the hardware (as in src/vm/memory.mjs); it stays in the access log.
    // Bank 00 is only reached by stack or direct page wraps and stays a boundary.
    if (physical >= 0x800000 && address >>> 16 !== 0) {
      accesses.push({ kind: 'rom-write', label, address, value });
      return;
    }
    if (outputBytes + 1 > maxOutputBytes) taskStop('task_output_budget_required');
    if (!windows.some(([first, last]) => physical >= first && physical <= last))
      taskStop('render_write_window_required', { address: physical });
    view.write(address, value);
    outputBytes++;
    accesses.push({ kind: 'write', label, address, value });
  };
  const readWord = (address, wrap = 24, label = 'WORD', outerReturn = false) => {
    const mask = wrap === 16 ? 65535 : 0xffffff;
    return (
      read(address & mask, label + '-low', outerReturn) |
      (read((address + 1) & mask, label + '-high', outerReturn) << 8)
    );
  };
  const writeWord = (address, value, wrap = 24, label = 'WORD') => {
    const mask = wrap === 16 ? 65535 : 0xffffff;
    write(address & mask, value & 255, label + '-low');
    write((address + 1) & mask, value >>> 8, label + '-high');
  };
  const stackWord = (offset = 1, label = 'stack-WORD') =>
    readWord((ctx.s + offset) & 65535, 16, label);
  const pullWord = (label = 'PLA') => {
    const value = stackWord(1, label);
    ctx.s = (ctx.s + 2) & 65535;
    return value;
  };
  const pushWord = (value, label = 'PHA') => {
    write(ctx.s, value >>> 8, label + '-high');
    ctx.s = (ctx.s - 1) & 65535;
    write(ctx.s, value & 255, label + '-low');
    ctx.s = (ctx.s - 1) & 65535;
  };
  const streamWord = (label = 'stream-WORD') => {
    const pointer = readWord(ctx.d, 16, label + '-pointer');
    return readWord((ctx.bank * 65536 + pointer + ctx.y) & 0xffffff, 24, label);
  };
  // Absolute accesses to actual WRAM/ROM remain ordinary provider accesses.
  // The only unmapped addresses accepted here are explicit arithmetic MMIO
  // requests in the hardware register banks, never synthesized device values.
  const ioAddress = (offset, width, writeAccess) => {
    const allowed = writeAccess
      ? (deviceRegisters?.writes ?? [0x4202, 0x4203, 0x4204, 0x4205, 0x4206])
      : (deviceRegisters?.reads ?? [0x4214, 0x4215, 0x4216, 0x4217]);
    const address = ctx.bank * 65536 + offset;
    if (
      ctx.bank & 0x40 ||
      !Array.from({ length: width }, (_, n) => offset + n).every((o) => allowed.includes(o))
    )
      taskStop('render_address_required', { address });
    if (ioMode !== 'record-requests') taskStop('task_io_mode_required');
    return address;
  };
  const absoluteRead = (offset, width, pc, label) => {
    const address = ctx.bank * 65536 + offset;
    if (renderAddress(address) !== null)
      return width === 1 ? read(address, label) : readWord(address, 24, label);
    ioAddress(offset, width, false);
    tick(width);
    const observation = ioObservations?.[observationIndex];
    if (
      !observation ||
      observation.pc !== pc ||
      observation.address !== address ||
      observation.width !== width
    )
      taskStop('task_io_observation_required', { pc, address, width, observationIndex });
    observationIndex++;
    const request = { kind: 'read', pc, address, width, value: observation.value };
    ioRequests.push(request);
    accesses.push({ ...request, kind: 'io-read', label });
    return observation.value;
  };
  const absoluteWrite = (offset, value, width, pc, label) => {
    const address = ctx.bank * 65536 + offset;
    if (renderAddress(address) !== null) {
      if (width === 1) write(address, value, label);
      else writeWord(address, value, 24, label);
      return;
    }
    ioAddress(offset, width, true);
    tick(width);
    if (outputBytes + width > maxOutputBytes) taskStop('task_output_budget_required');
    outputBytes += width;
    const request = { kind: 'write', pc, address, width, value };
    ioRequests.push(request);
    accesses.push({ ...request, kind: 'io-write', label });
  };
  const fetch = () => {
    const opcodeWord = streamWord('fresh-next-opcode');
    ctx.y = (ctx.y + 1) & 65535;
    ctx.a = ctx.x = opcodeWord & 255;
    ctx.status = (ctx.status & ~0x82) | (ctx.a === 0 ? 2 : 0);
    ctx.pc = 0xf390;
    return {
      opcodeWord,
      frontier: '80:F390',
      scope: 'manual-handler-prefix-before-indexed-dispatch',
      dynamicDispatchExecuted: false,
    };
  };
  try {
    const result = algorithm({
      ctx,
      entry,
      read,
      write,
      readWord,
      writeWord,
      stackWord,
      pullWord,
      pushWord,
      streamWord,
      fetch,
      tick,
      absoluteRead,
      absoluteWrite,
    });
    if (ioObservations !== null && observationIndex !== ioObservations.length)
      taskStop('task_io_observation_unused', { observationIndex });
    const plan = view.finish({
      handled: true,
      entry,
      ...result,
      outputContext: Object.freeze({ ...ctx }),
      work,
      outputBytes,
      accesses: Object.freeze(accesses.map((a) => Object.freeze(a))),
      ...(ioRequests.length || ioObservations !== null
        ? {
            ioRequests: Object.freeze(ioRequests.map((r) => Object.freeze(r))),
            observationsUsed: observationIndex,
          }
        : {}),
      fullTaskBinding: false,
      globalStackMinimum: null,
    });
    taskPlans.set(plan, data);
    return plan;
  } catch (error) {
    if (!error?.taskBoundary && !error?.renderBoundary) throw error;
    const { taskBoundary, renderBoundary, ...boundary } = error;
    return { handled: false, ...boundary };
  }
}

export function commitTaskPlan(data, plan) {
  if (!plan || taskPlans.get(plan) !== data)
    return { handled: false, reason: 'task_plan_owner_required' };
  const result = data.commit(plan);
  if (!result.handled)
    return {
      handled: false,
      reason: result.reason === 'render_plan_stale' ? 'task_plan_stale' : result.reason,
    };
  latestCommittedPlans.set(data, plan);
  return { handled: true, outputContext: plan.outputContext };
}
