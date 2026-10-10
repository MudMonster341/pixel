# Prompt for the next session (copy everything below the line)

---

Continue the BITS Dubai birthday pixel game (repo https://github.com/MudMonster341/pixel; the owner's PC copy is C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game). It is a gift for Taru's 22nd birthday (2026-10-11); she plays on a MacBook and the owner has no Mac to test on. **The game is finished and delivered**: `dist/offline.zip` (double-click) and the folder `dist/offline-site` (the owner uploaded it to Netlify Drop as the backup link). Do not break either.

Read, in this order: HANDOFF.md (state, the moments rules as they are NOW, what is left), CLAUDE.md, the last entries of MEMORY.md and ERRORS.md (ERR-0019..0021), docs/plans/agent-rules.md, docs/HOSTING.md, and, if the owner wants the extra, docs/plans/2026-10-10-post-game-auditorium.md. The knowledge graph in graphify-out/ was refreshed on 2026-10-10 (`graphify update .` is cheap, code only); use `graphify query "<question>"` before grepping.

## What may come next (ask the owner which; none is required)
1. **Changes from the owner's / Taru's play-through.** `node tools/feedback.js`, read anything new (`show FB-xxxx`, LOOK at the screenshots), one Sonnet agent at a time with a self-contained brief, review the diff, `npm run test:unit`, run only the affected e2e specs alone, commit, mark fixed with an `FB-XXXX:` test.
2. **The optional extension (owner idea, 2026-10-10):** after the game she stays in the world and is told she can head to the Auditorium, which opens as a small fun area with a BALL PIT (and maybe the sumo-vs-Narda arcade and other left-off ideas). Full plan, steps and the open questions to ASK FIRST are in docs/plans/2026-10-10-post-game-auditorium.md. Build it on a branch, never touch the delivered build until the owner has played it, cut from the bottom of the plan.
3. **Rebuild after ANY change that should reach Taru:** `npm run pack:offline -- --zip`, `npm run pack:site`, `node tools/qa-offline-play.js` and `... webkit`; hand over `dist/offline.zip` + `dist/offline/HOW_TO_OPEN.txt` and the folder `dist/offline-site`; the owner re-drops the folder on the SAME Netlify site (never rename the site: saves are per address). Never create accounts or publish.

## Rules that bit us
- Never `return` a Phaser object or the result of `scene.restart()` from `page.evaluate` (ERR-0021: it stalls 30-60 s). PowerShell blocks npm.ps1: use `npm.cmd` / `node server.js`.
- Moments (cut scenes): no spacing rules any more; place + requirement + once per save; a scene is 8-20 s (tests measure it; M2 and M5 have under 1 s left). A scene is only started by STANDING in its place (e.g. M4: corridor rows 19-20, not the lab, not the doorway row).
- Art only through the generators; free packs only; ask before hand-drawing anything (FB-0025). Do not invent story or personal facts: the owner's own words are used (card message, NPC lines, "Made for you by your one and only").
- One Sonnet agent at a time, monitored; build first with unit tests, then ONE full browser round on a quiet machine; nothing left running. Push `main` only when the owner asks (the pre-push hook runs the full suite, ~10 min: `git push origin main > push.log 2>&1`). Never `--no-verify` on `main`.
- Never cut: the offline zip and hosted link, credits, soft-lock guards (skip after 3 losses in every game, the ICL door guard), the full test before a handover.
