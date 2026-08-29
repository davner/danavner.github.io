# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: people who already know Dan.** Friends, family, and people who follow
what he is up to. They arrive to see what he is doing at the moment and what he
has been going to, collecting, reading, and playing. The now page and the
hobby logs are the point of the site for this reader, not an accompaniment to
something else.

**Secondary, confirmed: people forming a professional impression.** The career
page exists because it should be somewhere, and representing Dan well
professionally is one of the site's success conditions - but it is not the
reader the site is designed around, and a decision that improves the career page
at the expense of the now page is the wrong trade.

Developers who find the repository and consider forking it are served by the
README's "Making it yours" section. They are a real audience and not a target
one; nothing in the site's design owes them anything.

## Product Purpose

A personal site that says what Dan is doing right now and keeps a running record
of what he goes to, owns, reads, and plays.

Success is three things, confirmed in the user's own words:

| Condition                                       | What failure looks like                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| It stays current                                | A now page from four months ago, a show that never got logged. A stale personal site is worse than not having one. |
| It represents him well professionally           | Someone arriving from LinkedIn forms an inaccurate or unflattering impression of his work.                         |
| It is a satisfying thing to own and tinker with | The site becomes a chore to maintain, or so fragile that changing it is frightening.                               |

"Usable by anyone" was offered as a fourth success condition and deliberately
not selected, while WCAG 2.2 AA was confirmed as the standard. Accessibility is
therefore a constraint the work is held to, not a measure of whether the site is
doing its job. Both facts are true and future work should not collapse them into
each other.

## Positioning

Everything on the site is markdown or JSON read and validated at build time, so
content that would ship broken fails `npm run build` instead of reaching the
live site. A missing photo path, a show with no lineup, a now entry with no
prose, two entries dated the same day: all of them are build failures.

Several collections maintain themselves. Vinyl comes from Discogs nightly,
comics from League of Comic Geeks, Fortnite from its own job. What is left for a
person to write is the part a person should write.

## Operating Context

- Content is edited by hand or through Sveltia CMS at `/admin/`, which commits
  to the repository on the author's behalf. There is no server and no database
  behind either path.
- Photos enter through `scripts/optimize-photos.mjs`, which resizes,
  re-encodes, and strips EXIF. Phone photos carry GPS and a show log is a record
  of where someone was at a known time.
- The site deploys from `main` via GitHub Actions to GitHub Pages.
- Vinyl is one Discogs account shared with Alexis, filterable by owner, because
  the two of them disagree about what music is good.
- New comic day is Wednesday, which is the shelf's natural rhythm.

## Capabilities and Constraints

- **Static, no backend, no database.** Anything requiring a server is off the
  table. This has already decided at least one product question: the visitor
  counter was removed rather than proxied, because making the analytics
  first-party would need a backend that does not exist.
- **Content that can be wrong fails the build.** This is load-bearing and should
  not be softened into a runtime fallback.
- **One outbound request.** A cookie-free GoatCounter pageview beacon, and
  nothing else. `tests/links.spec.ts` fails the build if any request goes
  anywhere but this origin and GoatCounter. No font CDN, no third-party scripts.
- **Permissively licensed dependencies only** (MIT, ISC, Apache-2.0,
  BSD-3-Clause, OFL-1.1 for fonts).
- **No numbers on the page that cannot be relied on.** The visitor counter was
  removed because ad blockers match on domain rather than intent, so it showed a
  dead number to anyone running uBlock Origin, AdGuard, or Pi-hole. A number
  nobody but Dan looks at can be approximate; a number printed on the page
  cannot.

## Brand Commitments

- The site is `danavner.com` and speaks in Dan's own first person: dry,
  specific, and willing to be unimpressive about itself.
- **Never use the em dash.** A plain hyphen instead. This is a standing rule in
  `CLAUDE.md` and applies to prose, code comments, and documentation alike.
- The existing visual system is incumbent authority, and `DESIGN.md` at the
  repo root is where it is written down: the palette, the type scale, the
  components, and a do/don't list that the code already cites by name. The
  tokens and the CSS remain what actually ships.

## Evidence on Hand

Real, and usable as proof:

- A decade of career history in astronomy software - NOIRLab / AURA, Caltech /
  IPAC, University of Arizona Steward Observatory - currently leading
  architecture and frontend design for GPP Resource at NOIRLab.
- Education: M.S. Applied Physics, Northern Arizona University; University of
  Florida.
- Real content in every collection: a show log with photos, a vinyl shelf from
  Discogs, a comics shelf, Fortnite season history, blog posts, and now entries.

Absences that future work must not paper over:

- No testimonials, customers, pricing, benchmarks, or press. None exist and none
  should be invented.
- No now entry currently carries photos, so the now page's poster and carousel
  paths are built but unexercised by real content.

## Product Principles

1. **Current beats complete.** A short, recent now entry does more for this site
   than a long, old one. Anything that makes updating harder is a cost against
   the site's first success condition.
2. **The record is the product.** The shows, the shelves, and the now archive
   are the thing people come for. Nothing written before is lost when something
   new is added.
3. **Wrong content fails the build, not the reader.** Validation belongs at
   build time, where the author sees it, rather than as a graceful degradation
   the visitor sees.
4. **Owning it is part of the point.** The site is a workshop as much as a
   publication, so maintainability and the pleasure of working on it are real
   requirements, not overhead.
5. **Professional credibility is a constraint, not the subject.** The career
   page has to be right. It does not have to be first.

## Accessibility & Inclusion

**WCAG 2.2 Level AA**, confirmed 2026-08-28. `tests/a11y.spec.ts` runs axe at
the 2.2 A and AA tags on every route in both themes, and fails on any rule that
reaches no verdict as well as on any that fails.

Durable, and easy to overstate in either direction: **axe decides most of the
colour contrast on this site, and not all of it.** Measured across all 13 routes
in both themes, 2,292 contrast nodes: 1,896 pass, none fail, and 396 - 17% -
come back `incomplete`, meaning the check ran and could not reach an answer. The
reasons are specific and bounded:

| Nodes | Why axe could not decide                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------- |
| 309   | The grain overlay is a background image, and axe will not guess what is behind one                   |
| 46    | `text-foreground/90` in the prose styles resolves to an `oklab()` string axe's colour parser rejects |
| 12    | A background gradient                                                                                |
| 12    | A pseudo-element behind the text                                                                     |
| 9     | Text partially overlapping another element                                                           |
| 8     | A run too short for axe to call it text                                                              |

So a green axe run is real evidence about most of this site's colour and no
evidence at all about that 17%. The 17% is measured from painted pixels instead.

A second gap is not about contrast at all: the suite only ever sees a route as
it loads. Two of the six failures the 2026-08 audit found were in states it
never enters - a navigation label at 3.28:1 inside the mobile menu, which axe
reports as an ordinary violation the moment the sheet is open, and focusable
content inside an `aria-hidden` subtree with the sort listbox open. Both are
fixed. The blind spot is not.
