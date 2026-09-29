# Quality scorecard

Rubric and procedure: [../QUALITY_LOOP.md](../QUALITY_LOOP.md). One row per category; the loop
updates the score, date and issues each time it tests a category. Not rated yet = Phase A still
building. Target: 8+ in every area.

| # | Category | Score | Last rated | Top issues |
|---|---|---|---|---|
| 1 | Outdoor art | 7 | 2026-09-29 (run 4) | palms look noisy/dithered; still no people walking around |
| 2 | Interior art | 6 | 2026-09-29 (run 4) | foyer floor tile grid a bit busy; no people besides the volunteer; stair block still plain |
| 3 | Characters and depth | — | — | |
| 4 | UI and menus | 7 | 2026-09-29 (run 2) | title backdrop could be brighter; re-check HUD during cutscenes in a playthrough |
| 5 | Story flow and clarity | — | — | (owner: "I don't understand what's going on" at arrival; being rebuilt) |
| 6 | Cutscenes | — | — | (the in-world Gate 2 beat looks good; qa:shots times out waiting for the Gate 2 script to end) |
| 7 | Mini-games | — | — | |
| 8 | Audio | — | — | |
| 9 | Game feel and polish | — | — | |
| 10 | Card and ending | 7 | 2026-09-29 (run 2) | message box empty while the first line types in; box-opening not re-rated yet |
| 11 | Performance and stability | — | — | (e2e timeouts only under parallel load) |

## Log

<!-- newest first: date, category, scores per area, what was fixed -->
### 2026-09-29 — Run 4 re-rate: Outdoor 7, Interior 6, UI 7, Card 7
- **Outdoor (7, was 6):** the Main Block now matches the photo: full "BITS PILANI, DUBAI CAMPUS" sign, the tall mullioned glass front, light stone steps, a real red-paver forecourt, palms either side, the banner no longer covering the sign. Palms look noisy/dithered; no people.
- **Interior (6, was 5):** round shaded columns, a tiered gold chandelier, a rug, a reception desk, proper plant pots. The floor tile grid is a little busy; the stair block is plain; it's empty of people.
- **UI (7, was 5):** the title shows the real campus (the Main Block entrance) behind a crisp logo; the location banner moved to the top-left.
- **Card (7, was 5):** no ghost text; the new entrance slide matches the building; the cream note panel ties it together.
### 2026-09-29 — Outdoor art (run 3) — overall 6 (was 5)
- **Main Block front: 7.** Now reads as the entrance: the BITS lettering, windowed facade, tall mullioned glass front, double door and light stone steps. But the steps drop straight onto the sidewalk and road (no forecourt), and the location banner covers the sign.
- **Gate 2: 7.** Palm, pillar, booth, short barrier, planters: reads as a gate.
- **Hostels: 5.** The building and the player now show; the area label says "BITS Pilani, Dubai Campus" instead of the hostel's name.
- **Everywhere: 5.** Still no life (no students walking, no parked bikes); large plain areas.

### 2026-09-29 — Interior art (run 3) — overall 5 (was 4)
- **Foyer: 5.** Real stair treads now and a calm floor, but bland: white stripes for columns, the chandelier reads as a gold plus sign, the reception desk and sofas are tiny, and it's empty of people.
- **ICVL: 6.** Reads as a computer lab (monitor rows, chairs, cabinets, instructor desk); plants sit on brick-tile pedestals.
- **Physics Lab: 5.** Benches with equipment, stools, shelves, fume hood; still a uniform grid, sparse wall decoration.

### 2026-09-29 — UI and menus (run 1) — overall 5
- **Title: 4.** Buttons fine; the "live campus" backdrop is the 1px-per-tile map scaled up: a dark, blurry schematic, not the game world.
- **Pause: 6.** Clean, readable, consistent.
- **HUD: 5.** The location banner sits over the Main Block's own sign; area names fall back to the campus name at the hostels. (Cutscene overlap bugs fixed in quality/ui-1, merged; re-test next run.)

### 2026-09-29 — Card and ending (run 1) — overall 5
- **Card interior: 5.** Warm layout, hearts and cake. But the title glow draws as a ghosted duplicate of the text (looks like a rendering error); the temp "Day one" slide shows the old red arch; the photo frame and message box feel like two unrelated boxes.
### 2026-09-28 — Outdoor art (run 2) — overall 5 (was 4)
- **Main Block front: 5.** The glass front with mullions reads better; the steps now read as two flat brown bars rather than stone treads (no light tread face, too dark, too tall); the camera frame still cuts the building off.
- **Gate 2: 6.** Barrier arm, pillar and palm present; the barrier runs the whole width like a stripe. Better.
- **Mechanical front: 5.** Roofs now read as roofs (AC units, vents); the plaza shadow is softer but still a grey band.
- **Lawns: 6.** Natural now.
- **Hostels: 2.** Still broken: the Hostel A shot is a striped field, no hostel, no player.

### 2026-09-28 — Interior art (run 2) — overall 4 (was 3)
- **Foyer: 3.** The new floor is a high-contrast white-on-tan checker (graph paper); the staircase still draws as vertical rails; the chandelier is tiny.
- **LUG stall: 5.** The wordmark, mezzanine railing, plants and volunteer read well; the checker floor hurts.
- **ICVL: 3.** Over-corrected: a solid wall-to-wall grid of identical blue desks, no aisles, she stands among them.
- **Physics Lab: 4.** Uniform rows of identical benches, like a warehouse.
### 2026-09-28 — Interior art (run 1) — overall 3
From the same qa-shots run (indoor-main-block-*.png). Per area:
- **Foyer: 2.** The "marble" floor reads as speckled sand; the twin staircase draws as long vertical dark rails (a ladder or railway track), not steps; no chandelier, mezzanine plants or wordmark in view; columns are small white blocks floating on the floor. Nothing like the owner's photo.
- **LUG stall: 3.** A runner, one plant on a brick tile, a small counter; sparse; the volunteer is cut off at the top.
- **ICVL: 3.** A big pale empty floor with three server racks and two small items; no rows of desks with monitors, no blue cabinetry or poster wall.
- **Physics Lab: 3.** An empty floor, a row of small tables along the bottom, one cabinet and a sink.
- **Room 195: 5.** Rows of desks, a wood floor and the key on the teacher's desk read well; walls and trim are still flat.
- **Everywhere:** 1-tile vertical wall strips (no 3/4 top edge + face); far too much empty floor; furniture tiny relative to rooms; corridors are bare.

### 2026-09-28 — Outdoor art (run 1) — overall 4
Captured with `npm run qa:shots` (outdoor-*.png). Per area:
- **Main Block front + forecourt: 4.** Concrete sidewalks work. But the entrance steps render as a row of tall grey vertical panels (reads as window blinds or a fence, not steps); red brick patches either side of the steps; the glass front is small and the building above is cut off by the camera; the navy sign isn't in view; no palms or flags in frame.
- **Gate 2: 5.** Clean road and sidewalks, but there's no gate structure (no booth, barrier or pillars, just a crossing band and a fence), the palm top-left is dark and cropped, and the planters read as dirt boxes.
- **Avenue / roundabout: 5.** Clean but empty. Lawn tufts repeat in a rigid grid (wallpaper look), the lamp posts read as sideways hammers, and the roundabout is a flat grass square with an L of hedge.
- **Mechanical / Library fronts: 3.** The facade cast shadow draws as an opaque dark grey bar across the plaza (looks like a glitch); buildings show only as a thin strip; the huge flat roofs either side read as a floor grid.
- **Hostels: 3.** The "Hostel A" shot shows no hostel at all (a wrong QA point or a missing building), and the player isn't visible.
- **Parking / sports fields: 4.** A flat striped field and plain orange track bands; parked cars are tiny and in a different perspective; the player isn't visible in these shots.
- **Everywhere:** no life (no students walking), identical tuft grid on every lawn.
- Tooling: `npm run qa:shots` crashes at the old cutscene step (cutscenes are now in-world scripts).
