import { Check, Copy, Download, ImageIcon, Link2, Loader2, Share2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
 *
 * The panel is a shadcn Popover, so open/close, focus return, Escape, click
 * outside, and positioning are Radix's job rather than hand-rolled here.
 */
export function ShareShow({ show, className }: { show: Show; className?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [card, setCard] = useState<{ url: string; blob: Blob; index: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const building = useRef(false);

  const url = showUrl(show);
  const heading = showHeading(show);

  // Object URLs outlive the component unless they are handed back.
  useEffect(() => () => { if (card) URL.revokeObjectURL(card.url); }, [card]);

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

  // Opening builds the first card if there isn't one yet; a card already in
  // hand is reused, so reopening is instant.
  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !card) build(0);
    if (!next) setCopied(false);
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

  const action = "readout w-full justify-start rounded-none hover:border-ember hover:bg-ember/10 hover:text-ember";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "readout rounded-none text-muted-foreground hover:border-ember hover:bg-ember/10 hover:text-ember",
            className,
          )}
        >
          {status === "working" && !card ? <Loader2 className="animate-spin" /> : <Share2 />}
          Share
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        aria-label={`Share ${heading}`}
        className="max-h-(--radix-popover-content-available-height) w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-none border-border bg-background p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="readout text-ember">Share</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close share panel"
            className="-mt-1 -mr-1 p-1 text-muted-foreground transition-colors hover:text-ember"
          >
            <X className="size-4" />
          </button>
        </div>

        {card ? (
          <>
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
                <ToggleGroup
                  type="single"
                  value={String(card.index)}
                  onValueChange={(value) => {
                    if (value) build(Number(value));
                  }}
                  aria-label="Photo on the card"
                  className="mt-2 w-full justify-start gap-2 overflow-x-auto pb-1"
                >
                  {show.photos.map((photo, index) => (
                    <ToggleGroupItem
                      key={photo.src}
                      value={String(index)}
                      aria-label={photo.caption}
                      className="size-12 flex-none rounded-none border border-border p-0 opacity-60 transition-opacity hover:opacity-100 data-[state=on]:border-ember data-[state=on]:opacity-100"
                    >
                      <img src={photo.src} alt="" className="size-full object-cover" />
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
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
          </>
        ) : status === "failed" ? (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Could not build the card.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => build(0)}
              className={cn(action, "mt-3")}
            >
              Try again
            </Button>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Building the card…
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
