# Birthday sprint (4 days, 2026-10-03 .. 2026-10-06)

Status: **Days 1-2 done; continued in [2026-10-04-day3-feedback-and-wow.md](2026-10-04-day3-feedback-and-wow.md)**. Owner decisions from the design interview on 2026-10-03 (grilling session). This
plan **pauses the quality loop's rating** ([QUALITY_LOOP.md](../QUALITY_LOOP.md)): until the owner has
played the game and sent feedback, the goal is *complete and working*, not *rated 8+*. The loop resumes
afterwards, owner feedback first.

The game is a **birthday gift for Taru's 22nd birthday** (next week; exact date not given, so treat
Day 4 as the last build day with a day of slack). She plays it on a **MacBook**.

## The goal

1. **Complete:** the whole story plays from title to the birthday credits with nothing empty,
   no soft-lock and no missing texture.
2. **She can open it by double-clicking** (one offline `index.html` bundle, no install, no server).
3. **It feels like a place:** people and animals move around the campus; you can talk to the students
   and learn about the campus; the real entrance, reception and ground floor match the photos.
4. **Cute, soft, with a story** (owner's look): the campus and its rooms hold meaning. Art need not be
   insane, but it must not have bugs (broken pavements, hard walls, blocky buildings, odd windows).

## Owner decisions (settled)

| Topic | Decision |
|---|---|
| Delivery | One self-contained offline bundle for the MacBook ([ADR 0017](../../decisions/0017-offline-bundle-for-mac.md)). The Windows .exe is dropped from the plan (no build unless asked). |
| Ending | Box opening, the card, then a **credits phase**: "Happy Birthday, Taru", "Happy 22", ~8 wishes one by one, THE END ([ADR 0019](../../decisions/0019-credits-ending-and-recipient.md)). |
| Her name | The name field is prefilled "Taru" (she can change it). The credits always say Taru. |
| Talkable life | Every ambient student can be talked to and tells a campus fact; cats and birds wander ([ADR 0018](../../decisions/0018-talkable-campus-life.md)). |
| Facts | From the official BITS Dubai site and whatever is openly visible online (public Instagram, no logins). **Real CS professors may be named** (owner's call, 2026-10-03); the owner supplies more facts when asked. |
| Animals | Download free animal tileset packs (license checked, credited in CREDITS.md). Fallback: generator art. |
| Real-campus match | Look at the BITS Dubai 3D virtual tour for the **main reception and the ground floor** (left, right, structure). Fix only what clearly contradicts it. No deep rebuild. |
| Bus | An **RTA (Dubai) bus**, pixelated: it pulls up at the Gate 2 kerb, the **door opens**, she steps out. Find a reference image first. |
| Ratings | Not now. One objective defect sweep instead. |
| Scheduled task | "Pixel game: work the roadmap" is **disabled**. Owner says when to re-enable. |
| Playtest | The owner plays after Day 2 and sends feedback through the O overlay. |

## Schedule

| Day | Date | What happens | Owner action |
|---|---|---|---|
| 1 | Sat 10-03 | Cleanup (done). Research agents (facts, bus reference, 3D tour, animal packs). Sonnet briefs: the 3 bugs, then offline bundle, credits scene + name prefill, RTA bus. | Nothing. Upload card assets whenever ready (see below). |
| 2 | Sun 10-04 | Talkable people + animals, ground-floor/reception match, defect sweep, completeness test, full `npm test`, push. **Handover at end of day.** | Review the facts list when asked (add professors, clubs, quizzes). |
| 3 | Mon 10-05 | **Owner playtest.** Feedback via the O overlay. Items fixed first. | **Play the whole game. Send feedback.** |
| 4 | Tue 10-06 | Final fixes, final full test, final offline bundle, "how to open it" note. Stop with a day of slack. | Final check of the bundle; send it to her. |

**You can start testing at the end of Day 2.** I'll tell you when the handover build is ready: the
`../2D_pixel_game-play` copy is updated to `main` (`npm start`, http://localhost:8080) and the offline
bundle exists in `dist/offline/` (double-click `index.html`). See the playtest checklist below.

### Cut line (if time runs short)
1. Animals (cats and birds first, the rest drop).
2. The tour-based interior match beyond the foyer and reception.
3. Extra ambient lines.

**Never cut:** the 3 bugs, the offline bundle, the credits, the RTA bus, the completeness checklist.

## Work packages (Sonnet briefs)

Each package gets one self-contained brief: unit tests only, no servers/browsers/e2e/push, nothing left
running, no commit by the agent ([FEEDBACK.md](../FEEDBACK.md) "Who does the work"). Packages run in
parallel only in separate worktrees; packages that touch `src/main.js` (the asset loader) run in sequence.

| # | Package | Scope | Done when (checked by unit tests + the Day 2 checks) |
|---|---|---|---|
| A | **3 known bugs** | `src/main.js` preload, `src/scenes/world.js` `nearestInteractable()`, `tools/qa-shots.js` | Every NPC sheet referenced by `MAPS` npcs + `AMBIENT` + script actors is preloaded (test: each has a PNG and a preload). No `__MISSING` texture on campus or in the Main Block (e2e written, run Day 2). Story objects win exact distance ties over NPCs. qa-shots takes the platformer shot at the 3x level position. |
| B | **Offline bundle** | `tools/pack-offline.js` (new), `npm run pack:offline`, loader patch for `file://` | `dist/offline/index.html` plus assets opens under `file://` in Chrome/Edge with no console error, plays title to credits, audio works, saves work. Copies `assets/card/` (gitignored) at build time. Dev tools off. No server, no `fetch` of local files. |
| C | **Credits scene + name prefill** | `src/scenes/credits.js` (new), `src/scenes/card.js`, the name-entry scene, `card.example.json`, `src/card.js` | After the card: "Happy Birthday, Taru" and "Happy 22", ~8 wishes fade in one by one (~3 s each), THE END, "Made for you by Mustafa". Wishes and recipient come from `card.json` (`wishes`, `recipient`, `age`) with built-in defaults. Name field prefilled "Taru", editable; credits always use the recipient. Esc skips. "Watch the card again" still works. |
| D | **RTA bus arrival** | `tools/make-assets.js` (bus art), `src/scripts.js` opening script | A pixel RTA bus (livery from the reference in `docs/research/`) drives in, stops at the Gate 2 kerb, **opens its door**, she steps out, the door closes, it pulls away. 3/4 view. Plays inside the existing `ADR 0016` script runner. |
| E | **Talkable people + animals** | `src/ambient.js`, new `src/campus-facts.js` (data), `src/dialog.js` hook, animal sprites + AI, `CREDITS.md` | Every ambient student turns toward her on E, says 1 fact from their role pool (rotating), then walks on; never blocks the quest or a door. About 12 types and 30-40 facts, every fact traced to `campus-facts.md`. Cats and birds wander (idle/walk), react to her, cap on movers for performance. Free pack licensed and credited, or generator fallback. |
| F | **Reception and ground floor match** | `tools/interiors/*` | Foyer, reception, stairs, corridor structure agree with `docs/research/tour-ground-floor.md`. Only clear contradictions are changed. Story rooms and floors unchanged. |
| G | **Audio that works in Safari** | `tools/pack-offline.js`, `src/audio.js`, `tools/make-audio.js` | The music and sfx are Ogg Vorbis; older Safari cannot decode Ogg, so the bundle could be silent on her MacBook. Bundle both Ogg and a Safari-safe copy (MP3 or AAC, converted at build time with a devDependency or pure-JS encoder; no system install) and pick by `canPlayType`. A unit test checks every sound has both. |
| R | **Research (read-only)** | `docs/research/` | `campus-facts.md` (sourced; clubs, quizzes, facilities, events, CS professors), `rta-bus-reference.md` + image, `tour-ground-floor.md`, `animal-packs.md` (license, preview, fit). |

Also Day 1: remove the "food truck by the gate" line from `src/ambient.js` (it doesn't exist), and mark
FB-0027..0034 fixed (`npm run feedback -- fix ...`). FB-0025 is a standing rule (use free packs, don't
hand-draw art unless no pack exists: the bus is the exception).

## Status log

- **Day 1 (done):** cleanup; A (3 bugs), B (offline bundle, builds at about 20 MB), C (credits + Taru prefill) and D (RTA bus with door animation) merged, 508 unit tests green; research done (campus facts, RTA bus, 3D tour, animal packs). FB-0027..0034 marked fixed. "Food truck" line removed.
- **Decided (owner, 2026-10-03):** the ground floor follows the 3D tour, not the older photo: ADR 0020, docs/research/tour-ground-floor.md. Package F is next.
- **Fix round done:** 7 e2e failures fixed incl. 3 real soft-locks (Room 195 key unreachable, ICVL closet, Physics Lab desk); 578 unit tests green; full e2e not yet re-run.
- **Animals:** the owner's pack cat (4-direction walk) + Zeenaz cat poses + LPC Birds; the owner said cats and birds only.
- **Not yet seen in a running game:** everything built on Day 1 is unit-tested only. Day 2 is the first browser pass.

- **Day 2 (done, 2026-10-04):** foyer + wings rebuilt to the tour; offline bundle played from file:// in Chromium and WebKit (zero errors); defect sweep (23 faults, story-route ones fixed) and a generated completeness test; card typewriter bug fixed (ERR-0014); full test green (unit 691 + e2e 185) and pushed; hosted-link build (`npm run pack:site`, ADR 0022). Birthday is **2026-10-11** (owner); hand over by 10-09.
- **Owner's first playtest (2026-10-04):** "the game is fine, but no wow yet"; 33 feedback items FB-0044..0076 and a request for ideas. Continues in [2026-10-04-day3-feedback-and-wow.md](2026-10-04-day3-feedback-and-wow.md) (re-planned schedule 10-05..10-11).

## Day 2 verification (one test round, then stop everything)

1. **Completeness checklist test** (generated): every reachable map has props and life; every door that
   opens leads to a furnished room; every locked door says something; every referenced texture loads.
2. **Scripted playthrough**: title -> name -> bus -> Mustafa -> stall -> 3 mini-games (or skips) -> box -> card -> credits.
3. **Defect sweep** (`npm run qa:shots`, once): list only objective faults (broken tile seams, glitched or
   missing sprites, overlaps, windows that don't line up). Fix them in one brief. No scores.
4. **Offline bundle check** under `file://`.
5. Full `npm test` on a quiet machine, then push. Then stop every server.

## Owner playtest checklist (Day 3)

Play from the title screen like a new player, once without skipping and once with Esc skips. Press **O**
to send each thing you see. Look for:
- the RTA bus and the door opening; Mustafa's welcome; knowing where to go next;
- the real-life match: the entrance, the reception, the ground floor;
- talking to students (are the facts right? sound like a student?), cats and birds;
- the 3 mini-games (fair? skippable after 3 losses?);
- the box, the card and the credits (wording, pacing, "Taru", "22");
- anything that looks broken, empty, or wrong for the BITS Dubai campus.

## What the owner provides, and when

| What | When | How |
|---|---|---|
| Card photos, closing video, final wishes | Day 2-3 ("tomorrow, day after") | Put them in `assets/card/` and list photos in `card.json` ([STORY.md](../STORY.md) "How to put your photos and messages in"). Not required for the handover: placeholders work. |
| Facts, clubs, quizzes, professors | Day 2, when the facts list is shown | Reply in chat or in the O overlay; they go into `src/campus-facts.js`. |
| Playtest feedback | Day 3 | O overlay. |
| Real locations of the Physics Lab, ICVL, Room 195 | Not available | Stay guessed (STORY.md "Open questions"). |

## Risks

- **Safari on her MacBook can't be tested here.** Mitigation: no `fetch`/XHR of local files, no ES-module
  imports over `file://`, no features Safari lacks; test in Chrome and Edge under `file://`; keep the
  bundle plain script tags (as the game already is); the "how to open it" note says "use Safari or Chrome".
- **Bundle size.** Only runtime assets are embedded (maps, sprites, audio, card), not the source packs.
- **Facts about a real institution can be wrong.** Every fact is sourced; unverifiable claims are left out;
  the owner reviews the list.
- **Time.** The cut line above.
