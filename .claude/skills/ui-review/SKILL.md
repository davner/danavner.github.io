---
name: ui-review
description: Standards for checking the site in a browser. Use when end-to-end testing, verifying a visual change, reviewing layout or styling, taking screenshots, or checking responsive and accessible behaviour.
---

# Looking at the UI

Check the built site, not the dev server. Content and drafts behave differently
between the two.

```bash
npm run build
npm run preview
```

## Be picky

Judge what is on screen, not what the code intends. Screenshot it and look.

Check at 320px, at a phone width, and at desktop. Check both themes, since the
palettes are independent and only one of them is ever in front of you.

Things that are always worth flagging:

- text that wraps badly, breaks mid-word, or overflows its container
- inconsistent spacing between things that should match
- misaligned baselines, especially icons sitting next to text
- a subsection rendering its frame with nothing in it
- contrast that looks marginal, which usually means it is
- motion that ignores `prefers-reduced-motion`

If something clearly looks wrong, fix it, even when it is unrelated to the
current task. Say what you changed.

## Verify, do not assume

A change is not done because the code looks right. Load the page and confirm.
Interact with it: click through, tab through, resize.

`npm test` covers accessibility with axe on every route in both themes, internal
links, broken images, and horizontal overflow. Run it before claiming a visual
change is safe.
