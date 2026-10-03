# Handoff — read this first

**Updated 2026-10-03 (end of the third session, Day 1 of the birthday sprint).** Then read
[CLAUDE.md](CLAUDE.md), [docs/plans/2026-10-03-birthday-sprint.md](docs/plans/2026-10-03-birthday-sprint.md)
(the plan, schedule and packages), [docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md) (paused), and the last entries of
[MEMORY.md](MEMORY.md) and [ERRORS.md](ERRORS.md) (ERR-0010..0013 are new).

## What this is

A browser pixel game, a **birthday gift for Taru's 22nd birthday (next week; the exact date is unknown,
the owner says about 4 days of work from 2026-10-03)**, recreating the **BITS Pilani Dubai campus**. The player arrives as a new student on an
RTA bus, joins the **LUG treasure hunt**, wins three keys through mini-games, opens a box, sees an animated
**birthday card** and then a **credits scene** ("Happy Birthday, Taru / Happy 22 / wishes"). Script:
[docs/STORY.md](docs/STORY.md) — don't invent story. Phaser 3, plain script tags, no build step; Node is only tooling.
**She plays on a MacBook**: the deliverable is an **offline double-click bundle** (`npm run pack:offline` ->
`dist/offline/index.html`, ADR 0017). The Windows .exe is dropped (build it only if the owner asks).

Owner's wishes: cute and soft look with story meaning (the campus and rooms hold stories); art need not be
insane but must have no bugs (pavements, walls with no rounding, blocky buildings, odd windows, entrance must
match the real campus); complete, nothing empty; smooth game feel; people and animals moving; talk to everyone
and learn campus facts. **Ratings are paused** until the owner has played; the aim is *complete and working*.

## State at the end of this session

`main` is at commit `8de5df8` (or later) and is **NOT pushed** (origin/main is at `97b2b00`; about 14 commits ahead).
Push only after a full `npm test` on a quiet machine (the pre-push hook runs the full suite, about 17 min).
Nothing is running. Unit tests: **578/578 green**. Browser tests: the last full run was 177/184; the 7 failures were
then fixed and each re-run green, but **the full e2e suite has not been re-run since**.

### Done and merged this sprint (Day 1)
| Package | What | Notes |
|---|---|---|
| Cleanup | 9 agent worktrees, `-intro`, 32 merged branches, `origin-local/main`, `-cutscene`/`-interiors` removed | Kept `../2D_pixel_game-play` (STALE at `10dd30f`, update it before the owner plays) |
| A | 3 known bugs | `characterSheets()` registry drives the preload (no more missing-texture boxes); `pickInteractable()` + `INTERACT_PRIORITY` (key station > quest NPC > ambient > animals); qa-shots platformer position |
| B | Offline bundle | `tools/pack-offline.js`, `src/offline-shim.js`, `docs/OFFLINE_BUNDLE.md`; builds about 13 MB; plain script tags, XHR/fetch/Image/Audio shim over embedded data |
| G | Safari-safe audio | Bundle converts every `.ogg` to MP3 at build time (dev deps `@wasm-audio-decoders/ogg-vorbis`, `@breezystack/lamejs`), shim maps `x.ogg` -> `x.mp3`, patches `canPlayType` |
| C | Credits scene (ADR 0019) | `src/credits.js`, `src/scenes/credits.js` (about 42 s); name field prefilled "Taru"; recipient always "Taru" (card.json `recipient`/`age`/`wishes` override); 8 placeholder wishes |
| D | RTA bus (ADR 0016 script) | 5-frame sheet `assets/cutscenes/rta-bus-sheet.png` from `tools/make-cutscenes.js`; new `frame`/`anim` script steps; bus enters from the left heading east, door side to the camera; "food truck" line removed |
| E | Talkable life (ADR 0018) | `src/campus-facts.js` (14 roles, 43 sourced facts), 38 ambient students on campus (all talkable), `src/animals.js` + `tools/make-animals.js`: 4 cats + 4 birds on the campus (cats and birds only, owner's decision) |
| Fix round | 7 e2e failures | Cat flee, HUD test timing, opening-backdrop speed (cropped cached map), and **real soft-locks**: Room 195's key was unreachable (generator fix in `tools/interiors/build-interiors.js`), two students blocked the ICVL closet and the Physics Lab desk. New `tests/unit/story-clearance.test.js` guards every map |
| Research | `docs/research/` | `campus-facts.md` (77 facts), `rta-bus-reference.md` + image, `tour-ground-floor.md` + 12 screenshots, `animal-packs.md`, `campus-lines-review.md` (every talkable line, for the owner) |
| Feedback | FB-0027..0034 marked fixed | FB-0025 is the standing rule: free asset packs, do not hand-draw art (the RTA bus is the one allowed exception) |

### Owner decisions (all settled, see the sprint plan)
Offline bundle for the Mac; credits with Taru/22/wishes; name prefilled "Taru"; real CS professors may be named in
facts (names/titles as publicly listed; Elakkiya and Angel Arul Jothi without a title); cats and birds only;
tour-based ground floor **(ADR 0020, just decided)**; scheduled task "Pixel game: work the roadmap" **disabled**
until the owner says; ratings paused; the owner plays after Day 2 and sends feedback through the O overlay.

## What is LEFT (in order)

1. **Foyer / ground floor rebuild to match the 3D tour** (package F, [ADR 0020](decisions/0020-main-block-ground-floor-follows-the-3d-tour.md),
   [docs/research/tour-ground-floor.md](docs/research/tour-ground-floor.md)). Only the foyer, reception and the two wings; not the upper
   floors. Via the generators in `tools/interiors/` (`npm run interiors`), never hand-edited maps. Then re-check: quest routes
   (`src/objective-routes.js`), cutscene anchors (`src/scripts.js`), `src/ambient.js` and `src/animals.js` placements,
   `tests/unit/story-clearance.test.js` and any test that names foyer coordinates. The LUG stall stays "behind the staircase".
   One Sonnet brief, unit tests first.
2. **Open the offline bundle from `file://`** (`npm run pack:offline`, then open `dist/offline/index.html` in Chrome/Edge via the
   built-in browser) and play title -> name -> bus -> Mustafa -> stall -> 3 mini-games (or skips) -> box -> card -> credits -> title.
   Check zero console errors, audio after the first click, saves. Safari cannot be tested here (see Risks).
3. **Defect sweep + completeness** (no ratings): `npm run qa:shots` once; list only objective faults (tile seams, glitched or missing
   sprites, overlaps, odd windows), fix them in one Sonnet brief. Generated completeness test: every reachable map has props and life,
   every door leads to a furnished room, every locked door says something, no `__MISSING` texture.
4. **Full `npm test` on a quiet machine, then push** (nothing else running), then **update `../2D_pixel_game-play`**
   (`git -C ../2D_pixel_game-play checkout --detach main`) and **tell the owner the game is ready to play** (end of Day 2).
5. **Day 3: owner playtest** (feedback via the O overlay; their items jump the queue), **Day 4: final fixes**, rebuild the bundle
   (`npm run pack:offline -- --zip`), final full test, and give the owner the zip + `HOW_TO_OPEN.txt`.
6. After the birthday (or after the owner's feedback): resume the quality loop ([docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md));
   Audio, Game feel and Performance have never been rated; `src/scenes/ui.js` is large (split it only after the loop).

**Cut line if time runs short:** (1) animals beyond cats and birds on the main campus, (2) the tour-based match beyond foyer + reception,
(3) extra ambient lines. **Never cut:** the offline bundle, the credits, the bus, the soft-lock guards, the completeness checklist.

## What the owner provides (and when)
- **Card assets** (photos, closing video, final wishes, recipient/age): "tomorrow or the day after" (about 2026-10-04/05). Put them in
  `assets/card/` (gitignored; `card.json` shape in `assets/card/card.example.json` and STORY.md). Then **rebuild the bundle** so they are embedded.
  Placeholders work until then. The unfinished card shows a generated 5-slide slideshow and the placeholder wishes.
- **Review `docs/research/campus-lines-review.md`** (every talkable line) and add more facts, clubs, quizzes, professors; they go in
  `src/campus-facts.js`. The facts doc had gaps: named cafeteria/auditorium/DIAC park spots, post-2023 events, the LUG's own page (404),
  Instagram (login wall, skipped).
- **Playtest and feedback** (O overlay). Verify old fixed items in the Inbox (O): FB-0023, 0024, 0027..0043.
- **Still open from before:** approve the new dialogue lines (Mustafa's two lines, the key-room lines, the ambient lines); real locations
  of the Physics Lab, ICVL and Room 195 (guessed floors; the ground floor now follows the tour).

## Known risks and unverified things
- **Safari / her MacBook is untestable here.** Mitigations: no ES modules, no XHR to local files, audio as MP3, `localStorage` guarded. The
  `HOW_TO_OPEN.txt` says to use Safari or Chrome and to click once if there is no sound. Not verified: the MP3 loop gap (about 26 ms; an Info tag
  is written), `decodeAudioData` on MP3 bytes served under an `.ogg` name, and the closing video drawn into a WebGL texture from a blob URL
  (needs a real `video.mp4` to test; skipped gracefully if it fails).
- **Never seen in a running game:** the credits scene look/timing, the RTA bus camera/direction (the player now ends on the road near the
  avenue mouth, not at the gate), animal sizes (birds are 32 px, cats 16 px), the talkable-student placement feel, the Room 195 layout change.
- Saves live in `localStorage`: "Continue" only works in the same browser she first used.
- `assets/vendor/` and `assets/External Tilesets/` are git-ignored; agent worktrees lack them, so agent unit runs show 2 expected failures
  (`assets/ is up to date` and the `interior furniture kit ... LICENSE`); they pass in the main checkout.
- The first talk to a student gives an opener, then a fact (later talks give the next fact only). The owner can say if they want facts only.
- Credits for the owner's animal pack say "author not named in the pack" (do not invent an author).

## How the work runs (rules)
- **Build first, then test** ([docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md)): agents build with unit tests only (no servers, browsers, e2e or
  pushes, nothing left running); then one full test round, one fix round, push.
- **Sonnet subagents write the code** (Agent tool, `model: "sonnet"`, self-contained briefs, isolated worktrees when parallel; single agent
  directly in `main` when they need the git-ignored vendor art). The coordinator briefs, reviews diffs, merges, runs tests, updates docs.
  Never merge a worktree branch into a dirty `main`; commit the agent's work on its branch, then `git merge --no-ff`.
- Run e2e one spec at a time or the whole suite alone (parallel runs time out); stop servers afterwards. Push only on a quiet machine.
- Free art packs only; art only through the generators (`npm run assets`, `npm run interiors`, `npm run campus`), never hand-edited PNGs/maps.
- Never `--no-verify`, `--force`, or a weakened test. Log non-obvious bugs in ERRORS.md and decisions in `decisions/`.
- Usage limits stop agents often: resume them with SendMessage; their work stays in their worktree. Re-check `git status` first.
- A knowledge graph is in `graphify-out/` (use `graphify query`/`path`/`explain` before grepping; refresh with `/graphify . --update` after
  big code changes; it is untracked).

## How to run it
```
npm start                 # http://localhost:8080 (?dev=0 hides dev tools; O = feedback overlay)
npm test                  # unit + browser tests (also the pre-push check, about 17 min)
npm run test:unit         # unit tests only (fast; the build-phase check)
npm run pack:offline      # dist/offline/index.html (+ -- --zip) : the Mac deliverable
npm run qa:shots          # screenshots of every area, room, mini-game and the ending
npm run qa:shots:intro    # screenshots of the opening and story beats
npm run assets && npm run campus && npm run interiors   # regenerate art and maps
npm run feedback          # feedback waiting on the agent
npm run pack:win          # Windows zip (NOT needed: she has a Mac)
```
The owner's stable playtest copy is the worktree `../2D_pixel_game-play` (launch config "play"); update it with
`git -C ../2D_pixel_game-play checkout --detach main`.

## Map of the repo
- `src/` — game: `main.js`, `scenes/` (title, intro-*, opening-backdrop, world, ui, cutscene, box-opening, card, **credits**), `scripts.js` +
  `scripts-runtime.js` (in-world cutscenes incl. the RTA bus), `objective-routes.js`, `ambient.js`, **`campus-facts.js`, `animals.js`,
  `credits.js`, `offline-shim.js`**, `minigames/`, `audio.js`, `dialog.js`, `story.js`, `save.js`, `maplogic.js`, `state.js`
- `tools/` — generators (`make-assets.js`, `make-cutscenes.js`, `make-card-art.js`, `make-minigame-art.js`, `make-audio.js`, **`make-animals.js`**,
  `campus/`, `interiors/`), **`pack-offline.js`**, `lib/` (ogg->mp3), `qa-shots*.js`, `feedback*.js`
- `docs/` — STORY, plans/ (**2026-10-03-birthday-sprint.md**), quality/scorecard, research/ (photos, tour, bus, animals, facts), OFFLINE_BUNDLE,
  ARCHITECTURE, STYLE_GUIDE, GAME_FEEL · `decisions/` — ADRs 0001-0020 · `ERRORS.md` — ERR-0001..0013
- `tests/unit` (578 tests), `tests/e2e` · `electron/`, `build/` — Windows packaging (unused now)

## Quality scorecard (paused; last ratings 2026-09-29, details in docs/quality/scorecard.md)
Outdoor 7, Interior 6, Characters 4 (the texture bug is now fixed; re-rate), UI 7, Story flow 6, Cutscenes 7, Mini-games 6 (flyer looks empty),
Card 7; Audio, Game feel, Performance not rated. Target 8+ everywhere once the loop resumes after the owner's feedback.
