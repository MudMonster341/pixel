# Story: the LUG treasure hunt

**Told by the owner on 2026-09-20.** This is the script the game follows. Don't invent beyond it:
ask in the feedback thread instead. The ending is a **birthday surprise** for a real person, so the
whole game is a gift: everything before the card exists to lead up to it.

## Opening (owner brief, 2026-09-21; reworked 2026-09-27, ADR 0016/FB-0032)

Before beat 1, the game opens the way a Pokémon game does -- and, since the FB-0032 rework, as one
continuous shot in the real game world, never a cut to a differently-styled illustration.

0. **Title screen.** Big pressable buttons over a slow, live pan across the *real* generated campus
   map (a lightweight top-down render, `src/scenes/opening-backdrop.js` -- not a booted WorldScene),
   dimmed for legibility, with the original palm/fence silhouette strip scrolling in front of it.
1. **"Hello there!"** Mustafa greets the player over that same live backdrop (crossfaded in, not a cut
   to a new picture). He's the friendly organiser type who explains things: who the lead is (a new
   student arriving at BITS Pilani Dubai), what's about to happen, and he keeps it short.
2. **Name entry** and **3. Character customisation** (clothes colour, live-previewed) keep their own
   UI, over the same live backdrop, crossfading between the three screens.
4. **The arrival animation, in-world (ADR 0016).** Confirming her clothes hands off to the loading
   screen, then WorldScene itself: a real bus sprite drives in along the real Gate 2 approach road,
   stops, she steps off (revealed for the first time), the bus pulls away -- then Mustafa (a new
   recoloured character, not a placed map NPC) walks up from further inside the gate, greets her
   ("Welcome to BITS Pilani, Dubai Campus!", reused verbatim from the old gate cutscene), and walks her
   a few tiles up the avenue. The camera pans up to the Main Block entrance and back with his own line
   about the LUG stall, then hands control back with the objective already showing (FB-0033, below).
   Skipping the whole opening chain (`?intro=0`, an old save) or simply walking up to the same spot
   under her own steam plays the identical "Mustafa meets her" beat as a normal walk-into-a-trigger
   cutscene (`SCRIPTS.gate2`) -- one beat, two ways to reach it.
5. She walks up the avenue to the **Main Block entrance**, where an in-world beat (the camera pans up
   the facade, one line reused verbatim from the old entrance cutscene) plays, replacing the old static
   illustration. Then the story below begins.

**Onboarding (FB-0033, "as soon as I walk in, I don't understand what's going on").** From the moment
she has control: the quest tracker's objective text, a pulsing destination marker on the minimap and
full-screen map, and a bouncing arrow over the current destination door/desk when it's on screen,
always following the quest stage and whichever key is still missing. If she wanders for about 20
seconds without getting closer, a gentle toast repeats the objective.

**New dialogue written for this rework** (owner: please review/edit -- everything else is reused
verbatim from the lines that already existed): Mustafa's "Right this way — let's get you started."
and "The LUG stall is inside the Main Block — behind the staircase."; the three key-room beats'
own naming lines, "The Physics Lab.", "The ICL — the computing lab." and "Room 195." (docs/STORY.md
beat 8, kept deliberately short and functional).

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
7. **Key 2: the ICL**, the computing lab on the 1st floor.
8. **Key 3: Room 195.**
   - Each room gets its own small cutscene when she walks in.
   - Each key is won by beating a **mini-game** (see below).
9. **The reward.** She returns to the stall with all 3 keys. The volunteer says she's the **first to
   finish** and hands her a **small box**.
10. **The box opens**, then the **birthday finale** (a cake, candles she blows out, fireworks over the Dubai skyline,
    "Happy Birthday" played as a chiptune), then a full-screen **animated birthday card**: photos, drawings,
    animation, and a video at the end (see "The box and the birthday card" below).

## Amendments from the birthday sprint (2026-10-03; ADRs 0017-0019)

- **The recipient is Taru (22).** The name field at the start is prefilled "Taru" (she may change it). The
  credits always say "Taru", from `card.json`'s `recipient`, not the typed name.
- **Credits phase** after the card: "Happy Birthday, Taru", "Happy 22", about 8 wishes fade in one by one,
  THE END, "Made for you by Mustafa". `card.json` gets optional `wishes` and `age`.
- **The bus is an RTA (Dubai) bus**, pixelated, door opening, she steps out.
- **Campus life:** every ambient student can be talked to and shares a campus fact (clubs, quizzes,
  facilities, events, departments) from `src/campus-facts.js`; cats and birds wander. Facts are sourced
  from the official site and public pages. **Real CS professors may be named in facts** (owner's call);
  real people still don't appear as characters.
- **Ground floor:** the foyer, reception and wings follow the official 3D tour (ADR 0020), which supersedes the older owner photo.
- **Delivery:** an offline `index.html` bundle she double-clicks on her MacBook; no .exe.

## Amendment from owner feedback FB-0071 (2026-10-05): the ICL is a fingerprint-locked lab

The ICL (key 2) is a modern, spaceship-like super-computing lab with a robot called Alice. Its door is sealed with a fingerprint scanner: the mini-game
("ICL Fingerprint Hack", the same flyer) is how she gets in; the key is then collected inside (Alice hands it over, the core console holds it). Nothing else of the
story changes: the key, its quest id (`icl`), item (`keyIcl`) and the hunt's order are as before; losing three times still offers a skip (it opens the door), Esc leaves
it sealed and she can retry any time. See docs/INTERIORS_PLAN.md "P5c".

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
| 1 | Physics Lab (3rd floor) | Hero fight: a masked kitten hero (a generic stand-in) shoots a bat-eared "shadow bat" who shoots back (3 hearts, 9 hits, a roaming minion, a themed cover), then takes the key he drops (FB-0066) |
| 2 | ICL (1st floor) | Flappy-bird style flyer, now the **fingerprint hack** (FB-0071): the ICL is a sealed super-computing lab; the flyer (a data packet through neon firewalls) opens its door, then Alice hands over the key inside |
| 3 | Room 195 | Tower climb: a "reverse Rapunzel" (climb to the prince, dodge what the gargoyle throws) |

## The box and the birthday card (the ending, built 2026-09-22)

When she turns in all 3 keys, the volunteer hands over a small box (`GameState.quest.stage` becomes
`'rewarded'`). That immediately plays four things back to back, then returns to the title screen (box -> finale -> card -> credits -> title):

1. **The box opens** (`src/scenes/box-opening.js`): it appears, the lid creaks open, golden light
   and pixel sparkles rise, and the screen fills with light. Skippable with Esc, but only *after* the
   lid has fully opened -- a stray keypress right as the volunteer's last line closes can't rob the
   moment. If `assets/cutscenes/video/box-opening.mp4` exists, it plays that instead of the drawn
   version (see `docs/research/cutscene-video-prompts.md` "Prompt 3").
2. **The birthday finale** (`src/scenes/finale.js`, W3, built 2026-10-05; the cake and the fireworks are the celebration, the card
   then reads as the personal message afterwards). The warm light of the box fades into a dusk over a Dubai skyline silhouette (a needle
   tower, a sail-shaped hotel, an arched tower, lit windows: all generic shapes). On a table stands a tiered cake with **22 small candles**
   and Taru (her sprite, 3x) beside it; "Make a wish, Taru!". **She holds Space / E / Enter (or the mouse / a finger)** to blow: a breath
   meter fills and the flames go out one by one, left to right, over about 3 s of holding (they lean away and flicker harder, thin smoke
   rises, a soft "pff" each; letting go pauses it and blown-out candles stay out). Nobody can get stuck: after 8 s without progress
   "Hold SPACE to blow!" pulses, after 20 s the rest go out by themselves. When the last flame is out: a beat of silence and "Make a
   wish...", a warm flash, then ~15 s of **fireworks** (rising trails, bursts of sparks, a few rings and hearts, flickering windows) with a
   synthesized two-voice chiptune of the traditional "Happy Birthday to You" (public domain tune) and "Happy Birthday, Taru!". The name is
   the card's recipient ("Taru" unless `card.json` says otherwise); no age is shown here. During the candles the held key is the
   interaction, never a skip; from 2 s into the fireworks Esc / Enter / Space / a click skip on to the card; it fades to the card by itself
   when the song is over. The scene works fully silent. "Watch the Card Again" does not replay the finale.
3. **The birthday card** (`src/scenes/card.js`): a full-screen pixel card that opens, with confetti,
   a cake with candles, floating hearts, a photo slideshow and the messages below, typed out one at a
   time. When the last message closes it hands on to the credits.
4. **The credits** (`src/scenes/credits.js`, ADR 0019, see "The credits" below): "Happy Birthday, Taru",
   "Happy 22", the wishes one by one, "THE END", then back to the title screen -- the save is kept, so
   **"Continue"** picks up exactly where she was, and a new **"Watch the Card Again"** option (only
   shown once a save has actually reached this point) jumps straight back to the card (and then the
   credits) without replaying the box or the hunt.

The game runs on placeholders (a generic message, a temporary 5-slide photo slideshow of campus/story
moments -- see below) until the owner supplies real content -- nothing here can be "unfinished" in a
way that breaks it.

### How to put your photos and messages in

Everything below goes in **`assets/card/`**, a folder the game never commits (see `.gitignore`) --
so this is safe to edit directly on the machine that will actually send the finished game, without
it ever ending up in git history. A ready-to-copy, committed example of the exact `card.json` shape
below lives at [`assets/card/card.example.json`](../assets/card/card.example.json) -- copy it to
`assets/card/card.json` in the same folder and edit it.

Until any of this exists, the card doesn't show a bare "YOUR PHOTO HERE" placeholder photo forever --
it plays a temporary 5-slide slideshow instead (the Main Block entrance, the foyer staircase, the LUG
stall, the three keys, the box; `src/card.js` `TEMP_CARD_SLIDES`, drawn by `tools/make-card-art.js`),
so the game still looks finished before the owner's real photos exist. The instant `card.json` lists
even one real photo, the temporary slideshow disappears completely -- real photos always win, never
mixed in alongside the temporary ones.

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
  "recipient": "Taru",
  "age": 22,
  "messages": [
    "Happy Birthday, {name}!",
    "Here's a photo from that time...",
    "Have the best year yet."
  ],
  "photos": [
    { "file": "1.jpg", "caption": "Caption for the first photo" },
    { "file": "2.jpg", "caption": "Caption for the second photo" }
  ],
  "album": [
    { "file": "a1.jpg", "caption": "Caption of the 1st polaroid (the Physics Lab key)" },
    { "file": "a2.jpg", "caption": "Caption of the 2nd polaroid (the ICL key)" },
    { "file": "a3.jpg", "caption": "Caption of the 3rd polaroid (the Room 195 key)" }
  ],
  "wishes": [
    "A short wish, shown on its own for about three seconds.",
    "Write about eight of them; {name} becomes the recipient."
  ]
}
```

- `recipient`: her real name, used everywhere `{name}` appears in a message or wish, and in the
  credits' "Happy Birthday, ...". Left out entirely, it is **"Taru"** (ADR 0019) -- it is *not* the
  name typed on the game's own name-entry screen, so the gift always names her whatever a player types.
- `age`: the number in the credits' "Happy 22". Optional, default 22.
- `wishes`: the credits' wishes (see "The credits" below), one string each, about eight, each under
  about 70 characters. Optional: the built-in generic placeholders in `src/credits.js` play if left out.
- `messages`: shown one at a time, typed out, advanced with E/Space/Enter -- the same textbox every
  conversation in the game already uses. `{name}` anywhere in a line is replaced with `recipient`.
- `photos`: **order matters** -- they play in this order, cross-fading, holding a few seconds each,
  looping. `file` is just the filename inside `assets/card/photos/`, not a full path. `caption` is
  optional; leave it out (or empty) for no caption on that photo. A `file` that doesn't actually
  exist in the folder falls back to the placeholder illustration for that one slide (its caption
  still shows), rather than breaking the rest of the slideshow.
- `album` (W2, the memory album): up to 3 photos, one per LUG key in this order: the Physics Lab key, the
  ICL key, the Room 195 key. Each key she finds unlocks its polaroid on the Journal's Album page (J, then
  Tab); `file` is again a name inside `assets/card/photos/`, `caption` is optional (a default like "Memory 1:
  the Physics Lab key" shows without one). Left out, or a missing file, a slot is a placeholder polaroid
  ("A memory for you"): nothing breaks. Once all three keys are found, the card's slideshow also plays the
  album's photos after the `photos` (a file listed in both plays once). Square-ish or landscape photos fit
  the polaroid window best (it crops to fill).

### The credits (after the card, built 2026-10-03, ADR 0019)

After the card's last message (and the closing video, if any) the credits scene
(`src/scenes/credits.js`) plays, then returns to the title. On a calm dusk sky with twinkling stars and
slowly drifting hearts and confetti: "Happy Birthday, Taru" (the recipient), then "Happy 22", then
about eight wishes fading in one at a time (about 3 s each, 30 s in all), then "THE END" and "Made
for you by Mustafa" (about 42 s overall). Esc/Space/Enter skips ahead to THE END (and, once THE END is up,
back to the title); the card's music keeps playing. "Watch the Card Again" replays the card and then
the credits. The wishes shipped in `src/credits.js` are generic placeholders; the owner replaces them
with `wishes` in card.json. Content and pacing live in `src/credits.js` (`DEFAULT_CREDITS`,
`buildCreditsConfig()`, `creditsTimeline()`).

## Open questions for the owner

- Where exactly are the **Physics Lab**, the **ICL** and **Room 195**? A photo or a description of
  each would make those three rooms real instead of guessed. No public floor plans exist (checked
  2026-09-20: official site, prospectus PDF, Wikipedia, 2GIS, Google).
- Where is the real **main entrance (Gate 2)**? Still assumed (FB-0022).
- The card's real photos, video and final wording -- see "How to put your photos and messages in"
  above; the game plays fine on placeholders until then.

## Small choices made building the playable spine (M3, 2026-09-22)

The rooms/entrance above are still open questions, so the story spine (the volunteer, the 3 keys,
the gating) had to pick *something* real to stand on. Flagging what was decided, so the owner can
correct any of it once the real answer is known:

- **Room placement**: the Physics Lab moved to the 3rd floor (was a 2nd-floor guess); ICL and
  Room 195 are two of the 1st floor's plain "50 Seater Classroom" rooms, renamed (ICL refurnished
  as a computing lab, Room 195 left as a classroom) -- see docs/INTERIORS_PLAN.md "Story rooms" for
  exactly what changed. The room is the **ICL** (Intelligent Computing Lab); the owner corrected an earlier placeholder name (FB-0070).
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
  always names the first *actually missing* key, in the Physics Lab -> ICL -> Room 195 order.
- **The box opening and the birthday card were built 2026-09-22** -- see "The box and the birthday
  card (the ending)" above; at the time this M3 spine was first written they were still a later
  milestone, noted here only so the history of this decision log stays honest.
