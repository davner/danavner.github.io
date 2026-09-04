import { expect, test } from "@playwright/test";

import { code128bWidths } from "../src/lib/code128";

/**
 * The encoder is a pure function over a transcribed table, so the whole thing
 * is checked without a browser - no `page` fixture anywhere in this file, and
 * the mobile project skips it in `playwright.config.ts` because a second
 * device would run identical arithmetic.
 *
 * What these prove is the transcription, which is the entire risk: a wrong
 * digit in the table produces a plausible-looking barcode that does not scan.
 * Every six-element symbol must sum to 11 modules with the stop at 13, the
 * check symbol must match one computed from the character values alone, and
 * one vector is worked by hand below so the table rows it crosses are pinned
 * to the spec rather than to themselves.
 */
test.describe("code128bWidths", () => {
  test("every symbol is 11 modules and the stop pattern 13", () => {
    for (const text of ["", "5", "dan", "danavner.com", "a1b2c3d"]) {
      const widths = code128bWidths(text);

      // Start, one symbol per character, and the check symbol at six elements
      // each; then the seven-element stop.
      expect(widths.length, `length for ${JSON.stringify(text)}`).toBe((text.length + 3) * 6 + 1);

      for (let at = 0; at < widths.length - 7; at += 6) {
        const modules = widths.slice(at, at + 6).reduce((sum, width) => sum + width, 0);
        expect(modules, `symbol at ${at} for ${JSON.stringify(text)}`).toBe(11);
      }

      const stop = widths.slice(-7).reduce((sum, width) => sum + width, 0);
      expect(stop, `stop for ${JSON.stringify(text)}`).toBe(13);
    }
  });

  test("the check symbol is the weighted character sum mod 103", () => {
    /*
     * Recomputed here from the character values alone, without touching the
     * width table: "dan" is 'd' 68, 'a' 65, 'n' 78 (ASCII minus 32), so the
     * checksum is 104 + 1*68 + 2*65 + 3*78 = 536, and 536 mod 103 = 21.
     * Value 21 is also the character "5" (21 + 32 = 53), so the check symbol's
     * six widths must be byte-identical to the data symbol an encoding of "5"
     * produces - two different paths into the same table row.
     */
    const checkSymbol = code128bWidths("dan").slice(24, 30);
    const dataSymbolFor5 = code128bWidths("5").slice(6, 12);
    expect(checkSymbol).toEqual(dataSymbolFor5);
  });

  test("encodes dan to the hand-worked vector", () => {
    /*
     * Worked by hand against the spec's table:
     *
     *   start B    (104)  2 1 1 2 1 4
     *   'd'        ( 68)  1 4 1 2 2 1
     *   'a'        ( 65)  1 2 1 1 2 4
     *   'n'        ( 78)  2 4 1 1 1 2
     *   check      ( 21)  2 1 3 2 1 2   (536 mod 103 = 21)
     *   stop       (106)  2 3 3 1 1 1 2
     */
    expect(code128bWidths("dan")).toEqual([
      ...[2, 1, 1, 2, 1, 4],
      ...[1, 4, 1, 2, 2, 1],
      ...[1, 2, 1, 1, 2, 4],
      ...[2, 4, 1, 1, 1, 2],
      ...[2, 1, 3, 2, 1, 2],
      ...[2, 3, 3, 1, 1, 1, 2],
    ]);
  });

  test("refuses anything outside printable ASCII", () => {
    // Below the range, above it, and a multi-byte character whose first code
    // unit is nowhere near ASCII.
    expect(() => code128bWidths("dan\n")).toThrow(RangeError);
    expect(() => code128bWidths("café")).toThrow(RangeError);
    expect(() => code128bWidths("🛰")).toThrow(RangeError);
  });
});
