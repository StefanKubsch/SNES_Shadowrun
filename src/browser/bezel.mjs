// Static photographic monitor surround. It follows CRT availability/state and
// its own stored preference; image loading never blocks the game or renderer.
// Pixel coordinates in the unchanged square artwork canvas. Cropping its view
// rather than stretching the image preserves the approved monitor proportions.

const PERCENT = 100;
const FRONT = { x: 48, y: 152, width: 1162, height: 920 };
const GLASS = { x: 142, y: 261, width: 972, height: 706 };
const FRONT_ASPECT = FRONT.width / FRONT.height;
const OPENING = {
  x: (GLASS.x - FRONT.x) / FRONT.width,
  y: (GLASS.y - FRONT.y) / FRONT.height,
  width: GLASS.width / FRONT.width,
  height: GLASS.height / FRONT.height,
};
const PICTURE_COVERAGE = 0.98;

export function createBezel(
  surface,
  image,
  button,
  {
    enabled = true,
    onChange,
    label = (selected) => 'Monitor bezel: ' + (selected ? 'on' : 'off'),
  } = {},
) {
  let selected = enabled;
  let available = false;
  let crtEnabled = false;
  let loaded = image.complete && image.naturalWidth > 0;
  let layout;

  function fitPicture() {
    const p = layout.bounds ?? layout.picture;
    // Fit the projected active game bounds, retaining their aspect ratio. The larger
    // canvas crops the surrounding PAL/underscan padding behind the cabinet.
    const width = Math.min(
      (OPENING.width * PICTURE_COVERAGE) / p.width,
      (OPENING.height * PICTURE_COVERAGE * layout.aspect) / (FRONT_ASPECT * p.height),
    );
    const height = (width * FRONT_ASPECT) / layout.aspect;
    const x = OPENING.x + OPENING.width / 2 - (p.x + p.width / 2) * width;
    const y = OPENING.y + OPENING.height / 2 - (p.y + p.height / 2) * height;
    surface.style.setProperty('--bezel-canvas-width', `${width * PERCENT}%`);
    surface.style.setProperty('--bezel-canvas-x', `${x * PERCENT}%`);
    surface.style.setProperty('--bezel-canvas-y', `${y * PERCENT}%`);
    surface.style.setProperty('--bezel-aspect', String(FRONT_ASPECT));
    surface.style.setProperty('--bezel-full-width', `${FRONT_ASPECT * PERCENT}vh`);
    surface.style.setProperty('--bezel-image-x', `${(-FRONT.x / FRONT.width) * PERCENT}%`);
    surface.style.setProperty('--bezel-image-y', `${(-FRONT.y / FRONT.height) * PERCENT}%`);
    surface.style.setProperty(
      '--bezel-image-width',
      `${(image.naturalWidth / FRONT.width) * PERCENT}%`,
    );
    const clip = [
      (OPENING.y - y) / height,
      (x + width - OPENING.x - OPENING.width) / width,
      (y + height - OPENING.y - OPENING.height) / height,
      (OPENING.x - x) / width,
    ];
    surface.style.setProperty(
      '--bezel-canvas-clip',
      `inset(${clip.map((v) => `${v * PERCENT}%`).join(' ')})`,
    );
  }

  function show() {
    const visible = available && crtEnabled && selected && loaded;
    if (visible) fitPicture();
    surface.dataset.bezel = visible ? 'on' : 'off';
    image.hidden = !visible;
    button.hidden = !available;
    button.disabled = !crtEnabled || !loaded;
    button.setAttribute('aria-pressed', String(selected));
    button.textContent = label(selected);
  }

  image.addEventListener('load', () => {
    loaded = image.naturalWidth > 0;
    show();
  });
  image.addEventListener('error', () => {
    loaded = false;
    show();
  });
  button.addEventListener('click', () => {
    if (button.disabled) return;
    selected = !selected;
    onChange?.(selected);
    show();
    button.blur();
  });

  return {
    sync(crt) {
      available = crt.available;
      crtEnabled = crt.enabled;
      layout = crt.layout;
      show();
    },
  };
}
