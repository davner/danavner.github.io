/*
 * Generates the metric-matched fallback `@font-face` rules and font stacks that
 * kill the font-swap layout shift ("snap"). Each web font gets a fallback built
 * from a system font whose metrics are overridden to occupy the exact same space,
 * so when the real font swaps in nothing moves.
 *
 * Run it when a font changes, then paste the output:
 *   - the `@font-face` blocks into `src/fonts.css`
 *   - the FONT-FAMILY strings into the `--font-*` vars in `src/index.css`
 *
 *   node scripts/gen-font-fallbacks.mjs
 *
 * Caveat for Anton: Capsize sizes by an average-character width weighted for
 * running text, which is wrong for a condensed face used only large and all-caps
 * - it leaves the headings snapping ~30% narrower when the real font loads. Its
 * `size-adjust` is hand-corrected to the measured uppercase ratio in `fonts.css`
 * (with ascent/descent rescaled to match); do not paste Anton's raw number over
 * that. Inter and JetBrains Mono match closely and can be pasted as-is.
 */
import { createFontStack } from "@capsizecss/core";
import anton from "@capsizecss/metrics/anton";
import arial from "@capsizecss/metrics/arial";
import courierNew from "@capsizecss/metrics/courierNew";
import inter from "@capsizecss/metrics/inter";
import jetBrainsMono from "@capsizecss/metrics/jetBrainsMono";

const stacks = [
  ["--font-display (Anton)", createFontStack([anton, arial])],
  ["--font-sans (Inter)", createFontStack([inter, arial])],
  ["--font-mono (JetBrains Mono)", createFontStack([jetBrainsMono, courierNew])],
];

for (const [name, stack] of stacks) {
  console.log(`\n/* ===== ${name} ===== */`);
  console.log(`FONT-FAMILY: ${stack.fontFamily}`);
  console.log(stack.fontFaces);
}
