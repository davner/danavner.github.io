import { Check, Copy, Download, ImageIcon, Link2, Loader2, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { renderShowCard, showUrl } from "@/lib/show-card";
import { showHeading } from "@/lib/show-summary";
import type { Show } from "@/lib/shows";
import { cn } from "@/lib/utils";

type Status = "idle" | "working" | "ready" | "failed";

/**
 * Share sheet for one show: a poster rendered from the entry, and the link.
 *
 * The two are offered separately on purpose. Handing the OS a payload with a
 * file *and* a URL *and* a body of text lets each app decide what to do with
 * all three, and Messages decides to stack them: a full-height poster, the
 * whole lineup as a paragraph, and the link underneath. Sending one thing at a
 * time means the story gets the poster and the message gets a link that
 * previews itself.
 */
export function ShareShow({ show, className }: { show: Show; className?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [card, setCard] = useState<{ url: string; blob: Blob } | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const url = showUrl(show);
  const heading = showHeading(show);

  // Object URLs outlive the component unless they are handed back.
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);

  // Focus moves into the panel in the same pass that arms Escape, so there is
  // never a frame where the panel is on screen and the key does nothing.
  useEffect(() => {
    if (status !== "ready") return;

    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [status]);

  function close() {
    setStatus("idle");
    // Send focus back where it came from rather than dropping it on the body.
    triggerRef.current?.focus();
  }

  async function open() {
    if (card) {
      setStatus("ready");
      return;
    }

    setStatus("working");

    try {
      const blob = await renderShowCard(show);
      setCard({ blob, url: URL.createObjectURL(blob) });
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  }

  /** Swallows the cancel that every OS share sheet throws on dismissal. */
  async function share(payload: ShareData) {
    try {
      await navigator.share(payload);
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") throw error;
    }
  }

  const file = card ? new File([card.blob], `${show.slug}.png`, { type: "image/png" }) : null;
  const canShareLink = typeof navigator !== "undefined" && Boolean(navigator.share);
  const canShareImage = Boolean(file && navigator.canShare?.({ files: [file] }));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the link is on screen and selectable.
    }
  }

  const action = "readout w-full justify-start rounded-none hover:border-ember hover:text-ember";

  return (
    <span className={cn("relative inline-block", className)}>
      <Button
        ref={triggerRef}
        variant="outline"
        size="sm"
        onClick={open}
        disabled={status === "working"}
        aria-expanded={status === "ready"}
        className="readout relative z-10 rounded-none text-muted-foreground hover:border-ember hover:text-ember"
      >
        {status === "working" ? <Loader2 className="animate-spin" /> : <Share2 />}
        Share
      </Button>

      {status === "failed" ? (
        <span className="readout-dim relative z-10 ml-3">Could not build the card</span>
      ) : null}

      {status === "ready" && card ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="group"
          aria-label={`Share ${heading}`}
          className="absolute top-full left-0 z-30 mt-2 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto border border-border bg-background p-4 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="readout text-ember">Share</p>
            <button
              type="button"
              onClick={close}
              aria-label="Close share panel"
              className="-mt-1 -mr-1 p-1 text-muted-foreground transition-colors hover:text-ember"
            >
              <X className="size-4" />
            </button>
          </div>

          <img
            src={card.url}
            alt={`Share card for ${heading}`}
            className="mt-3 max-h-56 w-full border border-border object-contain"
          />

          <div className="mt-3 flex flex-col gap-2">
            {canShareImage ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => share({ files: [file!] })}
                className={action}
              >
                <ImageIcon />
                Share the card
              </Button>
            ) : null}

            <Button asChild variant="outline" size="sm" className={action}>
              <a href={card.url} download={`${show.slug}.png`}>
                <Download />
                Save the card
              </a>
            </Button>

            {canShareLink ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => share({ title: heading, url })}
                className={action}
              >
                <Link2 />
                Send the link
              </Button>
            ) : null}

            <Button variant="outline" size="sm" onClick={copyLink} className={action}>
              {copied ? <Check className="text-ember" /> : <Copy />}
              {copied ? "Link copied" : "Copy the link"}
            </Button>
          </div>

          <p className="readout-dim mt-3 break-all">{url.replace(/^https?:\/\//, "")}</p>
        </div>
      ) : null}
    </span>
  );
}
