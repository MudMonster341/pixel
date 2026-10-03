---
status: accepted
date: 2026-10-03
authored_by: agent
derived_from: ["owner design interview 2026-10-03 (credits scene: Happy Birthday Taru, Happy 22, wishes one by one)", "docs/STORY.md", "docs/plans/2026-10-03-birthday-sprint.md"]
supersedes: null
superseded_by: null
---

# 0019 — The ending is the card plus a credits phase; the recipient is Taru

## Context

The owner will make the final digital card later (assets arrive in a day or two). For now the game needs a
finished ending that works on placeholders: "a sort of end of credits scene... happy birthday Taru, happy
22 and wishes, slowly showing up one by one, not too long".

## Decision
- The existing box opening and animated card stay. After the card's last message a **credits phase** plays:
  "Happy Birthday, Taru", then "Happy 22", then about 8 short wishes fade in one at a time (~3 s each,
  ~35 s total), then THE END and "Made for you by Mustafa". Esc skips; a soft tone that matches the card.
- **Data:** `assets/card/card.json` gets `wishes` (list) and `age` next to `recipient`; every field is
  optional with built-in defaults (recipient "Taru", age 22, 8 generic warm wishes the owner will edit).
  Real photos and the closing video still drop in as documented in STORY.md.
- **Her name:** she can type any name at the start (the field is prefilled "Taru"). The credits always use
  the card's `recipient`, not the typed name, so the gift always names Taru.
- The placeholder wishes stay generic and soft: nothing personal that an agent would have to invent.
- "Watch the card again" replays the card and the credits.

## Consequences
- STORY.md's rule "recipient falls back to the typed name" changes: the default is now "Taru".
- The wishes are the first thing the owner edits when the real card content arrives.
