import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { initVisitorCount } from "@/lib/analytics";
import { inertBehindOverlay } from "@/lib/inert-behind-overlay";
import "@/index.css";

initVisitorCount();

/* The console's copy of the imprint. The hex is the dark theme's `--ion` -
   machine output takes the cold ink, and a devtools pane cannot read the
   token off the stylesheet. */
console.log(
  "%cdanavner.com · printed from source: github.com/davner/danavner.github.io",
  "color: #00dfe3; font-family: monospace;",
);

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
