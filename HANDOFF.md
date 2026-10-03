# Handoff — read this first

**Updated 2026-10-03 (third session).** [CLAUDE.md](CLAUDE.md), [docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md) (the owner's working rule),
[docs/quality/scorecard.md](docs/quality/scorecard.md), and the last entries of [MEMORY.md](MEMORY.md).

## NOW: the 4-day birthday sprint — follow [docs/plans/2026-10-03-birthday-sprint.md](docs/plans/2026-10-03-birthday-sprint.md)

The game is a gift for **Taru's 22nd birthday (next week)**; she plays on a **MacBook**. Ratings are
**paused** until the owner has played; the aim is *complete and working*. Decisions: ADR
[0017](decisions/0017-offline-bundle-for-mac.md) (offline double-click bundle, no .exe),
[0018](decisions/0018-talkable-campus-life.md) (talkable students with campus facts, cats and birds, real CS professors may be named),
[0019](decisions/0019-credits-ending-and-recipient.md) (credits phase, recipient Taru, name prefilled).

- Day 1 (10-03): cleanup done (worktrees, branches, leftover folders gone; scheduled task **disabled**).
  Next: research agents, then Sonnet briefs A (3 bugs), B (offline bundle), C (credits + name prefill), D (RTA bus).
- Day 2 (10-04): E (talkable people + animals), F (reception/ground floor vs the 3D tour), completeness test, defect
  sweep, full `npm test`, push, **tell the owner it's ready to play**.
- Day 3 (10-05): owner playtest (O overlay); fix their items first. Day 4 (10-06): final fixes, final bundle, how-to-open note.
- Owner may upload card photos/video on Day 2-3 (`assets/card/`); not needed for the handover.
- **Re-enable the scheduled task only when the owner says so.**

Everything below is the state at the start of the sprint (the status table and the bug list still apply).

## What this is

A browser pixel game, built as a **birthday gift**, recreating the **BITS Pilani Dubai campus**. The
player arrives as a new student, joins the **LUG treasure hunt**, wins three keys through mini-games
and gets an animated **birthday card**. Script: [docs/STORY.md](docs/STORY.md) — don't invent story.
Phaser 3 from local files, plain script tags, no build step; Node is only for tooling. Ships as a
Windows .exe (`npm run pack:win`).

## Status (2026-10-03)

- The **premium pass** ([plan](docs/plans/2026-09-26-premium-pass.md)) is built: all 7 stages merged.
- The **quality loop** (Phase B) is running: one category at a time, test, rate 1-10, fix, repeat.
- `main` is pushed and in sync with `origin/main` (`10dd30f`, pushed with the full suite green: 161 e2e + unit).
- **No .exe contains the owner's playtest feedback.** The only build is `dist/PixelQuest-win32-x64.zip` from 2026-09-26. Rebuild (`npm run pack:win`) only when asked, after the quality loop.
- **The owner's playtest feedback has not been given yet.** `npm run feedback` shows only the old premium-pass items FB-0027..0034 (built and merged long ago, never closed) and FB-0025 (a standing rule). Mark 0027..0034 fixed so the owner can verify them.
- Nothing is running. The scheduled task "Pixel game: work the roadmap" is **enabled** but stays
  out while `.session-active` is less than 6 hours old (docs/ROADMAP.md).

### What's in the game now
- **Opening:** title over the real campus (live tilemap pan), Mustafa greets her in person on the live
  backdrop, name entry, clothes colour, then **in-world**: a campus shuttle drives up to Gate 2, she
  steps off, Mustafa walks up, welcomes her and walks her up the avenue, the camera shows the Main Block.
- **Always knowing where to go:** quest pill, bouncing arrow over the next door, pulsing minimap
  marker, a reminder toast if she wanders.
- **Campus (Kenney RPG Urban kit, recoloured):** concrete sidewalks, sand/terracotta buildings with roofs,
  plinths and soft shadows; the **Main Block entrance per the owner's photo** (full "BITS PILANI, DUBAI
  CAMPUS" sign, tall mullioned glass front, double door, stone steps, a red-paver forecourt, palms,
  flags, WELCOME board); Gate 2 with pillar, booth, barrier; palms, trees, lamps, benches, bike racks,
  cars, a bus shelter; ambient students walking, sitting and chatting.
- **Depth (ADR 0015):** she walks behind buildings, trees, columns and furniture; doors open and she
  walks in (Pokémon style); locked doors rattle.
- **Main Block interiors** (4 compact floors): foyer per the owner's photo (marble, round columns,
  staircase to the mezzanine, chandelier, wordmark, reception, sofas, rug), the LUG stall behind the
  stairs, ICVL (computer lab), Room 195 (classroom), Physics Lab (benches, fume hood), furnished
  corridors with name plates; ambient students inside.
- **Cutscenes in the world (ADR 0016):** the opening, the Main Block entrance beat, a short beat in
  each key room. Esc skips. The HUD hides during them.
- **Mini-games:** platformer (Physics Lab), flyer (ICVL), Tetris (Room 195), with the hero at 3x scale,
  retry, and a skip after 3 losses.
- **Ending:** box opening, then the birthday card. Until the owner adds real content it shows 5
  generated "photos", placeholder messages and the recipient name typed in-game.
- **Audio:** music per area, sound effects, volume settings (pause menu and title).
- **UI:** one panel style (Kenney Pixel UI 9-slice), top-left location plate, compact HUD.

### Quality scorecard (target 8+ everywhere; details in docs/quality/scorecard.md)
| Category | Score | Next fixes |
|---|---|---|
| Outdoor art | 7 | palms look noisy; more life |
| Interior art | 6 | busy floor grid, plain stair block |
| Characters | 4 | **BUG: 3 foyer students show as missing-texture boxes** (see below) |
| UI | 7 | brighter title backdrop |
| Story flow | 6 | re-rate after the opening fixes |
| Cutscenes | 7 | polish only |
| Mini-games | 6 | the flyer still looks empty |
| Card and ending | 7 | box opening not re-rated |
| Audio, game feel, performance | not rated yet | |

## Repo cleanup — DONE 2026-10-03
Removed the 9 agent worktrees, `../2D_pixel_game-intro`, every local branch except `main`, the `origin-local/main` ref and the
leftover folders `-cutscene` and `-interiors`. Kept `../2D_pixel_game-play` (owner's playtest copy).

## Next items, in order (superseded by the sprint plan for the next 4 days)
1. The 3 known bugs below (Sonnet brief A), unit tests only.
2. Close FB-0027..0034 via `npm run feedback -- fix`.
3. After the owner's playtest: the quality loop resumes, one category per run (Characters -> Mini-games -> Interior art -> Story flow -> Outdoor/UI/Card; then Audio, Game feel, Performance for the first time). Target 8+.
4. Full `npm test`, push on a quiet machine. The Windows .exe is dropped (she has a Mac); the deliverable is the offline bundle (ADR 0017).

## Known bugs (fix first)
1. **Missing textures for ambient students.** `npc-ambient-a..f` sheets are generated by
   tools/make-assets.js but never loaded (src/main.js BootScene preload only loads
   npc-volunteer/student-a/student-b), so some students in the foyer draw as Phaser's black box with a
   green diagonal. Fix: load every NPC sheet referenced by MAPS npcs + AMBIENT (src/ambient.js) +
   script actors, driven from the data; add a unit test (every referenced character has a PNG and is
   preloaded) and an e2e check that no texture on campus/Main Block is `__MISSING`.
2. **Interaction tie-break:** `nearestInteractable()` (src/scenes/world.js) gives an exact distance
   tie to an NPC over a key station. Make story objects win ties.
3. `tools/qa-shots.js`: the platformer mid-play shot position may need updating for the 3x level.

## Waiting on the owner
- **Approve or change the new dialogue lines** (in-game Inbox, FB-0032): Mustafa's two new lines,
  the three key-room lines, and eight ambient student lines (one mentions a "food truck by the gate"
  that doesn't exist).
- **Verify the fixed items** in the Inbox (press O): FB-0023, FB-0024, FB-0035..FB-0043.
- Where the Physics Lab, the ICVL and Room 195 really are (guessed floors).
- The card's real photos, recipient name and messages (`assets/card/`, see `card.example.json`).
- **The playtest** — feedback through the O overlay in the game.

## How the work runs (rules)
- **Build first, then test** ([docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md)): agents build with unit
  tests only (no servers, browsers, e2e or pushes, nothing left running); then one full test round,
  one fix round, push; then the quality loop (one category per run: test, rate, fix).
- **Sonnet subagents write the code.** The coordinator briefs, reviews diffs and screenshots, merges,
  rates, updates the scorecard and docs, and pushes.
- Push only on a quiet machine (the pre-push hook runs the full suite; parallel test runs time out).
- Usage limits stop agents often: resume them with SendMessage; their work stays in their worktree.
- Free art packs only (owner); art only through the generators, never hand-edited PNGs or maps.
- Never `--no-verify`, `--force`, or a weakened test.

## How to run it
```
npm start                 # http://localhost:8080 (?dev=0 hides dev tools; O = feedback overlay)
npm test                  # unit + browser tests (also the pre-push check)
npm run qa:shots          # screenshots of every area, room, mini-game and the ending
npm run qa:shots:intro    # screenshots of the opening and story beats
npm run assets && npm run campus && npm run interiors   # regenerate art and maps
npm run pack:win          # dist/PixelQuest-win32-x64.zip, the sendable build
npm run feedback          # feedback waiting on the agent
```
The owner's stable copy is the worktree `../2D_pixel_game-play` (launch config "play"): update it
with `git -C ../2D_pixel_game-play checkout --detach main`.

## Map of the repo
- `src/` — game: `main.js`, `scenes/` (title, intro-*, opening-backdrop, world, ui, cutscene,
  box-opening, card), `scripts.js` + `scripts-runtime.js` (in-world cutscenes), `objective-routes.js`,
  `ambient.js`, `minigames/`, `audio.js`, `dialog.js`, `story.js`, `save.js`, `maplogic.js`, `state.js`
- `tools/` — generators (`make-assets.js`, `make-cutscenes.js`, `make-card-art.js`,
  `make-minigame-art.js`, `make-audio.js`, `campus/`, `interiors/`), `qa-shots*.js`, `feedback*.js`
- `docs/` — STORY, QUALITY_LOOP, quality/scorecard, plans/, research/ (photos, specs, pack notes),
  ARCHITECTURE, STYLE_GUIDE, GAME_FEEL · `decisions/` — ADRs 0001-0016 · `ERRORS.md` — ERR-0001..0009
- `tests/unit`, `tests/e2e` · `electron/`, `build/` — packaging
