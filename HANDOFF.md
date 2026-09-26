# Handoff — read this first

**Written 2026-09-26.** Everything a fresh session needs to pick this up and keep going. Read this,
then [CONTEXT.md](CONTEXT.md), the last entries of [MEMORY.md](MEMORY.md), and
[docs/ROADMAP.md](docs/ROADMAP.md).

## What this is

A browser pixel game, built as a **birthday gift**, recreating the **BITS Pilani Dubai campus**. The
player arrives as a new student, joins the **LUG treasure hunt**, wins three keys through mini-games,
and gets an animated **birthday card** at the end. The script is [docs/STORY.md](docs/STORY.md) —
follow it, don't invent story.

Phaser 3 from local files, plain script tags, **no build step** for the game itself. Node is only for
dev tooling. Delivered as a Windows .exe ([ADR 0010](decisions/0010-ship-as-windows-exe-and-web-build.md)).

## How the work runs (keep this going)

- **A scheduled task, "Pixel game: work the roadmap", runs every 3 hours** and does one roadmap task
  ([ADR 0011](decisions/0011-autonomous-roadmap-loop.md)). It reads the docs, checks the feedback
  inbox first, briefs a Sonnet agent, reviews, tests, ticks the box, commits and pushes. It only
  fires while the Claude app is open; a missed run fires at the next launch.
- **Sonnet subagents write all the code.** The coordinator plans, briefs, reviews diffs, runs tests,
  looks at screenshots, updates docs and commits. This is the owner's rule.
- **Usage limits interrupt agents often.** When that happens, resume the same agent with SendMessage
  ("the limit has reset, continue where you left off") — its uncommitted work is still in the tree.
  Keep the tree committed between tasks so an interrupted run never loses anything.
- **Owner feedback beats the roadmap.** In-game O overlay → `npm run feedback` → fix with a test
  named `FB-XXXX: ...` → `node tools/feedback.js fix FB-XXXX --test "<test>" "<what changed>"`.

## Current state (2026-09-26)

**The game is playable start to finish**: title → Mustafa's greeting → name entry → clothes choice →
bus arrival → gate cutscene → campus → Main Block → the volunteer → three key rooms with a mini-game
each → back to the volunteer → reward box → birthday card → title.

- `main` is at `674de43`, **one commit ahead of origin** (see "Known problems" — the push is blocked
  by a failing test, and `--no-verify` is forbidden).
- Tests: **306 unit, 91 e2e**. One e2e test fails repeatably (below); the rest pass.
- Branches: `feature/audio` (sound, parked), plus merged-and-kept `feature/intro`,
  `feature/cutscene`, `feature/interiors`, `feedback/gameplay`.

### Done

| Area | What exists |
|---|---|
| Opening | Title screen ("BITS DUBAI / The LUG Treasure Hunt") with drawn buttons and parallax, Mustafa's greeting with a portrait, name entry (typing + on-screen keyboard), clothes-colour customisation with live preview, the bus arrival at the gate, the Gate 2 and Main Block entrance cutscenes |
| Campus | Layout v3 from satellite: entrance lower-right, roundabout inside the gate, parking both sides, loop road, sports field west, hostels, DIAC Park and ring road. Roads, kerbs, crossings and pavements from Kenney; greenery from Sprout Lands; BITS facades built by us in the packs' style |
| Interiors | 8 floors (Main G–3, Library G–1, Mechanical G–1), furnished from free packs, rooms named from the virtual tour, stairs and doors both ways, no running indoors. Foyer has the LUG stall nook |
| Story | The volunteer (greets by the player's name, hints by key count, hands over the box), three keys as interactables, doors locked outside the story route, quest tracker, journal (J) |
| Mini-games | Platformer (Physics Lab), flappy (ICVL), Tetris (Room 195), each themed, with intro card, HUD, retry, and **skip offered after 3 losses** so the gift can't be blocked |
| Ending | Reward box opening, then the animated birthday card (photo slideshow, typed messages, confetti), "THE END", back to the title, plus "Watch the Card Again" |
| Systems | Saving (versioned, profile-ready), data-driven dialog with conditions/actions/choices, E and ! interaction bubbles, location banner, full-screen map (N), minimap, hotbar with held items, running (Shift) |
| Packaging | Phaser and the font vendored (runs offline), Electron wrapper with icon, `npm run pack:win` → `dist/PixelQuest-win32-x64.zip` (110 MB) with PixelQuest.exe. Verified by launching it |
| Process | Feedback loop, QA screenshots (`npm run qa:shots`), 397 tests, pre-push hook, GitHub Actions |

### Known problems (fix these first)

1. **`tests/e2e/tutorial.spec.js` "completing every step finishes the tutorial" fails repeatably on
   `main`** (not a flake — 2/2 and 3/3 runs). The "Tutorial complete!" toast never replaces "You got
   the Old Sword!". It first appeared during the audio work but reproduces on `main` without it, so
   it predates that branch. **This blocks every push**, because the pre-push hook runs the tests and
   `--no-verify` is not allowed. Fix the cause (likely `Tutorial.finish()`'s delayed toast in
   `src/scenes/ui.js`, or a toast being overwritten), not the test.
2. **`feature/audio` is parked** (music, sound effects, volume settings, 321 unit tests). Merge it
   once problem 1 is fixed and its own run is clean.
3. **A stray `dist2/` folder** is locked by Windows and can't be deleted from this session. It's
   gitignored and harmless; delete it manually when Windows releases it.
4. **`robustness.spec.js` "walking into every edge"** still fails about 1 run in 4 under load
   (ERR-0002/0003 family).

### Left to do, in MVP order

1. Fix the tutorial toast bug, push, merge `feature/audio`.
2. **A full playthrough by the owner**, with feedback through the O overlay. Everything else waits on
   what that finds.
3. Cutscenes for the three key rooms (Physics Lab, ICVL, Room 195).
4. The owner's card content: photos in `assets/card/photos/`, names and messages in
   `assets/card/card.json`, optional `video.mp4`.
5. Optional video cutscenes from the owner's clips ([prompts](docs/research/cutscene-video-prompts.md)),
   with the drawn stills as fallback.
6. Polish: transitions everywhere, idle animations, footstep dust, small campus props (benches, bins,
   a bus stop, signage), a UI kit pass.
7. Final QA: strict UI tests at several window sizes, keyboard-only reachability, the flake in (4),
   and a README for the person receiving the game.

### Waiting on the owner

- **Verify the 12 fixed feedback items** in the in-game Inbox (press O).
- **Where the Physics Lab, the ICVL and Room 195 really are.** They're on plausible floors, guessed,
  because no floor plans are published (checked: official site, prospectus PDF, Wikipedia, 2GIS, Google).
- **Where the real main entrance (Gate 2) is** — assumed from satellite imagery.
- **The card's content** (photos, recipient name, messages).
- Whether the keys should leave the bag when handed in.

## How to run it

```
npm start                 # http://localhost:8080 (add ?dev=0 to hide dev tools)
npm test                  # unit + browser tests (also runs before every push)
npm run pack:win          # dist/PixelQuest-win32-x64.zip — the sendable build
npm run assets            # regenerate art after editing tools/make-assets.js
npm run campus            # regenerate the campus map
npm run interiors         # regenerate the interior maps
npm run qa:shots          # screenshots of every area and room into qa-shots/
npm run feedback          # feedback waiting on the agent
```

The owner plays a **stable copy** served from the worktree `../2D_pixel_game-play` (launch config
"play"), so in-progress edits in the main tree never break their session. Update it with
`git -C ../2D_pixel_game-play checkout --detach main` and restart the server.

## Rules that must not be broken

- **Sonnet agents write the code**; the coordinator reviews, tests and commits.
- **Never** `--no-verify`, `--force`, or weaken a test to make it pass.
- **Art comes from packs** ([ADR 0012](decisions/0012-third-party-asset-packs.md)); we draw only what
  no pack covers. Never hand-edit generated PNGs or maps — change the tools and regenerate.
- **The game is non-commercial and must never be sold** (LimeZu and Sprout Lands licences). Credit
  stays in [CREDITS.md](CREDITS.md) and on the title screen.
- **Raw asset packs are gitignored**; only generated art ships.
- Tile names and indices stay stable when art changes, so maps and tests keep working.
- Don't invent story: [docs/STORY.md](docs/STORY.md) is the script, the owner writes the rest.
- Every decision gets written down: an ADR in `decisions/`, plus CONTEXT.md and a dated MEMORY.md entry.

## Map of the repo

- `src/` — game code: `main.js` (boot), `scenes/` (title, world, ui, cutscene, box-opening, card),
  `minigames/`, `dialog.js`, `story.js`, `save.js`, `audio.js` (on the audio branch), `maplogic.js`, `state.js`
- `tools/` — generators: `make-assets.js` (all tiles and sprites), `make-cutscenes.js`,
  `make-card-art.js`, `make-minigame-art.js`, `make-icon.js`, `campus/`, `interiors/`, `qa-shots.js`,
  `feedback*.js`, `lib/png*.js`
- `assets/` — generated art and maps (committed), `vendor/` (raw packs, gitignored), `card/` (owner's, gitignored)
- `docs/` — STORY, ROADMAP, GAME_FEEL, STYLE_GUIDE, ARCHITECTURE, CAMPUS_MAP_PLAN, INTERIORS_PLAN,
  QA_PLAN, TESTING, FEEDBACK, `research/`, `plans/`
- `decisions/` — ADRs 0001–0014 · `ERRORS.md` — ERR-0001 to ERR-0006, failures and their rules
- `electron/`, `build/` — packaging · `tests/unit`, `tests/e2e`
