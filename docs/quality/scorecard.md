# Quality scorecard

Rubric and procedure: [../QUALITY_LOOP.md](../QUALITY_LOOP.md). One row per category; the loop
updates the score, date and issues each time it tests a category. Not rated yet = Phase A still
building. Target: 8+ in every area.

| # | Category | Score | Last rated | Top issues |
|---|---|---|---|---|
| 1 | Outdoor art | 4 | 2026-09-28 | steps read as grey blinds; Mechanical plaza shadow bar; hostels not in shot; lawns tiled like wallpaper; lamp posts read as hammers; gate has no gate |
| 2 | Interior art | — | — | (rebuilt 2026-09-28, not yet rated. Known: walls are 1 tile tall, not 2-row LimeZu top+face; foyer set pieces (columns, twin staircase, chandelier, glass door) are hand-drawn, not from the LimeZu atlas) |
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
