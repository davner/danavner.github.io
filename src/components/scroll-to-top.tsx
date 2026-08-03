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
    // and leave the new page scrolled part way down. Forcing `auto` for the
    // duration cancels any running animation and lands us at the top.
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  }, [pathname, hash]);

  return null;
}
