---
status: accepted
date: 2026-10-03
authored_by: agent
derived_from: ["owner design interview 2026-10-03 (talk to every student, facts/clubs from the BITS Dubai site and Instagram, animals, real CS professors)", "docs/STORY.md", "docs/plans/2026-10-03-birthday-sprint.md"]
supersedes: null
superseded_by: null
---

# 0018 — Every ambient student is talkable; campus facts are data

## Context

The campus has ambient students (walk, sit, chat), but they are scenery and some are even buggy
(missing textures). The owner wants a university that feels alive: people to talk to who tell you about
the real campus (clubs, quizzes, facilities, events, departments), plus small animals. The BITS Dubai
site and its public Instagram hold plenty of facts. The owner may add facts himself.

## Decision
- **Every ambient student is talkable** with E: a short role (first-year, a club member, a library regular
  ...) and a pool of 2-3 facts, rotated. She stops, turns toward the player, says a line, then walks on.
  It never blocks a quest door, a key station or a cutscene (story objects win ties, see HANDOFF bug 2).
- **Facts are data** in `src/campus-facts.js` (content is data, ARCHITECTURE.md): `{ id, role, text, source }`.
  About 12 roles and 30-40 facts. The owner edits or adds facts there without touching the engine.
- **Sourcing rule.** Facts come from the official BITS Dubai site and openly visible public pages
  (including the public Instagram if readable without a login; we never log in). Every fact is traced in
  `docs/research/campus-facts.md`. A claim we can't verify is left out. Lines are paraphrased in a friendly
  student voice. No copied photos or quotes. The owner reviews the full list.
- **People rule (amends STORY.md "No real people appear as characters").** Real people still don't appear
  as *characters*. The owner has allowed that **real CS department professors may be *named in facts***
  ("Prof. X teaches ..."), limited to names, titles and roles that are publicly listed by the university.
  No personal details, opinions or invented anecdotes. The owner may supply more.
- **Animals:** cats and birds only, from a free tileset pack (licence checked, credited in CREDITS.md;
  generator art as fallback). A simple idle/walk wander AI, a small reaction when she is near (a cat turns,
  birds flutter off), a couple are talkable (a meow and a heart). A cap on moving sprites per map keeps
  performance.

## Consequences
- More moving sprites: a per-map cap and a performance check before handover.
- New dialogue lines go to the owner for review via the Inbox, like FB-0032.
- Facts can go stale; each carries its source so they are easy to re-check.
