// Original karma table layout used only by the content extractor.
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
