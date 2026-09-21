# Story: the LUG treasure hunt

**Told by the owner on 2026-09-20.** This is the script the game follows. Don't invent beyond it:
ask in the feedback thread instead. The ending is a **birthday surprise** for a real person, so the
whole game is a gift: everything before the card exists to lead up to it.

## Opening (owner brief, 2026-09-21)

Before beat 1, the game opens the way a Pokémon game does.

0. **Title screen.** Properly drawn, with big pressable buttons, not plain text rows. It must look
   good: this is the first thing anyone sees.
1. **"Hello there!"** A character called **Mustafa** greets the player. He's the friendly organiser
   type who explains things: who the lead is (a new student arriving at BITS Pilani Dubai), what's
   about to happen, and he keeps it short.
2. **Name entry.** The player types the lead's name (on-screen keyboard plus real typing, with a
   sensible default so it can be skipped).
3. **Character customisation.** At least clothes colour, picked from swatches, previewed live on her
   sprite. Hair and skin tone too if it's cheap to add.
4. **The arrival animation.** A bus drives in from off-screen, stops at the BITS main gate, the door
   opens, she steps off, the bus pulls away. Then the gate cutscene plays and she walks in.
5. She walks up the avenue to the **Main Block entrance**, where the entrance cutscene (steps,
   pillars, the glass front under the red arch) plays. Then the story below begins.

**Look:** the owner's words are "currently it looks very blocky and 2D, a little 3D please". Everything
in this opening needs depth: shaded and bevelled buttons and panels, drop shadows, a sense of
perspective in the cutscene art, and movement that eases rather than snaps.

## Beats

1. **Arrival.** (after the opening above) The lead (a new student: pink clothes, black hair, fair skin) walks up to the main
   gate. The **gate cutscene** plays: "Welcome to BITS Pilani, Dubai Campus!"
2. **The walk in.** She walks straight up the avenue to the Main Block entrance.
3. **The entrance cutscene (new).** A close-up pixel scene of the real entrance: the steps, the
   pillars, the glass front under the red arch. Then she's inside.
4. **The foyer.** The game says there's a **LUG event stall behind the stairs**. Everywhere else in
   the building is blocked off for now, so the only way is around and behind the staircase.
5. **The LUG volunteer.** A student stands at the stall. An **E** prompt floats over his head. He
   explains the treasure hunt: **find 3 keys hidden around campus.**
6. **Key 1: the Physics Lab**, 3rd floor. She goes up and to the right.
7. **Key 2: the ICVL**, the computing lab on the 1st floor.
8. **Key 3: Room 195.**
   - Each room gets its own small cutscene when she walks in.
   - Each key is won by beating a **mini-game** (see below).
9. **The reward.** She returns to the stall with all 3 keys. The volunteer says she's the **first to
   finish** and hands her a **small box**.
10. **The box opens** into a full-screen **animated birthday card**: photos, drawings, animation, and
    a video at the end.

## Rules for the world

- Only the route the story uses is open. Other doors, floors and rooms are politely blocked
  ("Locked for the event"), so the player can't get lost in 8 empty floors.
- The campus outdoors stays open to roam: it's the part the owner likes.
- No real people appear as characters. The volunteer is a generic student.

## Mini-games (one per key)

Each is a small pixel game inside the main game, with a **score target**. Reach the target and the
key is yours. You can retry as often as you like, and there's a "skip after 3 tries" escape so the
gift can never be blocked by a hard game.

| Key | Room | Mini-game |
|---|---|---|
| 1 | Physics Lab (3rd floor) | Platformer jump-and-run (Mario-like) |
| 2 | ICVL (1st floor) | Flappy-bird style flyer |
| 3 | Room 195 | Tetris |

## The birthday card (the ending)

- Full-screen, animated, in the game's own style: pixel confetti, cake, and typed messages.
- **Photos and a video the owner supplies**, dropped into `assets/card/` (gitignored, not committed),
  with names and messages in a small config file. The game runs with placeholders until then.

## Open questions for the owner

- Where exactly are the **Physics Lab**, the **ICVL** and **Room 195**? A photo or a description of
  each would make those three rooms real instead of guessed. No public floor plans exist (checked
  2026-09-20: official site, prospectus PDF, Wikipedia, 2GIS, Google).
- Where is the real **main entrance (Gate 2)**? Still assumed (FB-0022).
- The card's text: names, messages, and how many photos.
