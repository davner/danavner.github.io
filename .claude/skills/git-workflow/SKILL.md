---
name: git-workflow
description: Rules for staging, committing, and pushing in this repo. Use whenever the user asks to commit, push, stage, amend, rebase, revert, or otherwise change git history or branches.
---

# Git workflow

## Before committing

1. Run the tests and formatting checks that cover the change.
2. Stage only the files relevant to the task. Never `git add .`.
3. Show `git status --short` and summarise the staged diff.
4. Wait for explicit instruction to commit. Do not commit or push unprompted.

## Commit messages

Conventional Commits: `type(scope): summary`.

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `ci`, `build`, `chore`.

Scope is a ticket ID when one appears in the branch name or earlier in the
conversation, for example `fix(GPP-123): stop the scheduler dropping targets`.
Otherwise use the area of the codebase, or omit it.

Never add yourself as a commit co-author. No `Co-Authored-By` trailer, no
agent-session trailer, no agent name in the message body. Commits are authored
by the user alone.

Explain why the change was needed, not just what changed. Wrap the body at 80
columns.

## Rebasing onto a moved `main`

`main` keeps a linear history, so this one case is pre-approved: when a push is
rejected because `main` moved under you, rebase your own unpushed commits onto
the new tip rather than merging. No need to ask.

It comes up on its own here. The nightly `vinyl` job commits to `main` on its
own schedule, and a push that races it would otherwise leave a merge commit
describing nothing but the collision.

Rebasing commits that are already on the remote is a different thing, and still
needs asking - see below.

## Never without explicit approval

- `git commit --amend` on a commit that is already pushed
- `git rebase` that rewrites commits already on the remote, plus
  `filter-branch` and history rewriting generally
- `git reset` that discards commits
- `git push --force`. When a force-push is approved, `--force-with-lease` is the
  only acceptable form: it refuses the push if a bot landed a commit while you
  were rewriting, instead of silently overwriting it.
- deleting a branch, local or remote

Asking is cheap. Recovering a force-pushed branch is not.

## Branches

Never use branch names containing the agent's name. Use `type/short-summary`,
for example `feat/show-photo-strip`, or the ticket ID when there is one.

Merge into `main` only when explicitly told to.
