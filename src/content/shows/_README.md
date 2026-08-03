# Show log

One markdown file per show. The filename becomes the slug. Everything at the top of
`/shows` — total, bands seen, venues, most-seen act, the year groups — is derived
from these files, so adding a show is dropping a file in here and nothing else.

## A normal show

`lineup` is the whole bill, **top billing first**. Openers count — toward the display,
and toward "bands seen".

```md
---
lineup:
  - Knocked Loose         # tops the bill, shown large
  - Show Me the Body      # everyone below is listed as "w/ …"
  - Speed
date: 2026-06-20
venue: Hollywood Palladium
city: Los Angeles, CA
video: https://youtu.be/xxxxx
standout: true
---

Free-form markdown about the night. Optional.
```

A one-band night can skip the list and just say `title: Turnstile`.

## A festival

Festivals get a `title`, because the event is not a band. `lineup` is optional — use
it for whoever you actually caught.

```md
---
title: Vans Warped Tour
type: festival
date: 2026                 # partial dates are fine
endDate: 2026-06-21        # optional, for multi-day
city: Long Beach, CA
lineup:
  - Whoever you saw
---
```

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| `lineup` | shows | Every band, top billing first. No duplicates. |
| `title` | festivals | The event name. On a show, an alternative to a one-item `lineup`. |
| `type` | no | `show` (default) or `festival` |
| `date` | yes | `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` — use what you remember |
| `endDate` | no | Multi-day festivals. Renders as "Nov 15–16". |
| `city` | yes | |
| `venue` | no | Omit for festivals with no fixed venue |
| `video` | no | Full URL. Renders a Watch link. |
| `standout` | no | Adds a flame and pins it to the ticker |

Notes:

- A festival's `title` never counts toward "bands seen" — only its `lineup` does.
- Partial dates render to their precision: `2026` gets no day label under the 2026
  heading, `2026-06` renders as "Jun", a full date renders as "Jun 20".
- Bad frontmatter fails the build with the filename, rather than shipping a broken row.
- Files starting with `_` (like this one) are ignored.
