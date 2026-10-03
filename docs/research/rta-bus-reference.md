# RTA (Dubai) city bus: pixel reference

Purpose: redraw a Dubai RTA public bus as a 3/4 "from slightly above" sprite, parked at a kerb with its doors opening.
Colours below are estimates read from one photo (shaded, JPEG) plus the published RTA brand red; the artist should
treat them as a starting point, not as official values.

## Reference image (private reference only, not for shipping)

- File: `docs/research/rta-bus/dubai-rta-bus-cc0.jpg` (1024x640)
- Source: https://commons.wikimedia.org/wiki/File:Dubai_RTA_Bus.jpg
  (direct: https://upload.wikimedia.org/wikipedia/commons/f/fa/Dubai_RTA_Bus.jpg)
- Author: ThatOneFilipinoExtremeist. License: CC0 (public domain dedication), so it could even be traced if ever needed.
- Subject: Volvo B8R with Sunsundegui SB3 low-entry body, fleet no. 2580, route F15, stopped at a kerb.
  It is shot from above and from the front-left of the bus, close to the 3/4 angle we want (mirror it for a bus that
  faces right with its kerb side towards the camera; see note on door side below).
- Secondary candidate (not downloaded): https://commons.wikimedia.org/wiki/File:Dubai_bus_2022.jpg (Simon_sees, CC BY 2.0),
  a street-level shot of a Dubai bus; useful for the flat side view. The BurJurman files in the same Commons category are
  a private contractor's buses with a different livery, so do not use them for colours.

Other sources used: RTA's primary brand colour is red (hex #EC1C24 per logo listings, blue is the secondary brand colour);
RTA statement that the red triangle logo and red primary colour stay in the 2018 brand refresh
(https://gulfnews.com/uae/transport/rta-unveils-new-brand-identity-1.1903578); fleet info for Volvo/Sunsundegui SB3
low-floor buses (https://gulfnews.com/uae/transport/dubais-rta-signs-dh474-million-deal-for-over-370-buses-1.64531487).

## Livery (as seen on the Volvo SB3, the most common full-size RTA city bus)

| Part | Observed | Hex estimate |
|---|---|---|
| Roof | Off-white / very light grey with raised AC pods, two flat hatches and a box on the roof | `#E4E6EC` (shadow `#C4C7D0`) |
| Lower body panels | Cream-white | `#EDE8E0` (shade `#B9B3AB`) |
| Main stripe | A red swoosh: starts low at the rear wheel arch, rises toward the rear, sweeps down and forward under the windows to the front, ending in the red front bumper | `#D3232A` (brand `#EC1C24`, shaded `#8E2021`) |
| Window band | One continuous dark-tinted band from the rear to the front door, almost black | `#2B2A30` (glass highlight `#454348`) |
| Windscreen | Big, tall, lighter than the side glass, shows driver | `#4A5160` |
| Front face lower | Black grille/bumper area under the windscreen with a small silver Volvo mark | `#14131A` |
| Front bumper | Red, wraps the whole front bottom | `#D3232A` |
| Wheels | Dark grey tyres, silver-grey rims | tyre `#2A2830`, rim `#9AA0A8` |
| Doors | Glass doors, same dark tint as the windows, thin white/silver frame | glass `#2F3035`, frame `#E4E6EC` |

Text and marks (keep as 1-3 px blobs, not readable text at our size):

- RTA / "dubai" logo (small red triangle + wordmark): lower body, just behind the centre door, and a smaller one
  at the very rear of the lower body. Red on white.
- "www.rta.ae" and call-centre number (800 9090): small white text on the dark window band, upper side.
- Route number + Arabic destination: the big LED destination board sits behind the top of the windscreen (white/amber
  text on black, route code at the left, e.g. "F15"). A second small board sits above the front door on the side.
- Fleet number (4 digits, e.g. 2580): white on the dark front panel, small.

## Shape and proportions

- Rigid 12 m full-size city bus (articulated and 9 m "compact" Optare buses also run in Dubai, but use the 12 m one).
  Length : height is about 4.2 : 1 (12 m long, roughly 3.1 m tall without the roof pods). Width 2.5 m.
- Front: tall, nearly vertical, wide flat windscreen with a gentle curve, black lower face, red bumper, round
  headlights low at the corners (small dark pods), a thin chrome Volvo mark in the middle.
- Rear: nearly flat and vertical, with a slightly lower rear skirt (engine at the back); red swoosh starts here.
- Roof: slight crown, a long raised ridge of AC units at the front-middle (dark vents on top), a lower flat
  hatch near the rear. Roof reads as a light-grey slab from a high camera.
- Wheels: two axles only. Front axle sits behind the front door; rear axle about 2/3 of the way back. The wheel
  arches are black with a tiny gap below the body. The wheel base is very visible from a raised camera.

## Door layout (kerb side, the right side of the bus in Dubai, which drives on the right)

- Two doors: a front door right behind the windscreen, ahead of the front axle (roughly 8-12% of the bus length from
  the front), and a centre door roughly in the middle of the bus (about 45% from the front), behind the front axle.
  There is no door at the rear.
- Each door is a double-leaf glass door about 1.1-1.3 m wide (about 10% of the bus length) and nearly the full
  window-band height. The front door is a bit narrower than the centre one.
- Opening: inward-folding / swing-plug style. The two leaves hinge at the outer edges and fold inward and sideways
  (as a plug door) when opening; on this body they remain close to flush when closed. For a 3/4 sprite the simplest
  readable animation is: leaves part from the middle and slide/fold toward the frame, showing a dark interior gap
  with a hint of the grab pole and a low step.
- Low-entry: the front door has a ramp / kneeling step; the centre door is a step-up in the high-floor
  section of the bus. The bus also "kneels" a few pixels when it stops (optional 1 px body drop).
- Windows: one continuous band with thin vertical frame lines about every 1.1 m (6-7 panes between the doors);
  the sections around the doors are separate panes; the rear section is one long pane.

## Pixel brief

- Sprite size: 96 x 40 px at 1x for the body (about 12 m : 3 m; 8 px = 1 m horizontally, with a slightly taller
  silhouette to fake the raised camera). Canvas 104 x 48 with a 4 px transparent margin for shadow/door swing.
  If 1x does not fit the tile scale, draw at 2x (192 x 80) and note it in the asset list.
- View: 3/4 from above, kerb side (the right side of the bus) facing the camera, the front pointing right so the
  bus arrives from the left. Roof visible as a 6-8 px strip along the top (with AC pods), side panel below it.
- Palette (10 colours):
  1. `#E4E6EC` roof / door frames
  2. `#C4C7D0` roof shade
  3. `#EDE8E0` body cream
  4. `#B9B3AB` body shade
  5. `#D3232A` livery red
  6. `#8E2021` red shade
  7. `#2B2A30` window dark
  8. `#4A5160` windscreen / glass highlight
  9. `#14131A` front black / outline / arches
  10. `#9AA0A8` rims (tyre uses #2A2830 or reuse #2B2A30)
- Frames (door animation, two doors move together or the front one only, for a total of 4 body-door frames):
  1. `bus_closed`: doors shut.
  2. `bus_half_open`: leaves parted by about half; dark gap 2-3 px.
  3. `bus_open`: doors fully open; 5-6 px dark gap, grab pole, low step visible.
  4. `bus_closing`: same as half-open but with the leaves a 1 px different position (so it reads as a different
     frame), or reuse frame 2 reversed if the engine can play it backwards.
  Also needed: `bus_wheels` optional 2-frame spin (1 px offset of the spokes), and a 1-frame shadow strip under the bus.
- Stop sequence (order in the game):
  1. Arrive: bus slides in from off-screen left at about 48 px/s, easing out over the last 40 px, with the brake
     light (red pixel pair at the rear) lighting at the end.
  2. Park: the body drops 1 px (kneel), tiny dust puff under the wheels, doors stay closed for about 0.5 s.
  3. Open: closed, half-open, open (about 120 ms per frame), the kerb-side doors face the stop sign/bench.
  4. Dwell: doors open for the interaction (boarding / dialogue), about 2 s or until the player acts.
  5. Close: open, half-open (reversed), closed, then the body rises 1 px.
  6. Depart: the indicator blinks once (amber pixel at the front corner), the bus accelerates right and
     off-screen, then the tile reverts to the empty stop.

Note on the side: Dubai buses drive on the right and their doors are on the right-hand side of the bus. If the stop is
on the near side of the road, the camera sees the bus's left (driver) side if the bus faces right; to show doors
to the camera the bus must face left. Decide this against the map layout: the sprite as described (front pointing
right, doors toward the camera) is the mirror of reality, which is acceptable for a pixel game; flip the roof
details so that the destination board still sits at the front.
