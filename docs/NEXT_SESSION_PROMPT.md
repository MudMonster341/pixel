# Prompt for the next session (copy everything below the line)

---

Continue the BITS Dubai birthday pixel game (C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game). It is a gift for Taru's 22nd birthday (next week, about 4 days of work from 2026-10-03); she plays on a MacBook, so the deliverable is the offline double-click bundle, not an .exe.

Read HANDOFF.md first (state, what's done, what's left, risks), then docs/plans/2026-10-03-birthday-sprint.md, CLAUDE.md, and the last entries of MEMORY.md and ERRORS.md. A knowledge graph is in graphify-out/ (use `graphify query`/`path`/`explain` before grepping; do not rebuild it). Run `npm run feedback` and handle any NEW items first (FB-0025 is a standing rule: free asset packs only).

Rules: build first, then test (unit tests only while building; one full test round after; agents never leave servers running; no pushes until the full `npm test` passes on a quiet machine). Sonnet subagents write the code (self-contained briefs; worktrees when parallel; merge by committing the agent's branch and `git merge --no-ff`). Art only through the generators, free packs only. The scheduled task "Pixel game: work the roadmap" stays DISABLED until I say. Ratings are paused. Keep updates short and tell me as things happen.

Do, in order:
1. Foyer / ground floor rebuild to match the official 3D tour (ADR 0020 and docs/research/tour-ground-floor.md): oak floor, glass terrarium on the central axis, two curved reception desks flanking the entrance, split staircase on the left toward the back, spiral gold-ring chandelier, sofas on the back walls, and the two long wings (right: offices to the auditorium and visitor lounge; left: Admissions, Director's Office, a ramp, Sports Complex, clinic, Mini Mart; Library and Career Services off the back-left). Foyer, reception and wings only. Keep the story (the LUG stall stays behind the staircase) and the story-clearance test green; re-check quest routes, cutscene anchors, ambient and animal placements.
2. Build the offline bundle (`npm run pack:offline`) and play it from file:// in the built-in browser, title to credits: zero console errors, audio after the first click, saves. Fix what breaks.
3. One defect sweep (`npm run qa:shots`, objective faults only, no ratings) and a completeness check (nothing empty, no missing textures, every door leads somewhere, every locked door says something). Fix in one brief.
4. Full `npm test` on a quiet machine, fix failures, push, update ../2D_pixel_game-play (`git -C ../2D_pixel_game-play checkout --detach main`), and tell me the game is ready to play.
5. When I send feedback (O overlay) fix my items first. If I have uploaded card assets to assets/card/ (card.json, photos, video), rebuild the bundle with `npm run pack:offline -- --zip` and check them. Final step: the zip + HOW_TO_OPEN.txt for Taru.

Nothing should be left running in the background. Cut line if time runs short: extra animals, then the tour match beyond foyer and reception, then extra ambient lines. Never cut the bundle, credits, bus, soft-lock guards or the completeness checklist.
