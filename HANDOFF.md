# Handoff — read this first

**Day 3 is fully written up in [HANDOVER.md](HANDOVER.md) (what was done, commits, switches, seen vs unseen, to-do); read it right after this page. Pickup prompt: [docs/NEXT_SESSION_PROMPT.md](docs/NEXT_SESSION_PROMPT.md).**

**Updated 2026-10-05 (evening of Day 3: packages P1-P5 done).** Then read
[docs/plans/2026-10-04-day3-feedback-and-wow.md](docs/plans/2026-10-04-day3-feedback-and-wow.md) (**the plan for what to do next**),
[CLAUDE.md](CLAUDE.md), and the last entries of [MEMORY.md](MEMORY.md) and [ERRORS.md](ERRORS.md) (ERR-0010..0015).
Older plan with the finished Day 1-2 packages: [docs/plans/2026-10-03-birthday-sprint.md](docs/plans/2026-10-03-birthday-sprint.md).

## What this is

A browser pixel game, a **birthday gift for Taru's 22nd birthday on 2026-10-11**, recreating the **BITS Pilani Dubai campus**. The player
arrives as a new student on an RTA bus, joins the **LUG treasure hunt**, wins three keys through mini-games, opens a box, sees an animated
**birthday card** and then a **credits scene** ("Happy Birthday, Taru / Happy 22 / wishes"). Script: [docs/STORY.md](docs/STORY.md): don't invent
story. Phaser 3, plain script tags, no build step; Node is only tooling. **She plays on a MacBook**; the owner has **no Mac to test on**, so the
deliverables are (1) the offline double-click zip (`npm run pack:offline -- --zip`, ADR 0017) and (2) a hosted link as a backup
(`npm run pack:site`, [ADR 0022](decisions/0022-hosted-link-as-backup-delivery.md), [docs/HOSTING.md](docs/HOSTING.md)). The Windows .exe is dropped.

**Target:** hand over the final zip + link by **2026-10-09**, 10-10 is slack.

Owner's wishes: cute and soft look with story meaning; art need not be insane but must have no bugs; complete, nothing empty; smooth game
feel; people and animals moving; talk to everyone and learn campus facts. After the first playtest: **"the game is fine, but the wow aspect isn't
there yet"**, plus 33 feedback items. **Ratings stay paused.**

## State (2026-10-05, Day 3 evening)

`main` is **ahead of origin by many commits, NOT pushed** (push only when the owner says; the pre-push hook runs the full suite, 9-17 min). Last full run today:
**unit 1058 green + 186/186 browser tests green** (final run 2026-10-05 night; also qa:shots 103/103 and qa:offline Chromium + WebKit clean). Nothing is running.

### Done on Day 3 (feedback packages P1-P5, all committed, FB items marked fixed in the Inbox)
- **P1 controls/UI:** E/Space/Enter advance messages (one handler); the player halts under any script/overlay (ERR-0016); panel frame right/bottom border restored (ERR-0017); Quit (title + pause) + goodbye scene; ending chain hardened; Main Block door glass solid, two-tile doorways.
- **P2:** ICVL -> ICL everywhere (save migration); named ambient NPCs (`name`, `lines`, `sheet`, `factIds`): Deanne, 9 friends, 3 Mustafas (black+orange hoodie) near the games, Prof. Elakkiya/Angel/Raja; club outfits (ACM dark pink, LUG orange/black, MTC black/white, others sky blue); funnier CS openers. Lines for the owner: docs/research/campus-lines-review.md.
- **P3 outdoors:** `tools/render-map-crop.js` (LOOK at any map without a browser), kerb/road autotile (`tools/campus/autotile.js`), oval roundabout, road west with a turning circle, real parking lots, RTA bus stop + bay + shelter, full-width barrier, new palms/leafy trees.
- **P4 Main Block:** black void, side-on doors/windows, Library lobby at the foyer back-centre (door still closed), stairs from the LimeZu pack, working lifts on 4 floors, every door/lift animates (closed/half/open).
- **P5 mini-games:** Room 195 = **tower climb** (Tetris removed; match-3 dropped by the owner), Physics Lab = hero fight (kitten hero vs shadow bat, original stand-ins, Z shoots, themed cover), ICL = sealed spaceship lab: scanner + "ICL Fingerprint Hack" opens the door, Alice the robot gives the key.
- The owner's "moments" (unicorn+prince, Mevin, Raja's chariot, Sana/Shraddha/Palak, ball pit, sumo vs Narda) are designed and the questions settled: **docs/plans/2026-10-04-moments-and-small-touches.md** (not built yet).

### Also done on Day 3 evening (after P5)
- **Moments M1 unicorn + prince, M2 Mevin (Treble)** with the pacing system (`src/moments.js`; once only; entrance pair chains: M2 about 6 s after M1; M1 waits 2.5 s of free control; `?moments=0` for tests); **W4 golden hour** (`src/daylight.js`, morning -> dusk with the keys, `?daylight=0`); **W3 finale** (box -> cake with 22 candles blown one by one -> fireworks over a Dubai skyline + chiptune "Happy Birthday" -> card -> credits -> title; ADR 0023).
- Play copy `../2D_pixel_game-play` updated to `9969ccf` (ready for the owner's 2nd playtest, early).

### Owner's 33 items: FB-0044..FB-0076 all fixed except FB-0051 (in progress: chariot, the three girls, Mevin, Narda are moments) and FB-0075/0076 await their check. FB-0076 has a question to the owner in the thread.

## Owner decisions (all settled)
Offline bundle + a hosted link as backup (Netlify Drop, unlisted, card photos included; **the owner uploads it**, an account login is needed: ADR 0022);
credits with Taru/22/wishes; name prefilled "Taru"; real CS professors may be named in facts; cats and birds only; tour-based ground floor (ADR 0020);
wing doors closed + each says a line; no ruler portraits; **named friends allowed as characters (ADR 0021)**; scheduled task "Pixel game: work the
roadmap" **disabled** until the owner says; ratings paused; **one Sonnet agent at a time, monitored** (see Rules).

## What is LEFT (in order)
1. **Wait for the owner's 2nd playtest** (feedback via the O overlay), fix what they find.
2. **Remaining wow** (recommended answers, owner did not answer round 3): juice pass (key-pickup sparkle, emotes), W2 album + W6 selfie (placeholders; photos via `assets/card/`).
3. **Later moments** (optional, by 10-09): Raja's chariot (M3), Sana/Shraddha/Palak scene (M4). **PARKED by the owner on 2026-10-05, not a priority: the TP room (ball pit + arcade + sumo vs Narda).**
4. **Before handover:** `npm run qa:shots` (LOOK at them), `npm run qa:offline`, the full `npm test`, update `../2D_pixel_game-play`, tell the owner it is ready for the 2nd playtest (~10-08).
5. **Final (by 2026-10-09):** card assets in `assets/card/` -> `npm run pack:offline -- --zip` and `npm run pack:site`; the owner uploads `dist/offline-site` to Netlify; send Taru the link + zip + `HOW_TO_OPEN.txt`.

**Cut line:** the TP room is already parked; then Raja's chariot, then the three-girls scene, then W6/W2. Keep M1, M2, the finale, golden hour. **Never cut:** P1 (done), the bundle and hosted link, credits, soft-lock guards, completeness checklist, the full test before handover.

## What the owner provides (and when)
- **Card assets** (photos, the 3 memory-album photos + captions (`album`), closing video, final wishes, recipient/age) in `assets/card/` (gitignored; shape in `assets/card/card.example.json`):
  by ~2026-10-07. Placeholders work until then.
- **Friends' lines and inside jokes**, the real clubs/colours if different, and photos for the memory album/selfie (W1/W2): from 10-05.
- Answers to feedback questions in the O overlay; the second playtest on ~10-08. Optionally: any Mac (or a friend's) to open the link/zip once.
- Still open from before: approve new dialogue lines ([docs/research/campus-lines-review.md](docs/research/campus-lines-review.md)); real locations of the
  Physics Lab, ICL and Room 195 (guessed floors).

## Known risks and unverified things
- **Safari / her MacBook is untestable here.** Mitigations: no ES modules, no XHR to local files, audio as MP3, guarded `localStorage`, a hosted link
  fallback. Playwright WebKit (installed) plays the bundle with zero errors but has **no Web Audio on Windows**, so audio is only verified in Chromium.
  Not verified: MP3 loop gap (~26 ms), `decodeAudioData` on MP3 bytes under an `.ogg` name, the closing video as a WebGL texture (needs a real
  `video.mp4`; skipped gracefully on failure).
- **The built-in browser pane cannot run the bundle** (it opens local files as `data:` URLs, relative scripts do not load): use Playwright
  (`npm run qa:offline`).
- The unsure screenshot items U1-U11 in the defect report were not chased (except the card message). Never seen in a running game by the agent:
  credits timing, animal sizes, talkable-student placement feel. The owner has now seen the foyer; FB-0058..0065 target the Main Block.
- Saves live in `localStorage`: "Continue" only works in the same browser/site she first used.
- `assets/vendor/` and `assets/External Tilesets/` are git-ignored; agent worktrees lack them, so agent unit runs show 2 expected failures there;
  they pass in the main checkout. Work directly in `main` when an agent needs the vendor art.
- One unreproduced e2e failure (intro.spec.js:215) rejected a push once (ERR-0015); the retry passed.

## How the work runs (rules)
- **Build first, then test** ([docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md)): agents build with unit tests only (no servers, browsers, e2e or pushes,
  nothing left running); one full test round after, then push.
- **Sonnet subagents write the code**, **one at a time**, with self-contained briefs (they cannot see the game). The coordinator monitors (`git status`,
  `tasklist`), reviews the diff, runs `npm run test:unit`, **commits after each agent**, logs MEMORY.md, then briefs the next. Never leave a task half-done at
  the end of a session. Never merge a worktree branch into a dirty `main`; work directly in `main` for vendor-art tasks.
- Free art packs only; art only through the generators (`npm run assets`, `npm run interiors`, `npm run campus`), never hand-edited PNGs/maps.
- Never `--no-verify`, `--force`, or a weakened test. Log non-obvious bugs in ERRORS.md and decisions in `decisions/`.
- **Pushing:** only when the owner asks. `git push` runs the full suite (9-17 min, keep the machine quiet; run it in the background and save the output
  to a file: `git push origin main > push.log 2>&1`, a piped `tail` loses the failure text). A push can be refused by the permission classifier until the
  owner explicitly says to push.
- **Servers:** the app stops preview servers when a turn ends. For the owner's playtest tell them to run `node server.js` themselves
  (PowerShell blocks `npm.ps1`: use `node server.js` or `npm.cmd start`); set `FEEDBACK_DIR` as in `.claude/launch.json` if they use the play copy. Stop anything you started.
- For any scripted http check: `path.resolve` for file paths and `server.unref()` (a throwaway server kept Node alive and mixed up `/` and `\`).
- Usage: an agent run is ~250-500k tokens and 12-30 min; resume stopped agents with SendMessage; their work stays in the checkout. Re-check `git status` first.
- A knowledge graph is in `graphify-out/` (use `graphify query`/`path`/`explain` before grepping; untracked; refresh only with `/graphify . --update`).

## How to run it
```
node server.js            # http://localhost:8080  (the owner's way on Windows PowerShell; ?dev=0 hides dev tools; O = feedback overlay)
npm start                 # same thing (PowerShell blocks npm.ps1: use npm.cmd start)
npm test                  # unit + browser tests (also the pre-push check, 9-17 min)
npm run test:unit         # unit tests only (fast; the build-phase check; 691)
npm run pack:offline      # dist/offline/index.html (+ -- --zip): the Mac deliverable
npm run pack:site         # dist/offline-site/: the hosted-link folder (Netlify Drop, docs/HOSTING.md)
npm run qa:offline        # plays the bundle title -> credits (Chromium; `... webkit`; PLAY_URL=<url> for a hosted copy)
npm run qa:shots          # screenshots of every area, room, mini-game and the ending (qa-shots/, gitignored)
npm run assets && npm run campus && npm run interiors   # regenerate art and maps
npm run feedback          # feedback waiting on the agent;  npm run feedback -- show FB-0044 | fix FB-0044 "..."
```
The owner's stable playtest copy is the worktree `../2D_pixel_game-play` (launch config "play"); update it with
`git -C ../2D_pixel_game-play checkout --detach main`.

## Map of the repo
- `src/` — game: `main.js`, `scenes/` (title, intro-*, opening-backdrop, world, ui, cutscene, box-opening, card, credits), `scripts.js` + `scripts-runtime.js`
  (in-world cutscenes incl. the RTA bus), `objective-routes.js`, `ambient.js`, `campus-facts.js`, `animals.js`, `credits.js`, `offline-shim.js`, `minigames/`
  (platformer, flappy, tetris + framework), `audio.js`, `dialog.js`, `story.js`, `save.js`, `maplogic.js`, `state.js`
- `tools/` — generators (`make-assets.js`, `make-cutscenes.js`, `make-card-art.js`, `make-minigame-art.js`, `make-audio.js`, `make-animals.js`, `campus/`,
  `interiors/`), `pack-offline.js` (+ `--hosted`), `qa-offline-play.js`, `qa-shots*.js`, `feedback*.js`, `lib/`
- `docs/` — STORY, plans/ (**2026-10-04-day3-feedback-and-wow.md**, 2026-10-03-birthday-sprint.md), quality/ (defect-sweep-2026-10-04.md, scorecard),
  research/ (photos, tour, bus, animals, facts), OFFLINE_BUNDLE, **HOSTING**, ARCHITECTURE, STYLE_GUIDE, GAME_FEEL · `decisions/` — ADRs 0001-0022 ·
  `ERRORS.md` — ERR-0001..0015
- `tests/unit` (691) incl. `foyer-tour`, `completeness`, `story-clearance`; `tests/e2e` (185) · `electron/`, `build/` — Windows packaging (unused)

## Quality scorecard (paused; last ratings 2026-09-29, details in docs/quality/scorecard.md)
Outdoor 7, Interior 6, Characters 4 (texture bug fixed since; re-rate), UI 7, Story flow 6, Cutscenes 7, Mini-games 6, Card 7; Audio, Game feel,
Performance not rated. The owner's "no wow yet" is the real signal: the wow layer (plan section B) is the next lever, not the rubric.
