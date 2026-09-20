---
status: accepted
date: 2026-09-20
authored_by: agent
derived_from: ["owner brief 2026-09-20: 'i want to create a loop where i wont be interrupted ... have cron jobs or automated startup jobs which work on its own and work till the goals are finished'"]
supersedes: null
superseded_by: null
---

# 0011 — The work runs as a scheduled loop over a roadmap file

## Context
There's more work left than fits in one sitting (story, art, mini-games, packaging, UI polish), and
the owner doesn't want to drive each step. They asked for a job that keeps working on its own until
the goals are done, and chose "every few hours, day and night".

## Decision
- **[docs/ROADMAP.md](../docs/ROADMAP.md) is the single source of truth** for what's left, as ordered
  checkboxes grouped into milestones M1-M7. Tasks are written small enough for one run.
- **A scheduled task ("Pixel game: work the roadmap") runs every 3 hours.** Each run: reads the
  project docs, checks the feedback inbox, takes owner feedback first and otherwise the first
  unchecked roadmap task, briefs a Sonnet agent, reviews and tests the result, ticks the box, updates
  MEMORY.md and CONTEXT.md, commits and pushes, and leaves the game running for the owner.
- **Sonnet agents keep writing the code**; the scheduled run coordinates, exactly like an interactive
  session ([docs/FEEDBACK.md](../docs/FEEDBACK.md)).
- **Owner feedback always beats the roadmap.** Anything sent with the O overlay is handled first.
- A run that hits the account usage limit stops cleanly and records where it stopped, so the next run
  picks it up.

## Consequences
- Scheduled runs only fire while the Claude app is open; a missed run fires at the next launch.
- The loop burns usage limits in the background, which can slow the owner's own sessions. The cadence
  is a dial: it can be moved to nights only.
- Every decision a run makes must be written down (ADR, CONTEXT.md, MEMORY.md), because the next run
  starts with no memory of the last one.
