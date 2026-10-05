# Moments and small touches (the owner's scene ideas, 2026-10-04)

Status: **designed, not built.** The owner: "not right now, but slowly and properly". These are small, personal, unskippable scenes
("moments") that happen at spaced intervals while Taru walks around, each tied to a person or a joke she will recognise, plus two extra games and a ball pit.
They are the core of the "wow" the owner asked for (see [the Day 3 plan, section B](2026-10-04-day3-feedback-and-wow.md)) and widen **W1**.
Related decision: [ADR 0021](../../decisions/0021-friends-in-the-game-and-personal-touches.md) (named friends and professors as NPCs).
Build rules: [agent-rules.md](agent-rules.md). Build order: after P1-P4; the key games (match-3 etc.) are P5; moments and bonus games come after P5, one per agent run, cut from the bottom up.

## Settled with the owner (grilling round 1, 2026-10-04)
1. **Second playtest (~10-08):** all 33 fixes plus only the cheap moments (unicorn M1, Mevin M2, the cover M5). The sumo, tower, Raja's chariot, the three friends and the ball pit follow, using the playtest feedback, and land by 10-09.
2. **Moments are unskippable and play once only.** They do not activate a second time (not after Continue, not on replay; a brand-new save plays them again). They always end by themselves in 8-20 s.
3. **Lines:** the agent drafts everything (friends, professors, Narda, Mevin, Mustafa); the owner asks for changes afterwards. Placeholders stay light.
4. **Friends' looks:** the agent chooses distinctive looks (hair, skin tone, shirt, prop); the owner corrects from screenshots. Satvik: slightly darker skin tone and a camera, as a normal sprite.
5. **Real names in the zip/hosted link, professors included:** fine as is (private gift, kind teasing, only the gags the owner gave).
6. **Ball pit:** a simplified version in the TP room, built last, cut first.
7. **Room 195 key: the tower climb only. Match-3 is DROPPED** (supersedes the earlier "match-3 now, tower later" and FB-0074's "candy crush"; Tetris is still removed). There is no match-3 fallback, so the tower needs the same soft-lock guards as every mini-game (skip after 3 losses, Esc quits, every run ends). Sumo vs Narda stays a bonus in the TP-room arcade.

## Settled with the owner (grilling round 2, 2026-10-04)
8. **Tower climb:** a grumpy stone **gargoyle** at the top throws barrels and flower pots; **gentle** difficulty (3 hearts, slow hazards, about 60-90 s to win); skip after 3 losses.
9. **Hero vs villain:** Taru plays the white-kitten-with-a-pink-bow stand-in; the villain is the dark bat-eared caped stand-in who shoots at her; plus a roaming enemy and students in the lab. Gentle shooter: 3 hearts, the villain takes about 8-10 hits, simple bullet patterns, skip after 3 losses; she wins, takes the key, leaves.
10. **Sumo vs Narda:** winning gives nothing but bragging rights and Narda's reaction line (no stamp, no passport).
11. **Narda:** the agent chooses her look and a playful trash-talker personality; the owner corrects from the screenshot.
12. **The TP room (ball pit + arcade) is open from the start** (owner's choice, not the agent's "after the first key"): the "Locked for now" door becomes a real, always-open door. It sits off the key route, so it cannot block the story; it still needs the completeness/clearance tests.

## The owner's list (as sent, with their answers)

1. **Unicorn at the entrance.** Outside, as she enters the campus: a unicorn is eating. She reacts. A prince with a crown comes in from the right, says he is always watching, climbs on the unicorn and
   flies off. She: "Huh, is this the actual BITS?" **Her line stays the owner's inside joke, exactly as they wrote it** ("WOAH, WHAT? I'm not drunk yet, so why is a unicorn here?"): decided 2026-10-04, no softening.
2. **A tower-climb game** (Donkey Kong style): a **reverse Rapunzel**. The princess climbs the tower to save the prince (short hair). His friend is a **pet chameleon**, like in the Rapunzel/Tangled film
   (the film's chameleon is protected: ours is a generic green chameleon). The owner would prefer this over match-3 for the Room 195 key **if a good open implementation can be found**; otherwise match-3 stays.
   Research result (2026-10-04): the open Donkey-Kong-style projects found (meet-kong, DonkeyJon-phaser) have **no licence file** (all rights reserved), so their code cannot be copied, and the arcade
   original's art is Nintendo's. Decision: **write our own** on the existing pure, tested `src/minigames/platformer-physics.js` (add ladders, rolling hazards, a goal), with CC0 art (e.g. the CC0
   16x16 "tile set pack 1" by Chasersgaming has a ladder; "A platformer in the forest" by Buch is CC0), recoloured to our palette. Reference only: the classic "climb, dodge rolling barrels, reach the top" design.
3. **Mevin** (a friend, plays drums for **Treble, the music club**) comes up to her when she enters the campus: "WOAHHH, <name>, you da goat! Come watch me perform at Jashn some day." (The owner's wording; Treble goes in his name tag / line.)
4. **The Hello Kitty / Batman game gets a themed cover** (the owner pasted a pixel image: a white cat with a pink bow hugging a masked caped hero against a pink-orange sunset and a city skyline, and a Pinterest link).
5. **A ball pit** on the side near the auditorium / "TPP". **TPP = the TP room, the Telepresence Classroom** (the closed door at the end of the ground-floor left wing, `src/maps.js` "Telepresence Classroom door", today "Locked for now").
6. **A sumo game against Narda** (also requested, "as well"): a simple 2D two-player-style sumo like the mobile "2 player games": mash/click to push, win by pushing the other wrestler out of the ring. **Narda** is a friend of the owner (she/her).

Also already requested in FB-0051 and in the same spirit: **Prof. Raja's chariot** (a chariot suddenly arrives and takes him away), **Prof. Elakkiya** (hard quizzes), **Prof. Angel**
(a small pair of wings), **Sana, Shraddha and Palak** walking up together ("Hi <name>, come to the canteen with us"), the friends near every mini-game, Mustafa's fixed lines.

## Design: one small system, many moments

Moments are **in-world scripts** like the RTA bus and the Mustafa greeting (`src/scripts.js` + `src/scripts-runtime.js`: `spawnActor`, `move`, `face`, `emote`, `say`,
`parallel`, `cameraPan`, `wait`), started by the same Tiled `cutscene` trigger objects (`world.js checkCutscene()`), play-once through `GameState.seenCutscenes`
(saved). What is new is only the **pacing rules** (data, tested):

- **Unskippable but never a trap:** input is locked, the player stops (FB-0072 choke point), the scene always ends by itself, 8-20 s each, no choices, no timers that can fail.
  A scene never starts while a dialog, a mini-game, a key-room script or the pause menu is up, and is re-checked on the next frame.
- **Spaced:** at most one moment per 90 s of play and never two on the same map visit; an unplayed moment waits for the next trigger (it is not lost). Order below is the order she meets them.
  **The entrance pair is exempt (coordinator decision 2026-10-05, the owner wants both as she first enters the campus):** M1 (the gate avenue) and M2 (the forecourt) chain naturally. M2 overrides the defaults in the `MOMENTS` table (`src/moments.js`): `minGapS: 6` (about 6 s of play after M1 ENDS, which also keeps them from overlapping) and `sameVisitOk: true` (it may start on the visit M1 started on). Its trigger is the whole area in front of the Main Block door (steps, forecourt and the pavement beside it, 12 x 9 tiles: x 219..230, y 129..137): she cannot reach the door without crossing it, and if she crosses it before the 6 s are up she is still standing in it when they are (the first-time entrance beat on the steps holds her there for several seconds), so it starts on the first free frame. The 90 s gap and one-per-visit stay the default for every later moment (the chariot, the three friends, ...).
  **Not the instant control returns (2026-10-05):** M1 has `afterFreeS: 2.5`: it needs 2.5 s of FREE control (not inside any script, cutscene, dialog, door walk or overlay; `WorldScene.freeSeconds`, reset by every one of those and by a new map visit) before it may start, so she gets control and takes a few steps after the opening/Mustafa's welcome instead of sitting through ~30 s of locked scenes back to back. (It was 8 s first, but at a walk the avenue is crossed in about 3 s, so an 8 s wait often skipped M1 and with it M2.) Its trigger is the whole gate avenue up to the road in front of the forecourt (x 232..250, y 138..153): from where the opening leaves her it takes about 5 s to walk, about 3 s to run, to reach it, so the 2.5 s are always over by the time she enters it and M1 starts as she comes in through the gate.
- **Always visible above the dialog box:** while she is centred the dialog covers the lower ~40% of the screen, so during every `say` of a moment every actor and key prop (the unicorn, the prince, Mevin, the drum kit) stands at or above the camera's centre row (their feet no lower than ~14 px under it); Mevin stands 3 tiles to her right with the kit in front of him. The interact prompt ("E") is hidden for the whole script.
- **Related to the person:** the name on screen is the player's entered name (default "Taru"). Lines are drafts the owner edits (`docs/research/campus-lines-review.md`).
- **No soft-locks:** every moment ends with the player free and not standing inside a collider; a unit test walks each script's end position on the real map.

| # | Moment | Where / when | What happens | Engine | Cost |
|---|---|---|---|---|---|
| M1 | **Unicorn and the prince** | Outside, between the bus stop and the forecourt (first time only, after the Mustafa greeting) | Unicorn grazes (idle 2-frame head bob). She stops, "!" emote, her line. A prince (crowned stand-in sprite) walks in from the right: "I'm always watching." He mounts, the unicorn lifts off (shadow stays on the ground, sparkle trail, fades off the top). Her closing line. | script, one new 2-frame animal sheet + prince NPC (generator, pack crops/recolours) | S-M |
| M2 | **Mevin the drummer** | The forecourt at the Main Block, a few tiles after M1 (>= 60 s later or on reaching the forecourt) | Mevin runs up with a drum kit (snare/kick synth from `tools/make-audio.js`), a drum-roll, jumps, shouts his line, drums while she stands there, ends with a rimshot. | script + 2-3 short synth drum SFX, one NPC sprite with drum prop | S-M |
| M3 | **Prof. Raja's chariot** | A corridor of the Main Block (once, after the first key) | A teaching-corridor chat, a rumble, a chariot (generic, pack-based) rolls in, Raja climbs on, it leaves. | script | M |
| M4 | **Sana, Shraddha, Palak** | After the second key, on the way back (canteen path or the foyer) | Three friends walk up together: "Hi <name>, come to the canteen with us". She says she will, later. | script, 3 NPC sprites | S |
| M5 | **Hero vs villain cover** | The Physics Lab game's title screen (FB-0066) | See "The cover" below. | art generator | S-M |
| M6 | **The ball pit and the arcade, in the TP room** | The Telepresence Classroom at the end of the ground-floor left wing (optional, off the key route; today a closed door) | The door opens (a "fun room" for the party): a ball pit (she walks to its edge, E jumps in: a splash of coloured balls, she paddles slowly, balls bob and part around her, toss balls, laugh emote, climb out) and an arcade corner with the two bonus games below and Narda. | a new small interior (generator) + a "pit" region with its own movement rule and a particle emitter | L |
| M7 | **Sumo vs Narda** | An arcade cabinet in the TP room with Narda next to it ("Beat me at sumo!") | The sumo game below. Bonus: no key. | mini-game (pure logic + scene + art generator) | M |
| M8 | **Tower climb: save the prince** | The other arcade cabinet in the TP room; **may become the Room 195 key game** (see the line-up) | The tower-climb game below. | mini-game on the platformer physics | M-L |

M1 and M2 are the two the owner described as "when you enter campus": M1 plays first (the gate avenue), M2 a little later (the forecourt), so they never overlap.

### The cover for the hero-vs-villain game (M5)
The owner's reference is Hello Kitty and Batman. Those are protected characters, so (decision of 2026-10-04, ADR 0021, unchanged) the game uses **generic stand-ins**: a white kitten
hero with a pink bow, and a dark, bat-eared, caped masked hero. The cover takes the *mood* of the owner's picture: pink-orange sunset sky with a big pale sun, a rooftop ledge,
a dark city skyline at the sides (the same Dubai skyline silhouette as the finale, W9), the two stand-ins posed close together. It is composed from pack tiles and code (gradient bands, skyline
silhouettes, the existing character recolour sheets), not drawn by hand and not copied from the picture.
**Option for the owner:** if they prefer the exact characters for their own private copy, they can drop their own image into a gitignored slot (like the card photos); the build would pick
it up if present. That is the owner's file and the owner's call; it is not built unless asked.

### The sumo game (M7): design
Side view, two big sumo stand-ins facing each other on a round straw ring (dohyo); Narda on the right, Taru on the left. **Controls: mash SPACE / click / tap to push**
(the same one-button "2 player game" feel; Enter/E also work). Rules, all in a pure, unit-tested logic file (`src/minigames/sumo-logic.js`, like `tetris-logic.js`/`flappy-logic.js`):
- A position `p` in [-1, 1] (0 = the ring centre). Every press adds a short push impulse for the player; Narda's AI "presses" at a rate that depends on the round (about 4-6 per second, with jitter and short stumbles) so a quick mash wins, a lazy one loses.
- A small stamina meter: mashing without rhythm tires you (a light penalty), a steady rhythm does not.
- Friction pulls both toward the centre; whoever's `p` crosses the rim is pushed out. **Best of 3 rounds**; a round lasts at most about 15 s (then a draw is decided by who is nearer the centre).
- Soft-lock guard like every mini-game: **skip after 3 losses**, Esc to quit; no round can fail to end.
- Presentation: the pre-fight bow/"HAKKEYOI!" banner, a screen shake on each big push, dust puffs at the feet, the loser flying out of the ring in an arc, Narda's reaction lines.
- Art: pack tiles and code; wrestler sprites from a free pack if one has them, otherwise a recoloured, scaled pack character with a code-built mawashi and belly. No hand-drawn PNGs.

### The tower climb (M8): design
Side view, a tall tower of 5-6 floors joined by ladders (a "reverse Rapunzel": a tower window at the top where the short-haired prince waits, his green pet chameleon on the sill cheering).
Taru (the princess) climbs: run, jump, climb ladders (up/down), dodge rolling hazards (barrels/flower pots/books thrown down by a grumpy gargoyle, no protected character), reach the top. Lives: 3 hearts,
**skip after 3 losses**, Esc quits. Pure logic in `src/minigames/tower-logic.js` on top of `platformer-physics.js` (ladder state, hazard spawn/roll rules, win/lose), unit-tested; art from CC0 packs + code. Closing beat: she opens the window, the prince
climbs down saying thanks, the chameleon changes colour.

## Mini-game line-up (final, 2026-10-04)
| Key | Game | Note |
|---|---|---|
| Physics Lab | **Hero vs villain** (the platformer, made harder: FB-0066) | generic stand-ins; themed cover (M5) |
| ICL (fingerprint door, FB-0071) | the existing flyer "Server Dash" re-skinned as the fingerprint hack, then the lab with Alice | already built and tested |
| Room 195 | **Tower climb: save the prince (M8)** | replaces Tetris; match-3 is dropped |
| Bonus, TP room arcade | **Sumo vs Narda** (M7) | optional, no key |

## Open questions for the owner
None from rounds 1-2. Cut order if time runs short: M6 ball pit, then M3 Raja's chariot, then M7 sumo, then M4. Keep M1, M2, M5 and the tower climb (it is the Room 195 key).

## Draft lines (placeholders; the owner edits)
- **M1** Taru: "WOAH, WHAT? I'm not drunk yet, so why is a unicorn here?" Prince: "Don't mind me. I'm always watching." (mounts, flies off) Taru: "Huh... is this the actual BITS?"
- **M2** Mevin: "WOAHHH, TARU! You da goat!" ... "Come watch me perform at Jashn some day!" (rimshot) Name tag: "Mevin (Treble)".
- **M3** Raja: "Class is dismissed." (a chariot rumbles in) "My ride." Taru: "Okay. Never mind. This is definitely BITS."
- **M4** Sana: "Taru!" Shraddha: "There you are!" Palak: "Come to the canteen with us, we saved you a seat." Taru: "Give me a few minutes, one more key to find."
- **M7** Narda: "Beat me at sumo!" ... (win) "Okay, okay, you win this one."
