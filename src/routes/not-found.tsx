import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { PageShell } from "@/components/page";
import { useDocumentMeta } from "@/lib/use-document-meta";

export function NotFound() {
  useDocumentMeta("Not found", "That page does not exist.");

  return (
    <PageShell className="max-w-2xl text-center">
      <p className="display text-hero text-ember">404</p>
      <h1 className="display mt-4 text-heading text-balance">Nothing at these coordinates</h1>
      <p className="mt-5 leading-relaxed text-muted-foreground text-pretty">
        Whatever you were after is not here. It either moved or it never existed, and I cannot tell
        you which from where I am standing.
      </p>
      <Link
        to="/"
        className="group mt-10 inline-flex items-center gap-2 border border-ember bg-ember px-6 py-3.5 text-primary-foreground transition-colors hover:bg-transparent hover:text-ember"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        <span className="readout">Back home</span>
      </Link>
    </PageShell>
  );
}
