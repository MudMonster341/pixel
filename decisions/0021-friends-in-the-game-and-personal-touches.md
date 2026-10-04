---
status: accepted
date: 2026-10-04
authored_by: agent
derived_from: ["owner feedback FB-0051 and FB-0057 (2026-10-04): named friends, fixed Mustafa lines, club colours", "owner: 'the wow aspect isn't there yet'"]
supersedes: null
superseded_by: null
---

# 0021 — The owner's friends are characters in the game, and the wow layer is personal first

## Context
The game is a private birthday gift. CONTEXT.md said "No real people in the game"; ADR 0018 later allowed real CS professors in
sourced facts. After the first playtest the owner asked for their own friends as characters (FB-0051: Sid, Akshit, Varun, Mitul,
Karthik, and Mustafa in a black and orange hoodie near all the games with a fixed line) and for club colours (FB-0057), and said the
game still lacks a "wow".

## Decision
- Named friends of the owner (Sid, Akshit, Varun, Mitul, Karthik, Mustafa) are allowed as NPCs, because the owner asked for them
  explicitly and the game is a private gift. Their lines are the owner's: the agent drafts jokes, the owner approves them in
  `docs/research/campus-lines-review.md`; the agent never invents personal facts about a real person. Until approved, lines are
  clearly placeholder and light. Real people are shown only as small pixel characters (no photos in the game; photos live only in the
  owner-supplied card).
- Mustafa wears a black and orange hoodie (recolour sheet, ADR 0014). Club members wear their club colours: MTC black and white,
  ACM dark pink, LUG orange and black (the Linux logo), other clubs sky blue.
- The "wow" work is personal first, cinematic second, mechanical third: see docs/plans/2026-10-04-day3-feedback-and-wow.md (section B).
  Everything stays built from free packs and code; no hand-drawn art (FB-0025).
- Protected characters named in feedback (Hello Kitty, Batman, FB-0066) are replaced by generic stand-ins.

## Addendum 2026-10-04 (FB-0051 in full)
The owner's full list is wider than the first reading. All of these are allowed as small pixel NPCs, with affectionate, light, fixed lines that the owner approves:
- **Friends (male):** Sid, Akshit, Varun, Mitul, Karthik, **Mustafa** (the owner, black and orange hoodie, near every mini-game, one fixed line each), plus
  Siva, Shamsuddin, Najam, Satvik (a little darker skin tone, carries a camera).
- **Narda** (a friend, she/her): the sumo opponent at the Room 195 key station; **Mevin** (a friend with drums): runs up at the forecourt.
- **Friends of Taru (female):** Sana, Shraddha, Palak: a short scene where all three walk up, say hi to Taru and invite her to the canteen / to spend time with them.
- **Professors (the same three already in the sourced facts, ADR 0018):** Prof. **Elakkiya** (her quizzes are hard: a "goated" prof), Prof. **Angel** (J. Angel Arul Jothi: pun, she
  has small wings), Prof. **Raja** (Raja Muthalagu: a "raja": a chariot suddenly arrives and takes him away). Teasing stays kind and about the joke the owner gave, never about private life.
- Surnames, personal facts and photos are never invented; the agent drafts, the owner edits. Placeholders are marked in `docs/research/campus-lines-review.md`.
- The jokes are for Taru's group: they stay in the private build (nothing is published beyond the unlisted link, ADR 0022).

## Consequences
- ADR 0018's "real people" rule is widened for the named friends only; CONTEXT.md is updated.
- `src/campus-facts.js` / `src/ambient.js` / story dialogue gain named NPCs; tests keep the story-clearance geometry.
