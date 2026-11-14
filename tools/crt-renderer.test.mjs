import test from 'node:test';
import assert from 'node:assert/strict';
import { findEdge, withStartPage } from './browser-frame.mjs';
import { createCrt } from '../src/crt/crt.mjs';
import { SNES_PAL_RGB, SONY_PVM_20M2E } from '../src/crt/profiles.mjs';

// Renderer boundaries of src/crt/crt.mjs (docs/CRT-FILTER.md, Renderer review).
// Profile checks run before any canvas access, so Node needs no browser.
const rejects = (options, pattern) =>
  assert.throws(() => createCrt({}, { source: SNES_PAL_RGB, ...options }), pattern);

test('the renderer rejects unknown outputs and profiles beyond the shader limits', () => {
  rejects({ output: 'rec2020' }, /unknown output rec2020/);
  rejects(
    { monitor: { ...SONY_PVM_20M2E, curvature: { radiusMm: 100, viewingDistanceMm: 600 } } },
    /cylinder requires/,
  );
  rejects({ source: { ...SNES_PAL_RGB, levelBits: 9 }, monitor: SONY_PVM_20M2E }, /levelBits 9/);
  rejects(
    { monitor: { ...SONY_PVM_20M2E, rgbBandwidthHz: 1000 } },
    /light reach \d+ exceeds shader limit 64/,
  );
  rejects(
    { monitor: { ...SONY_PVM_20M2E, resolutionTvLines: 40 } },
    /spot reach \d+ exceeds shader limit 64/,
  );
  rejects(
    { monitor: { ...SONY_PVM_20M2E, halation: { sigmaMm: 60, energy: 0.05 } } },
    /halo reach \d+ exceeds shader limit 128/,
  );
  rejects(
    { monitor: { ...SONY_PVM_20M2E, damperWires: { positions: [0.2, 0.5, 0.8], widthMm: 0.05 } } },
    /damper wire count 3 exceeds shader limit 2/,
  );
});

// Real Edge/WebGL2. An asymmetric colour detects a wrong colour-space tag:
// drawImage into an sRGB 2D canvas converts a P3-tagged buffer, but leaves an
// sRGB buffer bit exact. P3 to sRGB uses the CSS Color 4 matrices.
const edge = findEdge();
test(
  'the renderer tags only tube output as Display P3, skips zero halation, matches the reference when minified and releases its GPU objects',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    const result = await withStartPage({ exe: edge, commandTimeout: 30000 }, ({ evalJs }) =>
      evalJs(`(async()=>{
      const {createCrt}=await import('/src/crt/crt.mjs');
      const {SNES_PAL_RGB,SONY_PVM_20M2E}=await import('/src/crt/profiles.mjs');
      const {tubeReference}=await import('/src/crt/beam.mjs');
      const {srgbEncode}=await import('/src/crt/signal.mjs');
      const {DISPLAY_P3,SRGB}=await import('/src/crt/colour.mjs');
      // Two animation frames let the canvas take its CSS size. A stall fails
      // after 10 s and names the page state instead of reaching the test limit.
      const frames=()=>new Promise((resolve,reject)=>{
        const stall=setTimeout(()=>reject(Error('animation frames stalled: visibility='+document.visibilityState+', focus='+document.hasFocus())),10000);
        requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(stall);resolve();}));
      });
      const proto=WebGL2RenderingContext.prototype,counts={};
      for(const name of ['texStorage2D','deleteTexture','createFramebuffer','deleteFramebuffer','createProgram','deleteProgram']){
        counts[name]=0;const original=proto[name];proto[name]=function(...args){counts[name]++;return original.apply(this,args);};}
      const make=(monitor,output,width=512,source=SNES_PAL_RGB)=>{
        const canvas=document.createElement('canvas');canvas.style.cssText='display:block;width:'+width+'px';document.body.prepend(canvas);
        for(const key of Object.keys(counts))counts[key]=0;
        const crt=createCrt(canvas,{source,monitor,enabled:true,output});
        return {canvas,crt,gl:canvas.getContext('webgl2'),created:{...counts}};
      };
      // Centre of the picture, redrawn and copied in one task.
      // On the GPU path, drawImage reads a changed colour space tag only after
      // a presented frame (Edge, 2026-11-03), so a tag switch waits for one.
      const shown=({canvas,crt})=>{
        const bytes=crt.snapshot(),copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
        const context=copy.getContext('2d',{colorSpace:'srgb'});context.drawImage(canvas,0,0);
        const x=canvas.width>>1,y=canvas.height>>1,at=(y*canvas.width+x)*4;
        return {raw:[...bytes.subarray(at,at+3)],copied:[...context.getImageData(x,y,1,1).data.subarray(0,3)]};
      };
      const flat=new Uint8ClampedArray(256*224*4);for(let i=0;i<flat.length;i+=4)flat.set([200,60,120,255],i);
      const out={};

      let view=make(SONY_PVM_20M2E,'display-p3');await frames();view.crt.draw(flat);
      out.p3={output:view.crt.output,created:view.created,on:[view.gl.drawingBufferColorSpace,shown(view)]};
      view.crt.setEnabled(false);await frames();view.crt.draw(flat);out.p3.off=[view.gl.drawingBufferColorSpace,shown(view)];
      view.crt.setEnabled(true);await frames();view.crt.draw(flat);out.p3.again=[view.gl.drawingBufferColorSpace,shown(view)];
      // Tube bytes against the reference in Display P3, every 17th row.
      const pattern=new Uint8ClampedArray(256*224*4);
      for(let y=0;y<224;y++)for(let x=0;x<256;x++)pattern.set([x,(y*5)&255,255-x,255],(y*256+x)*4);
      const compare=(crt,canvas,monitor,space,step=17)=>{
        crt.draw(pattern);const bytes=crt.snapshot(),reference=tubeReference(pattern,SNES_PAL_RGB,monitor,space),W=canvas.width,H=canvas.height;
        let diff=0;for(let y=0;y<H;y+=step)for(let x=0;x<W;x++){const light=reference.pixel(crt.layout,W,H,x,y);
          for(let c=0;c<3;c++)diff=Math.max(diff,Math.abs(bytes[(y*W+x)*4+c]-Math.round(srgbEncode(light[c])*255)));}
        return diff;
      };
      out.p3.diff=compare(view.crt,view.canvas,SONY_PVM_20M2E,DISPLAY_P3);
      for(const key of Object.keys(counts))counts[key]=0;
      view.crt.destroy();view.crt.destroy();out.p3.deleted={...counts};
      try{view.crt.draw(flat);out.p3.afterDestroy='drawn';}catch(error){out.p3.afterDestroy=error.message;}
      view.canvas.remove();

      view=make(SONY_PVM_20M2E,'srgb');await frames();view.crt.draw(flat);
      out.srgb={output:view.crt.output,on:[view.gl.drawingBufferColorSpace,shown(view)]};
      view.crt.setEnabled(false);out.srgb.off=[view.gl.drawingBufferColorSpace,shown(view)];
      view.crt.destroy();view.canvas.remove();

      // Zero halation energy (its oversized sigma is then unused), one damper
      // wire and no convergence: fewer passes, same reference.
      const reduced={...SONY_PVM_20M2E,halation:{sigmaMm:60,energy:0},convergence:null,damperWires:{positions:[0.5],widthMm:0.05}};
      view=make(reduced,'srgb');await frames();
      out.reduced={created:view.created,diff:compare(view.crt,view.canvas,reduced,SRGB)};
      view.crt.destroy();view.canvas.remove();

      // A 64 x 48 canvas: each output pixel covers about 4.5 source pixels
      // and 6.3 lines, so both output-area integrals carry many samples.
      view=make(SONY_PVM_20M2E,'srgb',64);await frames();
      out.minified={size:[view.canvas.width,view.canvas.height],diff:compare(view.crt,view.canvas,SONY_PVM_20M2E,SRGB,1)};
      // Resize through both old BEAM limits, including one output pixel.
      // The same renderer must recover its original output afterwards.
      out.tiny=[];
      for(const width of [12,4,1,64]){
        view.canvas.style.width=width+'px';await frames();
        out.tiny.push({size:[view.canvas.width,view.canvas.height],diff:compare(view.crt,view.canvas,SONY_PVM_20M2E,SRGB,1)});
      }
      view.crt.destroy();view.canvas.remove();

      // A synthetic profile with sigma two source pixels has substantial
      // voltage beyond seven intervals and needs larger intermediate margins.
      const source={...SNES_PAL_RGB,width:32,height:24,dotClockHz:32,standard:{activeLineS:1,activeLines:24,aspect:4/3}};
      const broad={...SONY_PVM_20M2E,rgbBandwidthHz:32*Math.sqrt(Math.LN2)/(4*Math.PI),resolutionTvLines:4,resolutionContrast:0.4,halation:null,convergence:null,damperWires:null};
      const pixels=new Uint8ClampedArray(32*24*4);
      for(let y=0;y<24;y++)for(let x=0;x<32;x++)pixels.set([255,x<16?255:0,(x*8)&255,255],(y*32+x)*4);
      view=make(broad,'srgb',64,source);await frames();view.crt.setControls({brightness:0.1,contrast:1.2});view.crt.draw(pixels);
      const bytes=view.crt.snapshot(),ref=tubeReference(pixels,source,broad,SRGB,{brightness:0.1,contrast:1.2});
      let diff=0;for(let y=0;y<view.canvas.height;y++)for(let x=0;x<view.canvas.width;x++){
        const light=ref.pixel(view.crt.layout,view.canvas.width,view.canvas.height,x,y);
        for(let c=0;c<3;c++)diff=Math.max(diff,Math.abs(bytes[(y*view.canvas.width+x)*4+c]-Math.round(srgbEncode(light[c])*255)));}
      out.broadDiff=diff;view.crt.destroy();view.canvas.remove();
      return out;})()`),
    );
    const { p3, srgb, reduced, minified, tiny, broadDiff } = result;
    const decode = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const encode = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
    // CSS Color 4 section 19: linear Display P3 to linear sRGB via XYZ, rounded.
    const p3ToSrgb = [
      [1.2249401, -0.2249404, 0],
      [-0.0420569, 1.0420571, 0],
      [-0.0196376, -0.0786361, 1.0982735],
    ];
    const converted = (bytes) => {
      const linear = bytes.map((v) => decode(v / 255));
      return p3ToSrgb.map((row) =>
        Math.round(
          255 *
            encode(
              Math.min(
                1,
                Math.max(
                  0,
                  row.reduce((s, m, i) => s + m * linear[i], 0),
                ),
              ),
            ),
        ),
      );
    };
    const near = (actual, expected, message) =>
      assert.ok(
        actual.every((v, i) => Math.abs(v - expected[i]) <= 1),
        `${message}: ${actual} vs ${expected}`,
      );

    assert.equal(p3.output, 'display-p3');
    assert.equal(p3.on[0], 'display-p3', 'tube output tags the drawing buffer as Display P3');
    near(p3.on[1].copied, converted(p3.on[1].raw), 'P3-tagged tube bytes are converted for sRGB');
    assert.notDeepEqual(p3.on[1].copied, p3.on[1].raw, 'the asymmetric colour detects the tag');
    assert.equal(p3.off[0], 'srgb', 'disabling the tube restores sRGB');
    assert.deepEqual(
      p3.off[1],
      { raw: [200, 60, 120], copied: [200, 60, 120] },
      'plain bytes are shown as sRGB',
    );
    assert.equal(p3.again[0], 'display-p3');
    assert.deepEqual(p3.again[1], p3.on[1], 'enabling again restores the P3 picture');
    assert.ok(p3.diff <= 2, `P3 tube output differs from the reference by ${p3.diff}`);

    assert.equal(srgb.output, 'srgb');
    assert.equal(srgb.on[0], 'srgb');
    assert.deepEqual(srgb.on[1].copied, srgb.on[1].raw, 'sRGB tube bytes are not converted');
    assert.deepEqual(srgb.off, ['srgb', { raw: [200, 60, 120], copied: [200, 60, 120] }]);

    // Frame, light, spot and three halo targets; programs PLAIN, LIGHT, SPOT,
    // HALO_BASE, two HALO_BLUR and BEAM. destroy() deletes each exactly once.
    assert.deepEqual(p3.created, {
      texStorage2D: 6,
      deleteTexture: 0,
      createFramebuffer: 5,
      deleteFramebuffer: 0,
      createProgram: 7,
      deleteProgram: 0,
    });
    assert.deepEqual(p3.deleted, {
      texStorage2D: 0,
      deleteTexture: 6,
      createFramebuffer: 0,
      deleteFramebuffer: 5,
      createProgram: 0,
      deleteProgram: 7,
    });
    assert.equal(p3.afterDestroy, 'crt: renderer was destroyed');
    assert.deepEqual(reduced.created, {
      texStorage2D: 3,
      deleteTexture: 0,
      createFramebuffer: 2,
      deleteFramebuffer: 0,
      createProgram: 4,
      deleteProgram: 0,
    });
    assert.ok(reduced.diff <= 2, `reduced profile differs from the reference by ${reduced.diff}`);
    assert.deepEqual(minified.size, [64, 48]);
    assert.ok(minified.diff <= 2, `minified output differs from the reference by ${minified.diff}`);
    for (const item of tiny)
      assert.ok(item.diff <= 2, `tiny output ${item.size} differs by ${item.diff}`);
    assert.deepEqual(
      tiny.map((item) => item.size),
      [
        [12, 9],
        [4, 3],
        [1, 1],
        [64, 48],
      ],
    );
    assert.ok(
      broadDiff <= 2,
      `wide electronics profile differs from the reference by ${broadDiff}`,
    );
  },
);
