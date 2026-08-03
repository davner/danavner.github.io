# Show log

One markdown file per show. The filename becomes the slug. Everything at the top of
`/shows` — total, bands seen, venues, most-seen act, the year groups — is derived
from these files, so adding a show is dropping a file in here and nothing else.

```md
---
title: Knocked Loose            # band, or the festival name
type: show                      # "show" (default) or "festival"
date: 2026-06-20                # YYYY, YYYY-MM, or YYYY-MM-DD — use what you remember
endDate: 2026-06-21             # optional, for multi-day festivals
venue: Hollywood Palladium      # optional — omit for festivals without a fixed venue
city: Los Angeles, CA           # required
lineup:                         # optional, in running order. Openers count.
  - Show Me the Body
  - Speed
video: https://youtu.be/xxxxx   # optional, full URL
standout: true                  # optional — adds a flame and pins it to the ticker
---

Free-form markdown about the night. Links, lists, whatever. Optional.
```

Notes:

- `type: festival` keeps the festival name out of the "bands seen" count — only its
  `lineup` counts. A regular show counts its `title` as a band.
- Partial dates are fine. `date: 2026` renders with no day label under the 2026
  heading; `2026-06` renders as "Jun"; a full date renders as "Jun 20".
- Bad frontmatter fails the build with the filename, rather than shipping a broken row.
