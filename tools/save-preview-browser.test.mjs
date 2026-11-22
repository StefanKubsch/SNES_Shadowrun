import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withStartPage, findEdge } from './browser-frame.mjs';
import { saveToText } from '../src/browser/save-file.mjs';

const edge = findEdge();
const waitFor = (expression) =>
  `new Promise((resolve,reject)=>{const end=Date.now()+15000;const check=()=>{if(${expression})resolve(true);else if(Date.now()>end)reject(Error('Preview condition timed out: '+${JSON.stringify(expression)}));else setTimeout(check,25);};check();})`;

test(
  'slot previews encode, persist, localize and fit narrow cards without entering SRAM',
  { skip: edge ? false : 'Microsoft Edge not found', timeout: 120000 },
  async () => {
    const source = saveToText(
      new Uint8Array(await readFile(new URL('./mesen/saves/apartment.srm', import.meta.url))),
    );
    await withStartPage({ exe: edge, commandTimeout: 30000 }, async ({ cdp, evalJs }) => {
      await evalJs(`(async()=>{
      const {encodeSavePreview,PREVIEW_WIDTH,PREVIEW_HEIGHT}=await import('/src/browser/save-preview.mjs');
      const {updateSaveDetails,SAVE_DETAILS_KEY}=await import('/src/browser/save-details.mjs');
      const {fromBase64,saveToText,SAVE_KEY,SAVE_EXTRA_KEY}=await import('/src/browser/save-file.mjs');
      const {RGBA_BYTES}=await import('/src/constants/ppu.mjs');
      const original=fromBase64(${JSON.stringify(source)}), bytes=new Uint8Array(0x4000);
      bytes.set(original);for(const offset of [0x0ffe,0x2000,0x2ffe])bytes.set(original.subarray(0,0x0ffe),offset);
      const pixels=new Uint8ClampedArray(PREVIEW_WIDTH*PREVIEW_HEIGHT*RGBA_BYTES);
      for(let i=0;i<pixels.length;i+=RGBA_BYTES){pixels[i]=180;pixels[i+1]=70;pixels[i+2]=30;pixels[i+3]=255;}
      const preview=encodeSavePreview({room:345,pixels},document);
      if(!preview)throw Error('PNG encoding failed');
      localStorage.setItem(SAVE_KEY,saveToText(bytes.subarray(0,0x2000)));
      localStorage.setItem(SAVE_EXTRA_KEY,saveToText(bytes.subarray(0x2000)));
      localStorage.setItem(SAVE_DETAILS_KEY,JSON.stringify(updateSaveDetails(null,bytes,[],'2026-11-22T12:00:00.000Z',preview)));
      window.previewBeforeReload=preview.image;
      window.sramBeforeReload=localStorage.getItem(SAVE_KEY);
    })()`);
      const encoded = await evalJs('window.previewBeforeReload');
      const sramText = await evalJs('window.sramBeforeReload');
      assert.match(encoded, /^data:image\/png;base64,/);
      await cdp.call('Page.reload');
      await new Promise((resolve) => setTimeout(resolve, 250));
      await evalJs(
        waitFor(
          "document.querySelector('#screen')?.dataset.stage==='data' && document.querySelector('#save-slot-list img')?.complete",
        ),
      );
      await evalJs(
        "document.querySelector('#menu-toggle').click();document.querySelector('#saves-settings-open').click()",
      );
      await evalJs(waitFor("document.querySelector('#save-slot-list img')?.naturalWidth>0"));
      const cards =
        await evalJs(`Array.from(document.querySelectorAll('#save-slot-list > section')).map(card=>({
      hidden:card.hidden,text:card.textContent,src:card.querySelector('img').getAttribute('src'),
      imageHidden:card.querySelector('img').hidden,width:card.querySelector('img').naturalWidth,height:card.querySelector('img').naturalHeight
    }))`);
      assert.deepEqual([cards[0].width, cards[0].height], [128, 112]);
      assert.equal(cards[0].src, encoded);
      assert.equal(cards[3].src, encoded);
      assert.equal(cards[3].hidden, false, 'stored fourth slot stays visible with two-slot option');
      assert.match(cards[3].text, /Requires four slots/);
      assert.equal(cards[1].imageHidden, false);
      assert.equal(cards[1].src, encoded);
      assert.equal(
        await evalJs("localStorage.getItem('shadowrun.sram.1')"),
        sramText,
        'PNG is outside SRAM',
      );
      await cdp.call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: false,
      });
      assert.equal(
        await evalJs(
          `(()=>{const list=document.querySelector('#save-slot-list');return list.scrollWidth<=list.clientWidth;})()`,
        ),
        true,
      );
      await evalJs(
        "document.querySelector('#saves-settings-close').click();document.querySelector('#language').click()",
      );
      await evalJs(
        waitFor("document.querySelector('#save-slot-title-0')?.textContent==='Spielstand 1'"),
      );
      assert.equal(
        await evalJs("document.querySelector('#save-slot-list img').alt"),
        'Spielszene zu Spielstand 1',
      );
      assert.equal(
        await evalJs("document.querySelector('#save-slot-list img').getAttribute('src')"),
        encoded,
      );
      await evalJs(
        "document.querySelector('#saves-settings-open').click();document.querySelector('#four-save-slots').click();for(const button of document.querySelectorAll('#save-slot-list button'))button.hidden=false",
      );
      assert.equal(
        await evalJs(
          "Array.from(document.querySelectorAll('#save-slot-list button')).every(button=>button.textContent==='Speichern')",
        ),
        true,
        'slot number appears only in the heading',
      );
      for (const [width, height] of [
        [1280, 720],
        [390, 720],
        [390, 844],
      ]) {
        await cdp.call('Emulation.setDeviceMetricsOverride', {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
        });
        const fit = await evalJs(`(()=>{
        const body=document.querySelector('#saves'),dialog=body.closest('dialog'),r=dialog.getBoundingClientRect();
        return {bodyHeight:body.clientHeight,contentHeight:body.scrollHeight,bodyWidth:body.clientWidth,contentWidth:body.scrollWidth,top:r.top,bottom:r.bottom,viewport:innerHeight};
      })()`);
        assert.ok(
          fit.contentHeight <= fit.bodyHeight + 1,
          JSON.stringify({ width, height, ...fit }),
        );
        assert.ok(fit.contentWidth <= fit.bodyWidth + 1, JSON.stringify({ width, height, ...fit }));
        assert.ok(fit.top >= 0 && fit.bottom <= fit.viewport, JSON.stringify(fit));
      }
      await evalJs(
        "document.querySelector('#save-slot-list img').src='data:image/png;base64,AAAA'",
      );
      await evalJs(
        waitFor(
          "document.querySelector('#save-slot-list img').hidden && !document.querySelector('#save-slot-list .save-preview span').hidden",
        ),
      );
    });
  },
);
