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
  Big pixel logo + subtitle, a slowly panning campus illustration,            │
  a blinking "PRESS ENTER", and a menu:                                       │
    Play                                                                      │
    Continue (only if a save exists; shows roughly where it left off)         │
    Controls                                                                  │
    Credits                                                                   │
  Arrows/W-S + Enter, or mouse click. Controls/Credits open as overlays       │
  on top of the title, Esc/Enter closes them back to the menu.                │
   │ Play → resetGameState()          │ Continue → loadGame(profile)          │
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
    Quit to Title → stops world/ui, returns to the title screen
```

Esc's full priority order in `UIScene`: the full-screen map closes first if it's open (that's an
older, still-valid rule), then Pause owns Esc, except while a conversation is on screen — you can't
pause mid-dialog, same as you can't in Pokemon either.

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

Rules, all enforced by `HintBanner` in `src/scenes/ui.js`:

- **Shown at most once, ever**, tracked in `GameState.seenHints` (a `Set`, saved and restored like
  everything else — see `docs/ARCHITECTURE.md` "State, saving"). The event that would trigger a
  hint can fire any number of times (every map load re-checks `move`/`run`, for instance); only the
  first one where the id isn't already in `seenHints` does anything.
  callers don't need to track "have I shown this" themselves.
- **Fades in, holds, fades out** — 300ms fade, ~2.6s hold, 300ms fade (`HINT_FADE_MS`/`HINT_HOLD_MS`
  in `src/scenes/ui.js`), never a hard cut, matching the "nothing is a flat instant cut" rule above.
- **Never covers the player.** The player is always near the middle of the screen (the camera
  follows her). The hint pill sits at a fixed screen position, `y = 64`, clear of both the location
  banner above it and the tutorial checklist panel to its right (`x` 320–640, checklist starts at
  `x = 644`) — nowhere near the middle of the screen at any point.
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

## What to check before calling a new screen "done"

Beyond `npm test` green and a look with `npm run qa:shots` (docs/TESTING.md, docs/QA_PLAN.md):

- Read the panel's own box (`{x, y, w, h}`) back in a test and assert every text object's bounds sit
  inside it — don't eyeball a screenshot for overflow when the box's own numbers can prove it.
- Try it at 960×540 and at least two other window sizes.
- Confirm it opens only from an action the player took (a keypress, a click, a real trigger) —
  never on a timer, never unconditionally on boot.
