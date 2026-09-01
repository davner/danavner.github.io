import { cn } from "@/lib/utils";

/**
 * The attribution Spotify's Developer Policy asks for: their mark, their name,
 * and a link back, wherever their data is on the page.
 *
 * The mark is monochrome, which is both what their design guidelines allow off
 * a black or white ground and the only version this site's one-hot-ink rule
 * would take - green here would be a second accent. It is drawn black and
 * inverted in the dark theme rather than painted with `currentColor`, because
 * their guidelines forbid recolouring it and `currentColor` would turn it ember
 * the moment it sat inside something that hovers.
 *
 * The link is Spotify itself rather than one album, because this line answers
 * for the page rather than for a row. An album's own link back is the control on
 * its card.
 *
 * It names cover art and nothing else, because a cover is the only thing here
 * Spotify actually supplies: it is a file fetched from them and painted on the
 * page, so a reader can see what is being credited. The caller gates on a saved
 * cover to match, and the two have to move together - a credit naming something
 * the page cannot show is the failure this wording exists to avoid.
 *
 * A release year taken from Spotify is the other candidate, and it is not
 * covered: nothing sets `yearIsPressing` yet, so crediting it now would be the
 * same empty claim. Whatever makes that field true owes this line a second look.
 */
export function SpotifyCredit({ className }: { className?: string }) {
  return (
    <p className={cn("readout-dim flex items-center gap-2", className)}>
      {/* Decorative: the sentence beside it already says Spotify, and a mark
          named as well would have a screen reader say it twice. */}
      <img
        src="/img/dan-fm/spotify-logo.svg"
        alt=""
        width={16}
        height={16}
        className="size-4 shrink-0 dark:invert"
      />
      <a
        href="https://open.spotify.com"
        target="_blank"
        rel="noopener noreferrer"
        className="readout-link"
      >
        Cover art from Spotify
      </a>
    </p>
  );
}
