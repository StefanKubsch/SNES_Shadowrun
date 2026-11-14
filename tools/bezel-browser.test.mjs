import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findEdge, withStartPage } from './browser-frame.mjs';

const edge = findEdge();
test(
  'window zoom doubles the picture and bezel, persists and resumes after fullscreen',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      const snapshot = () =>
        evalJs(`(async()=>{
        await document.querySelector('#pvm-bezel').decode();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const canvas=document.querySelector('#screen'),crt=canvas.crt;
        const surface=document.querySelector('#monitor').getBoundingClientRect();
        const box=canvas.getBoundingClientRect(),art=document.querySelector('#pvm-bezel').getBoundingClientRect();
        const menuBox=document.querySelector('#menu-toggle').getBoundingClientRect();
        const css=getComputedStyle(canvas);
        const width=box.width-parseFloat(css.borderLeftWidth)-parseFloat(css.borderRightWidth);
        const height=box.height-parseFloat(css.borderTopWidth)-parseFloat(css.borderBottomWidth);
        const {sourceToOutput}=await import('/src/crt/geometry.mjs');
        const {SNES_PAL_RGB}=await import('/src/crt/profiles.mjs');
        let mouseError=0;
        for(const [x,y] of [[0.5,0.5],[64.5,160.5],[255.5,223.5]]){
          const projected=sourceToOutput(crt.layout,SNES_PAL_RGB,x,y);
          const source=crt.toSource(box.left+parseFloat(css.borderLeftWidth)+projected.x*width,
            box.top+parseFloat(css.borderTopWidth)+projected.y*height);
          mouseError=Math.max(mouseError,Math.abs(source.x-x),Math.abs(source.y-y));
        }
        return {front:[surface.width,surface.height],canvas:[width,height],art:[art.width,art.height],
          left:surface.left+scrollX,device:[canvas.width,canvas.height],dpr:devicePixelRatio,mouseError,
          menuOffset:[menuBox.left-surface.right,menuBox.top-surface.top],
          bezel:document.querySelector('#monitor').dataset.bezel,crt:crt.enabled,available:crt.available,
          label:document.querySelector('#window-zoom').textContent,
          pressed:document.querySelector('#window-zoom').getAttribute('aria-pressed'),
          stored:localStorage.getItem('shadowrun.window.zoom.1'),full:document.fullscreenElement?.id??null};
      })()`);
      const base = await snapshot();
      assert.ok(base.available, 'float-target CRT is required');
      assert.equal(base.label, 'Window zoom: 100%');
      assert.equal(base.pressed, 'false');
      assert.equal(base.stored, null);
      assert.equal(base.front[0], 640);
      assert.deepEqual(
        base.menuOffset,
        [0, 0],
        'Options sits just outside the upper right bezel corner',
      );
      await evalJs(`document.querySelector('#window-zoom').click()`);
      const doubled = await snapshot();
      assert.equal(doubled.label, 'Window zoom: 200%');
      assert.equal(doubled.pressed, 'true');
      assert.equal(doubled.stored, '2');
      assert.deepEqual(doubled.menuOffset, [0, 0], 'Options follows the enlarged bezel corner');
      for (const part of ['front', 'canvas', 'art'])
        for (let axis = 0; axis < 2; axis++)
          assert.ok(Math.abs(doubled[part][axis] - base[part][axis] * 2) < 0.1, part);
      assert.ok(
        doubled.mouseError < 1e-6,
        'zoom preserves source-coordinate mapping: ' + JSON.stringify(doubled),
      );
      for (let axis = 0; axis < 2; axis++)
        assert.ok(Math.abs(doubled.device[axis] - doubled.canvas[axis] * doubled.dpr) <= 1);
      const shot = await cdp.call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      });
      await writeFile(join(logDir, 'bezel-window-200.png'), Buffer.from(shot.data, 'base64'));

      await cdp.call('Page.reload');
      const deadline = Date.now() + 10000;
      let reloaded = false;
      while (Date.now() < deadline) {
        try {
          reloaded = await evalJs(
            `!!document.querySelector('#screen')?.crt && document.querySelector('#window-zoom')?.textContent==='Window zoom: 200%'`,
          );
        } catch (error) {
          if (!/context|navigat/i.test(error.message)) throw error;
        }
        if (reloaded) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(reloaded, '200% is restored after reload');
      assert.deepEqual((await snapshot()).front, doubled.front);
      await cdp.call('Runtime.evaluate', {
        expression: "document.querySelector('#fullscreen').click()",
        userGesture: true,
      });
      await evalJs(`new Promise(resolve=>setTimeout(resolve,500))`);
      const full = await snapshot();
      const limit = await evalJs(`Math.min(innerWidth,innerHeight*1162/920)`);
      assert.equal(full.full, 'frame');
      assert.ok(Math.abs(full.front[0] - limit) < 0.1, 'fullscreen ignores window zoom');
      await evalJs(`document.exitFullscreen()`);
      assert.deepEqual((await snapshot()).front, doubled.front);

      await evalJs(`document.querySelector('#bezel').click()`);
      const bare = await snapshot();
      assert.equal(bare.bezel, 'off');
      assert.equal(bare.canvas[0], 1280, 'frame-free CRT keeps the zoom');
      assert.ok(bare.mouseError < 1e-6);
      await evalJs(`document.querySelector('#crt').click()`);
      const plain = await snapshot();
      assert.equal(plain.crt, false);
      assert.equal(plain.canvas[0], 1280);
      assert.ok(Math.abs(plain.canvas[0] / plain.canvas[1] - 256 / 224) < 1e-6);
      await evalJs(`document.querySelector('#window-zoom').click()`);
      const reset = await snapshot();
      assert.equal(reset.canvas[0], 640);
      assert.equal(reset.label, 'Window zoom: 100%');
      assert.equal(reset.stored, '1');

      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 400,
        height: 600,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await evalJs(
        `document.querySelector('#crt').click();document.querySelector('#bezel').click()`,
      );
      const narrow = await snapshot();
      assert.equal(narrow.front[0], 360);
      await evalJs(`document.querySelector('#window-zoom').click()`);
      const narrowZoom = await snapshot();
      assert.equal(narrowZoom.front[0], 720);
      assert.deepEqual(narrowZoom.menuOffset, [0, 0], 'Options stays attached in narrow windows');
      assert.ok(narrowZoom.left >= 0, 'the left edge remains reachable');
      const scrolled = await evalJs(
        `scrollTo(10000,0);({x:scrollX,width:document.documentElement.scrollWidth,view:innerWidth})`,
      );
      assert.ok(scrolled.x > 0, 'the enlarged view can be scrolled horizontally');
      assert.ok(
        scrolled.width - scrolled.x <= scrolled.view + 1,
        'the right edge remains reachable',
      );
      assert.ok(narrowZoom.mouseError < 1e-6);
      const menuPoint =
        await evalJs(`(()=>{const button=document.querySelector('#menu-toggle'),box=button.getBoundingClientRect();
        const x=box.left+box.width/2,y=box.top+box.height/2;
        return {x,y,hit:button.contains(document.elementFromPoint(x,y))};})()`);
      assert.ok(menuPoint.hit, 'the attached button remains reachable by scrolling');
      for (const type of ['mousePressed', 'mouseReleased'])
        await cdp.call('Input.dispatchMouseEvent', {
          type,
          x: menuPoint.x,
          y: menuPoint.y,
          button: 'left',
          clickCount: 1,
        });
      assert.ok(
        await evalJs(`!document.querySelector('#menu').hidden`),
        'a real click opens Options',
      );
      console.log(JSON.stringify({ base, doubled, full, narrowZoom, logDir }));
    });
  },
);

test(
  'the photographic bezel follows CRT, preserves input geometry, persists its preference and fits fullscreen',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs, logDir }) => {
      const shown = await evalJs(`(async()=>{
      const canvas=document.querySelector('#screen'),crt=canvas.crt,image=document.querySelector('#pvm-bezel');
      await image.decode();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!crt.available)throw Error('Float-target CRT required for bezel test');
      const pixels=new Uint8ClampedArray(256*224*4);
      for(let y=0;y<224;y++)for(let x=0;x<256;x++)pixels.set([x,y,(x+y)&255,255],(y*256+x)*4);
      crt.setOverlay(null);crt.draw(pixels);
      const screen=canvas.getBoundingClientRect(),surface=document.querySelector('#monitor').getBoundingClientRect();
      const art=image.getBoundingClientRect();
      const {sourceToOutput,outputToSource}=await import('/src/crt/geometry.mjs');
      const {SNES_PAL_RGB}=await import('/src/crt/profiles.mjs');
      const p=crt.layout.bounds??crt.layout.picture,mask=document.createElement('canvas');mask.width=image.naturalWidth;mask.height=image.naturalHeight;
      const context=mask.getContext('2d');context.drawImage(image,0,0);const alpha=context.getImageData(0,0,mask.width,mask.height).data;
      const at=(x,y)=>alpha[(Math.floor(y)*mask.width+Math.floor(x))*4+3];
      let maxMouseError=0,maxPictureAlpha=0;
      for(const sx of [0.5,64.5,128.5,255.5])for(const sy of [0.5,80.5,160.5,223.5]){
        const projected=sourceToOutput(crt.layout,SNES_PAL_RGB,sx,sy);
        const x=screen.left+projected.x*screen.width,y=screen.top+projected.y*screen.height;
        const source=crt.toSource(x,y);maxMouseError=Math.max(maxMouseError,Math.abs(source.x-sx),Math.abs(source.y-sy));
        maxPictureAlpha=Math.max(maxPictureAlpha,at((x-art.left)/art.width*mask.width,(y-art.top)/art.height*mask.height));
      }
      const firstX=Math.ceil((screen.left+p.x*screen.width-art.left)/art.width*mask.width);
      const lastX=Math.floor((screen.left+(p.x+p.width)*screen.width-art.left)/art.width*mask.width);
      const firstY=Math.ceil((screen.top+p.y*screen.height-art.top)/art.height*mask.height);
      const lastY=Math.floor((screen.top+(p.y+p.height)*screen.height-art.top)/art.height*mask.height);
      // The curved picture does not occupy the corners of its enclosing box.
      // Check every matte pixel whose centre actually projects into the source.
      for(let y=firstY;y<=lastY;y++)for(let x=firstX;x<=lastX;x++){
        const u=(art.left+(x+0.5)/mask.width*art.width-screen.left)/screen.width;
        const v=(art.top+(y+0.5)/mask.height*art.height-screen.top)/screen.height;
        const source=outputToSource(crt.layout,SNES_PAL_RGB,u,v);
        if(source.x>=0&&source.x<=256&&source.y>=0&&source.y<=224)maxPictureAlpha=Math.max(maxPictureAlpha,at(x,y));
      }
      const middleY=Math.floor(mask.height*0.4825),middleX=Math.floor(mask.width/2);
      let holeLeft=middleX,holeRight=middleX;
      while(holeLeft>0&&at(holeLeft-1,middleY)<16)holeLeft--;
      while(holeRight+1<mask.width&&at(holeRight+1,middleY)<16)holeRight++;
      const openingCoverage=(lastX-firstX+1)/(holeRight-holeLeft+1);
      const pictureHit=document.elementFromPoint(screen.left+screen.width/2,screen.top+screen.height/2)===canvas;
      const cabinetHit=document.elementFromPoint(screen.left+screen.width/2,screen.top+1)===canvas;
      const baseline={visible:document.querySelector('#monitor').dataset.bezel,pressed:document.querySelector('#bezel').getAttribute('aria-pressed'),
        pointer:getComputedStyle(image).pointerEvents,ratio:screen.width/screen.height,maxMouseError,maxPictureAlpha,openingCoverage,pictureHit,cabinetHit,
        frontAspect:surface.width/surface.height,imageAspect:art.width/art.height,
        cleared:[at(600,80),at(600,1140),at(145,600),at(1110,600),at(627,959)],
        alpha:[at(0,0),at(mask.width/2,mask.height/2),at(mask.width/2,mask.height*0.15)]};
      document.querySelector('#bezel').click();
      const off={visible:document.querySelector('#monitor').dataset.bezel,stored:localStorage.getItem('shadowrun.crt.bezel.1')};
      window.bezelBeforeReload=true;
      return {baseline,off};})()`);
      assert.equal(shown.baseline.visible, 'on');
      assert.equal(shown.baseline.pressed, 'true');
      assert.equal(shown.baseline.pointer, 'none');
      assert.equal(shown.baseline.pictureHit, true, 'the picture receives pointer input');
      assert.equal(
        shown.baseline.cabinetHit,
        false,
        'the canvas padding under the cabinet cannot receive clicks',
      );
      assert.ok(Math.abs(shown.baseline.ratio - 4 / 3) < 0.0001);
      assert.ok(
        Math.abs(shown.baseline.frontAspect - 1162 / 920) < 0.0001,
        'tight front view retains its original proportions',
      );
      assert.ok(
        Math.abs(shown.baseline.imageAspect - 1) < 0.0001,
        'the square source artwork is never stretched',
      );
      assert.ok(
        shown.baseline.cleared.every((alpha) => alpha <= 1),
        'the lid, control deck and inner grey strips are clear to the existing one-alpha-unit matte tolerance',
      );
      assert.ok(shown.baseline.maxMouseError < 1e-6, JSON.stringify(shown.baseline));
      // The generated matte has one-alpha-unit fringes near the glass edge.
      // Permit that <0.4% opacity, while rejecting cabinet coverage or cropping.
      assert.ok(
        shown.baseline.maxPictureAlpha <= 1,
        'the complete active picture remains visible through the opening: ' +
          JSON.stringify(shown.baseline),
      );
      assert.ok(
        shown.baseline.openingCoverage > 0.97 && shown.baseline.openingCoverage < 1,
        'the active game picture nearly fills the photographic opening: ' +
          shown.baseline.openingCoverage,
      );
      assert.deepEqual(shown.baseline.alpha.slice(0, 2), [0, 0]);
      assert.ok(shown.baseline.alpha[2] > 240, 'the cabinet stays opaque');
      assert.deepEqual(shown.off, { visible: 'off', stored: 'off' });

      await cdp.call('Page.reload');
      let reloaded = false;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        try {
          reloaded = await evalJs(
            `!window.bezelBeforeReload&&!!document.querySelector('#screen')?.crt&&document.querySelector('#pvm-bezel')?.complete`,
          );
        } catch (error) {
          if (!/context|navigat/i.test(error.message)) throw error;
        }
        if (reloaded) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.ok(reloaded, 'the bezel preference page reloaded');
      const toggled = await evalJs(`(async()=>{
      const surface=document.querySelector('#monitor'),button=document.querySelector('#bezel');
      const restored={visible:surface.dataset.bezel,pressed:button.getAttribute('aria-pressed')};
      button.click();
      dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));
      const crtOff={visible:surface.dataset.bezel,disabled:button.disabled,pressed:button.getAttribute('aria-pressed')};
      dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));
      const crtOn={visible:surface.dataset.bezel,disabled:button.disabled,stored:localStorage.getItem('shadowrun.crt.bezel.1')};
      const image=document.querySelector('#pvm-bezel'),original=image.src;
      image.src='/assets/missing-bezel.png';await new Promise(resolve=>image.addEventListener('error',resolve,{once:true}));
      const failed={visible:surface.dataset.bezel,crt:document.querySelector('#screen').crt.available,disabled:button.disabled};
      image.src=original;await image.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const {createBezel}=await import('/src/browser/bezel.mjs');
      const detached=document.createElement('div'),control=document.createElement('button'),copy=new Image();copy.src=original;await copy.decode();
      const unavailable=createBezel(detached,copy,control);unavailable.sync({available:false,enabled:false});
      return {restored,crtOff,crtOn,failed,unavailable:{visible:detached.dataset.bezel,hidden:control.hidden}};})()`);
      assert.deepEqual(toggled.restored, { visible: 'off', pressed: 'false' });
      assert.deepEqual(toggled.crtOff, { visible: 'off', disabled: true, pressed: 'true' });
      assert.deepEqual(toggled.crtOn, { visible: 'on', disabled: false, stored: 'on' });
      assert.deepEqual(toggled.failed, { visible: 'off', crt: true, disabled: true });
      assert.deepEqual(toggled.unavailable, { visible: 'off', hidden: true });

      await cdp.call('Runtime.evaluate', {
        expression: "document.querySelector('#fullscreen').click()",
        userGesture: true,
      });
      const full = await evalJs(`new Promise(resolve=>setTimeout(()=>{
      const canvas=document.querySelector('#screen'),surface=document.querySelector('#monitor').getBoundingClientRect(),box=canvas.getBoundingClientRect();
      const screen=canvas.crt.toSource(box.left+box.width/2,box.top+box.height/2);
      const aspect=1162/920;
      resolve({full:document.fullscreenElement?.id,width:surface.width,height:surface.height,limit:Math.min(innerWidth/aspect,innerHeight),
        canvasRatio:box.width/box.height,canvasHeight:box.height,picture:screen});},500))`);
      assert.equal(full.full, 'frame');
      assert.ok(
        Math.abs(full.width - (full.limit * 1162) / 920) < 0.1,
        'the front fills the limiting viewport dimension',
      );
      assert.ok(Math.abs(full.height - full.limit) < 0.1);
      assert.ok(Math.abs(full.canvasRatio - 4 / 3) < 0.0001);
      assert.ok(full.canvasHeight < full.limit, 'the complete cabinet has its own space');
      assert.ok(Math.abs(full.picture.x - 128) < 1e-6 && Math.abs(full.picture.y - 112) < 1e-6);
      const pixels = await evalJs(
        `(()=>{const c=document.querySelector('#screen'),p=new Uint8ClampedArray(256*224*4);for(let y=0;y<224;y++)for(let x=0;x<256;x++)p.set([x,y,(x+y)&255,255],(y*256+x)*4);c.crt.setOverlay(null);c.crt.draw(p);return true;})()`,
      );
      assert.equal(pixels, true);
      const shot = await cdp.call('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      await writeFile(join(logDir, 'bezel-fullscreen.png'), Buffer.from(shot.data, 'base64'));
      await evalJs(
        `dispatchEvent(new KeyboardEvent('keydown',{code:'F9'}));new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`,
      );
      const plain = await evalJs(
        `(()=>{const c=document.querySelector('#screen');return {visible:document.querySelector('#monitor').dataset.bezel,height:c.clientHeight,screen:innerHeight,ratio:c.getBoundingClientRect().width/c.getBoundingClientRect().height};})()`,
      );
      assert.equal(plain.visible, 'off');
      assert.equal(plain.height, plain.screen);
      assert.ok(Math.abs(plain.ratio - 256 / 224) < 0.0001);
      console.log(JSON.stringify({ baseline: shown.baseline, fullscreen: full, logDir }));
    });
  },
);
