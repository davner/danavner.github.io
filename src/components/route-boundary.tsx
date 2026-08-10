import { Component, type ReactNode } from "react";

import { looksLikeStaleChunk, shouldReloadForStaleChunk } from "@/lib/stale-chunk";

/**
 * Catches a lazy route that fails to load, and reloads the page once.
 *
 * ## The failure this exists for
 *
 * Route chunks are content-hashed - `fortnite-Dw2NAbxq.js` - and a deploy
 * replaces them with new names and deletes the old ones. A tab opened before
 * that deploy is still holding the old `index.html`, which points at filenames
 * that no longer exist. Click Fortnite or Comics and the browser asks for a
 * chunk that is gone, the dynamic import rejects, and with nothing catching it
 * React unmounts the whole tree: not a broken page, a blank one.
 *
 * That is not a rare edge here. Three nightly jobs commit their data and each
 * one triggers a deploy, so the hashes change most nights - leave a tab open
 * overnight and the next click on a lazy route is the one that breaks. It only
 * ever hits the lazy routes, which is why it looks arbitrary: Home, About,
 * Career and Blog are in the main bundle and never miss.
 *
 * ## Why reloading is the fix rather than a retry
 *
 * There is nothing to retry. The file is genuinely gone, and asking for it
 * again gets the same 404 - GitHub Pages answers with `404.html`, so the
 * browser is handed an HTML document where it wanted JavaScript. The only copy
 * of the app that can load this route is the new one, and a reload is how you
 * get it: the URL is already right, so it comes back on the same page with the
 * current `index.html` and the current filenames.
 *
 * A timestamp in `sessionStorage` makes it once. If the route fails again
 * moments after a reload then the cause was never a stale deploy, and reloading
 * again would be an infinite loop pointed at the user - so that failure shows a
 * page saying so instead. See `shouldReloadForStaleChunk`, which is written the
 * way it is because the obvious version does loop.
 */
interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class RouteBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (!looksLikeStaleChunk(error)) return;

    // A reload moments ago did not fix it, so this is not a stale deploy. Let
    // the fallback render rather than bouncing the page forever.
    if (!shouldReloadForStaleChunk()) return;

    window.location.reload();
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <p className="display text-3xl text-balance sm:text-4xl">This page did not load</p>
        <p className="mt-5 leading-relaxed text-muted-foreground text-pretty">
          Usually this means the site updated while the tab was open and the page you asked for
          moved out from under it. Reloading normally sorts it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="readout mt-10 inline-flex cursor-pointer items-center gap-2 border border-ember bg-ember px-6 py-3.5 text-primary-foreground transition-colors hover:bg-transparent hover:text-ember"
        >
          Reload
        </button>
      </div>
    );
  }
}
