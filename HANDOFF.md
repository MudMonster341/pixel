# Handoff — read this first

**Written 2026-09-27, when the owner paused all work.** Everything a fresh session needs to pick this
up. Read this, then [CONTEXT.md](CONTEXT.md), the last entries of [MEMORY.md](MEMORY.md), and the
premium-pass plan [docs/plans/2026-09-26-premium-pass.md](docs/plans/2026-09-26-premium-pass.md).

## What this is

A browser pixel game, built as a **birthday gift**, recreating the **BITS Pilani Dubai campus**. The
player arrives as a new student, joins the **LUG treasure hunt**, wins three keys through mini-games,
and gets an animated **birthday card** at the end. The script is [docs/STORY.md](docs/STORY.md) —
follow it, don't invent story.

Phaser 3 from local files, plain script tags, **no build step** for the game itself. Node is only for
dev tooling. Delivered as a Windows .exe ([ADR 0010](decisions/0010-ship-as-windows-exe-and-web-build.md)).

## Status: PAUSED (2026-09-27)

The owner asked to pause everything. As of the pause:
- No agents or servers are running.
- The scheduled task "Pixel game: work the roadmap" is **disabled**. Re-enable it only when the owner
  asks.
- `main` = `origin/main` = `f3006ea` (plus this docs commit). All tests green: 337 unit, 132 e2e.
- The two in-flight stages are saved as **unreviewed WIP commits on their own branches** (below).
  They are not merged. Review them before merging; don't assume they're good.

## The premium pass (started 2026-09-26)

The owner played the finished game and asked for a complete quality pass. Their chat feedback is
tracked as FB-0027..FB-0034; the code-review findings are FB-0035..FB-0043. The plan has 7 stages:

| # | Stage | State |
|---|---|---|
| 1 | Bug batch (FB-0035..0043) | **Merged + pushed.** HUD keys gated during cutscenes/mini-games, toast queue + tutorial fix, honest credits, clothes-colour reload, hints by missing key, overwrite-save confirm, journal redraw/scroll, `take` action (volunteer collects the keys), mini-game input polish, real left/right sprite rows (ERR-0007) |
| 1b | Music, sound, volume (`feature/audio`) | **Merged + pushed** |
| 2 | Research | **Done.** [campus-visual-reference.md](docs/research/campus-visual-reference.md) (32 photos, per-space build specs), [asset-packs-2026-09-26.md](docs/research/asset-packs-2026-09-26.md). Ninja Adventure (CC0) downloaded for palms/trees/flags/FX/UI |
| 3 | Depth engine ([ADR 0015](decisions/0015-depth-groups-and-door-entry.md)) | **Merged + pushed.** Y-sorted depth groups, feet-based depth, Pokémon door entry/exit, locked-door rattle, camera lerp, running dust |
| 4 | Campus art (FB-0027/0028/0029) | **WIP, unreviewed**, branch `worktree-agent-a3b2fc0b219dea823` (last commit `c02913f`). Round 3: rebuilding the outdoor look on Kenney's RPG Urban Pack (CC0): concrete sidewalks, BITS buildings from Kenney parts recoloured to sand/terracotta, glass-front Main Block entrance with columns + canopy + compact navy sign, bright palms, flag poles, bus stop. Rounds 1-2 were rejected at review (still read as brick; the entrance read as a box). It stopped just after saving 5 screenshots it hadn't reviewed yet |
| 5 | Interiors rebuild, foyer per the owner's photo (FB-0030/0031) | Not started (waits on stage 4: both change `assets/tiles.png`) |
| 6 | In-world cutscenes + opening + onboarding ([ADR 0016](decisions/0016-cutscenes-play-in-the-game-world.md), FB-0032/0033) | **WIP, unreviewed**, branch `worktree-agent-a459f3366dea619e6` (last commit `e3eb7b6`). Script runner in WorldScene, new opening on the live campus, Mustafa NPC (npc-mustafa.png), destination markers. Stopped mid-way through the entrance/key-room beats. It was asked to list every new dialogue line for the owner's approval |
| 7 | Finish: temporary card, UI kit, performance, QA at window sizes, README for the recipient (FB-0034) | Not started |

**Owner decisions in this pass:** free art packs only (declined buying LimeZu Modern Exteriors,
2026-09-27); downloading free packs is approved; the keys leave the bag when handed in.

### How to resume
1. Read the plan and this table. `npm run feedback` first (owner feedback beats the plan).
2. The worktrees live in `.claude/worktrees/agent-*` (gitignored), each on its own branch with
   junctions to the main repo's `node_modules` and gitignored vendor packs. If a worktree is gone,
   the branch still exists: `git worktree add .claude/worktrees/<name> <branch>`.
3. Stage 4: open its screenshots (`docs/research/premium-pass/` on that branch), compare with
   `docs/research/reference/owner-main-block-entrance.png`, and either send it back or merge it.
   Then stage 5.
4. Stage 6: finish the entrance/key-room beats, run the full suite, review the flow in the browser,
   show the owner the new dialogue lines, then merge.
5. Give parallel agents separate e2e ports (`E2E_PORT=4174/4175/...`). Push only when no other tests
   are running: a loaded machine makes the e2e suite time out (seen three times, ERR-0002/0003 family).

## How the work runs

- **Sonnet subagents write all the code.** The coordinator plans, briefs, reviews diffs and
  screenshots, runs tests, updates docs and commits. This is the owner's rule.
- **Usage limits interrupt agents often.** Resume the same agent with SendMessage ("the limit has
  reset, continue where you left off"); its uncommitted work is still in its worktree.
- **Owner feedback beats the plan.** In-game O overlay → `npm run feedback` → fix with a test named
  `FB-XXXX: ...` → `node tools/feedback.js fix FB-XXXX --test "<test>" "<what changed>"`.
- The scheduled loop respects a `.session-active` lock file (docs/ROADMAP.md) while a live session
  drives the work. The loop is currently disabled anyway.

## Waiting on the owner

- **Verify the fixed items** in the in-game Inbox (press O): FB-0023, FB-0024, FB-0035..FB-0043.
- **Where the Physics Lab, the ICVL and Room 195 really are** (guessed floors today).
- **The card's content** (photos, recipient name, messages) in `assets/card/`.
- Approval of any new dialogue lines stage 6 writes.

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

The owner plays a **stable copy** from the worktree `../2D_pixel_game-play` (launch config "play").
Update it with `git -C ../2D_pixel_game-play checkout --detach main` and restart the server.

## Rules that must not be broken

- **Sonnet agents write the code**; the coordinator reviews, tests and commits.
- **Never** `--no-verify`, `--force`, or weaken a test to make it pass.
- **Art comes from free packs** ([ADR 0012](decisions/0012-third-party-asset-packs.md)); we draw only
  what no pack covers. Never hand-edit generated PNGs or maps — change the tools and regenerate.
- **The game is non-commercial and must never be sold** (LimeZu and Sprout Lands licences). Credits
  stay in [CREDITS.md](CREDITS.md) and in the in-game Credits screen.
- **Raw non-redistributable packs are gitignored**; only generated art ships.
- Tile names and indices stay stable when art changes, so maps and tests keep working.
- Don't invent story: [docs/STORY.md](docs/STORY.md) is the script, the owner writes the rest.
- Every decision gets written down: an ADR in `decisions/`, plus CONTEXT.md and a dated MEMORY.md entry.

## Map of the repo

- `src/` — game code: `main.js` (boot), `scenes/` (title, world, ui, cutscene, intro-*, box-opening,
  card), `minigames/`, `audio.js`, `dialog.js`, `story.js`, `save.js`, `maplogic.js`, `state.js`
- `tools/` — generators: `make-assets.js` (tiles and sprites), `make-audio.js`, `make-cutscenes.js`,
  `make-card-art.js`, `make-minigame-art.js`, `make-icon.js`, `campus/`, `interiors/`, `qa-shots.js`,
  `feedback*.js`, `lib/png*.js`
- `assets/` — generated art, audio and maps (committed), `vendor/` (raw packs; the non-redistributable
  ones gitignored), `card/` (owner's content, gitignored)
- `docs/` — STORY, ROADMAP, GAME_FEEL, STYLE_GUIDE, ARCHITECTURE, plans/, research/
- `decisions/` — ADRs 0001–0016 · `ERRORS.md` — ERR-0001 to ERR-0007
- `electron/`, `build/` — packaging · `tests/unit`, `tests/e2e`
