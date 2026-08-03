import { useEffect } from "react";
import { useLocation } from "react-router";

/**
 * Client-side navigation keeps the old scroll position, which is disorienting
 * between pages. Anchors within a page are left alone.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return;

    // `html { scroll-behavior: smooth }` makes this jump animate, and an
    // animation already in flight when the route changes can outlive the reset
    // and leave the new page scrolled part way down. Forcing `auto` cancels it.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);

    // Chromium can still land one more frame of a cancelled animation, which
    // leaves the page a couple of pixels short of the top. Re-assert once the
    // browser has had that frame, then hand smooth scrolling back.
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      root.style.scrollBehavior = previous;
    });

    return () => {
      cancelAnimationFrame(frame);
      root.style.scrollBehavior = previous;
    };
  }, [pathname, hash]);

  return null;
}
