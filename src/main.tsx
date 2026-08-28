import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { initVisitorCount } from "@/lib/analytics";
import { inertBehindOverlay } from "@/lib/inert-behind-overlay";
import "@/index.css";

initVisitorCount();

/* A document-level concern rather than a component one: Radix sets `aria-hidden`
   from outside React, and on elements that are not always inside the React tree.
   So the mirror lives beside the mount rather than in the tree it watches, and
   is never torn down - the app owns the page for as long as the page exists. */
inertBehindOverlay();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
