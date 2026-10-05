# Handover: end of Day 3 (2026-10-05)

The complete record of the Day 3 session, for whoever picks the project up next. Read this, then [HANDOFF.md](HANDOFF.md) (rules, risks, how to run),
[CLAUDE.md](CLAUDE.md), [docs/plans/2026-10-04-moments-and-small-touches.md](docs/plans/2026-10-04-moments-and-small-touches.md), and the last entries of
[MEMORY.md](MEMORY.md) / [ERRORS.md](ERRORS.md) (ERR-0016..0018). The copy-paste prompt for the next session is [docs/NEXT_SESSION_PROMPT.md](docs/NEXT_SESSION_PROMPT.md).

## 1. The project in four lines
A browser pixel game (Phaser 3, plain script tags, no build step) recreating the BITS Pilani Dubai campus: **a birthday gift for Taru's 22nd birthday, 2026-10-11**.
She plays on a **MacBook**; the owner has no Mac, so the deliverables are the **offline double-click zip** (`npm run pack:offline -- --zip`) and a **hosted link**
(`npm run pack:site`, the owner uploads it to Netlify Drop; ADR 0017/0022). Target handover **2026-10-09**, 10-10 is slack. Ratings stay paused.

## 2. State right now
- `main` is **26 commits ahead of origin, NOT pushed** (push only when the owner says; the pre-push hook runs the full suite, 9-17 min; save output to a file).
- **Tests (2026-10-05 night):** unit **1058/1058**, browser **186/186** (10.0 min). `qa:shots` 103 captured, 0 skipped. `qa:offline` plays title -> credits (incl. the new finale) from
  `file://` in Chromium and Playwright WebKit with zero errors and zero external requests. Nothing is running in the background.
- The owner's play copy `../2D_pixel_game-play` is on `9969ccf` (play with `node server.js` from there; PowerShell blocks `npm.ps1`, use `node` or `npm.cmd`; `O` = feedback overlay).
- The owner has **not yet played** this build. Their first playtest (2026-10-04) produced the 33 items FB-0044..FB-0076, all now implemented.

## 3. What was done in Day 3 (commits since `4ade8c5`)
Process: **one Sonnet agent at a time** (briefs in `docs/plans/agent-rules.md` + a task brief), the coordinator reviews the diff, runs `npm run test:unit`, **looks at crops/shots**, marks
feedback fixed (`npm run feedback -- fix FB-00xx --test "..." "..."`), logs MEMORY.md and commits after each agent.

| Package | Commit | What |
|---|---|---|
| Docs | c7f8c2f..28082d0 | `docs/plans/agent-rules.md`, ADR 0021 addendum (full FB-0051 list), the owner's **moments** doc and two grilling rounds |
| **P1** controls/UI | 54c764b | FB-0045/0046/0068/0072/0073/0075/0076. E/Space/Enter share one handler; `haltPlayer()` when any script/overlay takes over (ERR-0016); the 9-slice frame lost its right/bottom border (ERR-0017); Quit (title + pause "Quit Game") + goodbye scene; ending chain hardened; Main Block door glass solid, two-tile doorways (`cells`) |
| **P2a** | bf48ece | ICVL -> **ICL** everywhere (ids `icl`/`keyIcl`/`key-icl`, save migration `renameLegacyIds()`); named ambient NPCs (`name`, `lines`, `sheet`, `factIds`; **Deanne**); club outfits (ACM dark pink, LUG+volunteer orange/black, new role `mtc-member` black/white, other clubs sky blue; 32 baked sheets `npc-<body>-<outfit>`) |
| **P2b** | 525449d | Funnier CS openers; 9 named friends (Sid, Akshit, Varun, Mitul, Karthik, Siva, Shamsuddin, Najam, Satvik with a camera); 3 **Mustafas** (black+orange hoodie) near Physics Lab / ICL / Room 195; Prof. **Elakkiya / Angel (wings) / Raja** |
| **P3a** | 3db5d2e | `tools/render-map-crop.js`; kerb/road autotile (`tools/campus/autotile.js`); oval roundabout; Gate 2 road continues west; real parking lots (`drawBayLot`) |
| **P3b** | 840eb2d | **Dubai RTA bus stop** (bay, shelter, sign pole), full-width barrier, new palms + leafy trees (`tools/lib/tree-art.js`) |
| **P4a** | 132f7d8 | Black void (`intVoid`), side-on doors/windows in vertical walls (auto-swapped), Library lobby at the foyer back-centre (door still closed) |
| **P4b** | ffde522 | Stairs from LimeZu pack art; **working lifts** on 4 floors (`lift` object + `{ warp }` dialog action + ding) |
| **P4c** | 1a1e06a | Every door/lift animates closed/half/open (`tools/lib/door-kinds.js`, `doorFrames()`, `doorClose` click) |
| **P5a** | dad0a8f | **Room 195 = tower climb** (Tetris removed; match-3 dropped by the owner): `tower-logic.js` + `tower.js` |
| **P5b** | 1f5f1f1 | **Physics Lab = hero fight** (kitten hero vs shadow bat, Z shoots, 9 hits, telegraphed volleys; **original** stand-ins; sunset cover; 4 lab students) |
| **P5c** | 2cd5b8d | **ICL = sealed spaceship lab**: scanner -> "ICL Fingerprint Hack" (the flyer) opens the hatch (`iclDoorOpen` flag), **Alice** the robot (or the console) gives the key |
| Spec fixes | 6c5f536 | 3 stale e2e expectations (named NPC tags, station E priority, journal count) |
| **Moments** | 1423193, 384658e, 9969ccf | `src/moments.js` pacing + **M1 unicorn+prince**, **M2 Mevin (Treble)**; M1 waits 2.5 s of free control, M2 follows ~6 s after M1; framing fixed so Mevin is above the dialog box |
| **W4** golden hour | e545d13 | `src/daylight.js`: morning -> midday -> golden -> dusk with the keys; vignette, lamp halos, dust motes |
| **W3** finale | 24d7c5e | box -> **finale** (cake, 22 candles blown out one by one, fireworks over a Dubai skyline, chiptune "Happy Birthday") -> card -> credits -> title ([ADR 0023](decisions/0023-birthday-finale-between-box-and-card.md)) |

Feedback status: FB-0044..FB-0076 fixed (in the owner's Inbox "Fixed, please check") **except FB-0051 (in progress)** and FB-0076 (fixed but has an open question to the owner in the thread).

## 4. New mechanisms and switches worth knowing
- **Tools:** `node tools/render-map-crop.js <map> x0 y0 w h scale out.png` (real tiles, look at any map without a browser); `node tools/preview-daylight.js [out] [--crop x,y,w,h]`; `npm run moments` (moment art); `tools/qa-shots.js` now also shoots both moments.
- **URL switches (tests/dev):** `?moments=0` and `?daylight=0` (the e2e helpers default both off; `moments: true` / `daylight: true` opt in); `?cutscene=0` also disables moments.
- **Named NPC fields** in `src/ambient.js`: `name`, `lines`, `sheet`, `factIds`. **Moments table** in `src/moments.js` (`minGapS`, `sameVisitOk`, `afterFreeS`, `requires`). **Door data:** `closedTiles/halfTiles/openTiles`. **Save fields:** `seenMoments`, `playSeconds`, `lastMomentAt`, flag `iclDoorOpen`; old saves migrate.
- **Soft-lock guards kept:** skip after 3 losses in every mini-game (round failsafes at 150 s), candle auto-blow at 20 s, ICL door opens for saves that already have the key, completeness + story-clearance tests extended for lifts, sealed door, scanner, Alice.
- Generated art/maps only through the generators (`npm run assets / campus / interiors / moments`); a test forbids "Hello Kitty/Batman/Sanrio/Gotham" in code (protected characters are generic stand-ins, ADR 0021).

## 5. What has been SEEN vs NOT seen
- **Seen (screenshots/crops, by the coordinator):** every new map area, the three mini-games (intro/play/win), the cover, the finale (candles, fireworks), both moments, the title menu, stairs, lifts, doors.
- **Not seen / needs a human:** game **feel** (tower and hero-fight difficulty, jump feel, climb animation), the unicorn lift-off and drum sync, **all sound** (the chiptune song, candle "pff"s, drums), hold-Space candle blowing on a Mac/Safari (key repeat, blur), the oval roundabout at zoom 3, MULTIPLY lighting on both renderers, door/lift motion, real **Safari** (never run; Playwright's Windows WebKit has no Web Audio).

## 6. Decisions made (all in docs; ADRs 0021, 0023; the moments doc "Settled with the owner")
Tower climb is the Room 195 key, **match-3 dropped**; hero fight uses generic stand-ins; ICL is a fingerprint lab; moments play once, are unskippable, spaced (entrance pair chains);
real friends/professors allowed as NPCs (kind teasing only; no birthday mentions in NPC lines); library stays closed; finale before the card; owner did not answer grilling round 3 so the
**recommended answers were used** (22 candles one by one, cake before the card, golden hour outdoors + gentle indoors, album/selfie as placeholders with photos swapped in via `assets/card/`).
**Parked by the owner (2026-10-05): the TP room, i.e. the ball pit and the arcade with sumo vs Narda: not a priority now.**

## 7. Still to do (in priority order)
1. **The owner's playtest** (play copy is ready): triage the O-overlay feedback (`npm run feedback`, `-- show FB-xxxx`), fix through packages, one agent at a time.
2. **Owner-side items:** approve/edit the new lines in `docs/research/campus-lines-review.md`; answer the FB-0076 question; confirm the volunteer's changed line about the lift; card assets into `assets/card/` (photos, closing video, wishes) by ~10-07.
3. **Remaining wow/moments, optional, cut from the bottom:** juice pass (key-pickup sparkle flying to the HUD, emotes); **M3 Prof. Raja's chariot**; **M4 Sana/Shraddha/Palak** ("Hi Taru, come to the canteen with us"); **W2 memory album** and **W6 selfie** (placeholders). Finish FB-0051 with M3/M4.
4. **Parked (do not start unless the owner asks): TP room** (Telepresence Classroom door, currently "Locked for now"): ball pit + arcade + **sumo vs Narda** (design in the moments doc; Narda is a friend, she/her).
5. **Final handover by 2026-10-09:** full `npm test`, `qa:shots` (LOOK at them), `qa:offline` (Chromium + `webkit`), update `../2D_pixel_game-play`, `npm run pack:offline -- --zip` and `npm run pack:site`, give the owner the zip + `HOW_TO_OPEN.txt` + `dist/offline-site` (docs/HOSTING.md). The agent never creates accounts or publishes.
6. Housekeeping: the knowledge graph in `graphify-out/` is **stale** (hundreds of changes; refresh with `/graphify . --update` only when the owner allows); `src/scenes/ui.js` and `tools/make-assets.js` are very large (split after the sprint); decorative hostel entrances are still walkable art (not real doors).

**Never cut:** the bundle + hosted link, credits, soft-lock guards, the completeness checklist, the full test before the final handover.

## 8. Lessons from this session (also in ERRORS.md)
- A **usage-limit stop** kills a running agent mid-edit: check `git status` + `npm run test:unit`, then resume the same agent with SendMessage (its context and edits survive). Nothing was lost three times.
- Agents cannot see the game: give them `tools/render-map-crop.js` and temp-PNG previews and make them OPEN the PNGs; the coordinator must still **look at `qa:shots`** (it found: the unicorn starting right after the welcome, Mevin hidden behind the dialog box, a stray "E" prompt, a stale name-tag test).
- Pacing rules written by the coordinator can silently starve a feature (Mevin would almost never have played): test the *player's* route, not just the rule.
- One agent's bad edit script deleted most of `tools/make-assets.js` once (rebuilt from `HEAD` plus its edits and the diff checked): keep agents on small `Edit`s and review `git diff --stat` for surprises.
- Never run two agents at once and never run the browser suite while an agent edits.
