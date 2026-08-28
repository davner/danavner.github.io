import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { initVisitorCount } from "@/lib/analytics";
import { inertBehindOverlay } from "@/lib/inert-behind-overlay";
import "@/index.css";

initVisitorCount();

const container = document.getElementById("root")!;

/* A document-level concern rather than a component one: Radix sets
   `aria-hidden` on this element from outside React, so the mirror lives beside
   the mount rather than inside the tree it is watching. Never torn down - the
   app owns the page for as long as the page exists. */
inertBehindOverlay(container);

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
