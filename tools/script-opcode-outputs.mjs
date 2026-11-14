// Shared intended paths, independent of whether identical reports need a write.
export function scriptOpcodeOutputPlan(specs) {
  const seen = new Set();
  for (const spec of specs) {
    if (!Number.isInteger(spec.id) || spec.id < 0 || spec.id > 0xFFFF || seen.has(spec.id)) {
      throw Error('Invalid or duplicate Script52 ID');
    }
    seen.add(spec.id);
  }
  const paths = stem => ({source: `analysis/render-task-${stem}.json`,
    native: `analysis/render-task-${stem}-native.json`});
  return {
    blocks: [null, ...specs].map(spec => ({spec,
      ...paths(spec ? 'script-opcode-' + spec.id.toString(16).padStart(3, '0') : 'script-opcode')})),
    continuation: paths('script-continuation'),
  };
}

export function scriptOpcodeOutputDeclarations(specs) {
  const {blocks, continuation} = scriptOpcodeOutputPlan(specs);
  return [
    ['analyze', 'source'], ['probe', 'native'],
  ].map(([role, field]) => ({
    name: `${role}:render-task-script-opcode`,
    command: `node tools/${role}-render-task-script-opcode.mjs`,
    definition: 'tools/script-opcode-outputs.mjs',
    inputs: ['tools/script-opcode-specs.json'],
    outputs: [...blocks, continuation].map(block => block[field]),
  }));
}
