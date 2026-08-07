import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { initVisitorCount } from "@/lib/analytics";
import "@/index.css";

initVisitorCount();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
