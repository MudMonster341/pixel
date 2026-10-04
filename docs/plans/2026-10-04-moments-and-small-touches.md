# Moments and small touches (the owner's scene ideas, 2026-10-04)

Status: **designed, not built.** The owner: "not right now, but slowly and properly". These are small, personal, unskippable scenes
("moments") that happen at spaced intervals while Taru walks around, each tied to a person or a joke she will recognise. They are the
core of the "wow" the owner asked for (see [the Day 3 plan, section B](2026-10-04-day3-feedback-and-wow.md)) and widen **W1**.
Related decision: [ADR 0021](../../decisions/0021-friends-in-the-game-and-personal-touches.md) (named friends and professors as NPCs).
Build rules: [agent-rules.md](agent-rules.md). Build order: after P1-P4 and the other feedback packages; the sumo game (M7) is built in P5 together with the other mini-games; the rest one moment per agent run, cut from the bottom up.

## The owner's list (as sent)

1. **Unicorn at the entrance.** Outside, as she enters the campus: a unicorn is eating. She reacts ("WOAH, what? Why is there a unicorn here?").
   A prince with a crown comes in from the right, says he is always watching, climbs on the unicorn and flies off. She: "Huh, is this the actual BITS?"
2. **A sumo game against Narda** (updated by the owner later on 2026-10-04; it replaces the first idea, a Donkey-Kong tower climb that saves the prince).
   A simple 2D two-player-style sumo, like the mobile "2 player games": a click/tap (or key) game where two sumo wrestlers push each other and you win by pushing the other one out of the ring.
   The opponent is **Narda**, a friend of the owner (she/her), who replaces Tetris.
3. **Mevin** (a friend, with drums) comes up to her when she enters the campus: "WOAHHH, <name>, you da goat! Come watch me perform at Jashn some day."
4. **The Hello Kitty / Batman game gets a themed cover** (the owner pasted a pixel image: a white cat with a pink bow hugging a masked caped hero against a pink-orange sunset and a city
   skyline, and a Pinterest link).
5. **A ball pit** on the side near the auditorium / "TPP" area: she can jump in and have fun, with proper, detailed animations.

Also already requested in FB-0051 and in the same spirit: **Prof. Raja's chariot** (a chariot suddenly arrives and takes him away), **Prof. Elakkiya** (hard quizzes), **Prof. Angel**
(a small pair of wings), **Sana, Shraddha and Palak** walking up together ("Hi <name>, come to the canteen with us"), the friends near every mini-game, Mustafa's fixed lines.

## Design: one small system, many moments

Moments are **in-world scripts** like the RTA bus and the Mustafa greeting (`src/scripts.js` + `src/scripts-runtime.js`: `spawnActor`, `move`, `face`, `emote`, `say`,
`parallel`, `cameraPan`, `wait`), started by the same Tiled `cutscene` trigger objects (`world.js checkCutscene()`), play-once through `GameState.seenCutscenes`
(saved). What is new is only the **pacing rules** (data, tested):

- **Unskippable but never a trap:** input is locked, the player stops (FB-0072 choke point), the scene always ends by itself, 8-20 s each, no choices, no timers that can fail.
  A scene never starts while a dialog, a mini-game, a key-room script or the pause menu is up, and is re-checked on the next frame.
- **Spaced:** at most one moment per 90 s of play and never two on the same map visit; an unplayed moment waits for the next trigger (it is not lost). Order below is the order she meets them.
- **Related to the person:** the name on screen is the player's entered name (default "Taru"). Lines are drafts the owner edits (`docs/research/campus-lines-review.md`).
- **No soft-locks:** every moment ends with the player free and not standing inside a collider; a unit test walks each script's end position on the real map.

| # | Moment | Where / when | What happens | Engine | Cost |
|---|---|---|---|---|---|
| M1 | **Unicorn and the prince** | Outside, between the bus stop and the forecourt (first time only, after the Mustafa greeting) | Unicorn grazes (idle 2-frame head bob). She stops, "!" emote, line. A prince (crowned stand-in sprite) walks in from the right: "I am always watching." He mounts, the unicorn lifts off (shadow stays on the ground, sparkle trail, fades off the top). Her closing line. | script, one new 2-frame animal sheet + prince NPC (generator, pack crops/recolours) | S-M |
| M2 | **Mevin the drummer** | The forecourt at the Main Block, a few tiles after M1 (>= 60 s later or on reaching the forecourt) | Mevin runs up with a drum kit (snare/kick synth from `tools/make-audio.js`), a drum-roll, jumps, shouts his line, drums while she stands there, ends with a rimshot. | script + 2-3 short synth drum SFX, one NPC sprite with drum prop | S-M |
| M3 | **Prof. Raja's chariot** | A corridor of the Main Block (random-ish, once, after the first key) | A teaching-corridor chat, a rumble, a chariot (generic, pack-based) rolls in, Raja climbs on, it leaves. | script | M |
| M4 | **Sana, Shraddha, Palak** | After the second key, on the way back (canteen path or the foyer) | Three friends walk up together: "Hi <name>, come to the canteen with us". She says she will, later. | script, 3 NPC sprites | S |
| M5 | **Hero vs villain cover** | The Physics Lab game's title screen (FB-0066) | See "The cover" below. | art generator | S-M |
| M7 | **Sumo vs Narda** | The Room 195 key station (replaces Tetris) | Narda waits beside the key desk: "You want the key? Beat me at sumo." The sumo game: see "The sumo game" below. | new mini-game (pure logic + scene + art generator) | M |
| M6 | **The ball pit** | A side room off the auditorium lobby (bonus, optional, not on the key route) | She walks to the pit's edge, presses E to jump in: a splash of coloured balls, she paddles through (slower, balls bob and part around her), tosses balls (a small button action), laughs emote, climbs out. | new small interactive area: a "pit" tile region with its own movement rule and a particle emitter | L |

M1 and M2 are the two the owner described as "when you enter campus": M1 plays first (the gate avenue), M2 a little later (the forecourt), so they never overlap.

### The cover for the hero-vs-villain game (item 4)
The owner's reference is Hello Kitty and Batman. Those are protected characters, so (decision of 2026-10-04, ADR 0021, unchanged) the game uses **generic stand-ins**: a white kitten
hero with a pink bow, and a dark, bat-eared, caped masked hero. The cover takes the *mood* of the owner's picture: pink-orange sunset sky with a big pale sun, a rooftop ledge,
a dark city skyline at the sides (the same Dubai skyline silhouette as the finale, W9), the two stand-ins posed close together. It is composed from pack tiles and code (gradient bands, skyline
silhouettes, the existing character recolour sheets), not drawn by hand and not copied from the picture.
**Option for the owner:** if they prefer the exact characters for their own private copy, they can drop their own image into a gitignored slot (like the card photos); the build would pick
it up if present. That is the owner's file and the owner's call; it is not built unless asked.

## The sumo game (Room 195): design
Side view, two big sumo stand-ins facing each other on a round straw ring (dohyo); Narda on the right, Taru on the left. **Controls: mash SPACE / click / tap to push**
(the same one-button "2 player game" feel; Enter/E also work). Rules, all in a pure, unit-tested logic file (`src/minigames/sumo-logic.js`, like `tetris-logic.js`/`flappy-logic.js`):
- A position `p` in [-1, 1] (0 = the ring centre). Every press adds a short push impulse for the player; Narda's AI "presses" at a rate that depends on the round (about 4-6 per second, with jitter and short stumbles) so a quick mash wins, a lazy one loses.
- A small stamina meter: mashing without rhythm tires you (a light penalty), a steady rhythm does not. It keeps it from being pure spam and is why the bigger the rhythm the better the push.
- Friction pulls both toward the centre; whoever's `p` crosses the rim is pushed out. **Best of 3 rounds**; a round lasts at most about 15 s (then a draw is decided by who is nearer the centre).
- Soft-lock guard like every mini-game: **skip after 3 losses**, Esc to quit; no round can fail to end.
- Presentation: the pre-fight bow/"HAKKEYOI!" banner, a screen shake on each big push, dust puffs at the feet, the loser flying out of the ring in an arc, Narda's reaction lines ("Best of three!", "Okay, okay, you win this one.").
- Art: pack tiles and code; wrestler sprites from a free pack if one has them, otherwise a recoloured, scaled pack character with a code-built mawashi and belly (the mini-game art generator already composes sprites this way). No hand-drawn PNGs.
Narda is a **named friend** (ADR 0021 addendum): she also stands near the Room 195 key station on the map with one fixed line; the owner approves her lines.

## Mini-game line-up (one confirmation needed)
The owner's two messages both replace Tetris (FB-0074: a candy-crush-style match-3; item 2: first a tower climb, now the sumo game). The last word wins for the Room 195 key. My proposal:

| Key | Game | Note |
|---|---|---|
| Physics Lab | **Hero vs villain** (the platformer, made harder: FB-0066) | as asked; generic stand-ins; themed cover (M5) |
| ICL (fingerprint door, FB-0071) | the existing flyer "Server Dash" re-skinned as the fingerprint hack, then the lab with Alice | already built and tested; fits a computing lab |
| Room 195 | **Sumo vs Narda** (M7) | the owner's latest request |
| Bonus (arcade corner beside the ball pit) | **Match-3** (FB-0074) | optional, no key; first to cut. The tower climb is dropped. |

If the owner would rather keep match-3 as the Room 195 key game, the sumo becomes the bonus (swap rows 3 and 4).

## Open questions for the owner
1. Sumo for the Room 195 key and match-3 as an optional bonus game (table above): OK, or should match-3 keep the key?
2. "TPP": which area is that (a building/room name)? The ball pit goes by the auditorium unless told otherwise.
3. Mevin: any real detail to include (instrument is drums, event is "Jashn"; anything else, or a different name spelling)? Is "Jashn" the cultural fest?
4. The unicorn line "I'm not drunk yet": I drafted a milder "I haven't even had coffee yet"; keep the original or the mild one?
5. Narda: anything to know about her (look, hair, a catchphrase), and is the sumo set in the Room 195 classroom?
6. Cut order if time runs short (my proposal): M6 ball pit, then the match-3 bonus, then M3 Raja's chariot, then M4. Keep M1, M2, M5, M7.

## Draft lines (placeholders; the owner edits)
- **M1** Taru: "WOAH. What?!" ... "I haven't even had coffee yet. Why is there a unicorn?" Prince: "Don't mind me. I'm always watching." (mounts, flies off) Taru: "Huh... is this the actual BITS?"
- **M2** Mevin: "WOAHHH, TARU! You da goat!" ... "Come watch me perform at Jashn some day!" (rimshot)
- **M3** Raja: "Class is dismissed." (a chariot rumbles in) "My ride." Taru: "Okay. Never mind. This is definitely BITS."
- **M4** Sana: "Taru!" Shraddha: "There you are!" Palak: "Come to the canteen with us, we saved you a seat." Taru: "Give me a few minutes, one more key to find."
