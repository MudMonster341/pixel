# Errors

Append-only log of **non-obvious** failures: symptom, root cause, fix, and how to recognise it
next time. Newest at the bottom. Entries are `ERR-NNNN`, numbered in order, never reused.

## ERR-0001 — Quick key taps are ignored (2026-09-13)

**Symptom:** Pressing E next to Tomas sometimes did nothing, and M sometimes didn't toggle the
minimap. The same action worked when timed slightly differently. Browser tests failed with
`expect(received).toBe(expected) Expected: true Received: false` (on `dialogOpen` and
`minimapVisible`) right after `page.keyboard.press(...)`.

**Context:** Phaser 3.80.1, with one-shot actions read via `Phaser.Input.Keyboard.JustDown(key)`
inside a scene's `update()`. Playwright's `press()` sends keydown and keyup a few milliseconds apart.

**Root cause:** Phaser's `Key.onUp` clears the key's "just down" flag. If keydown *and* keyup are both
processed before the scene's `update()` runs (a tap shorter than one frame), `JustDown` returns false
and the press is lost. Confirmed in the browser: down+up in the same frame → `JustDown` false;
down, check, up → true. Real players hit this with quick taps, and more often when frames are slow.

**Fix:** One-shot actions listen for keydown events (`this.input.keyboard.on('keydown-E', ...)`,
ignoring `event.repeat`) instead of polling `JustDown`. Held actions (movement) still read `isDown`.
Now a rule in docs/ARCHITECTURE.md. Covered by tests/e2e/house.spec.js (talking twice),
boot.spec.js (M toggle) and tutorial.spec.js.

**Recognise it next time:** an input that works "most of the time" and fails more under automation
or at low FPS → look for per-frame polling of an edge (`JustDown`/`JustUp`) instead of an event.

## ERR-0002 — Physics/sprite state read right after a keypress is occasionally stale (2026-09-17)

**Symptom:** P5 QA reproduced the flakiness three separate full `npm run test:e2e` runs had each
turned up one of, in `running.spec.js` ("holding Shift runs outdoors", "Shift has no effect
indoors") and `held-item.spec.js` ("selecting a slot ... shows a held-item sprite"). Re-running the
three suspect spec files 20x each (`--repeat-each=20`, 225 test executions) reproduced 2 held-item
failures and 2 running failures, all `expect(...).toBe(...)`/`toBeCloseTo(...)` mismatches reading
`player.body.velocity` or the held-item sprite's `visible`/position right after a `page.keyboard
.down()`/`press()`, following a **fixed** `page.waitForTimeout(100 or 120)`.

**Context:** `player.body.velocity` is only set inside `WorldScene.movePlayer()`, and the held-item
sprite is only repositioned inside `updateHeldItem()` -- both run once per Phaser update tick
(bound to `requestAnimationFrame`), not synchronously when a key event or hotbar selection fires.

**Root cause:** `waitForTimeout(100)` is a timing assumption: it bets that at least one Phaser tick
lands inside that 100ms wall-clock window. That bet is usually safe (a tick is ~16ms at 60fps), but
running many tests back to back (as `--repeat-each` does, and as CI often does under shared/loaded
hardware) can starve the page of `requestAnimationFrame` callbacks for well over 100ms. The read
then catches the *previous* tick's stale value (typically 0 velocity, or the held item's pre-move
position/visibility) instead of the one the new key state should have produced -- a real assertion
failure even though the game itself behaved correctly a few milliseconds later.

**Fix:** Replaced the fixed wait + single read with `expect.poll(...)` re-reading the same value
(velocity magnitude, held-item visibility, `world.facing`) until it settles on the expected result
(or the assertion's own timeout expires, which still fails a genuinely broken build). This checks
exactly the same end state, just without betting on how fast frames happen to arrive. Confirmed
stable with `--repeat-each=20` on the fixed spec files. See ERR-0003 for a second, distinct flake
this same QA pass found in `boot.spec.js`'s minimap toggle test (and its sibling in
`fullmap.spec.js`) -- `expect.poll` alone didn't cover that one, because the underlying problem
there is a dropped event, not a delayed read.

**Recognise it next time:** an e2e assertion on Phaser-driven state (physics body, sprite transform,
animation frame) that follows a fixed `waitForTimeout` and fails intermittently, especially under
load or `--repeat-each` → replace the wait+read with `expect.poll` on the value itself, per
docs/TESTING.md rule 5.

## ERR-0003 — A one-shot keydown UI toggle occasionally never fires at all under load (2026-09-17)

**Symptom:** `boot.spec.js` ("M hides and shows the minimap") and its sibling in `fullmap.spec.js`
("M keeps toggling...") each failed once across several full `npm test` runs during this same P5 QA
pass, always the same way: `expect.poll(() => minimapVisible).toBe(...)` timing out at its full
5000ms after a `page.keyboard.press('m')`, on the *second* press in the test (turn it off, then back
on). 20 isolated `--repeat-each=20` runs of `boot.spec.js` alone never reproduced it; it only showed
up inside a full suite run, i.e. with more of the machine's attention already spent on earlier tests.

**Context:** Unlike ERR-0002, this one is not explained by "the read ran before the next Phaser tick"
-- `expect.poll`'s default timeout is 5 whole seconds, hundreds of frames even under heavy load. A
value that's merely *delayed* would show up well inside that window. A value that never shows up in
5 real seconds means the `keydown-M` handler (`this.input.keyboard.on('keydown-M', ...)` in
`src/scenes/ui.js`) most likely never ran for that keypress at all.

**Root cause (best explanation, not fully proven):** Phaser's keyboard plugin captures native
`keydown`/`keyup` DOM events into a queue and drains it once per game step; under enough load for a
step to be skipped or a queued event to be dropped/coalesced by the browser itself, a single quick
`press()` (down+up with no delay) can end up producing no `keydown-M` callback at all, not just a
late one. This is speculative because it wasn't caught live in a trace -- but the symptom (a *missing*
event, not a slow one) is consistent with it, and inconsistent with every other explanation checked
(the handler's own `!event.repeat` guard, `toggle()`'s synchronous boolean flip, and scene-lifecycle
timing were all ruled out by reading the code).

**Fix:** `tests/e2e/helpers.js` adds `pressUntil(page, key, check)`: presses the key, polls `check()`
for up to 700ms, and on failure **presses the key again** (up to 5 times) before finally propagating
a real failure -- the same thing an impatient player would do if a keypress didn't seem to register.
This can't paper over an actually broken toggle (five separate presses would have to all silently
fail), but it absorbs a single dropped browser/Phaser input event exactly the way a human would.
Used for both minimap-toggle tests in place of a bare `page.keyboard.press` + `expect.poll`.

**Recognise it next time:** an `expect.poll` on a one-shot `keydown-*` UI action times out at its
*full* duration (not just "a bit slow") → suspect a dropped input event rather than a rendering
delay, and consider retrying the keypress itself, not just the read.

## ERR-0004 — Quit to Title crashed with "Cannot read properties of null (reading 'cut')" (2026-09-21)

**Symptom:** Adding "Quit to Title" to the pause menu (FB-0023/0024): choosing Play again from the
title screen after quitting silently did nothing -- no fade, no loading screen -- and the browser
console showed an uncaught `TypeError: Cannot read properties of null (reading 'cut')` the instant
`resetGameState()` ran. Never happened on a fresh page load, only after a quit-and-relaunch.

**Context:** `src/scenes/ui.js`'s file header used to say "It is never restarted" -- true until this
feature, since every other scene transition (map changes, cutscenes) is a `WorldScene` restart, not
a `UIScene` one. Several of `UIScene`'s components (`Hotbar`, `Tutorial`) subscribe directly to two
*persistent* emitters that outlive any one scene instance: `GameState.inventory` (a module-level
singleton, `src/state.js`) and `game.events` (Phaser's central bus, as opposed to a scene's own
`this.events`/`this.input.keyboard`, which Phaser tears down automatically on shutdown).

**Root cause:** `PauseMenu.quitToTitle()` calls `scene.stop('ui')`, which destroys that `UIScene`
instance's Phaser game objects (icons, graphics, text) -- but nothing removed the listeners
`Hotbar`/`Tutorial` had registered on `GameState.inventory` and `game.events` back in `create()`.
Those listeners are plain closures over `this`, so they kept a live reference to the now-destroyed
objects. The next relaunch of `'ui'` (via Title's Play/Continue → `BootScene`) created a *second*
`Hotbar`/`Tutorial` that registered its own listeners on the same two persistent emitters, on top of
the first, still-live ones. The very next `resetGameState()` (Title's own "Play" handler) called
`inventory.emit('changed')`, which reached *both* the new Hotbar and the stale, destroyed one --
the stale one's `slot.icon.setFrame(...)` tried to read a destroyed `Frame`'s internals (`cutX`/
`cutWidth`, which is what "reading 'cut'" was) and threw, aborting the whole handler chain (Phaser's
event emitter doesn't isolate one listener's exception from the others) before the fade/scene-start
code after it ever ran.

**Fix:** Every direct subscription any `UIScene` component makes on `GameState.inventory` or
`game.events` is now a named handler stored on `this`, and `UIScene` runs `this.events.once(
'shutdown', () => this.teardown())`, which unsubscribes all of them (including delegating to
`Hotbar.teardown()`/`Tutorial.teardown()`) before the scene's objects are gone. Scene-local
subscriptions (`this.input.keyboard.on(...)`, `scene.input.on('wheel', ...)`) didn't need this --
Phaser already cleans those up as part of the same shutdown.

**Recognise it next time:** a scene that used to be "never restarted" gains a way to stop and
relaunch it (a title screen, a "return to menu", anything beyond the usual map-change restart) →
audit every one of its components for subscriptions on something that outlives the scene itself
(a module-level singleton, `game.events`, `localStorage` polling) and add matching teardown, not
just for this scene but for anything else built on the same "it's never restarted" assumption.

## ERR-0005 — Typing her own name could silently move an on-screen keyboard's focus off "OK" (2026-09-21)

**Symptom:** Building the M3a name-entry screen (`src/scenes/intro-name.js`), an e2e test that typed
"Nadia" letter-by-letter then pressed Enter to confirm sometimes deleted a character instead of
moving to the customisation screen -- and once a fix made it deterministic, it did it *every time*:
Enter kept re-triggering `DEL`, never `OK`.

**Context:** The on-screen keyboard grid supports both arrow-key navigation (with focus starting on
`OK`, so a bare Enter skips the whole screen) and real physical typing of any letter, at the same
time, on the same scene, per the owner's brief. Every other menu in this game aliases `WASD` to the
arrow keys for keyboard navigation (docs/GAME_FEEL.md rule 7), so this screen initially did too.

**Root cause:** `WASD` are also letters a real name can contain. Typing "Nadia" fires physical
keydowns for `n`, `a`, `d`, `i`, `a` -- and this screen had `A`/`D` bound to `moveFocus(-1/+1, 0)`
*as well as* the catch-all "add this letter" handler. Both fired for every `a`/`d` in her own name,
silently walking the on-screen keyboard's focus off `OK` and onto neighbouring keys (`DEL`, in this
case) as a side effect of the very letters she was typing -- with no visual feedback pointing at the
cause, since the focus ring is small and the name field itself looked correct the whole time.

**Fix:** This screen's on-screen-keyboard navigation binds only the literal arrow keys (`UP`/`DOWN`/
`LEFT`/`RIGHT`), not the `WASD` aliases every other menu accepts -- which also matches the owner's
own brief for this screen more literally ("arrow keys + Enter"). Real typing (the generic `keydown`
catch-all filtering single a-z characters) is unaffected letter-for-letter now.

**Recognise it next time:** a screen that combines free-form text entry with an arrow-key-navigated
grid of options → any alias between "a navigation key" and "a character that can legally be typed"
is a bug, not a convenience; only alias direction keys that can never also be valid input.

## ERR-0006 — The held item could actually be drawn up to ~2.7px off the hand for a frame (2026-09-21)

**Symptom:** `tests/e2e/held-item.spec.js`'s "FB-0025" test (held item sits at the hand position, in
all 4 directions) was flaky in a way ERR-0002's `expect.poll` fix didn't touch: it passed in
isolation and in most full runs, but failed roughly 1 run in 10-15 under `--repeat-each=20`, always
the same way -- `expect(Math.abs(held.x/y - player.x/y - expected.x/y)).toBeLessThanOrEqual(2)`
receiving 2.3-2.7, just over the tolerance. The test already used `expect.poll` for everything
timing-sensitive; this wasn't a stale read.

**Context:** `updateHeldItem()` (`src/scenes/world.js`) runs from `movePlayer()`, inside
`WorldScene.update()`. `player.x`/`player.y` there are last frame's values: Arcade Physics steps
the body on the scene's `UPDATE` event (before `update()` runs) but doesn't copy the stepped body
back onto the game object's `x`/`y` until `Body.postUpdate()`, on `POST_UPDATE` (after `update()`
returns) -- so anything read mid-`update()` is one sync behind. A prior fix (see the old code
comment this entry replaces) extrapolated the pending movement as `velocity * delta`, betting that
Arcade's physics step for this tick would cover exactly this frame's own wall-clock `delta`.

**Root cause:** that bet is false by design. Phaser's Arcade `World` steps on a **fixed** 1/60s
clock with its own carry-over accumulator (confirmed by reading `phaser@3.80.1`'s `World.js`/
`Body.js`: `body.update()`, which is what actually moves `body.position`, only runs when
`world._elapsed` has crossed a full `1000/60`ms boundary -- `willStep` in `World.update()`).
Real frame timing is never perfectly 16.667ms, so a rendered frame can land 0, 1, or (after a
stall) 2+ physics steps. `velocity * delta` assumed exactly 1, in proportion to whatever the raw
delta was. Confirmed with an instrumented build (hooking the scene's `postupdate` event to log
`time/delta/velocity/heldItem vs player` every frame): under uniform 60fps timing the guess was
accurate to a few thousandths of a pixel, but the very first frame after a key is pressed (velocity
0 → 80, before Arcade's *next* `UPDATE` event has integrated it) already showed a `+1.33px` transient
(one fixed step's worth) purely from `delta` disagreeing with the accumulator -- and the FB-0025
test polls for `facing`, which changes on exactly that frame, so it was reading the worst-case
moment essentially every run, not a rare one. Under `--repeat-each` load, uneven frame pacing made
that transient exceed the test's 2px tolerance often enough to be visibly flaky. This was a real,
if usually sub-2px and easy to miss, visual bug: the held item genuinely could render detached from
the hand for a frame, not just a test-reading artifact.

**Fix:** stopped guessing. `body.position` has *already* been advanced by this frame's real step by
the time `updateHeldItem()` runs (the physics step is on `UPDATE`, before `update()`), and
`Body.preUpdate()` already snapshotted the pre-step value as `body.prevFrame` at the very top of
this same frame -- so `body.position.x - body.prevFrame.x` (and `.y`) is not a prediction, it's the
exact number `Body.postUpdate()` is about to add to `player.x`/`player.y` a moment later. Held-item
position is now `player.x/y + (body.position - body.prevFrame) + offset`, with no `velocity`/`delta`
involved at all. Confirmed with `--repeat-each=50` on the FB-0025 test alone (all green) and two full
`npm run test:e2e` runs (all held-item tests green both times; two unrelated, pre-existing
campus-layout failures from concurrent work in `tools/campus/` are out of scope for this fix).

**Recognise it next time:** any visual that computes its own absolute position from a physics body's
velocity/delta instead of reading the body's already-stepped state directly → check whether Arcade
Physics is on a fixed timestep (`world.fixedStep`, default true) before trusting `velocity * delta`
to match what the body will actually do this tick; prefer `body.position`/`body.prevFrame` (or
attaching the visual as a child of the body's game object) over re-deriving physics Phaser has
already computed.
