# Handoff — read this first

**READ FIRST: [docs/NEXT_SESSION_PROMPT.md](docs/NEXT_SESSION_PROMPT.md) (updated 2026-10-10, end of the delivery day): the game is DONE and handed over (zip + hosted link). What is open is optional: the post-game free roam, the Auditorium ball pit and a few extras, planned in [docs/plans/2026-10-10-post-game-auditorium.md](docs/plans/2026-10-10-post-game-auditorium.md).** Day 3 / Day 4 record: [HANDOVER.md](HANDOVER.md).

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

## State (2026-10-10, end of the delivery day: everything is on `main`)

`main` holds the finished game: EDI Madness (ICL parking), the message-only birthday card (cake on a sunset glow, the owner's final message, a lively backdrop), M1-M5 moments, the owner's NPC names/lines (FB-0083..FB-0101), Taru's reactions after Prof. Angel and Mevin (FB-0102), the sign-off "Made for you by your one and only" (FB-0103). The last full browser run was the push hook's: 190/190. Later commits since then only touch moments pacing, two Taru lines and the sign-off (unit + the affected specs green, `qa:offline` clean). Whether `origin/main` has the newest commits depends on the last push (check `git status -sb`).
**Delivered to the owner:** `dist/offline.zip` (8.7 MB) and the folder `dist/offline-site` (15.5 MB, uploaded by the owner to Netlify Drop; rebuild + re-drop after ANY change, same site, same link). No card photos/video (optional; with none the card shows the cake). Tests: unit 1316, browser 190, `qa:offline` Chromium + WebKit title->credits zero errors. Performance (headless, software GL): world update 0.2 ms/frame, no leak over 12 map changes, maps load in 0.5-1.2 s.
**Moments (cut scenes) rules NOW (owner, 2026-10-10):** no 90 s gap and no one-per-visit cap (the old rule was an agent's design, never the owner's). Each scene = a PLACE (tile rectangle) + a REQUIREMENT, plays once per save, never while a dialog/script/overlay is up. M1 needs the gate welcome + 2.5 s free control; M2 needs M1 and starts ~6 s after it ends; M3 any key, ground-floor hall; M4 the Physics Lab key, 3rd-floor corridor rows 19-20 x5..20 (standing in the lab or on row 18 does nothing: she must step onto the corridor); M5 the ICL key, ICL lab rows 11-12 x4..15, 0.6 s after the key dialog. Scenes are 8-20 s (M2 and M5 have ~0.8 s left: adding a line means trimming).

### Everything built so far (Day 3 + Day 4: see [HANDOVER.md](HANDOVER.md) for commits, switches, seen vs unseen)
- Day 3: P1 controls/UI, P2 named NPCs + club outfits, P3 outdoors, P4 Main Block (lifts, doors, stairs), P5 mini-games (tower climb Room 195, hero fight Physics Lab, ICL sealed lab with Alice), moments M1/M2, golden hour, birthday finale.
- Day 4: juice pass, M3 Raja's chariot, M4 Sana/Shraddha/Palak (now on the **3rd-floor corridor after the Physics Lab key**), W2 memory album (Journal Tab page, placeholders until photos), W6 selfie (P key), and the owner's 2nd-playtest fixes **FB-0077** (Gate 2 barrier lifts and stays up), **FB-0078** (slim code-drawn unicorn; prince: "If you're ever a little tipsy, I'll always watch out for you"), **FB-0079** (Aakar, sky blue, Dr. Evil voice), **FB-0080** (Mahin, badminton), **FB-0081** (left click shoots in the hero fight, Z kept), **FB-0082** (Rapunzel-tower backstory pages). FB-0051 fixed.
- The owner has played the build up to ~2226e24; they have not seen the fixes above or the 3rd-floor friends.

## Owner decisions (all settled)
Offline bundle + a hosted link as backup (Netlify Drop, unlisted, card photos included; **the owner uploads it**, an account login is needed: ADR 0022);
credits with Taru/22/wishes; name prefilled "Taru"; real CS professors may be named in facts; cats and birds only; tour-based ground floor (ADR 0020);
wing doors closed + each says a line; no ruler portraits; **named friends allowed as characters (ADR 0021)**; scheduled task "Pixel game: work the
roadmap" **disabled** until the owner says; ratings paused; **one Sonnet agent at a time, monitored** (see Rules).

## What is LEFT (in order)
1. **Nothing is required.** If the owner sends changes: `npm run feedback`, one Sonnet agent at a time (docs/FEEDBACK.md), unit tests while building, the affected e2e specs ALONE, then rebuild `npm run pack:offline -- --zip` + `npm run pack:site` and `node tools/qa-offline-play.js` (+ `webkit`); the owner re-drops `dist/offline-site` on Netlify. A push runs the full-suite hook (10 min on a quiet machine): only when the owner asks.
2. **OPTIONAL, nice to have, owner idea 2026-10-10** (full plan, steps, open questions: [docs/plans/2026-10-10-post-game-auditorium.md](docs/plans/2026-10-10-post-game-auditorium.md)): after the credits she stays in the world, is told she can head to the Auditorium, which opens as a small fun area with a ball pit (and maybe the sumo-vs-Narda arcade). Build on a branch, ask the open questions first, never risk the delivered build.
3. **Other left-off ideas:** the card with a real photo (owner may send one image; never looked at in photo mode), an admin page (list/delete this browser's saves, feedback switch; cannot reach her browser), the TP room, more moments, the owner's unchecked guesses (FB-0088 which of the pair is Nishit/Shryk, FB-0098 which corridor NPC is Krishna Nagpal).

**Cut line (for the optional extension):** from the bottom of docs/plans/2026-10-10-post-game-auditorium.md (extras, then sumo vs Narda, then the ball pit, then the Auditorium interior; the post-credits free roam is the smallest useful step). **Never cut:** the offline zip and hosted link, credits, soft-lock guards (skip after 3 losses in every game, the ICL door guard), the completeness checklist, the full test before a handover.

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
