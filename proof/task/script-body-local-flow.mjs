// Static source graph only. This never executes bytecode or supplies runtime
// return data: actual 4C/50 stores and fresh reads remain in their handlers.
export function proveLocalBodyFlow(instructions, { native9FResume = false } = {}) {
  const byPC = new Map(instructions.map((i) => [i.pc, i])),
    active = new Set(),
    lengths = new Map(),
    states = [],
    edges = [];
  let maxDepth = 0;
  function visit(pc, stack) {
    const key = pc + ':' + stack.map((s) => s.callPC).join(',');
    if (active.has(key) || stack.length > instructions.length)
      throw Error('Unproved local body cycle/recursion');
    if (lengths.has(key)) return lengths.get(key);
    const i = byPC.get(pc);
    if (!i || states.length >= 65536) throw Error('Unproved local body state');
    active.add(key);
    states.push({ pc, call_stack: stack.map((s) => s.callPC) });
    maxDepth = Math.max(maxDepth, stack.length);
    let successors = [];
    if (i.opcode === 0x52 || (!native9FResume && i.opcode === 0x58 && i.operand === 0x9f))
      throw Error('Unproved local body yield');
    if (i.opcode === 0x56) {
      if (stack.length) throw Error('END with pending local return');
    } else if (i.opcode === 0x50) {
      if (!stack.length) throw Error('Local return without call');
      const top = stack.at(-1);
      successors = [
        { to: top.returnPC, stack: stack.slice(0, -1), kind: 'local_return', callPC: top.callPC },
      ];
    } else if (i.opcode === 0x4c)
      successors = [
        {
          to: i.operand,
          stack: [...stack, { callPC: pc, returnPC: pc + i.length }],
          kind: 'local_call',
        },
      ];
    else if (i.flow === 'jump') successors = [{ to: i.operand, stack, kind: 'jump' }];
    else if (i.flow === 'conditional')
      successors = [
        { to: i.operand, stack, kind: 'conditional' },
        { to: pc + i.length, stack, kind: 'fallthrough' },
      ];
    else if (i.flow === 'next')
      successors = [
        {
          to: pc + i.length,
          stack,
          kind:
            native9FResume && i.opcode === 0x58 && i.operand === 0x9f
              ? 'observed_native9f_resume'
              : 'fallthrough',
        },
      ];
    else throw Error('Unproved local body terminator');
    let longest = 0;
    for (const s of successors) {
      edges.push({
        from: pc,
        to: s.to,
        kind: s.kind,
        call_stack: stack.map((s) => s.callPC),
        ...(s.callPC === undefined ? {} : { call_pc: s.callPC }),
      });
      longest = Math.max(longest, visit(s.to, s.stack));
    }
    active.delete(key);
    lengths.set(key, 1 + longest);
    return 1 + longest;
  }
  const maxHandlers = visit(0, []);
  if (new Set(states.map((s) => s.pc)).size !== instructions.length)
    throw Error('Unreachable original local body instruction');
  return {
    max_handlers: maxHandlers,
    max_local_depth: maxDepth,
    states,
    edges,
    call_sites: instructions
      .filter((i) => i.opcode === 0x4c)
      .map((i) => ({ pc: i.pc, target: i.operand, return_pc: i.pc + i.length })),
    return_sites: instructions.filter((i) => i.opcode === 0x50).map((i) => i.pc),
  };
}
