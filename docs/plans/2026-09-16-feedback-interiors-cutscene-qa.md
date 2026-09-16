# Work plan, 2026-09-16: feedback, campus v2, interiors, gate cutscene, QA

**Owner request (2026-09-16):**
- Review all the feedback and what else stands out, then update the docs.
- Fix everything.
- Build the building interiors and a Pokémon-style cutscene with a message when you enter the campus
  through the BITS Dubai gate.
- QA test everything: pathways, maps, mechanics and interiors.
- Keep the game running so the owner can add feedback while the work goes on.

**Who does what:** Sonnet agents implement every package. The main agent plans, briefs, reviews
diffs, runs tests, plays the game, updates feedback statuses and docs, and checkpoints
([FEEDBACK.md](../FEEDBACK.md)). Between packages the main agent checks the feedback inbox again,
so new owner feedback joins the next package.

## 1. Feedback review (FB-0001 to FB-0017)

| Item | Owner asked for | Where it stands |
|---|---|---|
| FB-0001 | Hotbar hid the player in the house: owner chose **B**, a smaller hotbar that turns translucent when the player is behind it | Built on branch `feedback/gameplay`, not merged (merge conflict in `world.js`) |
| FB-0002 | The held item shows on the character; add keycard, phone and basic university items | Built on `feedback/gameplay`, not merged |
| FB-0017 | Run button, no running inside buildings | Built on `feedback/gameplay`, not merged |
| FB-0003, 0004, 0013 | Random structure, broken/random fences | Fixed in C1.5 (straight plan, closed fence). Needs owner check |
| FB-0005, 0007 | Pavement width wrong, internal paths uneven and scattered | Fixed in C1.5 (3-tile walkways). Needs owner check |
| FB-0006, 0014 | Pavement art flat; roads need kerbs, walkways should read as paths | Art kit + C1.5. Needs owner check |
| FB-0008, 0009, 0010 | Angled map, need a straight, clear Gate 2 main entrance, proper internal/external roads and pavements | Straight map + Gate 2 in C1.5. **Road network still incomplete** (see section 2) |
| FB-0011 | Buildings merged, can't pass between them; walls too tall | Fixed in C1.5. Needs owner check |
| FB-0012 | A second entrance | Side Gate in C1.5. Needs owner check |
| FB-0015 | More trees and bushes, greener | Fixed in C1.5. **Tree pattern looks like a grid** (section 2) |
| FB-0016 | A proper tennis court | Fixed in C1.5. Needs owner check |

## 2. What else stands out (main agent's review of the C1.5 map, 2026-09-16)

1. **The campus shape isn't real.**
   - The fence is a 412×344 m square, which is the bounding box of the rotated OSM outline.
   - The real campus is a long strip along the D54.
   - Hostels sit in two columns, but in reality they form a row between the D54 side and the sports
     grounds.
2. **Roads don't form a network.**
   - The D54 floats on its own.
   - The Gate 2 approach dead-ends south of the gate.
   - The "ring road" is one straight stub that stops at the park edge, and there's no ring.
   - The parking lot touches no road.
3. **Too much empty desert.**
   - The map is 573×326 tiles, and most of it is bare sand.
   - DIAC Park is a giant green disc with a plain cross, bigger than the campus itself.
   - Neighbouring buildings are grey boxes floating in the sand.
4. **Nothing tells you where you are.**
   - There's no gate sign and no building name signs.
   - There's no location banner when you arrive somewhere.
5. **Buildings can't be entered.** Each has a 1-tile door that leads nowhere.
6. **Trees are scattered on a visible 9×9 grid**, which looks artificial.
7. **Sports areas are islands.** The track and courts aren't linked to the walkways.
8. **The minimap is unreadable.** The map is too big for it.
9. **Test items on campus.** The hotbar still offers potion/gem test items, and campus items come with the gameplay merge.
10. **Controls card.** In the Claude browser pane, Enter didn't close it. The e2e test passes in
    Playwright, so QA re-checks it in a real browser before calling it a bug.

## 3. Packages (in order)

### P1: Merge the gameplay branch (Sonnet)
Merge `feedback/gameplay` (606edec) into `main`:
1. Resolve the `src/scenes/world.js` conflict, keeping both the overhead layer and the running/held-item code.
2. Regenerate assets and the campus map, then run `npm test`.
3. Remove the worktree.

**Done when:** FB-0001, 0002 and 0017 tests pass on main.

### P2: Campus v2, accuracy and roads (Sonnet, main tree)
- **Measure the real footprint.** Rotate the OSM campus outline and building outlines into the D54
  frame with a script, then record the oriented sizes and positions in
  `research/bits-dubai-campus.md`.
- **Rebuild `layout.js` from those numbers:**
  - Give the fence its true strip proportions and keep it perfectly straight.
  - Put the hostel row, academic complex and sports grounds in their real relative places.
  - Keep Gate 2 at the bottom with a straight avenue up to the Main Block.
- **Make roads one connected network:**
  - D54 → Gate 2 approach → a real ring road around DIAC Park.
  - Parking joins a road.
  - Walkways link the track and every court to the spine.
- **Shrink the desert:** a tighter map margin, DIAC Park sized from OSM, and neighbours placed along the roads.
- **Landmarks:**
  - a proper Gate 2 structure (pillars, booth, sign strip) that matches the cutscene art
  - name signboards in front of each building
  - a `cutscene` trigger object just inside Gate 2
- **Doors:** each enterable building's entrance becomes a map object (`type: door`, `to: <interior map>`)
  that P3 connects.
- **Trees:** jittered, clustered placement with no visible grid; keep lawn and tree counts at least
  what the FB-0015 test needs.
- **Tests:** keep all the FB-0003 to FB-0016 tests passing, plus new tests:
  - road network connectivity: flood fill from the Gate 2 approach reaches D54, the ring road and parking
  - every building door is reachable from spawn
  - no isolated walkway islands

### P3: Building interiors, first floors (Sonnet, main tree, after P2)
Interiors are 1 m per tile and the rooms stay empty (owner decision). They're generated like the
campus: plans in `tools/interiors/plans.js` feed `npm run interiors`, which writes Tiled JSON maps in
`assets/maps/`.
- **Maps:**
  - **Main Block ground floor:** foyer atrium with reception, auditorium lobby + auditorium, a lab corridor with 4 empty labs, stairs up.
  - **Main Block 1st floor:** mezzanine (Connecting Lobby), classrooms corridor, stairs down.
  - **Library Block ground floor:** canteen/cafeteria, stairs up. **1st floor:** library hall.
  - **Mechanical Block ground floor:** workshop + lab corridor.
- **Engine support:**
  - door/warp objects in Tiled maps (outdoor door ↔ interior entrance, stairs ↔ stairs)
  - an `indoors` map property that disables running
  - interior tiles (floor, inner walls with the 2.5D top/front style, doors, stairs, reception
    desk, auditorium seating rows as the only furniture)
- **Tests:**
  - every interior room is reachable from its entrance (flood fill)
  - every warp lands on a walkable tile and has a return warp
  - e2e: walk into the Main Block, up the stairs, back down and out
  - no running indoors

### P4: Gate cutscene + location banner (Sonnet, own worktree, parallel with P2)
- **Pixel illustration:** the BITS Pilani Dubai main gate, drawn as code in the art tools (no copied
  photos; research the real gate for shapes and colours only).
- **Cutscene scene:**
  - letterbox bars slide in
  - the gate illustration fades in with a slow pan
  - a Pokémon-style message box types "Welcome to BITS Pilani, Dubai Campus!" (plus one more line)
  - fades back to the game
- **Trigger and skipping:**
  - It plays the first time the player walks through Gate 2 (the `cutscene` trigger object from P2),
    once per session (a GameState flag).
  - Enter/Space advance, Esc skips, and player input is blocked while it plays.
  - `?cutscene=0` turns it off for tests.
- **Location banner:** a Pokémon-style name plate slides in at the top-left when you enter a map or a
  named area (e.g. "Main Block · Ground Floor").
- **Tests:**
  - unit: the cutscene data and the once-only flag
  - e2e: crossing the trigger plays the cutscene, keys advance and skip it, and control returns afterwards

### P5: QA pass (Sonnet QA agent, then fixes by Sonnet)
Follows [QA_PLAN.md](../QA_PLAN.md):
- automated sweeps (map connectivity, warps, tile data)
- a scripted Playwright walkthrough that saves screenshots of every area to `test-results/qa/`
- mechanics checks

The QA agent files each problem it finds as a list in its report. The main agent triages, and a fix
agent resolves them. The owner's new feedback from this period joins here too.

## 4. Checkpoints
After each package the main agent:
1. runs `npm test`
2. plays the change in the browser
3. marks feedback items fixed with test names
4. updates CONTEXT/MEMORY/CAMPUS_MAP_PLAN
5. commits and pushes with `scripts/checkpoint.ps1`
6. restarts the game server so the owner can test and send feedback
