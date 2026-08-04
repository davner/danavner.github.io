/**
 * A photo attached to a content entry.
 *
 * Shared by every collection rather than owned by one, because the rules are
 * the same everywhere: `alt` and `caption` are both required, and a local `src`
 * has to exist. `vite-plugin-content.ts` enforces all three at build time, so a
 * photo that would ship broken or uncaptioned fails the build instead.
 */
export interface Photo {
  /** Path under `public/`, or a full URL. */
  src: string;
  /** Falls back to a generated description when empty. */
  alt: string;
  caption: string;
}
