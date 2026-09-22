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

## The box and the birthday card (the ending, built 2026-09-22)

When she turns in all 3 keys, the volunteer hands over a small box (`GameState.quest.stage` becomes
`'rewarded'`). That immediately plays two things back to back, then returns to the title screen:

1. **The box opens** (`src/scenes/box-opening.js`): it appears, the lid creaks open, golden light
   and pixel sparkles rise, and the screen fills with light. Skippable with Esc, but only *after* the
   lid has fully opened -- a stray keypress right as the volunteer's last line closes can't rob the
   moment. If `assets/cutscenes/video/box-opening.mp4` exists, it plays that instead of the drawn
   version (see `docs/research/cutscene-video-prompts.md` "Prompt 3").
2. **The birthday card** (`src/scenes/card.js`): a full-screen pixel card that opens, with confetti,
   a cake with candles, floating hearts, a photo slideshow and the messages below, typed out one at a
   time. It ends on a gentle "THE END" and returns to the title screen -- the save is kept, so
   **"Continue"** picks up exactly where she was, and a new **"Watch the Card Again"** option (only
   shown once a save has actually reached this point) jumps straight back to the card without
   replaying the box or the hunt.

The game runs on placeholders (a generic message, a soft placeholder illustration in the photo frame)
until the owner supplies real content -- nothing here can be "unfinished" in a way that breaks it.

### How to put your photos and messages in

Everything below goes in **`assets/card/`**, a folder the game never commits (see `.gitignore`) --
so this is safe to edit directly on the machine that will actually send the finished game, without
it ever ending up in git history.

| What | Where | Notes |
|---|---|---|
| The messages, names and photo captions | `assets/card/card.json` | See the shape below. Missing or left out entirely -> a short set of placeholder messages plays instead. |
| Photos | `assets/card/photos/<file>` | Any image format a browser can show (`.jpg`/`.jpeg`/`.png`/`.webp`/`.gif`). Any size or aspect ratio -- each one is scaled to fit inside the card's picture frame. A landscape photo (roughly 3:2 or 4:3) looks best; a very tall portrait photo will end up small inside the frame. Each file must also be **listed** in `card.json`'s `photos` array (below) -- dropping a file into the folder alone doesn't add it, since a browser can't list a folder's contents on its own. |
| The closing video (optional) | `assets/card/video.mp4` | Plays after the last message, before "THE END". If it's missing, the card just finishes on the last message instead -- nothing breaks either way. |
| The box-opening video (optional) | `assets/cutscenes/video/box-opening.mp4` | See `docs/research/cutscene-video-prompts.md` for the exact clip spec (16:9, 4-8 seconds, silent, pixel-art style). If missing, the drawn box-opening sequence plays instead. |

**`assets/card/card.json`** (every field optional -- a half-written file degrades gracefully, it
never breaks the card):

```json
{
  "recipient": "Her Name",
  "messages": [
    "Happy Birthday, {name}!",
    "Here's a photo from that time...",
    "Have the best year yet."
  ],
  "photos": [
    { "file": "1.jpg", "caption": "Caption for the first photo" },
    { "file": "2.jpg", "caption": "Caption for the second photo" }
  ]
}
```

- `recipient`: her real name, used everywhere `{name}` appears in a message. Left out entirely, it
  falls back to whatever name was actually typed on the game's own name-entry screen -- set this
  explicitly if you want the card to always say the same real name regardless of what a player types
  when playing the game itself.
- `messages`: shown one at a time, typed out, advanced with E/Space/Enter -- the same textbox every
  conversation in the game already uses. `{name}` anywhere in a line is replaced with `recipient`.
- `photos`: **order matters** -- they play in this order, cross-fading, holding a few seconds each,
  looping. `file` is just the filename inside `assets/card/photos/`, not a full path. `caption` is
  optional; leave it out (or empty) for no caption on that photo. A `file` that doesn't actually
  exist in the folder falls back to the placeholder illustration for that one slide (its caption
  still shows), rather than breaking the rest of the slideshow.

## Open questions for the owner

- Where exactly are the **Physics Lab**, the **ICVL** and **Room 195**? A photo or a description of
  each would make those three rooms real instead of guessed. No public floor plans exist (checked
  2026-09-20: official site, prospectus PDF, Wikipedia, 2GIS, Google).
- Where is the real **main entrance (Gate 2)**? Still assumed (FB-0022).
- The card's real photos, video and final wording -- see "How to put your photos and messages in"
  above; the game plays fine on placeholders until then.

## Small choices made building the playable spine (M3, 2026-09-22)

The rooms/entrance above are still open questions, so the story spine (the volunteer, the 3 keys,
the gating) had to pick *something* real to stand on. Flagging what was decided, so the owner can
correct any of it once the real answer is known:

- **Room placement**: the Physics Lab moved to the 3rd floor (was a 2nd-floor guess); ICVL and
  Room 195 are two of the 1st floor's plain "50 Seater Classroom" rooms, renamed (ICVL refurnished
  as a computing lab, Room 195 left as a classroom) -- see docs/INTERIORS_PLAN.md "Story rooms" for
  exactly what changed. "ICVL" itself is this task's own placeholder name, not a sourced one.
- **Quest stages**: `GameState.quest.stage` is `'arrival'` -> `'hunting'` -> `'rewarded'` (the
  original M1 scaffolding had `'briefed'`/`'done'` placeholders that nothing in this story actually
  needed as a separate step).
- **The 3 keys are real inventory items** too (Kyrise icons), not just the `quest.keys` progress
  flags M1 already had -- so the hotbar visibly fills up as she collects them. "He takes the keys"
  at the end is narrative only for now: there's no `take`-item dialog action yet, so the 3 key items
  and the box stay in her bag rather than actually being removed. Easy to add if that bothers you.
- **The volunteer's hint is keyed to how many keys she's holding, not which ones are still
  missing** (matching this task's own brief) -- so a player who collects them out of order gets a
  hint for a key she may already have. The quest tracker (top-right panel) is smarter about this: it
  always names the first *actually missing* key, in the Physics Lab -> ICVL -> Room 195 order.
- **The box opening and the birthday card were built 2026-09-22** -- see "The box and the birthday
  card (the ending)" above; at the time this M3 spine was first written they were still a later
  milestone, noted here only so the history of this decision log stays honest.
