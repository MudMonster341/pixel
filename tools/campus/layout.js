// Campus map settings for tools/campus/build-campus.js (see ADR 0007).
//
// Frame: metres from `origin`, rotated so the campus fence / hostels / D54 road line up with the grid.
//   u = along the D54 road (towards north-east)  → drawn to the right
//   v = away from the D54 road (towards the gate) → drawn downwards
// So the main gate is at the bottom and walking in through it means walking up ("north" in-game).
// Set `flip: true` to turn the whole map 180° (gate at the top).
//
// Features OpenStreetMap doesn't have (track, courts, parking, lawns) are measured from the annotated
// campus map on Wikimedia Commons (about 3.8 px per metre) and are accurate to roughly ±10 m.
module.exports = {
  osmFile: 'diac.osm',
  metersPerTile: 2,
  origin: { lat: 25.1314, lon: 55.42 },
  frameAngleDeg: 39,
  flip: false,

  // The map covers the campus fence and the DIAC ring road, plus a margin
  boundsMarginMeters: 40,

  // DIAC ring road, measured from the rendered OSM ring (frame metres). Inside it: DIAC Park.
  diacRing: { center: [249, 188], radius: 222 },

  // Push the map edge out so the D54 road (the campus's north-west edge, v ≈ -206) is included
  boundsExtend: { minV: -226 },

  // The academic complex runs ~45° off the rest of the campus; rotate it as one group onto the grid.
  // Nearby off-grid roads/paths (within radius) rotate with it. The rotation that puts the drop-off
  // loop (entranceWay) most directly below the complex is chosen, so the main entrance faces the viewer.
  straighten: [
    { name: 'Academic complex', anchors: [224330149, 224330155, 224330151], radiusMeters: 110, entranceWay: 634882316 },
  ],

  // Road widths in metres by OSM highway type (footways and steps become paving)
  roadWidths: { primary: 12, secondary: 10, tertiary: 9, residential: 7, unclassified: 7, service: 5, living_street: 5, pedestrian: 4, footway: 3, path: 3, steps: 3, cycleway: 3 },

  campusFence: 224330161,

  // BITS buildings by OSM way id. wallTiles = height of the front wall in tiles.
  // Hostel letters are best guesses from Google labels and the Wikimedia map (unverified).
  buildings: {
    224330149: { name: 'Main Block', style: 'bits', wallTiles: 4, door: true },
    224330155: { name: 'Library Block', style: 'bits', wallTiles: 3 },
    224330151: { name: 'Mechanical Block', style: 'bits', wallTiles: 3 },
    519043993: { name: 'Hostel A', style: 'bits', wallTiles: 4, unverified: true },
    519043994: { name: 'Hostel B', style: 'bits', wallTiles: 4, unverified: true },
    519043995: { name: 'Hostel C', style: 'bits', wallTiles: 4, unverified: true },
    519043996: { name: 'Hostel C', style: 'bits', wallTiles: 4, unverified: true },
    519043998: { name: 'Hostel D', style: 'bits', wallTiles: 4, unverified: true },
    519044000: { name: 'Hostel G (Girls)', style: 'bits', wallTiles: 4, unverified: true },
    519044001: { name: 'Hostel H (Girls)', style: 'bits', wallTiles: 4 },
  },
  otherBuildingWallTiles: 3,

  // Hand-measured features, in frame metres. rect = [u, v, width, height]
  manual: [
    { name: 'Central Lawn', kind: 'lawn', rect: [-102.6, -86.3, 36.8, 71] },
    { name: 'Athletics Track', kind: 'track', center: [-168.4, -46.85], length: 131.6, width: 63.1, laneWidth: 9 },
    { name: 'Tennis Courts', kind: 'court', rect: [-283, -60, 35.6, 35.5] },
    { name: 'Courts', kind: 'court', rect: [-118.4, -123.2, 110.5, 15.8] },
    { name: 'Student Parking', kind: 'parking', rect: [-205.3, -17.9, 97.4, 14.5] },
  ],

  // Player start: just outside the main gate (OSM gate booth way), facing into campus
  spawn: { nearWay: 1090992244, offsetMeters: [0, 12], facing: 'up' },

  zones: [
    { name: 'DIAC Park', ring: true },
    { name: 'BITS Pilani, Dubai Campus', way: 224330161 },
  ],
};
