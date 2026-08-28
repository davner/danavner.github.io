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
  display:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(3.25rem, 13vw, 9rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.015em"
  display-long:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "clamp(1.75rem, 6.4vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Anton, Anton Fallback, Arial Narrow, Haettenschweiler, Impact, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter Variable, Inter Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Variable, Inter Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.75
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono Variable, JetBrains Mono Fallback, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.68rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.18em"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
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
at nine rems of screen width, with a 0.68rem monospace readout sitting under it
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
different ways - `text-muted-foreground/70`, `opacity-70` on a wrapper, and
`text-ember/50` - so there is no single spelling to grep for, and a lint rule
that matched the two most common would have missed the third.

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

- **Display** (400, `clamp(3.25rem, 13vw, 9rem)`, 0.86, `-0.015em`, uppercase):
  page titles, one or two short words, set as large as the page will carry. Line
  height under 1 and negative tracking are what make it read as a poster rather
  than a headline.
- **Display Long** (400, `clamp(1.75rem, 6.4vw, 4.5rem)`): the same face for a
  title that is a whole phrase, sized so a long line still clears a 320px screen
  without breaking mid-word. There is no third size.
- **Headline** (400, `1.875rem` rising to `2.25rem`, 0.95): section headings
  inside long-form prose, still in the display face.
- **Title** (600, `1.25rem`): sub-headings in prose, set in the body face.
- **Body** (400, `1.0625rem`, 1.75): everything read at length, capped around
  `max-w-2xl` so a line stays comfortable.
- **Label** (500, `0.68rem`, `0.18em`, uppercase, mono): section labels, dates,
  venue lines, catalogue numbers, telescope names. The instrument scale.

### Named Rules

**The Two Voices Rule.** A screen speaks at poster scale or at instrument scale.
Text that is neither, sitting between the display face and the readout, is
usually a heading that has not decided what it is.

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

**The Type Scales, The Layout Steps Rule.** Prefer `clamp()` on the display face
over a new breakpoint. The grid changes rarely and the type changes constantly.

## Elevation & Depth

**There are no shadows in this system, and that is the design.** Surfaces are
flat and separated by a hairline border. Cards and popovers are distinguished
from the page by a single step of lightness, not by lifting off it.

Depth comes from two fixed layers behind everything: a radial ember bloom in the
top `80vh` of the viewport, and a film-grain texture generated as an SVG
turbulence filter at 3.5% opacity in the light theme and 5% in the dark. Their
job is to stop flat colour reading as flat. Nothing else is doing depth work, and
the grain is the mechanism rather than the mood.

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

Near-square, everywhere. The radius scale runs from 3px to 8px off a 4px base,
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
  there are more than a handful. Hover goes ember. The current route is marked.
  On small screens the nav collapses into a sheet.

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

### Named Rules

**The Commit On Hover Rule.** An interactive element does not hint. Border, text
and background move to ember together, so the whole control becomes the target.

**The One Ring Rule.** The focus indicator is defined once, in the base layer. A
component that wants its own is almost always a component that is about to ship
without one.

## Do's and Don'ts

### Do:

- **Do** set page titles in the display face at `clamp(3.25rem, 13vw, 9rem)`, or
  at the long size when the title is a phrase. There is no third size.
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
  overflowing text scrolls only while hovered or focused.

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
