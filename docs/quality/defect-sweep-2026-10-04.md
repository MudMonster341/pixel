# Defect sweep, 2026-10-04 (objective faults only, no ratings)

Source: the 97 screenshots in `qa-shots/` (960x540; the camera is at 3x zoom, so one tile is 48 px and a screen
shows about 20 x 11 tiles), every one viewed, plus the committed map data (the maps were rendered to PNG and the
rooms measured; see `tests/unit/completeness.test.js`). Ratings are paused; nothing below is taste. Each row says
what is wrong in one sentence and where. Rows are ordered by how visible they are to a first-time player on the
story route (title -> Gate 2 -> campus -> Main Block -> LUG stall -> key rooms -> mini-games -> ending).

How to read the shots: `indoor-<map>-<room>.png` is the camera centred on the middle of that named room
(`tools/qa-shots.js` teleports to the centre of each `area` object), so a room that looks like bare floor in its
shot really is bare in the middle. The Library Block and Mechanical Block doors are locked for the whole game
(`MAPS.campus.doorLocks`, no `stages`), so D20-D23 are not reachable on the story route today; they matter only if
those buildings are opened or the owner walks them with the dev tools.

## Faults (23)

| id | shot | location in the image | fault | likely source |
|---|---|---|---|---|
| D01 | ui-fullscreen-map.png | labels at x 195-525, y 120-190, and at x 770-955, y 270 | Place labels collide: "Side Gate / Hostel D / Hostel C / Courts / Tennis Courts / Athletics Track / BITS Pilani, Dubai Campus / Main Block" overprint each other, "Mechanical Block" reads "chanical Block" under "Courts", and "Manipal University Boys..." spills past the map frame to the screen edge. | `src/scenes/ui.js` (FullMap label placement), label data from `assets/maps/campus.json` areas |
| D02 | minigame-platformer-03-gameover.png | whole frame | The "TRY AGAIN?" panel is shifted left and cut off at x=0 ("AGAIN?", "E: 1 / 6", "Y (ENTER)", "QUIT" clipped), and the dim overlay covers only the left half (x < 505); the right half stays bright. Panel and overlay follow a scrolled camera instead of the screen. | `src/minigames/framework-scene.js` end panel + `src/minigames/platformer.js` camera |
| D03 | minigame-platformer-02-play.png | top-left, x 0-140, y 12-45 | The cells counter is cut by the screen edge and reads "LS: 1 / 6" (the "CELLS" half is off-screen). Same cause as D02. | `src/minigames/platformer.js` HUD |
| D04 | ending-01-box-closed.png | lid x 343-620, y 105-195; box x 350-610, y 250-390 | In the "closed" state the lid hangs about 55 px above the box body instead of sitting on it (the lid is also wider than the box). | `src/scenes/box-opening.js` (lid at `mouthY`, origin 0.5,1), art `tools/make-card-art.js` / `assets/cutscenes/card-box-lid.png` |
| D05 | outdoor-hostel-hostel-d.png; outdoor-library-block-front.png | tree at x 500-600, y 205-345; second tree at x 320-400, y 395-540 | The tree is built wrong: the lime canopy has a second outline ring offset to its right, the trunk is a separate brown bar with a gap below the canopy, and an orange crate overlaps the canopy. Reads as a glitched sprite. | tree tiles (`treeCanopy*`, `treeTrunk`) in `tools/make-assets.js`, placement in `tools/campus/build-campus.js` |
| D06 | indoor-main-block-2-entrance.png; -landing.png; -main-block-stairs-2.png | whole frame | The 2nd-floor landing (on the story route to the Physics Lab) is about 85% bare cream floor: 205 floor tiles, 3 props (two flat orange sofa squares and a plant), largest bare block 160 tiles. | `tools/interiors/plans.js` (FURNISHERS.lounge) |
| D07 | (no shot; found by the new unit test) | Main Block stairs G(up), 1(up), 2(up) | Going up each Main Block staircase arrives at tile (37,17) of the next floor, which is the stairwell's east wall (`intWallFaceEndR`, solid): the player lands inside a wall and can only be pushed out by physics. Library and Mechanical stairs land on floor. | `tools/interiors/plans.js` line 26 (`facing: 'right', offset: [2, 0]` for every "(down)" stairs) |
| D08 | minigame-flappy-04-gameover-skip-offer.png; -05-win.png | text x 115-305, y 209; ghost bird x 195-225, y 265-300 | The in-play "PRESS SPACE TO FLAP" hint and the bird stay visible behind the panel and bleed through it, overlapping "You've tried 3 times..." and the left panel border. | `src/minigames/flappy.js` line 58 (`hoverPrompt` not hidden when the run ends) |
| D09 | minigame-flappy-05-win.png; minigame-platformer-05-win.png; minigame-tetris-05-win.png | key icon x 470-492, y 228-272 | The key icon's bottom overlaps the first line of the win message; in Flappy it covers the "C" of "ICVL" (reads "IC.L"), in Tetris the "m" of "Room". | `src/minigames/framework-scene.js` (win panel layout) |
| D10 | indoor-main-block-g-foyer.png | x 425-500, y 215-285 | The gold chandeliers (overhead layer) are drawn over the player and hide her head and hair as she crosses the middle of the foyer. May be intended (ceiling piece) but it hides the avatar in the room every player crosses. | `intChandelier*` overhead tiles, `tools/interiors/build-interiors.js` foyer furnisher |
| D11 | outdoor-library-block-front.png; outdoor-mechanical-block-front.png; outdoor-hostel-hostel-a/b/c/g-girls.png | entrance at x 456-552 (library/mech y 198-245; hostel-a y 55-100) | The entrance is a flat dark panel with two white dots (it reads as a face or a blank board, not a door) and it sits on bare plaza paving: one tile below the facade wall at the Library and Mechanical blocks, and with no wall beside it at hostel A. | `bitsDoor` tile in `tools/make-assets.js`, plaza layout in `tools/campus/build-campus.js` |
| D12 | outdoor-spawn.png; outdoor-athletics-track.png; outdoor-diac-park.png; outdoor-courts.png | spawn: x 0-240 and x 620-960; others: whole frame | Bare areas larger than a third of the screen: the spawn avenue is about 60% plain sand, the athletics infield and DIAC Park are 100% plain grass, the courts' left and right sides are about 45% plain teal with no lines. | `tools/campus/build-campus.js` (ground fill, prop scatter) |
| D13 | outdoor-avenue.png; outdoor-student-parking.png | cars at x 770-915, y 255-330 (avenue); whole parking bay row | Cars come in two scales and orientations in the same lot: tiny side-view cars about 48 x 20 px (smaller than the 64 px player) parked across nose-in bays next to 48 x 50 front-view vans. | `carSedan*`/`carFront*` tiles in `tools/make-assets.js`, placement `tools/campus/build-campus.js` |
| D14 | outdoor-gate-2.png; cutscene-01-script.png; cutscene-02-dialog.png; cutscene-03-control-returned.png | x 100-215, y 85-225 | The palm canopy is drawn over the guard booth roof and crate beside the booth, in the first scene the player sees. | palm tiles + overhead layer, `tools/campus/build-campus.js` gate placement |
| D15 | every outdoor shot after the cutscene (e.g. outdoor-hostel-hostel-b.png) | top-right strip, x 665-945, y 15-45 | The compact objective strip is cut mid-sentence with an ellipsis ("Keys 0/3 . Find the LUG stall behind the ..."), so after the first seconds the player cannot read where to go. | `src/scenes/ui.js` (QuestTracker compact mode) |
| D16 | pause-controls-panel.png | x 320-640, y 405-440 and hotbar x 340-625, y 458-520 | The "WASD / ARROWS TO MOVE" hint shows through the Controls panel under the "ESC Pause" row, and the hotbar slots overlap the panel's bottom edge. | `src/scenes/ui.js` depth order of tutorial hint and hotbar vs pause panel |
| D17 | ending-04-card-cover.png | x 345-365, y 195-460 over text x 360-598, y 243 | The yellow balloon's string runs through "HAPPY BIRTHDAY," on the card cover. | `tools/make-card-art.js` / `src/scenes/card.js` cover layout |
| D18 | outdoor-side-gate.png | x 0-340, y 170-540 | The road beside the Side Gate is drawn as chunky 3-tile stair steps with no kerb or pavement, unlike the straight roads (kerbs, pavements, lane lines) elsewhere. | `tools/campus/build-campus.js` (OSM road rasteriser for diagonal roads) |
| D19 | (no shot; found by the new unit test) | campus "Library Block entrance", "Mechanical Block entrance"; Main Block Stairs G(up), 1(up), 2(up) | Five locked doors have a `doorLocks` rule with no `reason`, so they show the generic "Locked for the event" instead of their own line (the 15 closed wall doors of the foyer wings all have their own lines). | `src/maps.js` `doorLocks` |
| D20 | indoor-library-block-g-library-circulation-reception.png; indoor-library-block-1-groove-dance-club.png; -reflexions-photography-club.png; -centre-for-higher-education.png; -discussion-room-1/2.png | whole frame | Rooms with almost no furniture: Circulation Reception 501 floor tiles / 3 props (no reception desk), Activity Room 359 / 2, three clubs about 200 / 2 each, Discussion Rooms 134 / 1, Centre for Higher Education 186 / 4. | `tools/interiors/plans.js` (FURNISHERS for these kinds) |
| D21 | indoor-mechanical-block-g-workshop-1.png; -workshop-2.png; -workshop-cnc-room.png; -surveying-lab-civil.png; indoor-mechanical-block-1-*lab*.png | whole frame | All 9 labs and workshops have props only along the top and bottom walls: the largest bare block is 120-504 tiles (a screen shows about 225); the two ground-floor workshops are plain `asphalt` floor with nothing on it. | `tools/interiors/plans.js` (lab/labHeavy/workshop furnishers) |
| D22 | indoor-mechanical-block-g-mechanical-block-stairs-g.png; indoor-library-block-g-library-block-stairs-g.png | whole frame | The stairwells are 13 x 19 and 7 x 19 tiles with only a 2 x 3 stair flight in them: 247 and 133 bare tiles, about 80% of the screen. | `tools/interiors/plans.js` stairwell rooms |
| D23 | (every Library and Mechanical shot; found by the new unit test) | library-block-g/1, mechanical-block-g/1 | These four floors have no NPC, key station, ambient student or animal at all. | `src/ambient.js`, `src/animals.js` (no entries for these maps) |

Counts: 23 objective faults. D20-D23 are in the two locked buildings; D07 is data-confirmed but not seen in the running game;
D19-D23 were found from the data and the new unit test, the rest from the shots.

## Fix status (story-route round, 2026-10-04)

Each line is the status of one id after the fix round. "Visual" means a unit test pins the logic and the data but the picture itself
has to be looked at in the running game.

- **D01** Status: fixed. `src/maplogic.js` `fullMapLabelCandidates()` / `placeMapLabels()` (priority order, clamp into the map frame, skip a label that would overlap, truncate over-long names, one label per name), used by `FullMap.open()` in `src/scenes/ui.js`. Test: `tests/unit/fullmap-labels.test.js` (every real map). Visual: check the M map.
- **D02** Status: fixed. Every mini-game UI object (cards, dim overlay, win icon, message, win flash) is pinned to the screen (`pinToScreen()`, scrollFactor 0) in `src/minigames/framework-scene.js`. Test: `tests/unit/minigame-panels.test.js` (source-pinned; the scenes need Phaser). Visual: platformer game-over.
- **D03** Status: fixed. Same change as D02 for the shared HUD (cells counter).
- **D04** Status: fixed. `src/scenes/box-opening.js`: the lid is seated on the box body (`lidSeatY()`, kept seated through the bounce-in) and the glow mouth follows the body top. No art changed. Test: `tests/unit/box-lid.test.js` (reads the constants against the real PNG pixels). Visual: the closed-box frame; the lid keeps its natural 2 px overhang each side.
- **D05** Status: not in this round (out of scope).
- **D06** Status: fixed. `FURNISHERS.lounge` in `tools/interiors/build-interiors.js` now lays out benches, red/blue sofas, tables, chairs, vending machines, a water cooler, plants, bins and wall posters from existing tiles; 3 more ambient students on `main-block-2` (`src/ambient.js`). Passes the completeness density and bare-floor rules unchanged. `npm run interiors` regenerated `main-block-2.json` and its preview. Visual: the 2nd floor landing.
- **D07** Status: fixed. `tools/interiors/plans.js` `stairwell()`: the "(down)" flights say `facing: 'left'`, so arrival is on the flight's own tile (35,17), facing away from the east wall, on every Main Block floor and from the foyer staircase. Object names unchanged. Tests: `tests/unit/main-block-stairs.test.js`, `tests/unit/completeness.test.js`; the pinned upper-floor hashes in `tests/unit/foyer-tour.test.js` were re-pinned with a comment. Visual: take the stairs up and down once.
- **D08** Status: fixed. `onPanelShown()` hook in the shared scene; Flappy hides the "PRESS SPACE TO FLAP" prompt and the bird while a card is up (`src/minigames/flappy.js`). Test: `tests/unit/minigame-panels.test.js` (source-pinned).
- **D09** Status: fixed. Three blank rows above the win message and the icon position from `winCardLayout()` (`src/minigames/framework-data.js`). Test: `tests/unit/minigame-panels.test.js` (real spacing check, all three games share the card).
- **D10** Status: fixed. The overhead layer is drawn at alpha 0.45 on indoor maps (`overheadAlpha()` in `src/maplogic.js`, applied in `src/scenes/world.js`); the campus tree canopies stay solid. Test: `tests/unit/overhead-alpha.test.js`. Visual: walk across the foyer centre.
- **D11** Status: not in this round (out of scope).
- **D12-D14** Status: not in this round (out of scope).
- **D15** Status: fixed. The quest pill is a "Keys n/3" line plus the whole objective wrapped to two lines at full size (`trackerPillText()` in `src/maplogic.js`, `QuestTracker` in `src/scenes/ui.js`; `HUD_TRACKER.collapsedH` is now 56 for the tallest case and the panel height follows the text). Test: `tests/unit/quest-pill.test.js` (every stage and key combination), `tests/unit/hud-layout.test.js` stays green. Visual: the pill is taller than before.
- **D16** Status: fixed. The hotbar is hidden while the pause menu or its Controls page is open (`hotbarShouldShow()`), and the hint banner holds back while pause is open (`HintBanner.blocked()`). Test: `tests/unit/pause-overlap.test.js`.
- **D17** Status: fixed. The gold balloon moved to the right of the red one in `tools/make-card-art.js` (`npm run assets` regenerated `card-cover.png`), clearing the whole title band. Test: `tests/unit/card-cover.test.js` (maps the title box into the PNG; fails on the old art).
- **D18** Status: not in this round (out of scope).
- **D19** Status: fixed. Own `reason` lines in `src/maps.js` for the Library and Mechanical entrances and the three "(up)" stairs ("The stairs are roped off. Talk to the LUG volunteer first." is only ever shown at stage `arrival`; the stairs open for good once the volunteer sets the task). Tests: `tests/unit/main-block-stairs.test.js`, `tests/unit/completeness.test.js`; the two e2e specs that asserted the old text were updated (not run).
- **D20-D23** Status: not fixed (out of scope: the Library and Mechanical Blocks are locked for the whole game). `tests/unit/completeness.test.js` now exempts those four interiors from the density, bare-floor and life rules through `UNREACHABLE_INTERIORS`, with a derived test that fails if any of them becomes reachable.

## Top 10 by visibility

1. D01 full-screen map labels overlap and spill off the frame.
2. D02 platformer game-over panel cut off and half-dimmed.
3. D03 platformer cells counter cut off at the left edge.
4. D04 gift box lid floats above the box on the ending.
5. D05 broken tree sprites on the campus.
6. D06 2nd-floor landing is a bare hall on the route to the Physics Lab.
7. D07 taking any Main Block stairs up lands in a wall tile (unverified in game).
8. D08 stale Flappy prompt and bird show through the game-over and win panels.
9. D09 key icon overprints the win message of all three mini-games.
10. D10 chandeliers hide the player's head in the foyer.

## Unsure (not counted above; do not fix without looking in the running game)

- U1 outdoor-avenue.png (x 0-45, y 30-95) and outdoor-main-block-front.png (x 800-835, y 395-455): a pale translucent bell-shaped sprite with peach spots lies on the road and pavement. Probably a bird or animal seen from above while fading, possibly a leftover sprite.
- U2 Several indoor shots do not match the map data around the room centre (indoor-mechanical-block-1-advanced-characterization-lab-mech.png shows the player in bare void beside a wall; the Structures lab shot is on the stairs corridor; floors look dark grey where `tiles.png` is pale). The map render from the committed JSON shows nothing like that, so this is probably the shot tool (teleport onto a warp or a map still fading in), not the game.
- U3 Near-black or dim shots: indoor-mechanical-block-1-mechatronics-lab-workshop.png, -prime-movers-...png, indoor-main-block-1-entrance.png, indoor-library-block-g-entrance.png, ending-07-the-end.png (almost black, no "THE END" text visible). Most likely a fade-in captured early; if not, the lab is genuinely too dark to read.
- U4 ending-05-card-photo.png and ending-06-card-message.png: the message box under the photo is empty in both ("card-message" should show the message). Probably the typewriter had not started when the shot was taken.
- U5 Every UI panel (minigame intro and result panels, HUD panels, menus) has a cream frame on the top, left and bottom edges and none on the right edge (e.g. minigame-flappy-01-intro.png at x 800). Could be a bevel style, could be a missing edge.
- U6 `intNoticeboard` (indoor-main-block-2-landing.png at x 318-360, y 10-50; the LUG stall) reads as a grinning tan face with blue eyes and white teeth; `intSofa` on the 2nd floor (x 342-385, y 153-195) is a flat orange square with no detail. Both may look like placeholders.
- U7 The location banner is cut at the screen's left edge and overlaps the minimap's top edge in the first shot of each interior (indoor-*-entrance.png): probably the slide-in tween mid-way.
- U8 Area name "Oh Crop! Design club" has a lower-case "club" while its siblings read "Groove (Dance Club)", "Reflexions (Photography Club)" (`tools/interiors/plans.js`).
- U9 outdoor-hostel-hostel-a.png (x 372-408, y 162-185) and the other hostel shots: a small black bracket-shaped sprite on the grass beside each plaza (a bike rack drawn nearly black?).
- U10 outdoor-hostel-hostel-b.png: the player stands in the doorway with the awning drawn over her lower body (depth order at the door tile), looks like she is behind the door.
- U11 title-screen.png / title-menu.png: the "BITS DUBAI" title and tagline overprint the backdrop's facade sign ("BITS PILANI, DUBAI CAMPUS") at x 265-665, y 105-155.

## Areas not covered by any shot

- Main Block ground floor: both long wing corridors (left to the Sports Complex lobby, right to the Auditorium lobby) with their 15 closed, nameplated doors and the two glass side doors; the two curved reception desks and frosted partitions beside the entrance; the mezzanine/wordmark wall; the foyer sofas on the right wall. Only the foyer centre, the entrance, the two lobbies and the LUG stall were shot.
- Main Block floors 1 and 3: the long corridors (only the Room 195, ICVL, Physics Lab room centres and stair landings were shot); the far corners of every room (shots show only the centre).
- Library Block and Mechanical Block: the corridors between rooms; ground-floor Library "Reading Area" and "Stack/Textbook" shots are present but not the aisle ends.
- Campus: Hostel interiors do not exist; no shot of Gate Parking, the roundabout, the bus stop and the RTA bus, the DIAC Park paths, the tennis court nets close up, the back road behind the Mechanical Block, or any night/other-time state.
- Screens with no shot: dialog boxes with a speaker over the world (only the Gate 2 cutscene one), the journal (J), inventory with items in hand, save/load slots, the name/customise/greeting intro scenes, the credits scene (`src/scenes/credits.js`), the Controls/Credits screens of the title menu, the Tetris and Flappy mid-play states with real obstacles/pieces beyond the first frame, the door-open overlay animation.
