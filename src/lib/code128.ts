/*
 * Code 128, subset B - the one barcode on the site, drawn on the colophon.
 *
 * Hand-rolled rather than a dependency because this subset of the spec (ISO/IEC
 * 15417) is nothing but the width table below, a mod-103 checksum, and a stop
 * pattern: the function is smaller than any integration and has no opinion
 * about rendering. Subset B carries the full printable ASCII range, which
 * covers a lowercase-hex commit id with room to spare.
 */

/**
 * Element widths for every symbol value, 0-106, one digit per element starting
 * with a bar. Values 0-94 are the printable ASCII characters in order (space
 * through tilde), 103-105 the start codes, 106 the stop - written with its
 * termination bar attached, which is why it alone has seven elements.
 *
 * Transcribed row by row from the spec's table; `tests/code128.spec.ts` holds
 * the structural invariants (every six-element row sums to 11 modules, the
 * stop to 13) that a mistyped digit would break.
 */
const WIDTHS = [
  "212222", // 0
  "222122",
  "222221",
  "121223",
  "121322",
  "131222",
  "122213",
  "122312",
  "132212",
  "221213",
  "221312", // 10
  "231212",
  "112232",
  "122132",
  "122231",
  "113222",
  "123122",
  "123221",
  "223211",
  "221132",
  "221231", // 20
  "213212",
  "223112",
  "312131",
  "311222",
  "321122",
  "321221",
  "312212",
  "322112",
  "322211",
  "212123", // 30
  "212321",
  "232121",
  "111323",
  "131123",
  "131321",
  "112313",
  "132113",
  "132311",
  "211313",
  "231113", // 40
  "231311",
  "112133",
  "112331",
  "132131",
  "113123",
  "113321",
  "133121",
  "313121",
  "211331",
  "231131", // 50
  "213113",
  "213311",
  "213131",
  "311123",
  "311321",
  "331121",
  "312113",
  "312311",
  "332111",
  "314111", // 60
  "221411",
  "431111",
  "111224",
  "111422",
  "121124",
  "121421",
  "141122",
  "141221",
  "112214",
  "112412", // 70
  "122114",
  "122411",
  "142112",
  "142211",
  "241211",
  "221114",
  "413111",
  "241112",
  "134111",
  "111242", // 80
  "121142",
  "121241",
  "114212",
  "124112",
  "124211",
  "411212",
  "421112",
  "421211",
  "212141",
  "214121", // 90
  "412121",
  "111143",
  "111341",
  "131141",
  "114113",
  "114311",
  "411113",
  "411311",
  "113141",
  "114131", // 100
  "311141",
  "411131",
  "211412", // 103, start A
  "211214", // 104, start B
  "211232", // 105, start C
  "2331112", // 106, stop plus the termination bar
] as const;

const START_B = 104;
const STOP = 106;

/**
 * Alternating bar/space widths (bar first) for one Code 128B symbol, quiet
 * zones excluded.
 *
 * The result is `(text.length + 3) * 6 + 1` numbers: start code, one symbol
 * per character, the mod-103 check symbol, and the stop pattern with its
 * termination bar. Each width is 1-4 modules; the caller picks what a module
 * is worth on screen.
 *
 * @throws {RangeError} for any character outside printable ASCII (32-126),
 * which is all subset B can carry.
 */
export function code128bWidths(text: string): number[] {
  const values = Array.from(text, (char) => {
    const code = char.charCodeAt(0);
    if (code < 32 || code > 126) {
      throw new RangeError(`Code 128B carries only ASCII 32-126; got ${JSON.stringify(char)}`);
    }
    return code - 32;
  });

  // The checksum weights the start code once and each character by its
  // one-based position.
  const checksum = values.reduce((sum, value, index) => sum + value * (index + 1), START_B) % 103;

  return [START_B, ...values, checksum, STOP].flatMap((value) => Array.from(WIDTHS[value], Number));
}
