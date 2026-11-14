// Browser UI is rasterized at the game resolution and composited before CRT
// processing. Semantic HTML remains available to keyboard and screen readers.
import { pixelAspect } from '../crt/geometry.mjs';
import { OPAQUE, RGBA_BYTES, SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants/ppu.mjs';

export const START_BUTTON = { x: 76, y: 148, width: 104, height: 24 };

// Layout of the start screen in game pixels (256 x 224).
const CENTRE_X = SCREEN_WIDTH / 2;
// Logo: at most LOGO_MAX_HEIGHT high and LOGO_MAX_WIDTH wide, from LOGO_TOP.
const LOGO_MAX_HEIGHT = 106,
  LOGO_MAX_WIDTH = 216,
  LOGO_TOP = 18,
  // Text title when the logo is missing, and the "Enhanced" subtitle.
  TITLE_Y = 80,
  SUBTITLE_Y = 134;
// Half a pixel puts a one-pixel stroke on the pixel grid.
const STROKE_ALIGN = 0.5;
// Status message: wrap width, lines and line height; while the game runs it
// sits on a dark box above the bottom edge, before that below the button.
const MESSAGE_WIDTH = 224,
  MESSAGE_LINES_RUNNING = 4,
  MESSAGE_LINES_START = 3,
  MESSAGE_LINE_HEIGHT = 10,
  MESSAGE_BOTTOM_RUNNING = 218,
  MESSAGE_TOP_START = 187,
  MESSAGE_BOX_MARGIN = 8,
  MESSAGE_BOX_TOP = 7;
// RGBA byte offset of the alpha channel.
const ALPHA = 3;
// The loading status is centred inside a single filled track.
const LOADING_BAR = { x: 16, y: 178, width: 224, height: 18 };

export function createStartScreen({ canvas, crt, source, logo, title, start, status, progress }) {
  const raster = document.createElement('canvas');
  raster.width = SCREEN_WIDTH;
  raster.height = SCREEN_HEIGHT;
  const context = raster.getContext('2d', { willReadFrequently: true });
  let running = false,
    hovered = false,
    pressed = false,
    armed = false;

  function lines(text, width, maxLines) {
    const result = [];
    let line = '';
    for (const word of text.trim().split(/\s+/)) {
      const next = line ? line + ' ' + word : word;
      if (context.measureText(next).width <= width) line = next;
      else {
        if (line) result.push(line);
        line = word;
        // Long error paths also have to fit within the screen.
        while (context.measureText(line).width > width) {
          let end = line.length - 1;
          while (end > 1 && context.measureText(line.slice(0, end)).width > width) end--;
          result.push(line.slice(0, end));
          line = line.slice(end);
        }
      }
    }
    if (line) result.push(line);
    if (result.length > maxLines) {
      result.length = maxLines;
      result[maxLines - 1] = result[maxLines - 1].slice(0, -1) + '…';
    }
    return result;
  }

  function draw() {
    context.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    if (!running) {
      context.fillStyle = '#050909';
      context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      if (logo.complete && logo.naturalWidth) {
        // Compensate the PAL raster's nonsquare pixels so the supplied logo
        // keeps its physical aspect in both CRT and plain output.
        const par = crt.enabled ? pixelAspect(source, source.standard) : 1;
        const ratio = logo.naturalWidth / logo.naturalHeight;
        const height = Math.min(LOGO_MAX_HEIGHT, (LOGO_MAX_WIDTH * par) / ratio),
          width = (height * ratio) / par;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(logo, (SCREEN_WIDTH - width) / 2, LOGO_TOP, width, height);
      } else {
        context.font = 'bold 21px monospace';
        context.fillStyle = '#d8cda5';
        context.fillText(title.textContent.replace(/\s+Enhanced$/, ''), CENTRE_X, TITLE_Y);
      }
      context.font = '9px monospace';
      context.fillStyle = '#d8cda5';
      context.fillText('Enhanced', CENTRE_X, SUBTITLE_Y);
      if (!start.hidden) {
        const b = START_BUTTON;
        context.fillStyle = hovered && !start.disabled ? '#234031' : '#0a1812';
        context.fillRect(b.x, b.y, b.width, b.height);
        context.strokeStyle = start.disabled ? '#52615a' : '#a0e2ba';
        context.lineWidth = document.activeElement === start ? 2 : 1;
        context.strokeRect(b.x + STROKE_ALIGN, b.y + STROKE_ALIGN, b.width - 1, b.height - 1);
        context.font = '10px monospace';
        context.fillStyle = start.disabled ? '#81928a' : '#b7f8d0';
        context.fillText(start.textContent, CENTRE_X, b.y + b.height / 2 + (pressed ? 1 : 0));
      }
    }
    const message = status.textContent.trim();
    if (running && !message) {
      crt.setOverlay(null);
      return;
    }
    if (!running && progress && !progress.hidden) {
      const b = LOADING_BAR;
      context.fillStyle = '#0a1812';
      context.fillRect(b.x, b.y, b.width, b.height);
      context.fillStyle = '#315b44';
      context.fillRect(b.x + 1, b.y + 1, (b.width - 2) * progress.position, b.height - 2);
      context.strokeStyle = '#6fbb91';
      context.lineWidth = 1;
      context.strokeRect(b.x + STROKE_ALIGN, b.y + STROKE_ALIGN, b.width - 1, b.height - 1);
      context.font = '8px monospace';
      context.fillStyle = '#e7eeeb';
      context.fillText(message, CENTRE_X, b.y + b.height / 2);
    } else if (message) {
      context.font = '8px monospace';
      const text = lines(
        message,
        MESSAGE_WIDTH,
        running ? MESSAGE_LINES_RUNNING : MESSAGE_LINES_START,
      );
      const top = running
        ? MESSAGE_BOTTOM_RUNNING - text.length * MESSAGE_LINE_HEIGHT
        : MESSAGE_TOP_START;
      if (running) {
        context.fillStyle = 'rgba(3,9,7,0.9)';
        context.fillRect(
          MESSAGE_BOX_MARGIN,
          top - MESSAGE_BOX_TOP,
          SCREEN_WIDTH - 2 * MESSAGE_BOX_MARGIN,
          text.length * MESSAGE_LINE_HEIGHT + MESSAGE_BOX_MARGIN,
        );
      }
      context.fillStyle = '#b3c7bd';
      text.forEach((line, i) => context.fillText(line, CENTRE_X, top + i * MESSAGE_LINE_HEIGHT));
    }
    crt.setOverlay(context.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT).data);
  }

  const hit = (event) => {
    if (running || start.hidden || start.disabled) return false;
    const { x, y } = crt.toSource(event.clientX, event.clientY),
      b = START_BUTTON;
    return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
  };
  canvas.addEventListener('pointermove', (event) => {
    const next = hit(event);
    if (next === hovered) return;
    hovered = next;
    canvas.style.cursor = hovered ? 'pointer' : '';
    draw();
  });
  canvas.addEventListener('pointerleave', () => {
    if (!hovered && !pressed) return;
    hovered = pressed = armed = false;
    canvas.style.cursor = '';
    draw();
  });
  canvas.addEventListener('pointerdown', (event) => {
    armed = event.button === 0 && hit(event);
    if (!armed) return;
    event.preventDefault();
    pressed = true;
    start.focus({ preventScroll: true });
    draw();
  });
  canvas.addEventListener('click', (event) => {
    const activate = armed && event.button === 0 && hit(event);
    armed = false;
    if (!activate) return;
    pressed = false;
    start.click();
  });
  addEventListener('pointerup', (event) => {
    if (!hit(event)) armed = false;
    if (!pressed) return;
    pressed = false;
    draw();
  });
  canvas.addEventListener('pointercancel', () => {
    armed = pressed = false;
    draw();
  });
  for (const type of ['focus', 'blur']) start.addEventListener(type, draw);
  for (const type of ['load', 'error']) logo.addEventListener(type, draw);
  const changed = new MutationObserver(draw);
  changed.observe(start, { attributes: true, attributeFilter: ['hidden', 'disabled'] });
  changed.observe(status, { childList: true, characterData: true, subtree: true });
  if (progress)
    changed.observe(progress, { attributes: true, attributeFilter: ['value', 'max', 'hidden'] });
  const black = new Uint8ClampedArray(SCREEN_WIDTH * SCREEN_HEIGHT * RGBA_BYTES);
  for (let i = ALPHA; i < black.length; i += RGBA_BYTES) black[i] = OPAQUE;
  crt.draw(black);
  canvas.dataset.presentation = 'start';
  draw();
  return {
    refresh: draw,
    get running() {
      return running;
    },
    setRunning(value) {
      if (running === value) return;
      running = value;
      hovered = pressed = armed = false;
      canvas.style.cursor = '';
      canvas.dataset.presentation = running ? 'game' : 'start';
      draw();
    },
  };
}
