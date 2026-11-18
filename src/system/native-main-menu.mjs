// The karma menu's window layout and list tables (80:F054, 80:F0F3, 80:F1B5). The
// register-level save checksum 81:B1AB lives in proof/replay/native-main-menu.mjs;
// the live start menu uses saveSlotValid of src/game/save-slots.mjs.
export const KARMA_WINDOWS = Object.freeze({
  left: 3,
  columns: 11,
  balanceTop: 5,
  balanceRows: 3,
  categoryTop: 8,
  categoryRows: 6,
  categoryVisibleRows: 4,
  detailLeft: 14,
  detailColumns: 16,
  headerTop: 5,
  headerRows: 3,
  listTop: 8,
  listRows: 9,
  listVisibleRows: 7,
});

// The three karma lists: header text, value pointers (bank 7E via DP10), names, limits, entry count and where
// the loop starts again (F054 rebuilds the header, F0F3 and F1B5 only the rows). Values below their limit are
// listed (1DAB names, 1EB1 values, 1E2F indices); a changed row count resets the cursor DP1A. The menu A6B8 in
// window 1F52 buys with F006 (F0F3: the value 7E3BFB also raises 7E3C00 by 0A and raises the state count of the
// leader over CECB with FF... 0A) and shows the karma again (EF82).
export const KARMA_LISTS = Object.freeze({
  0x80f054: {
    text: 0x70bb,
    pointers: 0xefca,
    names: 0xefd2,
    limits: 0xefda,
    end: 8,
    header: true,
    pcs: { text: 0x80f059, request: 0x80f0b3, menu: 0x80f0d3, buy: 0x80f0e9, karma: 0x80f0ec },
  },
  0x80f0f3: {
    text: 0x7490,
    pointers: 0xefb2,
    names: 0xefba,
    limits: 0xefc2,
    end: 8,
    header: false,
    body: true,
    pcs: {
      text: 0x80f0f8,
      request: 0x80f152,
      menu: 0x80f172,
      buy: 0x80f188,
      karma: 0x80f1ae,
      refill: 0x80f1ab,
    },
  },
  0x80f1b5: {
    text: 0x709d,
    pointers: 0xefe2,
    names: 0xefee,
    limits: 0xeffa,
    end: 0x0c,
    header: false,
    pcs: { text: 0x80f1ba, request: 0x80f214, menu: 0x80f234, buy: 0x80f24a, karma: 0x80f24d },
  },
});
