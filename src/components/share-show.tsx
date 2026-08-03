import { Check, Copy, Download, Loader2, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { renderShowCard, showUrl } from "@/lib/show-card";
import { showHeading, showSummary } from "@/lib/show-summary";
import type { Show } from "@/lib/shows";
import { cn } from "@/lib/utils";

type Status = "idle" | "working" | "ready" | "failed";

/**
 * Share sheet for one show: a poster rendered from the entry, plus the link.
 *
 * On a phone this hands both to the OS share sheet in one go, which is what
 * puts the image into an Instagram story or a text message. On a desktop, where
 * `navigator.share` is usually absent, it falls back to saving the image and
 * copying the link, which is the same two things done by hand.
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

  async function build(): Promise<Blob | null> {
    if (card) return card.blob;

    try {
      const blob = await renderShowCard(show);
      setCard({ blob, url: URL.createObjectURL(blob) });
      return blob;
    } catch {
      return null;
    }
  }

  async function open() {
    setStatus("working");
    const blob = await build();

    if (!blob) {
      setStatus("failed");
      return;
    }

    const file = new File([blob], `${show.slug}.png`, { type: "image/png" });
    const payload = { title: heading, text: `${heading} - ${showSummary(show)}`, url, files: [file] };

    // Sharing the file and the link together is the whole point; if the
    // platform will not take a file, the panel below does the job instead.
    if (navigator.canShare?.(payload)) {
      try {
        await navigator.share(payload);
        setStatus("idle");
        return;
      } catch (error) {
        // A cancelled share is a normal outcome, not a failure to report.
        if ((error as Error)?.name === "AbortError") {
          setStatus("idle");
          return;
        }
      }
    }

    setStatus("ready");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the link is on screen and selectable.
    }
  }

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
            <Button
              asChild
              variant="outline"
              size="sm"
              className="readout rounded-none hover:border-ember hover:text-ember"
            >
              <a href={card.url} download={`${show.slug}.png`}>
                <Download />
                Save image
              </a>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyLink}
              className="readout rounded-none hover:border-ember hover:text-ember"
            >
              {copied ? <Check className="text-ember" /> : <Copy />}
              {copied ? "Link copied" : "Copy link"}
            </Button>
          </div>

          <p className="readout-dim mt-3 break-all">{url.replace(/^https?:\/\//, "")}</p>
        </div>
      ) : null}
    </span>
  );
}
