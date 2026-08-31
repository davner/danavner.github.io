import {
  Check,
  Copy,
  Download,
  ImageIcon,
  Link2,
  Loader2,
  RotateCcw,
  Share2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Card } from "@/lib/card-canvas";
import type { Photo } from "@/lib/photo";
import { cn } from "@/lib/utils";

type Status = "idle" | "working" | "ready" | "failed";

/**
 * Whatever is being shared, reduced to the six values the sheet reads.
 *
 * The sheet is one component rather than one per subject because a show and a
 * now entry want the same thing: a poster built from the entry, the link, and
 * the four actions over them. They differ only in these values, so a second
 * copy of the status machine and the object-URL lifecycle would be two things
 * to keep in step and no new behaviour.
 */
export interface Shareable {
  /** Accessible name, the OS share sheet's title, and the preview image's alt. */
  heading: string;
  /** Canonical absolute URL. Never printed as text; the buttons carry it. */
  url: string;
  /** Basename for the saved PNG, no extension. */
  filename: string;
  /** Cover candidates. More than one shows the picker. */
  photos: Photo[];
  /**
   * Draws the poster. Absent means link-only: no preview, no picker, no card
   * actions, and no loading state to sit through. A now entry with no photos is
   * what enters that path - without a photo the top third of the card is empty
   * and the biggest thing on it is a date.
   */
  renderCard?: (photoIndex: number) => Promise<Card>;
}

/**
 * Share sheet for one subject: a poster rendered from it, and the link.
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
export function Share({ subject, className }: { subject: Shareable; className?: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [card, setCard] = useState<{
    url: string;
    blob: Blob;
    index: number;
    truncated: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const building = useRef(false);

  const { heading, url, filename, photos, renderCard } = subject;

  // Object URLs outlive the component unless they are handed back.
  useEffect(
    () => () => {
      if (card) URL.revokeObjectURL(card.url);
    },
    [card],
  );

  async function build(index: number) {
    // A ref rather than the status, which is stale inside this closure. Two
    // fast presses would otherwise race and the loser could land last.
    if (!renderCard || building.current) return;
    building.current = true;
    setStatus("working");

    try {
      const { blob, truncated } = await renderCard(index);
      // Replacing `card` revokes the previous object URL through the cleanup
      // above, so switching photos does not leak one per press.
      setCard({ blob, url: URL.createObjectURL(blob), index, truncated: Boolean(truncated) });
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

  const file = card ? new File([card.blob], `${filename}.png`, { type: "image/png" }) : null;
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

  const action =
    "readout w-full justify-start rounded-none hover:border-ember hover:bg-ember/5 hover:text-ember";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "readout rounded-none text-muted-foreground hover:border-ember hover:bg-ember/5 hover:text-ember",
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
        className="max-h-(--radix-popover-content-available-height) w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-none border-border bg-background p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="readout text-ember">Share</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close share panel"
            className="-mt-1 -mr-1 cursor-pointer p-1 text-muted-foreground transition-colors hover:text-ember"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nothing at all when there is no renderer: a link-only subject has no
            preview to show, no picker, and no build to wait through. */}
        {!renderCard ? null : card ? (
          <>
            <img
              src={card.url}
              alt={`Share card for ${heading}`}
              aria-busy={status === "working"}
              /* Machine-readable, because the alternative way to check that a
                 long entry's card says where the rest is would be a human
                 opening a PNG - a step that fails open. */
              data-truncated={String(card.truncated)}
              className={cn(
                "mt-3 max-h-56 w-full border border-border object-contain transition-opacity",
                status === "working" && "opacity-50",
              )}
            />

            {/* Which photo tops the card. Only worth showing when there is a
                choice to make - one photo is not a picker, it is a thumbnail of
                the picture already on screen. */}
            {photos.length > 1 ? (
              <div className="mt-3">
                <p className="readout-dim">Cover</p>
                <ToggleGroup
                  type="single"
                  value={String(card.index)}
                  onValueChange={(value) => {
                    if (value) build(Number(value));
                  }}
                  aria-label="Photo on the card"
                  /* The padding is the focus ring's room. A scroller clips at
                     its padding box, and `overflow-x: auto` forces the block
                     axis to `auto` as well, so a thumbnail flush against the
                     start of the strip loses the left and top of its ring with
                     nothing there. Pulled back out by the negative margin, so
                     the strip still lines up with the label over it. Outward
                     rather than an inward stroke, which on a photograph has no
                     contrast to guarantee. */
                  className="-mx-2 -mb-2 w-auto justify-start gap-2 overflow-x-auto p-2"
                >
                  {photos.map((photo, index) => (
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
          </>
        ) : status === "failed" ? (
          <p className="mt-3 text-sm text-muted-foreground">Could not build the card.</p>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Building the card…
          </p>
        )}

        {/*
         * The link actions render in every state, which is why this block is out
         * here rather than inside the `card` branch. A card that cannot be drawn
         * is still a page worth sending, so the one thing the panel can always
         * do must not be withheld exactly when it is needed.
         *
         * The card actions stay conditional on there being a card, because
         * there is nothing to save or send without one.
         */}
        <div className="mt-3 flex flex-col gap-2">
          {card && canShareImage ? (
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

          {card ? (
            <Button asChild variant="outline" size="sm" className={action}>
              <a href={card.url} download={`${filename}.png`}>
                <Download />
                Save the card
              </a>
            </Button>
          ) : null}

          {status === "failed" ? (
            <Button variant="outline" size="sm" onClick={() => build(0)} className={action}>
              <RotateCcw />
              Try again
            </Button>
          ) : null}

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
      </PopoverContent>
    </Popover>
  );
}
