# Handoff — read this first

**Updated 2026-10-04 (end of Day 2 of the birthday sprint, after the owner's first playtest).** Then read
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

## State (2026-10-04)

`main` is pushed (origin/main = `2fad122`, plus local docs commits since; this handoff's own commit may be ahead). Last full `npm test`:
**unit 691 green + 185/185 browser tests green** (run twice; one unreproduced e2e failure in a push attempt: ERR-0015). Nothing is running
(the owner started their own server with `node server.js` for the playtest; it is theirs).

### Done (Days 1-2)
Offline bundle (Safari-safe MP3 audio), credits scene, RTA bus with door animation, talkable students + cats and birds, campus facts, **foyer and
two wings rebuilt to the 3D tour** (ADR 0020), 13 closed nameplated wing doors that each speak a line, a story-clearance test, a **completeness test**
(textures, door targets and arrival tiles, lock reasons, furniture density, life per reachable map), `tools/qa-offline-play.js` (title -> credits from
file:// or `PLAY_URL`, Chromium or WebKit), a defect sweep ([docs/quality/defect-sweep-2026-10-04.md](docs/quality/defect-sweep-2026-10-04.md): D01-D11,
D13-D17, D19 fixed; D12, D18, D20-D23 left on purpose) and the card typewriter bug (ERR-0014). Hosting build `npm run pack:site`.

### The owner's playtest feedback (2026-10-04): 33 NEW items FB-0044..FB-0076 are waiting
Run `npm run feedback`, then `npm run feedback -- show FB-00xx` for each (many are just a screenshot + a title). The plan groups them into
packages P1-P5 with notes and open questions: **[docs/plans/2026-10-04-day3-feedback-and-wow.md](docs/plans/2026-10-04-day3-feedback-and-wow.md)**.
In short:
- **P1 controls/UI:** E and Enter both advance messages (FB-0045), stop the player when an overlay shows (FB-0072), cut-off text box and wordy
  instructions (FB-0073), item bar (FB-0068), a way to quit (FB-0075), after the end go back to the main screen (FB-0076), entrance run animation +
  not walking over the door/wall line (FB-0046).
- **P2 names/dialogue/costumes:** hostel resident -> **Deanne** (FB-0050); funnier CS-student lines, friends **Sid, Akshit, Varun, Mitul, Karthik**,
  **Mustafa** (black and orange hoodie) near all the games with a fixed line (FB-0051); club colours MTC black/white, ACM dark pink, LUG orange/black,
  others sky blue (FB-0057); **ICVL is really "ICL"** (FB-0070). See [ADR 0021](decisions/0021-friends-in-the-game-and-personal-touches.md).
- **P3 campus outdoors:** a Dubai RTA bus stop and the road continuing left (FB-0044/0049), real parking bays (FB-0047), double pavement lining
  (FB-0048), barrier fully down (FB-0052), broken/mismatched trees (FB-0053/0056), a proper roundabout and road/pavement styles (FB-0054/0055).
- **P4 Main Block interiors:** window, black for inaccessible areas instead of "dirt", door facing, **stairs that look like stairs** with a proper
  tileset (FB-0058..0065), **all doors animate open/close** (FB-0067), the lift (FB-0069).
- **P5 mini-games:** replace Tetris with a **match-3** (FB-0074); the **ICL** is a fingerprint-locked lab opened by a mini-game, modern spaceship-like,
  robot "Alice" (FB-0071); Physics Lab: students + a harder hero-vs-villain fight (FB-0066, use generic stand-ins, not Hello Kitty/Batman).
- **P6 the wow layer** (plan section B): friends as characters, memory album, blow-the-candles + fireworks finale, golden-hour lighting, juice pass,
  selfie mode, phone hints, passport, Dubai flavour. The owner picks; the recommended set is W1, W4, W3, W2, W6.
FB-0025 stays a standing rule: free asset packs only, no hand-drawn art. Old items waiting on the owner to verify in the Inbox: FB-0023, 0024, 0027..0043.

## Owner decisions (all settled)
Offline bundle + a hosted link as backup (Netlify Drop, unlisted, card photos included; **the owner uploads it**, an account login is needed: ADR 0022);
credits with Taru/22/wishes; name prefilled "Taru"; real CS professors may be named in facts; cats and birds only; tour-based ground floor (ADR 0020);
wing doors closed + each says a line; no ruler portraits; **named friends allowed as characters (ADR 0021)**; scheduled task "Pixel game: work the
roadmap" **disabled** until the owner says; ratings paused; **one Sonnet agent at a time, monitored** (see Rules).

## What is LEFT (in order)
1. **Triage** the 33 items (`npm run feedback`), ask the owner about the unclear ones, then execute packages **P1 -> P5** one agent at a time
   (plan section A and the schedule in section C). Mark fixed items (`npm run feedback -- fix FB-00xx "..."`). Add `FB-XXXX:` regression tests.
2. **Wow layer** (P6) with the owner's picks, incl. the owner's "moments" ([docs/plans/2026-10-04-moments-and-small-touches.md](docs/plans/2026-10-04-moments-and-small-touches.md): unicorn+prince, Mevin, Raja's chariot, ball pit, tower-climb game; 6 open questions); needs the friends' lines/jokes and the card photos from the owner.
3. After each visual package: `npm run qa:shots` and LOOK at the shots; `npm run qa:offline` for the bundle. Full test once per day (pre-push hook).
4. **Final handover (by 2026-10-09):** card assets in `assets/card/` -> `npm run pack:offline -- --zip` and `npm run pack:site`; update
   `../2D_pixel_game-play`; the owner uploads `dist/offline-site` to Netlify; send Taru the link + the zip + `HOW_TO_OPEN.txt`.
5. Later: resume the quality loop ([docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md)); `src/scenes/ui.js` is large (split it only after the loop).

**Cut line:** W7/W8, then W6/W2, then match-3 art polish, then extra ambient lines. **Never cut:** P1 (controls, quit, ending -> title), the bundle and
hosted link, credits, soft-lock guards, the completeness checklist, the full test before handover.

## What the owner provides (and when)
- **Card assets** (photos, closing video, final wishes, recipient/age) in `assets/card/` (gitignored; shape in `assets/card/card.example.json`):
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
