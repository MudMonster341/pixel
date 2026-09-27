# Build first, then the quality loop (owner rule, 2026-09-27)

The owner: "Build first, then we test. We waste too much time and stay stuck, so build everything
fast, the whole flow. Then the loop fixes bugs and design decisions, and each loop over the game tests
one thing, such as art in each area, design, and then everything. Set up a rubric, rate everything,
figure out what needs improvement, fix category-wise, then run the loop all over: test, rate, fix."

## Phase A — BUILD (until the whole flow exists)

Applies until every stage of [the premium pass](plans/2026-09-26-premium-pass.md) is merged.
- Agents write code and generate art/maps; they run **only the unit tests**
  (`node --test tests/unit/*.test.js`). They still write e2e tests, which run later.
- **No game servers, browsers, Playwright runs, screenshot scripts or pushes.** Nothing is left
  running in the background, ever. If a server is started for any reason, it's stopped in the same step.
- The coordinator reviews each branch's diff and merges it. No pushing in Phase A.
- Phase A ends with one full `npm test` round on a quiet machine, one fix round, and a push.

## Phase B — the quality loop (after Phase A)

Each loop run (the scheduled task, or a live session) does exactly one category:
1. **Pick** the category with the lowest score in [quality/scorecard.md](quality/scorecard.md)
   (ties: the one rated longest ago).
2. **Test that category once:** start the game, capture what the category needs (`npm run qa:shots`,
   the category's own e2e specs, a short scripted playthrough), then **stop every server**.
3. **Rate** every area of that category against the rubric below, 1-10, and write the scores plus
   concrete issues (what's wrong, where, which screenshot) into the scorecard.
4. **Fix** the category: group the issues into one or two Sonnet briefs, build-only (Phase A rules).
   Review, merge.
5. The next run of the same category re-tests and re-rates. A category is **done at 8+ in every area**.
   Every third run, and before any push, run the full `npm test`, fix failures, then push.

Owner feedback (the in-game O overlay) always jumps the queue.

## The rubric (1-10)

| Score | Meaning |
|---|---|
| 1-3 | Broken, ugly or confusing; blocks or embarrasses the game |
| 4-5 | Works, but looks or feels amateur |
| 6-7 | Decent indie quality; small rough edges |
| 8 | Polished; nothing looks unfinished |
| 9-10 | Pokémon-class premium; the owner would show it off |

| # | Category | Areas rated separately | What an 8 looks like |
|---|---|---|---|
| 1 | **Outdoor art** | Gate 2, avenue, Main Block front + forecourt, Library/Mechanical fronts, parking, sports fields, hostels, DIAC park, roads | Ground clearly reads as ground; one coherent palette; buildings have roofs, height and shadows; the entrance matches the owner's photo; palms, flags and props placed with intent |
| 2 | **Interior art** | Foyer, stairs, each floor's corridor, Physics Lab, ICVL, Room 195, LUG stall | Rooms look like their photos; furnished, not empty; walls with 3/4 depth; the foyer matches the owner's photo |
| 3 | **Characters and depth** | Player walk/idle/turn, NPCs, sorting behind/in front, door entry/exit, running | Faces the way she moves; no mirroring; never draws over walls; doors open and she walks in |
| 4 | **UI and menus** | Title, HUD (minimap, tracker, hotbar, banners), dialog box, pause, journal, full map, credits, confirm panels, at 960x540 and 2 other sizes | Consistent panel style, nothing overflows or overlaps, readable at a glance, HUD doesn't cover the play area |
| 5 | **Story flow and clarity** | Opening, bus arrival, Mustafa, gate, entrance, finding the stall, each key room, returning, the reward | Always obvious what to do next; no dead time; follows STORY.md |
| 6 | **Cutscenes** | Opening, gate, entrance, key rooms, box opening | In-world, smooth camera and easing, no hard cuts, skippable, no soft-locks |
| 7 | **Mini-games** | Platformer, flyer, Tetris | Clear goal, fair difficulty, good feel, themed art, retry/skip clean |
| 8 | **Audio** | Music per area, SFX coverage, volume balance, settings | Every action has a fitting sound; nothing too loud or missing |
| 9 | **Game feel and polish** | Transitions, camera, input response, juice, idle life | Nothing snaps or flashes; every action gives feedback |
| 10 | **Card and ending** | Box opening, card (temporary content), the end, "watch again" | Emotional, smooth, finished-looking even on placeholders |
| 11 | **Performance and stability** | FPS on campus, load times, console errors, saves, window sizes, the .exe | 60 fps, loads in seconds, zero console errors, no soft-locks |
