---
name: bug-fixing
description: How to approach a bug in this repo, starting from an end-to-end reproduction. Use when investigating a defect, a regression, something behaving incorrectly, or a failing or flaky test.
---

# Fixing a bug

## Reproduce first, from the outside

Before reading code or forming a theory, reproduce the bug end to end, as close
to how a real user hits it as possible. For this site that means the built app
in a browser, not a unit test and not the dev server:

```bash
npm run build
npm test                  # or drive the specific route with Playwright
```

A bug you cannot reproduce is a bug you cannot verify you fixed. A theory
formed from reading code alone tends to find a plausible cause rather than the
real one.

## Then

1. Narrow the reproduction to the smallest set of steps that still shows it.
2. Fix the cause, not the symptom. If the fix is a workaround, say so plainly
   and explain what the real fix would be.
3. Add or extend a test that fails without the fix. Put it at the level the bug
   was reproduced at, so it guards the behaviour a user actually sees.
4. Re-run the full suite. A fix that breaks something else is not a fix.

## Flaky tests

Treat flakiness as a defect as serious as a wrong result, and fix it when you
see it, including when it is unrelated to the current task.

Find the actual race before changing anything. Adding a sleep, a retry, or a
longer timeout hides the problem and keeps the signal untrustworthy. Ask whether
the flake is in the test or in the product, because a test that races the app
often means users can race it too.

Re-run a suspect test several times before calling it fixed.
