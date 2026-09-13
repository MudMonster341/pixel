---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: ["owner request 2026-09-13: a proper pipeline of automated tests that runs every push"]
supersedes: null
superseded_by: null
---

# 0005 — Unit tests with node:test, browser tests with Playwright, run before every push and on GitHub

## Context
Until now every change was checked by hand in the browser. The owner asked for automated tests on
every push, so features keep working as the game grows. Most of the game is timing and rendering
(keys, physics, scene changes), which only a real browser exercises. [ADR 0003](0003-no-build-step.md)
said "no npm dependencies".

## Options considered
1. **Unit tests only (`node:test`, built into Node).** No install. Can't catch gameplay bugs:
   input, collisions, scene restarts, UI.
2. **Playwright (browser) + `node:test` (unit), run by a pre-push hook and GitHub Actions.** Plays
   the real game in Chromium. Cost: the first npm devDependency, about 115 MB of Chromium locally,
   and each push waits for the suite (about 1.5 minutes today).
3. **Cypress.** A comparable browser runner, but heavier to install, with a separate app and
   weaker multi-page support. Nothing it offers is needed here.
4. **Puppeteer with a hand-rolled runner.** Drives Chrome, but has no test runner, auto-waiting,
   traces or reports.

## Decision
Use option 2. The very first run caught a real input bug that manual testing had missed
([ERR-0001](../ERRORS.md)), which is exactly the kind of regression this is meant to stop.

## Consequences
- Easy: every feature and every feedback fix gets a test; failures come with a trace to replay.
- Easy: map content is validated automatically (tiles, reachability, doors).
- Hard: pushes take longer, and tests that depend on timing need care (single worker, polling
  instead of sleeps, wide movement margins).
- Amends ADR 0003: npm dependencies are now allowed **for development tooling only**. The game itself
  still loads nothing from npm and needs no install to run.
- Revisit if: the suite takes longer than about 5 minutes. Then run browser tests in parallel, or only
  on GitHub, in a new ADR.

## Links
- Related: [ADR 0003](0003-no-build-step.md), [ADR 0006](0006-dev-feedback-loop.md), [docs/TESTING.md](../docs/TESTING.md)
- Failure caught on the first run: [ERR-0001](../ERRORS.md)
