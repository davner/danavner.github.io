# Agent instructions

Always in effect. Task-specific rules live in `.claude/skills/` and load only
when that kind of work starts.

## Writing

- Never use the em dash "-". Use a plain hyphen instead.
- Never hand-edit `CHANGELOG.md` or any file marked auto-generated.

## Technical decisions

- Weight quality, simplicity, robustness, scalability, and long-term
  maintainability over development cost.
- For one-off or infrequent operational work, take the simplest direct
  end-to-end path. Do not add wrappers, control planes, policy layers, custom
  verifiers, or automation until the direct path hits a concrete blocker or a
  repeated need.

## Engineering standards

- Fix lint errors, failing tests, and flaky tests when you encounter them, even
  when unrelated to the current task.
- Before spawning a large swarm of subagents (dynamic workflows, ultra code, or
  any similar harness feature), explain the tradeoffs and get explicit approval.

## Git

Do not commit or push unless explicitly told to. Full rules load from the
`git-workflow` skill when committing.

## This project

Static React site, no backend. Content is markdown validated at build time, so
a malformed post or a missing photo path fails `npm run build` rather than the
live site. See `README.md` for the stack, the content model, and the CI layout.

- `npm run build` type-checks and builds.
- `npm test` runs Playwright against the built site. Build first.
- Deploys from `main` via GitHub Actions.
- Adding a show to the log is the `add-show` skill, not a freehand edit. Adding
  a trip is the `add-trip` skill, same rule.
- Every image entering the repo goes through
  `node scripts/optimize-photos.mjs <folder-under-public/img> <files...>` first.
  It resizes, re-encodes, and strips EXIF - phone photos carry GPS. Then look at
  the result and give it both real `alt` text and a caption. Always both.
