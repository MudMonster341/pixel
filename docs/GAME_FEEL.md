# Game feel: the Pokemon-class standard

**Status:** v1, written 2026-09-20 for FB-0023 (the controls card overflowed its box and blocked the
start of the game) and FB-0024 ("study the whole game design of Pokemon... that premium feeling").
This file is the standard every future UI task is checked against — a panel that violates a rule
here is a bug, the same way a map with an unreachable pickup is a bug (docs/TESTING.md rule 6).
Change it deliberately, the same way as docs/STYLE_GUIDE.md: edit this file and say why in MEMORY.md.

Research method: played/studied Gen 3-5 Pokemon (FireRed/Emerald/HeartGold/Black) for *structure* —
screen flow, menu shape, pacing, how controls are taught — never copying any Nintendo art, text, or
music. Nothing in this codebase reproduces Pokemon's assets; what's reused is the *grammar* (a title
screen has a menu; a textbox has a blinking arrow; a new mechanic gets a hint the first time it
matters), which is common to the whole genre, not Nintendo's property.

## What "premium" actually means here

Watching Pokemon closely, "premium" isn't one big thing, it's the absence of small annoyances,
stacked up:

- **The game never dumps information you can't use yet.** Pallet Town teaches walking by making you
  walk downstairs to progress, not by showing you a control card first. A mechanic is taught at the
  exact moment it becomes relevant, once, and then never mentioned again.
- **Nothing is a flat instant cut.** Screens fade, textboxes and menus have a slide or a beat of
  timing, the title's "PRESS START" blinks instead of just sitting there. Motion is small and quick,
  never showy.
- **The player is never blocked without a reason.** A card that must be dismissed before you can
  move (the old FB-0023 controls card) is exactly the kind of friction Pokemon avoids: even its own
  title-screen menu appears as a natural continuation of pressing Start, never as a wall.
  Historically the *real* Pokemon games do gate the very first minutes (no main menu exists until a
  save is created, "New Game" is forced through a full name-entry flow), which is a monetisation/
  identity mechanic this game has no reason to copy — our version keeps the spirit ("teach, don't
  block") and drops the friction that doesn't serve a gift.
- **Every box knows its own size.** A Pokemon textbox is always the same shape because the game
  writer respects the box's line/character limit; nothing in a real Pokemon UI overflows its own
  frame, because the frame is the constraint content is written to fit, not sized after the fact
  (which is exactly what FB-0023 got backwards: content first, then a fixed box too small for it).

## The flow, boot to gameplay

```
index.html
   │
   ├─ ?title=0 (tests, and any future "skip intro" preference) ──────────────┐
   │                                                                          │
   ▼                                                                          │
TITLE SCREEN (src/scenes/title.js, scene key 'title')                        │
  "BITS DUBAI" + "The LUG Treasure Hunt" over a slowly panning, dimmed        │
  campus illustration. Two stages, never both on screen (owner feedback:     │
  showing the prompt and the menu together said the same thing twice):       │
    intro: a blinking "PRESS ENTER" only                                     │
    menu (Enter/Space/click reveals it, replacing the prompt): a panel       │
      (docs/STYLE_GUIDE.md panel style, opaque -- so it never has to fight   │
      the illustration underneath for legibility) listing                   │
        Play                                                                 │
        Continue (only if a save exists; shows roughly where it left off)    │
        Controls                                                             │
        Credits                                                              │
  Arrows/W-S + Enter, or mouse click. Controls/Credits open as overlays      │
  on top of the title, Esc/Enter closes them back to the menu.                │
   │ Play → resetGameState()          │ Continue → loadGame(profile)          │
   ▼                                  │                                       │
THE M3a OPENING (`?intro=0` skips straight to LOADING, same as `?title=0`     │
skips TITLE -- see "The M3a opening" below) ─────────────────────────────────▶│
   │                                                                          │
   ▼                                                                          │
LOADING SCREEN (src/main.js BootScene, scene key 'boot') ◀─────────────────────┘
  Logo, "LOADING...", a progress bar driven by Phaser's real loader
  (this.load.on('progress', ...) — never a guessed duration). Shown for at
  least MIN_LOADING_MS even if everything's cached, so it can't flash by in
  a single frame (only applies on the title path; ?title=0 skips the wait,
  since automated tests want the fast boot, not the polish).
   │
   ▼
WORLD + UI (src/scenes/world.js, src/scenes/ui.js)
  WorldScene fades its camera in from black (250ms) — that fade is what
  actually hides the scene handoff, so nothing before it needs its own
  fade-out. The player can move immediately. No modal card. The first
  relevant hint (see below) appears within moments, once, and fades away.
```

`?title=0` (the default in `tests/e2e/helpers.js` `openGame()`) skips straight to the loading
screen and then the world, exactly as the game booted before this file existed — the ~65 other
specs don't need to know the title screen exists at all. Only `tests/e2e/title.spec.js` turns it
back on.

### Pause, from anywhere in the world

```
Esc (world, not mid-dialog) → PAUSE MENU (src/scenes/ui.js PauseMenu)
    Resume        → Esc/Enter, back to the game exactly as it was
    Controls      → the same panel the title screen shows (ControlsPanel)
    Save          → writes the save now, toasts "Game saved!" (or "Saving is
                    off" under ?save=0)
    Quit to Title → stops every gameplay scene, returns to the title screen
    Quit Game     → (FB-0075) tries window.close(), then the goodbye screen
                    (src/scenes/goodbye.js): "Thanks for playing! You can close this
                    tab or window now." + Back to title (Enter/E/Space/Esc/click).
                    The title menu's own "Quit" (always its last entry) does the same.
```

Controls: Enter, E and Space all do the same thing wherever a message advances or a choice is picked
(FB-0045) -- one key handler per scene, so one press is never used twice. Whenever a blocking screen opens
(dialog, journal, map, pause menu, a script, a door walk, a mini-game, the feedback panel) the player stops
at once, idle in the direction she faces; held keys resume movement after it closes (FB-0072).

Esc's full priority order in `UIScene`: the full-screen map closes first if it's open (that's an
older, still-valid rule), then Pause owns Esc, except while a conversation is on screen — you can't
pause mid-dialog, same as you can't in Pokemon either.

## The M3a opening (owner brief, 2026-09-21, docs/STORY.md "Opening"; reworked 2026-09-27, ADR 0016)

Title's "Play" (new game only -- "Continue" skips straight to loading, she's already named and
dressed) chains through three menu-like scenes, each its own file in `src/scenes/intro-*.js`, each
crossfaded (not a black flash) over the same live campus-pan backdrop every one of them shares
(`src/scenes/opening-backdrop.js`, FB-0032) -- then the bus arrival and the Gate 2 "Mustafa meets her"
beat play *in-world* (WorldScene's own script runner, ADR 0016, docs/ARCHITECTURE.md "In-world
cutscene scripts"), not as further scenes in this chain:

```
'greeting' → 'name-entry' → 'customize' → 'boot' (playOpening:true) → 'world' (SCRIPTS.opening)
```

- **`greeting`**: Mustafa's portrait + the game's own dialog box (reused from ui.js) -- a handful of
  short lines, skippable.
- **`name-entry`**: real typing *and* an on-screen keyboard grid (arrows + Enter, or a click), a
  default name so a single Enter/Esc accepts it and moves on, letters/spaces only, 10 characters.
- **`customize`**: a live, animated preview of her actual sprite, clothes-color swatches (left/right
  or click), a default so it's skippable the same way. Confirming hands off straight to `boot` with
  `{ playOpening: true }`, which rides through to `WorldScene.init()` (src/main.js).
- **The bus + Mustafa, in-world**: `WorldScene.create()` runs `SCRIPTS.opening` (src/scripts.js) the
  moment `this.playOpening` is set -- a real bus sprite drives in on the actual Gate 2 road, she steps
  off, it pulls away, then Mustafa (a script actor, not a placed map NPC) walks up and greets her,
  walks her up the avenue, and the camera pans to the Main Block entrance and back before handing
  control over. The *same* beat (`SCRIPTS.gate2`) plays from the existing Gate 2 map trigger for
  anyone who reaches it another way (`?intro=0`, an old save, or just walking up under her own steam)
  -- one beat, two ways to trigger it, never duplicated.

`?intro=0` skips the greeting/name/customize chain straight to `boot` (no `playOpening` flag, so the
in-world bus/Mustafa beat doesn't run automatically either -- she still meets Mustafa the normal way,
by walking into the Gate 2 trigger), the same shape as `?title=0` skips the title screen:
`tests/e2e/helpers.js` `openTitle()` sets it off by default, only `tests/e2e/intro.spec.js` turns it
on. Every scene in the chain follows the same skip rule as everything else in this file (rule 7
below): Esc always accepts whatever's currently chosen/typed and moves to the next scene, never a dead
end; Esc during the in-world bus/Mustafa script fast-forwards it to its own end state instead (ADR
0016's own `ScriptRunner.skip()`), the same "never a half state" promise.

## "A little 3D": the rules this pass settled on (owner brief 2026-09-21)

The owner's words: *"currently it looks very blocky and 2D, a little 3D please."* Four concrete
techniques, applied consistently rather than once on one screen, so later work matches:

1. **Every panel gets a 1px inner bevel.** `drawPanel()` (src/scenes/ui.js) now draws a faint light
   line along its own top/left inside the border and a faint dark line along the bottom/right, on top
   of the existing drop shadow and cream border -- because every panel in the game already calls
   `drawPanel()` (dialog box, pause menu, minimap, credits, the title's own menu background), this one
   change lifts the whole game's UI at once, consistent with STYLE_GUIDE.md's "one light source,
   top-left" rule for every other asset.
2. **Buttons are a real widget, not styled text.** `drawButtonState()`/`class Button` (src/scenes/
   ui.js): a drop shadow, a bevelled edge (inverted when pressed, so it reads as pushed in), and three
   states (normal/hover/pressed) that mouse and keyboard both drive into the same drawing code -- a
   keyboard Enter gets the same press-then-release visual a click does (`Button.flashPress()`). Used
   for the title screen's whole menu (the owner's specific ask: "big buttons... drawn properly").
3. **Parallax, not one image panning alone.** The title screen's backdrop is two layers moving at
   different speeds: the existing Gate 2 illustration panning slowly (unchanged), and a new
   silhouette strip (`assets/cutscenes/title-fg.png`, palms + a fence line) scrolling sideways faster,
   underneath the menu. Two speeds is what makes it read as depth instead of a flat, moving picture.
4. **Ground shadows and forced perspective everywhere a character or a building stands.** The player
   and every NPC now cast a soft ellipse shadow (`WorldScene` `playerShadow`/per-NPC shadow), matching
   what pickups already did (STYLE_GUIDE.md "Drop shadows"). Every cutscene illustration
   (`tools/make-cutscenes.js`) narrows its road/steps toward the horizon rather than drawing them a
   constant width -- the same forced-perspective trick the original Gate 2 scene already used for its
   avenue, now also used for the new entrance scene's steps.

Motion follows the rest of this file's existing rule (never a flat instant cut): every tween added in
this pass uses an easing curve (`Cubic.easeOut` to decelerate into a stop, `Cubic.easeIn` to
accelerate away, `Sine.easeOut` for a short hop), never `Linear`.

## One UI kit, HUD declutter and dialog polish (2026-09-27/28, roadmap M2, quality category 4)

Every panel/button in the game (dialog, menus, tracker, banners, mini-game cards) used to be hand-drawn
`Graphics` rectangles (`drawPanel()`/`drawButtonState()`, `src/scenes/ui.js`). They're now a real 9-slice
frame recolored from the Kenney Pixel UI Pack (CC0, CREDITS.md's own "UI kit" entry), generated by
`tools/make-assets.js` into `assets/ui-panel.png`/`ui-icons.png` and never hand-edited (this file's own
rule, CLAUDE.md) -- `makePanel()`/`Button` build a Phaser NineSlice from it, so every existing caller
got the new look without its own layout math changing. (FB-0073: the frame is the pack's WHOLE 48x48 art
at 2x -- 96x96 per frame, a 4 px border on all four sides; an earlier 45 px crop dropped the right and
bottom edges of every panel. `tests/unit/ui-frame.test.js` reads the PNG and simulates the 9-slice.) A gold cursor sprite (`makeCursor()`) replaces
the old "> " text prefix in every keyboard-driven list (the pause menu, the Controls/Sound rows, dialog
choices, mini-game cards); the dialog box's "next line" arrow is now a real sprite that bounces
continuously (a small y-bob) instead of blinking, still never appearing before the line finishes typing.

The HUD itself was decluttered around this same kit: `hudLayout(width, height)` (`src/maplogic.js`) is
the one pure function every top-level HUD box (minimap, location banner, hint, quest tracker, hotbar)
reads its own position from -- unit-tested (`tests/unit/hud-layout.test.js`) for no overlap and staying
on screen at 960x540/1280x720/1920x1080, proving rule 2 below instead of just asserting it. What
changed: the minimap shrank to a ~120x90 map area with its caption tucked inside (was 160x120 plus a
separate caption row); the hint banner moved bottom-center above the hotbar (was stacked under the
location banner, see the hint table below); the quest tracker is now a compact single-line pill
("Keys 1/3 · Find the ICL, 1st floor"), expanding to the full objective for ~3s only when the
objective text itself changes; the hotbar fades out after ~3s idle while genuinely empty and fades
back in the instant an item's added or a slot's picked (never while it holds something).

## In-fiction hints replace the controls card (FB-0023)

The old design showed one card listing every control before the player could take a single step —
the thing the owner's screenshot caught overflowing its own box. The new design teaches nothing
until it matters, the way Pallet Town does:

| Hint | Shown when | Text |
|---|---|---|
| `move` | The instant she's placed into a controllable world | WASD / ARROWS TO MOVE |
| `talk` | The first time any NPC is ever in interact range | PRESS E TO TALK |
| `run` | The first time she's anywhere running is even possible (outdoors) | HOLD SHIFT TO RUN |
| `map` | The first time she leaves the area she started in | PRESS M FOR THE MAP |
| `menu` | Right behind `map` (FB-0075): the pause menu is where Save / Quit to Title / Quit Game live | ESC FOR THE MENU |

Rules, all enforced by `HintBanner` in `src/scenes/ui.js`:

- **Shown at most once, ever**, tracked in `GameState.seenHints` (a `Set`, saved and restored like
  everything else — see `docs/ARCHITECTURE.md` "State, saving"). The event that would trigger a
  hint can fire any number of times (every map load re-checks `move`/`run`, for instance); only the
  first one where the id isn't already in `seenHints` does anything.
  callers don't need to track "have I shown this" themselves.
- **Fades in, holds, fades out** — 300ms fade, ~2.6s hold, 300ms fade (`HINT_FADE_MS`/`HINT_HOLD_MS`
  in `src/scenes/ui.js`), never a hard cut, matching the "nothing is a flat instant cut" rule above.
- **Never covers the player.** The player is always near the middle of the screen (the camera
  follows her). **Moved bottom-center, above the hotbar, in the HUD declutter pass (2026-09-27)** —
  was stacked directly under the location banner near the top of the screen; now sits right next to
  the thing it's teaching (WASD/E/Shift/M all matter down where she's about to press them), via
  `hudLayout()`'s own `hint` box (`src/maplogic.js`), the same numbers a unit test checks for overlap
  against the hotbar/banner/tracker/minimap at 3 screen sizes (`tests/unit/hud-layout.test.js`).
- **Queued, not stacked.** If two hints become relevant close together, the second waits for the
  first to finish rather than overlapping it.

A future hint (a mini-game's own controls, say) is just one more entry in the `HINTS` table plus one
`game.events.emit('hint', 'newId')` call at the moment it matters — no new UI code.

## Concrete, testable UI rules

Every rule below is something an e2e test can assert on directly (docs/TESTING.md rule 4: behaviour
and bounds, not pixels).

1. **A panel's box is sized from its content, never the other way around.** Compute height as
   `header + rows.length * rowHeight + footer` (see `ControlsPanel`, `Tutorial.buildChecklist()`),
   not a fixed number tuned to today's row count. This is what makes FB-0023 structurally impossible
   to reintroduce: there is no fixed height left to overflow.
2. **No panel may overflow its own frame**, at 960×540 or at any real window size. The internal UI
   coordinate space is always exactly 960×540 (Phaser `Scale.FIT` + `CENTER_BOTH` letterboxes the
   real window around it, `docs/STYLE_GUIDE.md` "UI canvas") — a panel that fits at 960×540 fits at
   every size, by construction. A test still checks it at a couple of other sizes, because "by
   construction" is a claim, and claims get tested.
3. **Panel margins:** 16px from the screen edge for a corner panel (minimap, tutorial checklist —
   already the rule, unchanged), centered with equal margins on all sides for a modal panel (pause,
   controls, credits, the title's own overlays).
4. **Dialog text:** at most 3 lines per page, wrapped to the box's own width
   (`docs/STYLE_GUIDE.md`, unchanged) — roughly 40-45 characters per line at the game's 16px body
   size before wrapping kicks in. Typing speed is 45 characters/second (`CHARS_PER_SECOND`,
   `src/scenes/ui.js`), matching a Pokemon textbox's brisk-but-readable pace; the ▼ arrow blinks at
   2.5 Hz once the line has finished typing, never before.
5. **Transitions:** a map change fades 250ms to black and back (unchanged,
   `docs/STYLE_GUIDE.md`). The loading screen holds at least `MIN_LOADING_MS` (400ms) so it can't
   flash by unseen, but never invents a delay beyond what real loading needs on a slow connection —
   the progress bar always reflects `this.load`'s real progress, never a fake animation.
6. **A hint or toast never blocks input.** Only a modal (dialog, pause, the full-screen map, the
   title's Controls/Credits overlay) is allowed to block movement (`UIScene.isBlocking()`), and a
   modal blocks by being the *only* input the player would want to give, never as an interruption —
   nothing modal opens itself without the player asking for it (the old controls card broke exactly
   this rule by opening unasked on every fresh load).
7. **Every screen is reachable by keyboard alone**, mouse click is always an addition, never the
   only path: menus take arrows/W-S + Enter/Space, panels close on Esc or Enter.
8. **Nothing flashes faster than 3 times a second** (unchanged, `docs/STYLE_GUIDE.md`) — the
   blinking "PRESS ENTER", the dialog arrow, and a selected menu row's highlight all sit well under
   that (2-2.5 Hz).

## Mini-games (roadmap M4)

Each of the 3 key mini-games (docs/STORY.md, `src/minigames/`) is its own little game, but it has to
read as *this* game's UI wrapped around it, not a different one bolted on. Rules this pass settled on:

- **The shared shell reuses this game's own furniture, not new art.** The intro/game-over/win cards
  (`src/minigames/framework-scene.js` `MinigameCard`) are built from `drawPanel()`/`uiText()`/`COLORS`
  (`src/scenes/ui.js`) -- the exact same panel a dialog box or the pause menu uses, sized from its own
  content (rule 1 below, unchanged). A player shouldn't be able to tell a mini-game's cards were built
  by different code than the rest of the UI.
- **A mini-game's own "hero" is the lead herself** (art pass, coordinator brief 2026-09-22):
  the flyer (and the retired platformer) draw a real `this.add.sprite(x, y, 'player', frame)`
  (`ensurePlayerAnims()`, `src/minigames/framework-scene.js`) using the exact texture
  `src/scenes/world.js` does, walk/idle animations and all -- not a stand-in shape. Because that
  texture is loaded once, at boot, under whichever clothes-colour swatch she actually picked
  (`src/main.js` BootScene), a mini-game never needs to know her colour itself: it just reuses the
  one texture the game already loaded, and gets the right one for free. **Quality-loop pass
  (2026-09-29, Mini-games category rated 4/10, "the hero is a speck"):** that sprite is now drawn at
  `HERO_SCALE` (`src/minigames/framework-scene.js`, 3x -- matching the main game's own `ZOOM`) via a
  plain `sprite.setScale()`, since it used to render at native 16x24 size on the mini-game canvas and
  read as tiny. The level geometry and physics constants for both games were retuned to match (see
  `src/minigames/platformer.js`'s own file header) rather than left at their old numbers.
- **Retrying is exactly one keypress, never a menu to navigate into first.** The game-over card's item
  list always starts with Retry highlighted (`MinigameCard.show()`'s `index = 0`), so ENTER alone
  retries -- rule 7 below (keyboard first) plus this task's own brief. Skipping to another item
  (Quit, or the skip gift) still only takes an arrow press or two, never more.
- **The skip offer is a gift, not a defeat screen.** After 3 losses, "SKIP -- TAKE THE KEY ANYWAY"
  appears on that same game-over card (docs/STORY.md "nobody may be locked out") -- it's an addition
  to the existing Retry/Quit list, not a different, harsher screen replacing them, and its own win
  card still says "KEY GIFTED!" rather than reusing the real win's "YOU GOT IT!" text, so it's
  honestly a different, still-celebratory outcome, not a hidden downgrade.
- **Esc always quits back to the game, from anywhere in a mini-game** (the intro, mid-play, or a
  card) -- consistent with this file's existing "every screen reachable by keyboard alone" and
  "nothing modal traps you" rules; it never asks for confirmation, the same as skipping a cutscene.
- **A mini-game never eats the world's own fade.** `MinigameBaseScene.finish()` fades out/in exactly
  like `src/scenes/cutscene.js`'s `outro()` does (250ms, `Cubic`-free plain fade, matching "map change:
  250ms fade to black and back") -- launching and returning never look like a hard cut.

### The art/juice pass (coordinator brief, 2026-09-22)

The mechanics landed first and read as "flat shapes on black" -- premium needs a room, not just a
rule set. What changed:

- **Each game gets a themed, generated backdrop**, not black: `tools/make-minigame-art.js` (same
  technique as `tools/make-cutscenes.js` -- a tiny Img/PNG writer, no dependencies) draws a 960x540
  illustration per game (the Physics Lab's benches/shelves/a tank under warm lamps, the ICL server
  room's racks-and-cable-trays under cold blue light, Room 195 at night with a whiteboard/desks/a
  skyline window) and each scene loads its own, pinned with `scrollFactor(0)` so it never needs to
  tile across a scrolling level. `npm run assets` regenerates it; `tests/unit/assets.test.js` checks
  it's committed and up to date, the same rule every other generated-art file already follows.
- **Foreground furniture is drawn to match its room**, not left as flat colored bars: the
  hero fight's platforms are steel scaffold decks with legs, a grating and a hazard stripe, painted into its rooftop backdrop from the
  rules (`tools/make-minigame-art.js` reads `HV_PLATFORMS`); the flyer's obstacles are server racks with a cold highlight
  edge and small LEDs that blink independently of each other (`applyBlink()`, each LED's own random
  `invert` flag, well under the 3Hz flash limit below) instead of a flat grey column.
- **A mini-game card is sized from its *wrapped* content**, not just its paragraph count
  (`MinigameCard.show()`): a long instruction line is measured and wrapped the same way
  `src/scenes/ui.js` DialogBox wraps its own typewriter text, *before* the panel's height is
  computed -- the fix for a real overflow this pass first shipped with (a long instruction line
  drawing straight past the card's own edges), not a hypothetical rule.
- **Juice, all added at the framework level** so all 3 games get it for free, none of them draw it
  themselves: a small scale-pulse on the shared score HUD whenever the score goes up
  (`MinigameBaseScene.setScore()`), a small camera shake on a loss (`lose()`, `shake(160, 0.006)` --
  felt, not jarring), a bounced-in real key icon (`ITEMS[def.item]`, the same Kyrise art a key
  station's own pickup uses) on the win card, and the card's own fade-and-ease-up entrance described
  above. The platformer-style games (the hero fight, the tower) add one effect only they need -- a landing puff
  (`spawnDustPuff()`, shared in `framework-scene.js` so a future game can reuse it too).
- **The tower climb (Room 195, FB-0074) is gentle and telegraphed**: three hearts, slow hazards (about
  80 px/s), a jump that clears one comfortably (a window of about 200 ms), and a wobble plus a puff on
  the gargoyle 0.7 s before every throw. A hit is a blink (2.5 Hz, under the 3 Hz limit) and a short
  invulnerability with one light red pulse over the screen, never a knockback to the start. The win is a
  short closing beat (the prince leans out, the chameleon goes green, pink, green, a heart pops) before
  the shared win card; a round that runs past 150 s counts as a win, so nobody is stuck.
- **The hero fight (Physics Lab, FB-0066) is intense but gentle and telegraphed**: three hearts and a 1.5 s blink after a hit, slow bolts
  (190 to 230 px/s), the shadow bat takes 9 hits, and every volley (an aimed bolt, another, a 3-bolt fan, a slow sweep) starts with a 0.6 s
  wind-up: he raises his arms, a ring swells round him once, and a shield bubble shows (the shield is also up for 1.8 s after a hit, so a
  shot at a bubble does nothing: "bubble up: dodge, bubble down: shoot"). He hovers low for the aimed bolts and rises for the fan and the
  sweep, so she has to hop onto a platform to hit him. The minion is one shot; it drops one heart per round. After the last hit he
  slumps and says "Fine, fine. Take it." (1.8 s), the key drops, she walks to it. The left mouse click shoots, Z too (FB-0081; the shell's card keys stay Enter, Space, E,
  Up, Down, W, S), the cover picture sits behind the intro card, and nothing flashes faster than 2.5 Hz.

## Daylight: the golden hour (wow idea W4, with W9's dust)

The light on the campus moves from morning to dusk as the three keys are found, so the hunt feels like one long day. It is a mood, never a
barrier: text, the UI, the mini-games, the ending and the cutscenes are untouched (the tint lives only in `WorldScene`, which is drawn under
`UIScene`), and the world never drops below **85 % brightness** at any phase.

| Keys held | Phase | Outdoors |
|---|---|---|
| 0 (stage arrival) | **morning** | a hair of warm, clear air: almost nothing |
| 1 | **midday** | neutral and crisp: no overlay is drawn at all |
| 2 | **golden hour** | warm amber, a soft vignette, a glow on the street lamps, 6 drifting dust motes |
| 3, or the box handed over (stage `rewarded`) | **dusk** | pink-orange sliding to violet, a deeper vignette, stronger lamp glow, 8 motes |

- **Pure part, `src/daylight.js`** (tested in `tests/unit/daylight.test.js`): `dayPhase(keys, stage)` / `dayPhaseFromQuest(quest)` (the phase is
  derived from state, so Continue and old saves need no new save field), `daylightParams(phase, indoors)` (tint, alpha, vignette, halo, motes,
  warm), `lerpParams`, the brightness floor (`daylightBrightness()`, `DAYLIGHT_MIN_BRIGHTNESS`), the lamp scan `findLightSpots()` and the dust
  motes' drift. All the numbers live in `DAYLIGHT_TABLE`.
- **Drawn by `WorldScene` (`createDaylight()`)**: one full-screen camera-fixed rectangle with the MULTIPLY blend mode (screen colour becomes
  screen x (1 - alpha + alpha x tint), which WebGL and Canvas agree on), depth 2,000,000 so it covers even the tree canopies (1,000,000); a
  vignette image (a cached radial-gradient canvas texture, normal blend); additive soft halos on the street lamps' heads (`lampPostTop`) and the
  foyer chandeliers (`intChandelier`), found by scanning the map data; up to 10 additive dust motes (outdoors only, a cheap loop, no physics).
  Textures are canvas-generated once and cached; nothing is interactive; nothing allocates per frame. The lab's cyan light bars are left alone
  (they already glow).
- **Indoors** it is a gentler version: the overlay at 40 % of the outdoor alpha (same warm tint), half the vignette, softer halos on the
  chandeliers, no dust.
- **Transitions**: on a new scene (a warp, Continue) it snaps to the phase of the quest; when the quest changes (a key found, the box handed
  over: `state-changed`, and `collectKeyStation()`) the numbers ease (smoothstep) to the new phase over 2.5 s, advanced from `update()` before its
  "transitioning" early return so a key-room beat does not freeze the light, with a wall-clock failsafe (4.5 s) that lands exactly on the target.
- **Switch**: `?daylight=0` builds none of it (`daylightEnabled()`). `tests/e2e/helpers.js` sets it for every spec (`daylight: true` opts in).
- **Looking at it without a browser**: `node tools/preview-daylight.js [out.png] [--map campus] [--crop x0,y0,w,h] [--scale 2] [--indoor]`
  renders a real map crop four times (morning, midday, golden hour, dusk) with the game's own colour maths into one strip PNG.

## The birthday finale: the cake, the candles, the fireworks (wow idea W3, with W9's skyline)

The ending's celebration, between the box and the card (docs/STORY.md "The box and the birthday card"). The feel rules it follows:

- **No hard cut at either end.** It starts from the warm light the box ends on (a full-screen 0xfff1a8 cover that fades out over 0.9 s) and leaves by
  a camera fade to black into the card (which fades in from black as before). A failsafe timer guarantees the hand-off; a hard stop at 60 s guarantees
  the scene ends whatever happens.
- **HOLD to blow, and the world answers at once.** The candles are the interaction, so nothing skips them: the 22 flames go out one at a time (about
  136 ms each while a key is held; the whole cake takes ~3 s), each flame leans away from her and flickers harder the longer she blows, a thin wisp of
  smoke rises from each one that goes out, and a soft "pff" plays (at most one per 100 ms). Releasing pauses (the flames settle upright, the blown-out
  ones stay out). The held state comes from keydown/keyup (and the pointer), never from key repeat, and is cleared on window blur.
- **Nobody is stuck.** A hint ("Hold SPACE to blow!") pulses after 8 s without progress; after 20 s the rest go out by themselves. The wish / flash /
  fireworks run on a fixed schedule; the skip (Esc, Enter, Space, E, a click) works from 2 s into the fireworks, never earlier, and a key still held down from
  the candles (a repeat event) never skips.
- **The celebration is calm, pretty and finite.** 15 bursts in the pastel palette of the credits (sparks 24-40 per burst, rings, hearts, a triple at the
  end), cheap closed-form particles (no physics, at most ~100 alive, ~300 shapes a frame at the peak), windows of the skyline flicker, soft hearts and
  sparkles drift all through, confetti falls during the show, balloons bob. Nothing flashes faster than the warm flash (0.45 s, once).
- **Pure logic, code-drawn art.** Rules, schedule, the seeded firework show and the failsafes are `src/finale.js` (no `Math.random`); the drawing is
  shape lists in `src/finale-art.js` (rects / ellipses / circles) replayed onto Graphics, the static parts baked into three textures once; the sky is
  the credits' dusk (`CREDITS_SKY_STOPS`, pinned by a test). The song and the effects are synthesized by `tools/make-audio.js` (tune data in
  `tools/lib/happy-birthday.js`). Tests: `tests/unit/finale.test.js`.
- **Looking at it without a browser:** the layout was checked by rasterising the same shape lists onto an RGBA buffer (`tools/lib/png.js`) and opening the PNG
  (a throw-away script: the candle phase, a blowing frame and two firework frames). The real thing needs a look in a browser (`npm run qa:shots` has
  the finale frames `ending-03b..d`).

## Selfie (wow idea W6)

P takes a selfie, only in free control (the same "does anything own the screen?" test the moments use, plus 0.3 s of free control; anything else, including a
second P while one is running, is a silent no-op). It never freezes her. The sequence is under 1.6 s: one white flash (a single fade, gentler with reduced motion)
with a shutter click, a tilted polaroid card sliding up in the bottom-left corner ("Selfie, <map name>"), the toast "Selfie saved", and a PNG download named
`selfie-<map>-<n>.png` (a 4:3 crop of the game view around her, pulled halfway towards the friends within about 6 tiles, magnified 2x, on a white polaroid frame).
The renderer's snapshot includes every scene, so the UI scene is hidden for exactly the one frame that is captured and shown again on `postrender`: the HUD is
not in the picture. If the browser refuses the download the card still shows and the toast says "Selfie taken (couldn't save a file here)". Everything it makes is
destroyed when it ends or when the scene shuts down (with a scene-clock and a wall-clock failsafe). `?selfie=0` turns it off (e2e specs do). Code: `src/selfie.js`,
tests: `tests/unit/selfie.test.js`.

## What to check before calling a new screen "done"

Beyond `npm test` green and a look with `npm run qa:shots` (docs/TESTING.md, docs/QA_PLAN.md):

- Read the panel's own box (`{x, y, w, h}`) back in a test and assert every text object's bounds sit
  inside it — don't eyeball a screenshot for overflow when the box's own numbers can prove it.
- Try it at 960×540 and at least two other window sizes.
- Confirm it opens only from an action the player took (a keypress, a click, a real trigger) —
  never on a timer, never unconditionally on boot.
