// Browser-only test harness for small, isolated shader passes. RGBA32F targets
// expose linear values without output-byte clipping or RGBA16F quantization.
// The function is injected into the test page; helpers stay inside its body.
export function probeCrtShaders(cases, shaders) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false });
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw Error('Float WebGL2 required');
  const results = [];
  try {
    for (const fixture of cases) {
      const program = gl.createProgram();
      const compiled = [];
      const textures = [];
      let framebuffer;
      try {
        for (const [type, source] of [
          [gl.VERTEX_SHADER, shaders.VERTEX],
          [gl.FRAGMENT_SHADER, shaders[fixture.shader]],
        ]) {
          const shader = gl.createShader(type);
          compiled.push(shader);
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw Error(`${fixture.name}: ${gl.getShaderInfoLog(shader)}`);
          gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw Error(`${fixture.name}: ${gl.getProgramInfoLog(program)}`);
        gl.useProgram(program);
        for (const [name, value] of Object.entries(fixture.uniforms)) {
          const location = gl.getUniformLocation(program, name);
          if (Array.isArray(value)) {
            if (value.length === 9) gl.uniformMatrix3fv(location, false, value);
            else gl[`uniform${value.length}f`](location, ...value);
          } else if (name === 'reach') gl.uniform1i(location, value);
          else gl.uniform1f(location, value);
        }
        let unit = 0;
        for (const input of fixture.textures) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          const data = input.bytes ? new Uint8Array(input.bytes) : new Float32Array(input.floats);
          textures.push(makeTexture(gl, input.width, input.height, data, !!input.bytes));
          gl.uniform1i(gl.getUniformLocation(program, input.name), unit++);
        }
        // The output texture gets a distinct, unused unit, so it cannot replace
        // a sampler's input and accidentally create framebuffer feedback.
        gl.activeTexture(gl.TEXTURE0 + unit);
        const output = makeTexture(gl, fixture.width, fixture.height, null, false);
        textures.push(output);
        framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
          throw Error('Incomplete probe target');
        gl.viewport(0, 0, fixture.width, fixture.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        const pixels = new Float32Array(fixture.width * fixture.height * 4);
        gl.readPixels(0, 0, fixture.width, fixture.height, gl.RGBA, gl.FLOAT, pixels);
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw Error(`${fixture.name}: GL error ${error}`);
        // Raw framebuffer order: row zero is the bottom output row. Data passes
        // use this same row index; final PLAIN/BEAM reverse it through VERTEX.
        results.push({ name: fixture.name, pixels: Array.from(pixels) });
      } finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        if (framebuffer) gl.deleteFramebuffer(framebuffer);
        for (const texture of textures) gl.deleteTexture(texture);
        gl.deleteProgram(program);
        for (const shader of compiled) gl.deleteShader(shader);
      }
    }
    return results;
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function makeTexture(gl, width, height, data, bytes) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      bytes ? gl.RGBA8 : gl.RGBA32F,
      width,
      height,
      0,
      gl.RGBA,
      bytes ? gl.UNSIGNED_BYTE : gl.FLOAT,
      data,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }
}
