# TODO

Things worth doing, with enough context to pick up cold. Not a backlog of
everything - if an item stops looking worth doing, delete it.

## QR code on the share card

**Why.** A poster shared to an Instagram story is a dead end. Instagram does not
read anything embedded in an image, feed captions do not linkify, and the
tappable sticker Spotify gets comes from a native integration a static site
cannot reach (see "Sharing to Instagram" in `README.md`). A QR is the only way
the image itself leads anywhere: whoever is looking at the story points a camera
at it.

**The design that avoids a runtime dependency.** The card is drawn client-side
on a canvas, so the obvious approach is a QR library in the bundle. It does not
need one. A show's URL is known at build time, so:

1. Add a QR encoder as a **devDependency** (`qrcode` is MIT and never ships).
2. Generate the matrix for each show's URL in `vite-plugin-content.ts`, Node
   side, and put it on the entry as a compact boolean grid.
3. `src/lib/show-card.ts` draws it as filled squares. No encoder in the browser,
   no bytes added to the client bundle.

**Open questions.**

- Where on the 1080×1920 poster. Bottom rule next to the printed URL is the
  obvious spot, but the footer is already tight.
- Quiet zone and contrast. It has to scan off a phone screen showing an
  Instagram story, which is a re-encoded, brightness-adjusted copy of the PNG.
  Test against the real thing, not the local canvas.
- Whether a photoless card wants it bigger, since it has room going spare.

**Done when** a story screenshot scans on a second phone and lands on the show
page.
