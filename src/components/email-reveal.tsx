import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { profile } from "@/content/profile";
import { cn } from "@/lib/utils";

/**
 * The address is never in the markup until someone asks for it.
 *
 * It is stored as two halves and only joined in an event handler, so it is not
 * a single scrapeable string in the bundle either. This stops naive harvesters,
 * not a determined one, which is the right amount of effort for a mailto.
 */
export function EmailReveal({ className }: { className?: string }) {
  const [address, setAddress] = useState("");
  const [copied, setCopied] = useState(false);

  function reveal() {
    setAddress(`${profile.emailUser}@${profile.emailDomain}`);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the address is on screen and selectable anyway.
    }
  }

  // Matches the padding the site's other outline buttons use, so this sits at
  // the same height as whatever it is placed next to.
  const shape =
    "readout h-auto rounded-none px-5 py-3 leading-none hover:border-ember hover:text-ember";

  if (!address) {
    return (
      <Button variant="outline" onClick={reveal} className={cn(shape, className)}>
        <Mail />
        Show email
      </Button>
    );
  }

  return (
    <span className={cn("inline-flex flex-wrap items-stretch gap-2", className)}>
      <Button asChild variant="outline" className={shape}>
        <a href={`mailto:${address}`}>
          <Mail />
          {address}
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={copy}
        aria-label={copied ? "Email copied" : "Copy email address"}
        className="h-auto w-11 rounded-none text-muted-foreground hover:text-ember"
      >
        {copied ? <Check className="text-ember" /> : <Copy />}
      </Button>
    </span>
  );
}
