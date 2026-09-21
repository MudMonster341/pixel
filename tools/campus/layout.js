// Campus map settings for tools/campus/build-campus.js (ADR 0009: back to OpenStreetMap data,
// straightened and cleaned up, after the owner rejected the hand-drawn schematic in ADR 0008/FB-0021).
//
// This file is settings plus clean-up rules and a few hand-measured features, not a drawn plan:
// build-campus.js parses tools/campus/diac.osm at build time and does the actual layout work
// (rotating the academic complex onto the grid, simplifying every outline to a rectilinear shape,
// building a small hand-picked walkway network). Positions here that ARE fixed numbers (the sports
// grounds, parking) are hand-measured from the annotated campus photo on Wikimedia Commons in the
// same frame OpenStreetMap uses (about ±10 m, kept from ADR 0007/0008 unchanged).
//
// Frame: metres from `origin`, rotated so the campus fence / hostels / D54 road line up with the grid.
//   u = along the D54 road (towards north-east)  -> drawn to the right
//   v = away from the D54 road (towards the gate) -> drawn downwards
// So Gate 2 is at the bottom (south) and walking in through it means walking up ("north" in-game).
// Set `flip: true` to turn the whole map 180 degrees (gate at the top).
module.exports = {
  osmFile: 'diac.osm',
  metersPerTile: 2,
  origin: { lat: 25.1314, lon: 55.42 },
  frameAngleDeg: 39,
  flip: false,

  // The map covers the campus fence, the DIAC ring road, D54 and a margin.
  boundsMarginMeters: 30,
  // Extra room kept between the outermost real building/fence point and the drawn fence line, so
  // buildings never sit flush against it (metres).
  fencePaddingMeters: 10,

  // DIAC ring road, measured from the rendered OSM ring (frame metres, ADR 0007). Inside it: DIAC Park.
  diacRing: { center: [249, 188], radius: 222 },

  // The academic complex runs off-grid from the rest of the campus (about 44 degrees, ADR 0007);
  // rotate it as one group onto the grid. Nearby off-grid roads/paths (within radius) rotate with
  // it. Of the four grid-aligned rotations, build-campus.js picks the one that puts the real
  // drop-off loop (entranceWay) most directly below the complex, so the entrance faces the viewer.
  straighten: [
    { name: 'Academic complex', anchors: [224330149, 224330155, 224330151], radiusMeters: 110, entranceWay: 634882316 },
  ],
  // Tolerance (metres) for cleaning up digitisation noise and small chamfers into clean rectilinear
  // polygons (coordinate clustering), used on every building outline. Kept small enough to preserve
  // real wings/L-shapes (Main Block has several).
  rectilinearizeToleranceMeters: 4,
  // BITS buildings are then simplified further into at most this many large rectangles (each at
  // least this many tiles on a side), so real small facade setbacks that stay individually
  // rectilinear but read as a staircase in a row get dropped (owner review, ADR 0009).
  maxRectsPerBuilding: 4,
  minBuildingRectTiles: 6,
  // The campus fence is reduced to its straightened bounding rectangle (one closed rectilinear
  // loop, ADR 0009), not a traced polygon: the real fence line has a rounded/chamfered notch near
  // the entrance driveway that isn't meant to be a fence feature (Gate 2 replaces it).
  campusFence: 224330161,

  // Road widths in metres by OSM highway type (footways/steps become paving). Any OSM road whose
  // centre falls inside the campus fence is dropped: inside the fence, paths come only from the
  // hand-picked walkway network below (FB-0007), not from raw OpenStreetMap geometry.
  roadWidths: { primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 7, service: 5, living_street: 5, pedestrian: 4, footway: 3, path: 3, steps: 3, cycleway: 3 },

  // BITS buildings by OSM way id. wallTiles = height, in tiles, of every wall run *except* the front
  // -- kept at 2 (unchanged from the original "not bloated" note) so side/back wings of an L-shaped
  // building don't reach any deeper into the gap to a close neighbour than they always did. The
  // south-facing FRONT run specifically is drawn 4 tiles deep regardless of this number
  // (FRONT_WALL_TILES in build-campus.js's drawBuilding, coordinator review 2026-09-21: at zoom 3 a
  // 2-tile wall next to a 20+ tile roof read as a flat texture, not a building) -- one dedicated
  // tile per band (cap/window/body/base, tools/make-assets.js's bitsFacade* functions) instead of
  // every row repeating the same squished mini-facade. Scoping the extra depth to just the one wall
  // the player actually stands in front of, instead of every wall run, keeps the existing building
  // spacing/clearances (real BITS buildings are sometimes only a few metres apart) intact rather
  // than needing them all re-spaced. `door: true` buildings get an entrance + a `door` object with
  // `to`, for a future interior map (ADR 0009 step 5); the game must not crash if that map doesn't
  // exist yet (checked in src/scenes/world.js -- warps aren't wired up here). `grand: true`: only
  // the Main Block gets the taller red arch entrance tiles (bitsEntranceGrandL/R) instead of the
  // ordinary salmon-trim ones -- it's the building the story actually enters, and the one
  // photo-confirmed as "glass front under a red arch" (docs/research/bits-dubai-campus.md "Look
  // (from photos)").
  buildings: {
    224330149: { name: 'Main Block', style: 'bits', wallTiles: 2, door: true, to: 'main-block-g', grand: true },
    224330155: { name: 'Library Block', style: 'bits', wallTiles: 2, door: true, to: 'library-block-g' },
    224330151: { name: 'Mechanical Block', style: 'bits', wallTiles: 2, door: true, to: 'mechanical-block-g' },
    // Hostel letters are best guesses from Google labels and the Wikimedia map (unverified, ADR 0007).
    519043993: { name: 'Hostel A', style: 'bits', wallTiles: 2, unverified: true },
    519043994: { name: 'Hostel B', style: 'bits', wallTiles: 2, unverified: true },
    519043995: { name: 'Hostel C', style: 'bits', wallTiles: 2, unverified: true },
    519043996: { name: 'Hostel C', style: 'bits', wallTiles: 2, unverified: true },
    519043998: { name: 'Hostel D', style: 'bits', wallTiles: 2, unverified: true },
    519044000: { name: 'Hostel G (Girls)', style: 'bits', wallTiles: 2, unverified: true },
    519044001: { name: 'Hostel H (Girls)', style: 'bits', wallTiles: 2 },
  },
  otherBuildingWallTiles: 2,

  // Hand-measured features OpenStreetMap doesn't have (track, courts, parking), in frame metres,
  // unchanged from ADR 0007/0008. rect = [u, v, width, height].
  manual: {
    centralLawn: { name: 'Central Lawn', rect: [-102.6, -86.3, 36.8, 71] },
    track: { name: 'Athletics Track', center: [-168.4, -46.85], length: 131.6, width: 63.1, laneWidth: 5 },
    tennis: { name: 'Tennis Courts', rect: [-283, -60, 35.6, 35.5] },
    otherCourts: { name: 'Courts', rect: [-118.4, -123.2, 110.5, 15.8] },
    parking: { name: 'Student Parking', rect: [-205.3, -17.9, 97.4, 14.5] },
  },

  // Gate 2 (main entrance): still on the south fence edge (ADR 0009), but the owner's layout
  // correction (2026-09-21, docs/research/bits-dubai-campus.md "Layout correction from the owner")
  // rejected centring it on the Main Block: their reference screenshot has the real entrance on the
  // lower-RIGHT of the campus, off the DIAC ring side. `uFraction` places it that fraction of the
  // way from the fence's west edge (0) to its east edge (1) instead of on the Main Block's own
  // centreline -- 0.82 clears enough room on both sides of the entrance road for the parking lots
  // below while still sitting well east of the campus's own u-midpoint (biased towards the DIAC ring,
  // which this file places just east of the fence -- see RING_GAP_METERS in build-campus.js).
  gate2: { nearWay: 1090992244, approachWidthMeters: 14, outerApproachMeters: 40, uFraction: 0.82 },
  // A small roundabout just inside Gate 2 (owner: "as soon as you get in there's a roundabout"),
  // kept axis-aligned per ADR 0009 (a true circular kerb would need diagonal tiles) -- a paved square
  // junction with a lawn-and-hedge traffic island in the middle. `outerHalfMeters`/`islandHalfMeters`
  // are upper bounds: build-campus.js shrinks them if the real gate-to-Main-Block depth is tight.
  roundabout: { avenueToRoundaboutMeters: 12, outerHalfMeters: 10, islandHalfMeters: 4 },
  // Parking either side of the entrance road, just past the roundabout (owner: "parking on the left
  // and right"). Depth is derived at build time from whatever depth is left after the roundabout and
  // the loop road's own clearance from the Main Block are reserved (see build-campus.js section 11).
  entranceParking: { widthMeters: 32, gapMeters: 6 },
  // The loop road around the academic core (owner: "internal roads form a loop... rather than one
  // straight avenue"), replacing the old single straight avenue all the way to the Main Block door.
  // Constant width, axis-aligned rectangle (ADR 0009); margin is generous on the sides with room
  // (west/east/back of the core) and clamped by build-campus.js everywhere it isn't.
  loopRoad: { widthMeters: 8, marginMeters: 20 },
  // Side Gate (second entrance, FB-0012): west fence, near the hostel/Library side (no source names
  // it "Gate 1" -- see the research doc).
  sideGate: { spanMeters: 8 },

  walkwayWidthMeters: 6, // 3 tiles

  boundsMargin: 30,
};
