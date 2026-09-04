---
name: danavner.com
description: A tour poster and a star chart, printed on the same press.
colors:
  flyer-red: "oklch(0.53 0.22 30)"
  flyer-red-hot: "oklch(0.66 0.225 32)"
  photocopy-cyan: "oklch(0.5 0.13 215)"
  photocopy-cyan-bright: "oklch(0.82 0.14 197)"
  bone: "oklch(0.6 0.05 268)"
  bone-bright: "oklch(0.93 0.02 90)"
  newsprint: "oklch(0.965 0.008 85)"
  newsprint-raised: "oklch(0.995 0.004 85)"
  press-black: "oklch(0.115 0.014 268)"
  press-black-raised: "oklch(0.155 0.016 268)"
  ink: "oklch(0.16 0.012 268)"
  ink-reversed: "oklch(0.95 0.008 90)"
  ink-faded: "oklch(0.46 0.014 268)"
  ink-faded-reversed: "oklch(0.68 0.016 268)"
  rule: "oklch(0.85 0.01 85)"
  rule-reversed: "oklch(0.26 0.018 268)"
typography:
  hero:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(4rem, 17vw, 12.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.015em"
  poster:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(3.25rem, 13vw, 9rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.015em"
  poster-long:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(1.75rem, 6.4vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.015em"
  feature:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(3rem, 2rem + 5vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(1.5rem, 1.1rem + 2vw, 2.25rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Variable, Inter Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.25rem, 1.05rem + 1vw, 1.5rem)"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  lede:
    fontFamily: "Inter Variable, Inter Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5556
    letterSpacing: "normal"
  body:
    fontFamily: "Inter Variable, Inter Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  sm:
    fontFamily: "Inter Variable, Inter Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4286
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono Fallback, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.18em"
rounded:
  sm: "3px"
  md: "4px"
  lg: "4px"
  xl: "4px"
spacing:
  gutter: "1rem"
  gutter-wide: "1.5rem"
  title-gap: "1.5rem"
  prose-gap: "1.25rem"
  section-gap: "6rem"
components:
  button-primary:
    backgroundColor: "{colors.flyer-red}"
    textColor: "{colors.newsprint}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
    typography: "{typography.title}"
  button-outline:
    backgroundColor: "{colors.newsprint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.25rem"
  button-outline-hover:
    backgroundColor: "{colors.flyer-red}"
    textColor: "{colors.flyer-red}"
    rounded: "{rounded.md}"
  rail-pill:
    backgroundColor: "{colors.newsprint}"
    textColor: "{colors.ink-faded}"
    rounded: "0"
    padding: "0.5rem 0.75rem"
    typography: "{typography.label}"
  rail-pill-current:
    backgroundColor: "{colors.flyer-red}"
    textColor: "{colors.newsprint}"
    rounded: "0"
    padding: "0.5rem 0.75rem"
    typography: "{typography.label}"
  panel:
    backgroundColor: "{colors.newsprint-raised}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "1.25rem"
---

# Design System: danavner.com

## Overview

**Creative North Star: "Deep Field / Gig Flyer"**

Two things Dan cares about share a visual language. The tour poster and the star
chart are both stark, both mostly black, and both put enormous type next to
small, precise data. That collision is the whole system: an Anton headline set
at nine rems of screen width, with a 0.6875rem monospace readout sitting under it
spelling out a venue, a catalogue number, or a date. Neither element apologises
for the other.

The palette follows from that. Press black and bone type, a flyer red for heat
and emphasis, a photocopy cyan for readouts and machine output. The light theme
is not a separate design; it is the same poster printed on newsprint instead of
pinned to a wall, which is why its background is a warm off-white rather than
pure white and why the type is near-black rather than grey.

Nothing here is soft. Corners are 4px at most and usually square, separation is
a hairline rather than a shadow, and the only thing standing between flat colour
and the reader is a film-grain layer and a single ember bloom at the top of the
page. This is a site that would rather look printed than rendered.

**Key Characteristics:**

- Poster-scale display type against instrument-scale mono labels, with almost
  nothing in between
- Near-square geometry: a 4px radius that reads as square at every size that
  matters
- Flat surfaces separated by hairlines; grain and a single bloom supply all the
  depth there is
- One hot accent, spent sparingly, and one cold one reserved for machine output
- Two themes that are the same artefact on different stock, not a light design
  and a dark design

## Colors

A four-colour press: black, bone, one hot ink, one cold one.

### Primary

- **Flyer Red** (`oklch(0.53 0.22 30)` light, `oklch(0.66 0.225 32)` dark): the
  site's only warm accent and its entire emphasis budget. It marks the current
  item, the hovered control, the focus ring, the bullet before a list item, the
  keyword in a code block, and the `w/` before a support act. In the dark theme
  it runs hotter and lighter, which is why type on top of it is near-black
  rather than bone: white on that orange only reaches 3.35:1, while dark type
  clears AA and reads more like hazard tape, which suits the poster.

### Secondary

- **Photocopy Cyan** (`oklch(0.5 0.13 215)` light, `oklch(0.82 0.14 197)` dark):
  the cold counterpart, reserved for machine output and things that are not
  warm. Strings in syntax highlighting, the shimmer across the solo-run badge.
  It is never used for emphasis; that is Flyer Red's job, and mixing them
  weakens both.

### Tertiary

- **Bone** (`oklch(0.6 0.05 268)` light, `oklch(0.93 0.02 90)` dark): a pale
  near-neutral for quiet marks that still need to be a colour rather than a
  grey.

### Neutral

- **Newsprint** (`oklch(0.965 0.008 85)`): the light theme's page. Warm
  off-white, never pure white, because the metaphor is stock rather than screen.
- **Newsprint Raised** (`oklch(0.995 0.004 85)`): cards and popovers in the
  light theme, a single step brighter than the page.
- **Press Black** (`oklch(0.115 0.014 268)`): the dark theme's page. Blue-shifted
  rather than neutral, which is what keeps it reading as deep field rather than
  as grey.
- **Press Black Raised** (`oklch(0.155 0.016 268)`): cards and popovers in the
  dark theme.
- **Ink** (`oklch(0.16 0.012 268)`) and **Ink Reversed**
  (`oklch(0.95 0.008 90)`): body type in each theme.
- **Ink Faded** (`oklch(0.46 0.014 268)` light, `oklch(0.68 0.016 268)` dark):
  secondary type. This is already the dim value; do not dim it further with an
  alpha, which is how the timeline's year label shipped at 3.28:1.
- **Rule** (`oklch(0.85 0.01 85)` light, `oklch(0.26 0.018 268)` dark): every
  border and divider on the site.

### Named Rules

**The One Hot Ink Rule.** Flyer Red is the only warm colour in the system and it
is spent, not spread. If a screen has more than a few ember marks on it, they are
competing rather than pointing, and the newest one is probably the one to cut.

**The Cold Ink Is Machine Output Rule.** Photocopy Cyan marks what a machine
produced or a state that is not warm. It never substitutes for Flyer Red as an
accent, and the two never sit adjacent as a pair.

**The No Second Dimming Rule.** `ink-faded` is the dim token. Applying an alpha
on top of it produces text that fails contrast. If something needs to be quieter
than `ink-faded`, it needs to be smaller or further away, not fainter. The same
applies to the accents: `text-ember` and `text-ion` are already the saturated
value, and an alpha over either lands under 4.5:1 at readout sizes.

It has shipped five times: the timeline's year label at 3.28:1, the mobile nav's
group heading at 3.28/3.88:1, the solo badge's "1P" at 2.91:1, the duo badge's
"2P" at 3.78/3.25:1, and its separator at 2.61/2.11:1. The alpha arrived three
different ways - a `/70` alpha on the muted-foreground token, an `opacity-70`
on a wrapper, and a `/50` alpha on ember - so there is no single spelling to
grep for, and a lint rule that matched the two most common would have missed the
third. The spellings are described rather than written out, because Tailwind
scans this file and naming one puts its CSS back in the bundle.

**There is deliberately no automated check for the mechanism.** What is worth
catching is the consequence, and the consequence is a contrast number, which
axe already produces wherever it can resolve the background - it reported the
nav heading as an ordinary violation. The reason that one shipped is not that
contrast is unmeasurable; it is that `tests/a11y.spec.ts` only ever looks at a
route as it loads, and nobody had opened the menu. Extending that sweep to the
states a route load never reaches is the guard worth building. A rule that
hunts for the alpha instead would be a second thing to maintain that has to
agree with the first, and would still be blind in exactly the same places.

**The Same Artefact Rule.** The two themes are one design on different stock.
A colour decision that only makes sense in one theme is not finished.

## Typography

**Display Font:** Anton (with Arial Narrow, Haettenschweiler, Impact)
**Body Font:** Inter Variable (with system sans)
**Label/Mono Font:** JetBrains Mono Variable (with SFMono-Regular, Menlo)

**Character:** Anton is drawn tight and heavy and is used at sizes that make it
architecture rather than text. Inter carries everything a person actually reads.
JetBrains Mono, uppercased and tracked wide, is the instrument label. The gap
between the largest and smallest is enormous and deliberate, and the middle is
kept nearly empty.

### Hierarchy

Every step is a `clamp()` on the display face, so type scales with the viewport
and the layout is the only thing that steps. Asking for a stock Tailwind size
generates no CSS at all, which is louder than rendering at a size nobody chose.

- **Hero** (400, `clamp(4rem, 17vw, 12.5rem)`, 0.86, `-0.015em`, uppercase): the
  largest mark on the site. The wordmark on the landing page and the numeral on
  the 404, and nothing else.
- **Poster** (400, `clamp(3.25rem, 13vw, 9rem)`): a page title of one or two
  short words, set as large as the page will carry. Line height under 1 and
  negative tracking are what make it read as a poster rather than a headline.
- **Poster Long** (400, `clamp(1.75rem, 6.4vw, 4.5rem)`): the same face for a
  title that is a whole phrase, sized so a long line still clears a 320px screen
  without breaking mid-word.
- **Feature** (400, `clamp(3rem, 2rem + 5vw, 4.5rem)`): one figure or one line
  standing alone, where a heading-scale number would stop reading as a figure.
- **Heading** (400, `clamp(1.5rem, 1.1rem + 2vw, 2.25rem)`, 0.95): a section
  heading, a card title, a stat figure, a prose `h2`. Still the display face.
- **Title** (600, `clamp(1.25rem, 1.05rem + 1vw, 1.5rem)`): a tile title or a
  prose sub-heading, in either face depending on which side of the collision it
  belongs to.
- **Lede** (400, `1.125rem`, 1.5556): the paragraph under a page title, and
  intro prose.
- **Body** (400, `1.0625rem`, 1.5 on the page and 1.75 inside prose): everything
  read at length, capped around `max-w-2xl` so a line stays comfortable. It is
  set on `body`, never on `html`, because a root font-size rescales every `rem`
  in the spacing scale along with the type.
- **Small** (400, `0.875rem`, 1.4286): a secondary line, and the controls.
- **Label** (500, `0.6875rem`, `0.18em`, uppercase, mono): section labels, dates,
  venue lines, catalogue numbers, telescope names. The instrument scale.

### Named Rules

**The Two Voices Rule.** A screen speaks at poster scale or at instrument scale.
Text that is neither, sitting between the display face and the readout, is
usually a heading that has not decided what it is.

**The Bare Display Step Rule.** Only the two sans steps, `lede` and `sm`, carry
a paired line-height. The six display steps deliberately carry none, because a
size utility out-ranks anything set in a component layer: give `heading` a
leading and it silently beats the `0.86` that makes the poster face a poster.
This asymmetry looks like an oversight and is not. Symmetry here costs every
bare call site its leading.

**The Readout Is Data Rule.** The mono face means this is a fact: a date, a
place, a count, a name from a catalogue. It is not for prose, and prose set in
it reads as a machine talking.

## Layout

A single centred column, `max-w-6xl`, with `1rem` gutters rising to `1.5rem`
above the small breakpoint, and `3rem` of space above the page title rising to
`4rem`. Long-form reading is capped narrower, around `max-w-2xl`, independent of
the shell.

Vertical rhythm is coarse and consistent. `1.5rem` is the standing gap under a
page title whatever follows it. Paragraphs in prose sit `1.25rem` apart, section
headings take `3.5rem` above them, and a major section break is `6rem`. Density
is low by intent: this is a site read at leisure, not a dashboard.

Responsive behaviour is mostly typographic rather than structural. The display
face is set in `clamp()` so it scales with the viewport instead of stepping at
breakpoints, and the layout collapses from paired columns to a single stack.
Nothing on the site may scroll horizontally; the whole route list is swept for it
in the test suite.

### Named Rules

**The Two Steps Rule.** The design has two structural breakpoints and no more:
`sm` (640px) turns the phone menu into a bar and a single column into two, and
`lg` (1024px) brings in the paired-column layouts. `md` (768px) is sanctioned for
a grid that splits there, and for the alignment utilities inside that grid - a
block right-aligned while it is still a full-width stack reads as a mistake, so
text and content alignment step with the grid they belong to or not at all.
Nothing uses `xl` or `2xl`, because the shell caps at `max-w-6xl` and every width
past about 1200px draws the same column. The display face takes no breakpoint at
all - a size that steps where a grid also steps is how a figure ends up wider
than the cell holding it.

**The Type Scales, The Layout Steps Rule.** Prefer `clamp()` on the display face
over a new breakpoint. The grid changes rarely and the type changes constantly.

## Elevation & Depth

**There are no shadows in this system, and that is the design.** Surfaces are
flat and separated by a hairline border. Cards and popovers are distinguished
from the page by a single step of lightness, not by lifting off it.

Depth comes from two fixed layers behind everything: a radial ember bloom in the
top `80vh` of the viewport, and a film-grain texture generated as an SVG
turbulence filter at 3.5% opacity in the light theme and 5% in the dark. Their
job is to stop flat colour reading as flat, and the grain is the mechanism rather
than the mood.

A third layer exists, and exactly one: `.on-air-lamp`, the glow on the dot in
dan.fm's station badge. It is named here rather than left to be found, because a
page carrying an undocumented glow is a page the next reader reverts. What bounds
it is that it says something no border could - one element, one state, derived
from `--ember` through `color-mix`.

It sits on the dot rather than behind the badge, and that is a contrast decision
before it is a visual one. Sized to the badge, the same glow puts ember under an
11px mono label at `0.18em`, which measured 3.44:1 at the animation's peak
against the 4.5 AA needs - and axe returns a node with a pseudo-element under its
text as `incomplete` rather than failing it, so no sweep would have caught that.
On the dot there is nothing to read underneath: it is `aria-hidden` decoration,
the label starts a `gap-2.5` away, and the falloff ends inside that gap. Keep it
there. A glow moved back behind the text is a contrast problem again, and the
build will not say so.

It is not a general-purpose glow. A second call site turns it into a scale, and
this system has no depth scale on purpose.

The one exception in the codebase is `shadow-xs` on filled buttons, inherited
from shadcn. It is small enough not to break the rule and not worth a special
case, but it is not a licence to add a shadow scale.

### Named Rules

**The Flat Press Rule.** Separation is a hairline, a lightness step, or space.
It is never a shadow. A component that needs a drop shadow to be legible has a
contrast problem, not a depth problem.

**The Grain Is Not Decoration Rule.** The grain layer is what keeps large flat
fields from looking dead. It is `aria-hidden`, fixed, and behind everything, and
it must never be removed to "clean up" a surface. Its cost, accepted knowingly,
is a hole in automated colour checking: axe will not guess what is behind a
background image, so 309 of the site's 2,292 contrast nodes come back
`incomplete` rather than pass or fail. That is a bounded hole, not a total one -
axe decides 83% of this site's colour - and what falls in it is measured from
painted pixels instead.

## Shapes

Near-square, everywhere. The radius scale runs from 3px to 4px off a 4px base,
and 4px on a 36px control reads as square with the corner just knocked off. Some
components are fully square by choice: the timeline rail's date pills, the share
panel, the photo frames.

Borders do the work corners do not. A hairline in `rule` marks every panel, every
photo, every table row, and every divider. Where a panel wants to signal that it
is interactive, it grows ember corner ticks on hover, drawn as 8px L-shapes at
opposite corners like registration marks on a printed sheet.

Photos are framed with a hairline and never rounded. Bullets in prose are a 12px
ember rule rather than a disc.

### Named Rules

**The Knocked Corner Rule.** 4px is the maximum radius on anything. If a
component wants to look softer, the answer is that it does not get to.

**The Registration Mark Rule.** Corner ticks mean interactive. They appear on
hover and focus-within, never at rest, and never as pure ornament.

**The Halftone Rule.** A photo in a multi-photo carousel rests screened - grey,
pushed in contrast, a dot lattice over the top, like a picture on newsprint -
and resolves to the true photograph in exactly two ways: under the reader's
pointer, or when focus lands anywhere in the figure hosting the strip, which is
where the prev/next controls live, so tabbing to either resolves the visible
slide. The treatment exists on hover-capable devices only, and never on
identification imagery - not the home portraits, not a record sleeve, not an
album cover - where the picture is the information rather than the atmosphere.
One exemption follows from the mechanism rather than softening it: a
single-photo carousel renders no controls, so it holds nothing focusable, and a
photo with no focusable neighbour is never screened - it shows true at rest
instead of standing behind a screen a keyboard cannot lift. The screen's
crossfade is an opacity change, which the reduced-motion allowlist already
permits; the filter snaps deliberately, because widening that allowlist for one
treatment would loosen a global contract.

## Motion

The register is the snap. A page prints; it does not perform. What moves does
so because the reader's pointer is on it, finishes fast, and moves with the
character of the press - a stamp lands, a drawer glides shut on its rails.

Two curves carry all of it, held as easing tokens in `src/index.css` and
printed by `scripts/make-easings.mjs` from spring constants named beside the
values, so the numbers are regenerable rather than magic. **The stamp**
(`--ease-stamp`) is a critically damped spring that is already moving when it
lands - most of its travel in the first fifth, a short settle, structurally
incapable of overshoot. It times pressed controls, drawn hairlines, and copy
confirmations. **The drawer** (`--ease-drawer`) is over-damped from rest and
spends its whole travel decelerating; it times the mobile sheet. A third curve
arrives when a third character has a second customer, not before.

### Named Rules

**The Two Hundred Rule.** Every duration is 200ms or less. Paper snaps, and a
motion that needs longer to read is a motion carrying more meaning than this
site gives it. The cap binds vendored components too: a stock duration above it
is edited down in place, with the departure documented in the file.

**The Pointer's Motion Rule.** A transform state exists only where a pointer
can be the cause: under the motion-safe condition and, for hovers, on
hover-capable devices. Keyboard activation never moves anything - the same
control pressed from the keyboard swaps state without the travel, delivered by
suppressing the animation wherever focus is visible rather than by tracking
input modality in script. Under reduced motion the transform state is removed
outright, so nothing is left to jump.

**The Allowlist Contract Rule.** The reduced-motion allowlist in
`src/index.css`'s base layer - colour and opacity keep transitioning,
everything else stops - is the contract, and no motion added anywhere widens
it. One bounded survival exists: a reader-triggered, sub-100ms, opacity-only
commit cue may survive reduced motion, because when everything else is stilled
it is the only remaining signal that the action landed. That bound is a
mechanism, not a license - riding an API the CSS kill cannot reach is
sanctioned only inside it, and anything longer, self-starting, or spatial does
not qualify however it is implemented.

## Components

Controls are instrument-precise and poster-loud: square, mono-lettered and exact
until you touch one, at which point they commit fully to ember rather than
hinting at it.

### Buttons

- **Shape:** effectively square (4px radius), 36px tall at the default size.
- **Primary:** filled Flyer Red with near-black type in the dark theme and
  newsprint in the light, `0.5rem 1rem` of padding.
- **Outline:** the site's workhorse. A hairline border on the page background at
  rest. On hover the border, the text and a 10% background wash all go ember at
  once, so it reads as a target rather than lighting up only its edges.
- **Ghost / Link:** available from shadcn, used sparingly. A link-styled button
  underlines on hover rather than changing colour.
- **Focus:** every control takes the site-wide focus ring described below.

### Chips and Pills

- **Filter toggles:** square, mono label, hairline border. Selected state fills
  with Flyer Red and reverses the type.
- **Timeline rail pills:** fully square, mono, in a horizontally scrolling rail.
  The current pill fills ember. These mark position, not selection, and carry
  `aria-current` rather than a checked state.

### Cards and Panels

- **Corner style:** square or 4px.
- **Background:** one lightness step above the page (`newsprint-raised` /
  `press-black-raised`).
- **Shadow strategy:** none. See Elevation and Depth.
- **Border:** a hairline in `rule`, always.
- **Internal padding:** `1.25rem`, rising to `2rem` on larger panels.
- **Interactive panels** grow ember corner ticks on hover and focus-within.

### Inputs and Fields

- Hairline border on the page background, square, mono or body type depending on
  context. Focus is marked by the site ring, except where a field opts out
  deliberately and marks focus with an ember border instead.

### Navigation

- Mono uppercase labels at readout scale, grouped rather than listed flat once
  there are more than a handful. Hover lifts the one label it is on to the full
  foreground and leaves the rest alone; ember is kept for the route you are on,
  which is marked. A group opens on a click, never on a hover, and closes on a
  second click, on Escape, on a link, or on a press outside. On small screens
  the nav collapses into a sheet.

### The Focus Ring

The one component-level rule worth stating in full, because it took ten
declarations across seven components to get wrong:

A 2px ember outline at a 2px offset, defined once on `:focus-visible` and
inherited by everything. The offset is the load-bearing part. This site puts
controls on exactly two kinds of surface, a neutral and ember itself, and no
colour in the palette clears 3:1 against both. Pushing the stroke off the control
means the gap always shows the surface behind, which is neutral everywhere, so
the ember reads at 5.32:1 in the light theme and 5.91:1 in the dark against both
of its edges.

Two consequences: an `outline-none` in a component's classes opts that element
out entirely and needs a stated reason, and a control inside an
`overflow: hidden` container must paint its ring inward with a negative offset
instead.

### The Imprint

The footer closes with a printer's imprint: dim readout lines carrying the
copyright, the last-updated date with an epoch stamp, and the pressing.

The impression number is the deploy workflow's run number. It advances on every
deploy, and deploys fire on every nightly data refresh as well as on every
push, so it moves several times a day with no human change. That is honest for
a pressing - the plates rolled whether or not anyone touched the artwork - and
it is not a bug to file. A build outside CI reads "Proof copy" instead.

The epoch stamp ("J2026.67") is the year plus the fraction of it elapsed:
year + dayOfYear / 365.25, truncated to two decimals, computed from the same commit
timestamp as the last-updated date. It is a house mark wearing Julian-epoch
clothes, not an ephemeris; do not correct it toward or away from astronomical
time.

Every section page and the colophon also carry a catalogue number over the
title, in the dim readout: "DA-005" over Shows. The numbers run in nav order
with the colophon last, and the scheme never renumbers itself - each is a
literal beside the page's meta in `lib/routes.ts`, so pages joining or leaving
the nav cannot shuffle serials already in print, the way a label does not
renumber its back catalogue when a record goes out of press. Content pages - a
show, a post, an album, an archived now entry - are items in the catalogue
rather than pages of it, so they carry none, and the home page is the cover.
The line is hidden from assistive technology on purpose: it restates the h1
plus a decorative serial, and exposing it would put mono noise before every
page title in a screen reader.

### Named Rules

**The Commit On Hover Rule.** An interactive element does not hint. Border, text
and background move to ember together, so the whole control becomes the target.

**The One Ring Rule.** The focus indicator is defined once, in the base layer. A
component that wants its own is almost always a component that is about to ship
without one.

## Do's and Don'ts

### Do:

- **Do** set a page title with `PageHeader`, which offers the poster step and
  the long one. A page that spells its own size out is a page inventing a step.
- **Do** use the mono readout for facts: dates, venues, counts, catalogue
  numbers, place names.
- **Do** separate surfaces with a hairline in `rule` and a single lightness step.
- **Do** let interactive elements commit fully to ember on hover, border and
  text and wash together.
- **Do** keep both themes in mind at once. A colour decision that works in only
  one is unfinished.
- **Do** measure contrast from painted pixels for anything sitting over the
  grain, over a gradient, or over a photograph. axe decides 83% of this site's
  colour and returns "incomplete" for the rest, so a green run proves a lot and
  not everything.
- **Do** tie any motion to the reader. The marquee pauses on hover and
  overflowing text scrolls only while hovered or focused. `.on-air-lamp` is the
  one loop that runs on its own, because there the motion is the meaning: a lamp that
  breathes is what says the station is live, the same way the grain is mechanism
  rather than mood. It pays for the exception by staying small - one element, one
  state, seven seconds, opacity only, never a transform - and by answering
  `prefers-reduced-motion` with the glow held still rather than taken away, since
  a request about movement is not a request to lose the signal.

### Don't:

- **Don't** add a drop shadow. Depth is a hairline, a lightness step, or space.
- **Don't** exceed a 4px radius, or reach for a pill-shaped control.
- **Don't** dim `ink-faded` further with an alpha. It is already the dim value
  and dimming it again fails contrast.
- **Don't** spread Flyer Red. It is an emphasis budget, not a brand colour to
  apply everywhere.
- **Don't** use Photocopy Cyan as a second accent. It marks machine output.
- **Don't** write a component-local focus ring. There is one, in the base layer.
- **Don't** let this drift toward a generic SaaS landing page: rounded cards,
  soft shadows, gradient buttons, three-column icon-and-heading feature grids.
- **Don't** let it drift toward a corporate portfolio template either: tasteful
  neutral greys, a big hero photo, a tidy timeline of roles. This is a personal
  site that happens to have a career page, not a resume that learned CSS.
- **Don't** add scroll-triggered reveals, parallax, or elements that animate in
  as you reach them.
