import { Check, Copy, Mail } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";

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
  // Whether the confirmation may stamp - false on keyboard activations.
  const [stamped, setStamped] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  /*
   * The button that was pressed is replaced by the address, so without this the
   * keyboard lands on `<body>` and the answer is somewhere behind the reader.
   * The anchor's accessible name is the address itself, so arriving on it is
   * also how the result is announced - no live region needed on the page.
   */
  useEffect(() => {
    if (address) link.current?.focus();
  }, [address]);

  function reveal() {
    setAddress(`${profile.emailUser}@${profile.emailDomain}`);
  }

  async function copy(event: MouseEvent<HTMLButtonElement>) {
    // Modality decided once, before the await while the event still has its
    // target - the same reasoning share.tsx spells out over its handler.
    const stamp = !event.currentTarget.matches(":focus-visible");
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setStamped(stamp);
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
        <a ref={link} href={`mailto:${address}`}>
          <Mail />
          {address}
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={copy}
        // The name stays the action across the swap - a control renamed to
        // its own confirmation has no stated purpose exactly while focus
        // sits on it. The region below announces the copy instead.
        aria-label="Copy email address"
        className="h-auto w-11 rounded-none text-muted-foreground hover:text-ember"
      >
        {/* Ion for machine output, stamped like the share panel's Copied -
            and like it, only on pointer copies. */}
        {copied ? <Check className={cn("text-ion", stamped && "copy-stamp")} /> : <Copy />}
      </Button>

      {/* Announces the copy; mounted with the revealed address, so the
          region exists before it has anything to say. */}
      <span role="status" className="sr-only">
        {copied ? "Email copied" : ""}
      </span>
    </span>
  );
}
