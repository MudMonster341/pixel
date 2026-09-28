# Quality scorecard

Rubric and procedure: [../QUALITY_LOOP.md](../QUALITY_LOOP.md). One row per category; the loop
updates the score, date and issues each time it tests a category. Not rated yet = Phase A still
building. Target: 8+ in every area.

| # | Category | Score | Last rated | Top issues |
|---|---|---|---|---|
| 1 | Outdoor art | 5 | 2026-09-28 (run 2) | entrance steps read as flat brown bars; Hostel A shot still shows only a field (no hostel, no player); Mechanical shadow still a grey band |
| 2 | Interior art | 4 | 2026-09-28 (run 2) | floor is a loud high-contrast checker; foyer staircase still vertical rails; ICVL a solid grid of desks with no aisles; Physics Lab a uniform warehouse grid |
| 3 | Characters and depth | — | — | |
| 4 | UI and menus | — | — | (HUD clutter at the top: minimap, banner, hint and tracker all compete) |
| 5 | Story flow and clarity | — | — | (owner: "I don't understand what's going on" at arrival; being rebuilt) |
| 6 | Cutscenes | — | — | (owner: choppy and disconnected; being rebuilt in-world) |
| 7 | Mini-games | — | — | |
| 8 | Audio | — | — | |
| 9 | Game feel and polish | — | — | |
| 10 | Card and ending | — | — | (temp slide card-temp-1 draws the old red arch; must match the real terracotta portal + glass canopy) |
| 11 | Performance and stability | — | — | (e2e timeouts only under parallel load) |

## Log

<!-- newest first: date, category, scores per area, what was fixed -->
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
