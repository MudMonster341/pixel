# Day 3 plan: the owner's first playtest feedback + the "wow" layer

Status: **active** (written 2026-10-04 evening, end of Day 2). Taru's birthday is **2026-10-11**; aim to hand over the final zip
and link by **2026-10-09**, with 10-10 as slack. Ratings stay paused ([QUALITY_LOOP.md](../QUALITY_LOOP.md)).
Earlier plan: [2026-10-03-birthday-sprint.md](2026-10-03-birthday-sprint.md) (its Day 1-2 packages are done).

## What the owner said after playing (2026-10-04)

"The game is fine in the sense, but the wow aspect isn't there yet." They sent 33 feedback items (FB-0044..FB-0076) and asked for
ideas to make the game better and add more game sense. This plan does both: **fix the feedback first, then add a short list of
wow features** chosen to be cheap, personal and built only from free packs and code (no hand-drawn art, FB-0025).

## A. Feedback triage (33 items, 6 packages)

Many items are a screenshot with a one-line title. The agent MUST open each one first:
`npm run feedback -- show FB-00xx` (it prints the map, the player tile, the pointed-at tile and the screenshot path under
`feedback/screenshots/`). Ask the owner through the feedback thread when an item is still unclear; do not build on a guess.

| Pkg | Theme | Items | Notes / open questions |
|---|---|---|---|
| **P1** | Controls and UI (small, safe, do first) | FB-0045 (E **and** Enter advance messages), FB-0072 (player stops while a screen/overlay is up), FB-0073 (a text box is cut off on the right; instructions too wordy), FB-0068 (close the item bar on the right: unclear, show first), FB-0075 (a way to quit the game), FB-0076 (after the ending go straight back to the main screen), FB-0046 (the entrance run animation looks odd; she must not be able to walk over the door/wall line) | FB-0076: today credits -> title already; check what the owner saw (maybe the card -> credits step, or "watch card" path). Quit: a title/pause "Quit" entry (browser: return to title; the Windows build is not used). |
| **P2** | Names, dialogue, costumes, the ICL rename | FB-0050 ("hostel resident" -> **Deanne**), FB-0051 (funnier CS-student lines from Instagram-style/tech jokes; friends **Sid, Akshit, Varun, Mitul, Karthik**; **Mustafa** near all the games with a fixed line, wearing a **black and orange hoodie**), FB-0057 (club colours: sky blue generic club members; **MTC** black and white; **ACM** dark pink; **LUG** orange and black like the Linux/Tux logo), FB-0070 (**"it's ICL, not ICVL"**: rename everywhere: story, key ids' labels, maps, tests, docs; Intelligent Computing Lab) | New decision: [ADR 0021](../../decisions/0021-friends-in-the-game-and-personal-touches.md) (real friends as characters). Needs the owner's lines/jokes: the agent drafts, the owner approves in `docs/research/campus-lines-review.md`. |
| **P3** | Campus outdoors | FB-0044 + FB-0049 (a real **Dubai RTA bus stop** where the bus stops; the road continues to the left; look up RTA stops first), FB-0047 (parking: real bays with spacing, keep the car look), FB-0048 (double lining on the pavement, not uniform), FB-0052 (the gate barrier fully down), FB-0053 + FB-0056 (trees: the broken one, and one that does not match the palette), FB-0054 + FB-0055 (a proper **roundabout** and roads: pavement styles for every connected/unconnected case) | Art only via `tools/campus/` + `tools/make-assets.js` from packs. Roads/pavements need a small tile-transition ("autotile") rule set; do this once, for all cases (FB-0054 explicitly asks for it). |
| **P4** | Main Block interiors | FB-0058 (window fix), FB-0059 ("remove the dirt"; show **solid black** for inaccessible areas instead), FB-0060 (a door should face right, not the viewer), FB-0061 + FB-0063 (**stairs must look like stairs**: centre them; find a proper external tileset for stairs), FB-0062 (the library door position on the ground floor: "the library comes here, not to the left, there is a bit of space behind and then the library"), FB-0064 + FB-0065 ("fix this", "these doors need fixing": view the screenshots), FB-0067 (**every door gets an open and close animation**), FB-0069 (the lift is not usable: either make a working lift between floors or remove/mark it clearly) | Stairs and doors touch the foyer/wing work from Day 2 (ADR 0020); keep `story-clearance` and `completeness` tests green. A new free stairs tile source may need a licence check + CREDITS.md. |
| **P5** | Mini-games and the ICL / Physics Lab rooms | FB-0074 (**remove Tetris, replace with a match-3**, "candy crush sort of game", for the Room 195 key), FB-0071 (the **ICL** is a closed, fingerprint-locked lab: a mini-game opens the door; inside a modern, spaceship-like super-computing lab with a robot called **Alice**), FB-0066 (Physics Lab: add students; the game becomes a harder, more intense **hero-vs-villain shooter**: she fights the enemies and collects the key, then may leave) | **Licence note:** the owner's idea names Hello Kitty and Batman. Use **generic stand-ins** (a masked caped hero vs a caped villain) built from free packs; do not draw or ship protected characters. Keep "skip after 3 losses" (nobody may be locked out). The match-3 logic is ours (pure, unit-tested); gem art from a free icon pack already vendored (kyrise 16x16 RPG icons) or recoloured pack tiles. |
| **P6** | The wow layer | see section B | Only after P1-P5 are merged and the full test is green. |

Cross-cutting: FB-0025 stays a standing rule (free packs only). Every fix gets a regression test named `FB-XXXX: ...`. After a package
is merged, mark its items fixed (`npm run feedback -- fix FB-00xx "<what changed>"`) so they show up in the owner's Inbox as
"Fixed, please check".

## B. The wow layer (ideas, ranked; the owner picks)

Principle: a gift's "wow" is mostly **personal** and **emotional**, then **cinematic**, then **mechanical**. Cost: S = under a day of one agent,
M = a day, L = more. All art from packs/generators; effects are code (tints, particles), which is not hand-drawn art.

| # | Idea | What she sees/feels | Cost | Needs from the owner |
|---|---|---|---|---|
| W1 | **Her friends are in the game** | Sid, Akshit, Varun, Mitul, Karthik and Mustafa (black-and-orange hoodie) stand around campus and near each mini-game with their own funny fixed lines and a wish each; the hunt feels like her actual friend group, not generic students. | S-M | Real lines/inside jokes (agent drafts, owner edits); each friend's hair/clothes colour if wanted. |
| W2 | **Memory album** | Every key unlocks a polaroid in the Journal (J) with a caption; the finished album becomes the card's slideshow. | M | Photos and captions (placeholders until then). |
| W3 | **Blow the candles + fireworks finale** | After the box opens: a cake, hold a key to blow out the candles, fireworks over a Dubai-skyline silhouette, a chiptune "Happy Birthday" (the tune is public domain; generated by `tools/make-audio.js`), then the card and credits. | M | Nothing (optional: her real age/name already set). |
| W4 | **Golden hour** | A warm sunset tint, soft vignette and light halos on the campus; lamps glow indoors; the day moves from morning to dusk as the three keys are found. Cheap, makes every screenshot prettier. | S-M | None. |
| W5 | **Juice pass** | Doors open/close (already asked, FB-0067); dust puffs when running; key pickup flies to the HUD with a sparkle; "!" "?" "heart" emotes; cats purr hearts when petted; subtle screen shake/flash on mini-game hits; footstep sounds by floor. | M | None. |
| W6 | **Selfie mode** | A camera key (P) frames her with nearby friends and saves a PNG keepsake; a group selfie at the end. Works offline (download). | S-M | None. |
| W7 | **Phone hints** | If she is lost for about a minute, a friend "texts" a hint in a phone-style popup (modern, funny, solves "where do I go"). | M | Friend voices (covered by W1). |
| W8 | **Campus passport** | Stamps for each area, cats petted, facts learned; a small reward when complete (an outfit colour or an extra card line). | M | Optional. |
| W9 | **Dubai flavour** | RTA bus stop (P3), skyline silhouette in the credits and finale, heat-haze/dust particles, shamal wind. | S | None. |

**Recommended set:** W1, W4, W3, W2 and W6, with W5 folded into P4/P1 (doors) and W9 into P3. W7/W8 are the first cuts.

## C. Schedule (re-planned to the 2026-10-11 birthday)

| Day | Date | Work | Owner action |
|---|---|---|---|
| 3 | Mon 10-05 | P1 (controls/UI) -> P2 (names, dialogue, costumes, ICL rename) | Send the friends' lines/jokes and photos when ready; answer feedback questions. |
| 4 | Tue 10-06 | P3 (campus outdoors) -> P4 (Main Block interiors) | Look at the Inbox items marked fixed. |
| 5 | Wed 10-07 | P5 (match-3, ICL door game + lab, Physics Lab fight) | Card assets into `assets/card/` (photos, video, wishes). |
| 6 | Thu 10-08 | P6 wow layer (W4, W3, W1 polish, W2/W6), full test, push, ready-to-play message | **Second playtest** (O overlay). |
| 7 | Fri 10-09 | Owner's feedback fixes; final bundle + zip + site (`npm run pack:offline -- --zip`, `npm run pack:site`), `HOW_TO_OPEN.txt` | Upload `dist/offline-site` to Netlify ([HOSTING.md](../HOSTING.md)); send Taru the link + zip. |
| 8 | Sat 10-10 | Slack | - |
| - | Sun 10-11 | Birthday | - |

**Cut line:** (1) W7, W8; (2) W6, W2; (3) match-3 art polish; (4) extra ambient lines. **Never cut:** P1 (controls, quit, ending -> title),
the bundle and the hosted link, credits, soft-lock guards, the completeness checklist, the full test before the final handover.

## D. How the work runs (owner preferences, 2026-10-04)

- **One Sonnet agent at a time**, each with a self-contained brief; the coordinator watches progress (`git status`, running processes) and
  reviews the diff, runs `npm run test:unit`, commits, and only then briefs the next. Never leave a task half-finished at the end of a session: commit
  after every agent, log it in MEMORY.md, and keep HANDOFF.md true.
- Unit tests only while building. One full test round per day (the pre-push hook runs `npm test`, 9-17 min); the owner keeps the machine quiet.
- Agents cannot see the game: after each visual package the coordinator re-runs `npm run qa:shots` and **looks at the shots** (that is how the card
  typewriter bug was found) and `npm run qa:offline` for the bundle.
- Usage budget: each agent run costs roughly 250-500k tokens and 12-30 minutes; do not parallelise to "save time".
