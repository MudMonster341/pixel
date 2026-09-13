---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: ["owner request 2026-09-13: in-game feedback overlay (dev mode only) that logs items for the agent, who can ask for clarification before implementing"]
supersedes: null
superseded_by: null
---

# 0006 — Dev feedback is saved as files in the repo, through the local dev server

## Context
The owner play-tests and wants to report several things at once from inside the game. The agent has
to be able to read them later, ask clarifying questions, and link each fix to a test. It must only
exist in dev mode. The agent can read local files and run commands, but it can't receive messages
from a browser page.

## Options considered
1. **Create GitHub Issues from the overlay.** Good tracking UI. Cost: a GitHub token in the browser
   page, a network dependency, and the screenshot and game-state context don't fit well.
2. **Store in the browser (localStorage), export by hand.** No server changes. Cost: the agent can't
   see anything until the owner exports, and the history is easily lost.
3. **Files in the repo, written by the local dev server (`POST /api/feedback`), read and answered
   by the agent through a CLI.** The agent reads the files directly, git keeps the history, and it
   only works when `npm start` is running, which also keeps it dev-only.
4. **Keep using chat messages.** Nothing to build. Cost: no screenshot, no position or game state,
   no status tracking, and several items tangled into one message.

## Decision
Use option 3. One JSON file per item plus a screenshot, a status workflow shared by the overlay and
`tools/feedback.js`, and a rule that every fix names its regression test.

## Consequences
- Easy: each report arrives with a screenshot, pointed-at tile, map, position and game state, so
  most items can be reproduced without asking.
- Easy: questions and fix confirmation happen in-game, and the status history shows where each item is.
- Hard: screenshots (about 50–150 KB each) accumulate in git.
- Hard: the agent only sees new items when a session checks. Nothing notifies it automatically.
- The dev server now listens on 127.0.0.1 only, because it accepts writes.
- Revisit if: other people play-test, or the game gets hosted builds. Then move items to GitHub Issues
  or a hosted backend, in a new ADR.

## Links
- Related: [ADR 0005](0005-automated-tests-on-every-push.md), [docs/FEEDBACK.md](../docs/FEEDBACK.md)
