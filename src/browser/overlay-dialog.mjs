// Shared modal shell for the handbook, settings and future overlays.
export function createOverlayDialog({
  id,
  titles,
  frame,
  opener,
  returnFocus,
  content,
  contentClass = 'settings-content',
  onOpen,
  onClose,
  onKeyDown,
}) {
  const dialog = document.createElement('dialog'),
    header = document.createElement('header'),
    title = document.createElement('h2'),
    close = document.createElement('button');
  dialog.id = id;
  dialog.className = 'overlay-dialog';
  title.id = `${id}-title`;
  dialog.setAttribute('aria-labelledby', title.id);
  header.className = 'overlay-header';
  close.id = `${id}-close`;
  close.type = 'button';
  content.classList.add('overlay-body', contentClass);
  content.hidden = false;
  header.append(title, close);
  dialog.append(header, content);
  frame.append(dialog);
  opener.setAttribute('aria-haspopup', 'dialog');
  opener.setAttribute('aria-controls', dialog.id);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (onKeyDown?.(event)) {
      event.stopPropagation();
      return;
    }
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => {
    onClose();
    returnFocus.focus({ preventScroll: true });
  });
  function setLanguage(code) {
    const german = code === 'de';
    dialog.lang = german ? 'de' : 'en';
    opener.textContent = titles[dialog.lang];
    title.textContent = `SHADOWRUN // ${opener.textContent}`;
    close.textContent = german ? 'Schließen' : 'Close';
  }
  setLanguage('en');
  return {
    get isOpen() {
      return dialog.open;
    },
    setLanguage,
    close() {
      if (dialog.open) dialog.close();
    },
    open() {
      if (dialog.open) return;
      dialog.showModal();
      onOpen();
      close.focus({ preventScroll: true });
    },
  };
}
