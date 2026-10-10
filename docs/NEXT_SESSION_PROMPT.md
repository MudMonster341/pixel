# Prompt for the next session (copy everything below the line)

---

Continue the BITS Dubai birthday pixel game (repo https://github.com/MudMonster341/pixel; the owner's PC copy is C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game). It is a gift for Taru's 22nd birthday (2026-10-11); she plays on a MacBook and the owner has no Mac to test on, so the deliverables are the offline double-click zip and a hosted backup link (Netlify Drop, the owner uploads it).

Read, in this order: HANDOFF.md, CLAUDE.md, the last entries of MEMORY.md and ERRORS.md (ERR-0019..0021), docs/HOSTING.md, docs/plans/agent-rules.md.

## State (2026-10-10)
Everything is merged to `main`: EDI Madness (the ICL parking game), the message-only birthday card (cake on a sunset glow, the owner's final message, a lively backdrop with Mustafa/Taru/friends), M5 Prof. Angel, the owner's NPC names and lines, and every feedback item up to FB-0101. Unit 1313/1313; the browser suite is green apart from load-only timeouts that pass alone; `qa:offline` plays title to credits in Chromium and WebKit with zero errors. No card photos/video yet (optional).

## Do
1. `node tools/feedback.js` and read anything new (`show FB-xxxx`, LOOK at the screenshots). One Sonnet agent at a time with a self-contained brief; review the diff; `npm run test:unit`; run only the affected e2e specs alone; commit; mark fixed with an `FB-XXXX:` test.
2. After ANY change: `npm run pack:offline -- --zip` and `npm run pack:site`, then `node tools/qa-offline-play.js` (and `webkit`). Hand over `dist/offline.zip` + `dist/offline/HOW_TO_OPEN.txt` and the folder `dist/offline-site`. Never create accounts or publish.
3. Do not push `main` unless the owner asks (the hook runs the full suite, 10-20 min).

## Rules that bit us
Never `return` a Phaser object or the result of `scene.restart()` from `page.evaluate` (ERR-0021). PowerShell blocks npm.ps1: use `npm.cmd` / `node server.js`. Art only through the generators; free packs only. Build first, then test; nothing left running.
