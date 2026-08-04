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
  const [card, setCard] = useState<{ url: string; blob: Blob; index: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const building = useRef(false);

  const url = showUrl(show);
  const heading = showHeading(show);

  // Object URLs outlive the component unless they are handed back.
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);

  /*
   * The panel stays up while a new cover renders, so "open" is not the same as
   * "ready" any more - it is any state where a card exists and the panel has
   * not been dismissed.
   */
  const panelOpen = card != null && (status === "ready" || status === "working");

  // Focus moves into the panel in the same pass that arms Escape, so there is
  // never a frame where the panel is on screen and the key does nothing.
  useEffect(() => {
    if (!panelOpen) return;

    // Only on the way in. Re-focusing on every render would yank focus off the
    // cover button the moment you picked a different photo.
    if (!wasOpen.current) panelRef.current?.focus();
    wasOpen.current = true;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen]);

  function close() {
    setStatus("idle");
    wasOpen.current = false;
    // Send focus back where it came from rather than dropping it on the body.
    triggerRef.current?.focus();
  }

  async function build(index: number) {
    // A ref rather than the status, which is stale inside this closure. Two
    // fast presses would otherwise race and the loser could land last.
    if (building.current) return;
    building.current = true;
    setStatus("working");

    try {
      const blob = await renderShowCard(show, index);
      // Replacing `card` revokes the previous object URL through the cleanup
      // above, so switching photos does not leak one per press.
      setCard({ blob, url: URL.createObjectURL(blob), index });
      setStatus("ready");
    } catch {
      setStatus("failed");
    } finally {
      building.current = false;
    }
  }

  async function open() {
    if (card) {
      setStatus("ready");
      return;
    }
    await build(0);
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
        disabled={status === "working" && !card}
        aria-expanded={panelOpen}
        className="readout relative z-10 rounded-none text-muted-foreground hover:border-ember hover:text-ember"
      >
        {status === "working" && !card ? <Loader2 className="animate-spin" /> : <Share2 />}
        Share
      </Button>

      {status === "failed" ? (
        <span className="readout-dim relative z-10 ml-3">Could not build the card</span>
      ) : null}

      {panelOpen && card ? (
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
            aria-busy={status === "working"}
            className={cn(
              "mt-3 max-h-56 w-full border border-border object-contain transition-opacity",
              status === "working" && "opacity-50",
            )}
          />

          {/* Which photo tops the card. Only worth showing when there is a
              choice to make - one photo is not a picker, it is a thumbnail of
              the picture already on screen. */}
          {show.photos.length > 1 ? (
            <div className="mt-3">
              <p className="readout-dim">Cover</p>
              <div
                role="radiogroup"
                aria-label="Photo on the card"
                className="mt-2 flex gap-2 overflow-x-auto pb-1"
              >
                {show.photos.map((photo, index) => (
                  <button
                    key={photo.src}
                    type="button"
                    role="radio"
                    aria-checked={card.index === index}
                    aria-label={photo.caption}
                    onClick={() => build(index)}
                    className={cn(
                      "size-12 shrink-0 border transition-colors",
                      card.index === index
                        ? "border-ember"
                        : "border-border opacity-60 hover:opacity-100",
                    )}
                  >
                    <img src={photo.src} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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

          {/* The whole thing, protocol included. This is what "Copy the link"
              puts on the clipboard, so printing a trimmed version of it meant
              the panel showed one string and handed over another. There is no
              shortener to offer instead - that would be a third-party service
              on a site that makes a point of not calling one. */}
          <p className="readout-dim mt-3 break-all select-all">{url}</p>
        </div>
      ) : null}
    </span>
  );
}
