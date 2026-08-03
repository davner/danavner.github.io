import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

import { PageShell } from "@/components/page";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/lib/use-document-meta";

export function NotFound() {
  useDocumentMeta("Not found", "That page does not exist.");

  return (
    <PageShell className="max-w-xl text-center">
      <p className="font-mono text-7xl font-semibold tracking-tight text-primary">404</p>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance">
        Nothing at these coordinates.
      </h1>
      <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
        The page you were looking for is not here. It may have moved, or it may never have existed
        in the first place.
      </p>
      <Button asChild className="mt-8">
        <Link to="/">
          <ArrowLeft />
          Back home
        </Link>
      </Button>
    </PageShell>
  );
}
