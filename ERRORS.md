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

## ERR-0007 — The walk animation was mirrored: "I look like I'm walking left when I'm walking right" (2026-09-26)

**Symptom:** Owner feedback (FB-0043): moving right made the lead's sprite look like she was facing
and walking left, and vice versa -- moving either direction looked backwards ("moonwalking").

**Context:** `tools/make-assets.js` builds the player/NPC sheets (ADR 0013) by cropping frames out of
LimeZu's `Amelia_idle_16x16.png` / `_run_16x16.png` / `_idle_anim_16x16.png` source sheets, each of
which lays four directions out as four columns/blocks. The original FB-0025 pass wrote down a
comment about that layout ("column/block 0 is a side profile... 2 is the *other* side profile, a
mirror of 0") and built the game's own sheet as 3 rows (down/up/"left", with "left" sourced from
block 0), then had `src/scenes/world.js` mirror that same row with `flipX` for "right".

**Root cause:** the comment's claim was never checked against the actual pixels -- it assumed block 0
and block 2 were a mirrored pair (a common convention in some packs) rather than decoding the source
PNGs and looking at where the face/skin pixels actually sit in each column. They aren't a mirrored
pair: block 0 is a genuine, separately-drawn RIGHT-facing pose and block 2 is a genuine, separately-
drawn LEFT-facing pose. Building "left" from block 0 baked a right-facing frame in under the wrong
name, and then mirroring *that* for "right" produced a left-facing-looking frame for the direction
that was supposed to be right -- both directions ended up wrong, which is exactly the "moonwalking
both ways" the owner described (not a single flipped sign, which would only have broken one direction).

**Fix:** decoded the source sheets and measured which column's skin/face pixels lean into which half
of the frame before writing any mapping down again (see `tests/unit/assets.test.js`'s "FB-0043" test,
which checks exactly this against the committed PNG). `CHAR_ROWS`/`CHAR_DIR_INDEX` (tools/make-
assets.js) now build 4 real rows -- down/up/left/right, `right: 0, up: 1, left: 2, down: 3` -- and
every consumer (`src/scenes/world.js`, `src/minigames/framework-scene.js`, `platformer.js`/
`flappy.js`) plays the matching real row instead of mirroring one row with `flipX`; the player sprite
is never flipped at all now.

**Recognise it next time:** a sprite-sheet layout comment that describes column/block N as "the other
side, mirrored" (or any other structural claim about a vendor pack) without a note saying it was
actually decoded and looked at → don't trust it; open the source PNG (`tools/lib/png-decode.js`
already exists for exactly this) and check where the identifying pixels (face, a logo, an asymmetric
detail) actually land before writing the mapping down. "It moved but looks backwards/mirrored" for a
character sprite specifically → suspect a mislabeled or wrongly-mirrored source column before assuming
a simple `flipX`/velocity-sign bug.

## ERR-0008 — Any door/stairs into a building crashed WorldScene.create() the first time it ran (2026-09-28)

**Symptom:** After merging the Main Block interiors rebuild (40x40 floors) alongside the campus art
rebuild, `npm test`'s first full round found campus.spec.js's "walk up to the Main Block entrance"
and interiors.spec.js's "walking into the Main Block..." both timing out in `waitForMap()`
(tests/e2e/helpers.js), never actually reaching `main-block-g`. A `pageerror` the test wasn't
printing (added a temporary listener to see it) showed the real failure: `TypeError: Cannot read
properties of undefined (reading 'width')` inside Phaser's own `GetTileAt`, called from
`WorldScene.buildDepthGroups` (src/scenes/world.js), thrown during `create()` -- i.e. the *first*
frame of the interior map, before the player/camera/input setup after it ever ran. The scene was
left permanently inactive (`world.sys.isActive()` false, `player.active` false), which every test
after that point read as "never arrives" since `waitForMap()`'s own `ready` check requires both.

**Context:** ADR 0015's depth groups bake every non-`ground` tile layer, including the `overhead`
layer (tree canopies, ADR 0008) when the current map's own Tiled data has one -- `buildMap()` only
ever *assigns* `this.overheadLayer` inside `if (overheadDef) { ... }`; there is no matching `else`
branch, and `init()` (which runs on every `this.scene.restart()`, since `WorldScene` restarts *in
place*, not as a fresh instance) never reset it either. The campus has tree canopies (an `overhead`
layer); every interior (the newly-rebuilt Main Block floors included) does not.

**Root cause:** walking from the campus (which sets `this.overheadLayer` to a real, live
`TilemapLayer`) through a door into any interior (which never reassigns it, since that map has no
`overhead` layer of its own) left `this.overheadLayer` pointing at the *previous* map's now-destroyed
layer object -- `this.scene.restart()` tears down every display object from the old `create()` run,
but a plain instance property survives on the same, reused `WorldScene` instance. `buildDepthGroups()`
still unconditionally included it in `bakeLayers` (`this.overheadLayer ? [this.overheadLayer] : []`
read the stale truthy reference) and called `.getTileAt()` on it, which reached into the destroyed
layer's internals and threw. Any interior reached directly from the campus hit this on its very first
load; interiors.spec.js's floor-to-floor stairs (interior → interior, both without `overhead`) never
did, which is why only the entry step failed.

**Fix:** `init()` now sets `this.overheadLayer = null` unconditionally, every restart, so
`buildMap()`'s own `if (overheadDef)` is the *only* thing that can make it non-null again -- a map
without that layer always starts this field clean instead of inheriting whatever the previous map
left behind.

**Recognise it next time:** a scene that restarts *in place* (`scene.restart()`, not a fresh
instance) and has a field only ever assigned inside a conditional branch (`if (someLayerExists) {
this.x = ... }`, no `else`) → that field can leak the previous run's now-destroyed value into a run
where the condition is false. `init()` must reset every such field unconditionally, the same way
`buildMap()`'s *un*conditional fields (`this.map`, `this.solidLayers`, `this.mapObjects`, ...) never
have this problem simply by always being reassigned. A crash inside `create()` itself (not a gameplay
bug reachable later) reads, from the outside, as "the scene never became active/ready" -- exactly
what a `waitForMap()`/`waitForBoot()` timeout looks like -- so check for an uncaught `pageerror`
before assuming a slow transition or a bad door/spawn placement.

## ERR-0009 — Every door out of a building froze for 5+ real seconds; most e2e tests were quietly this slow the whole time (2026-09-28)

**Symptom:** Once ERR-0008's crash was fixed, interiors.spec.js's Main Block round trip still failed
`waitForMap('campus')` at its final step (walking back out onto campus) -- but this time not from a
crash: `state(page).ready` genuinely became true, just roughly 5.3 real seconds after
`tests/e2e/helpers.js`'s `waitForMap()` had already given up at its 5s poll timeout. The same
underlying cost was hiding in plain sight in every other test too (added timing instrumentation
around `buildMap()`/`buildDepthGroups()` to confirm): the real campus map's *first* load (every
single spec's `openGame()`) paid the exact same ~5.3s, just absorbed inside Playwright's much longer
default timeouts, so nothing before this looked broken -- it just made the whole suite unnecessarily
slow.

**Context:** The campus art rebuild (FB-0027/0028/0029) gave the real campus map 244 real
`depthGroup` objects (buildings, trees, palms, signboards, ...), ~28k tiles baked across 2 layers
(~56k individual tile blits) by `WorldScene.buildDepthGroups()` (ADR 0015, src/scenes/world.js).
tests/e2e/performance.spec.js's own synthetic-250-groups test predates this and still passed
throughout, because its budget (15s for a *whole page load*, including real asset decode) was
generous enough to swallow the cost without anyone isolating it.

**Root cause:** each tile blit called `RenderTexture.drawFrame()`, which is a convenience method that
does its own `beginDraw()`/`batchDrawFrame()`/`endDraw()` -- a full render-target bind, draw, flush
and unbind -- *per call*. That's negligible for a handful of calls (a single group, or the old
"campus has no real groups yet" state this code was originally written and budgeted for), but at
~56k individual calls it measured at 5.3+ real seconds of synchronous main-thread work, every single
time `buildMap()` runs: the initial page load, *and* every `this.scene.restart()` a door/stairs warp
makes when it lands back on campus, since that re-runs `buildMap()` -> `buildDepthGroups()` from
scratch. For a real player this is a multi-second freeze on every door out of any building onto
campus, not just a test-timing artifact.

**Fix:** batch each group's own blits instead of flushing per tile: one `rt.beginDraw()` before the
group's nested tile loop, `rt.batchDrawFrame()` (identical signature to `drawFrame()`, just deferred)
inside it, one `rt.endDraw()` after. Same pixels, same tile-frame API, no visible behaviour change --
measured at ~100-200ms for the real campus's 244 groups afterward (confirmed by reverting the fix
and re-running: 5522ms without it, in `tests/e2e/performance.spec.js`'s new
"bake in well under a second" test, which asserts a 2s budget -- generous, but nowhere near the old
5s+). This also shaved several seconds off nearly every e2e test's own `openGame()`, since campus is
the default start map for most specs.

**Recognise it next time:** any code that calls a Phaser `RenderTexture`'s `draw()`/`drawFrame()` (or
`stamp()`) in a loop, especially one bounded by map/content size rather than a small fixed count →
check whether `beginDraw()`/`batchDraw()`/`batchDrawFrame()`/`endDraw()` exist on that Phaser version
(they've existed since 3.60) and batch the loop instead of calling the single-shot convenience method
per iteration. A "severe regression" performance test with a generous, whole-page-load budget (here,
15s) can hide a real per-operation regression indefinitely if nothing isolates the specific operation
that got expensive -- prefer measuring the specific expensive call directly, with a tighter budget,
alongside (not instead of) the coarser end-to-end smoke test.

## ERR-0010 � Every opening screen froze ~0.5 s on entry; a second Esc/Enter skipped the next screen (2026-10-03)

**Symptom:** First full browser run: intro.spec.js "typed name", "typing straight over the pre-filled
default" and "chosen clothes colour" failed (name field stayed TARU, `pressUntil(ArrowRight)` never saw
the colour change). Passed alone, failed in the suite.

**Root cause:** `buildCampusPanBackdrop()` (title/greeting/name/customize) parsed the whole 534x341 campus
(546k tiles, 3 layers) with `make.tilemap` in every scene: ~200 ms parse + render, 400-900 ms from Esc to the
name screen being active. `pressUntil(page, 'Escape', name-entry active)` re-presses after 700 ms, so the
second Esc landed on the name screen (Esc = accept) and skipped it; every later key went to the customize
screen. A real player tapping Esc twice would skip a screen the same way.

**Fix:** src/scenes/opening-backdrop.js builds a cropped copy of the map (tour spots plus half a screen of
margin, ~45x40 tiles), cached under `map-campus-backdrop`; name screen is now active ~310 ms after Esc.
Covered by the three intro specs above.

**Recognise it next time:** a keyed test that passes alone and fails in the suite, with state "one screen
ahead" -> look for a slow scene transition plus a re-pressing helper.

## ERR-0011 � A shy cat ran 1 tile instead of 2-4 (2026-10-03)

**Root cause:** `animalFleePoint()` returned the first angle that had *any* walkable length, so a straight-away
line that hit a fence-post row after 1 tile produced a 1-tile hop even though a clear 4-tile run existed
a little to the side.
**Fix:** src/animals.js tries every angle and takes a full-length run at once, otherwise the longest.
Tests: tests/unit/animals.test.js "ERR-0011" (2) and campus-life.spec.js "a shy cat runs a short way off".

## ERR-0012 � HUD timer specs flaked: quest tracker pill, hotbar auto-hide (2026-10-03)

**Root cause:** not a game regression (also flaky on commit 10dd30f). Phaser `delayedCall` timers run
~10-15% slower than the wall clock at the ~50 fps headless Chromium manages, and the specs gave a 3 s timer
only 3.2 s (fixed sleep) / 4 s (`expect.poll` sampling at 1 s steps).
**Fix:** tests/e2e/hud-layout.spec.js waits for the state with an 8 s poll budget (TESTING.md rule 5); the
assertions are unchanged.

## ERR-0013 � Room 195's key station was unreachable on foot; students could seal the ICVL; story playthrough timed out (2026-10-03)

**Symptom:** story.spec.js "LUG treasure hunt" hit the 30 s test timeout (it takes ~26 s on a quiet machine).
Chasing the "ambient student in front of a story object" suspicion with a new geometric test
(tests/unit/story-clearance.test.js) found two real soft-locks:
1. **Room 195** (Main Block 1st floor): the classroom generator put extra desks on *both* side rings at
   every other row, cutting each ring at every desk row, so the teacher's desk (key station, 24,5) was 8
   tiles from the nearest reachable tile. The third key could not be collected by walking.
   Fix: tools/interiors/build-interiors.js keeps the left ring clear (desks only on the right ring);
   `npm run interiors` regenerated assets/maps/main-block-1.json (+ preview PNG). Nothing else changed.
2. **ICVL**: idle student `mb1-amb-icvl-1` stood on (4,7), the only way into the ICVL closet (immovable
   collider). Also `mb3-amb-bench` stood 2.2 tiles from the Physics Lab desk inside a 1-tile corridor.
   Fix: src/ambient.js moved them (to (6,11) and (9,20)).
**Rule now tested:** idle/chat students and talkable cats stay >= 2 interact ranges from story NPCs/key
stations, off doors/stairs/route stops, and never seal a station/NPC/door off (4-neighbour BFS).
**Fix for the timeout:** story.spec.js `test.setTimeout(90_000)`; assertions unchanged.

## ERR-0014 — The birthday card's message box never typed (2026-10-04)
**Symptom:** qa:shots `ending-05/06` and the offline playthrough showed an empty cream message box under the card photo; `dialog.typing` stayed true with an empty body for 8+ s.
**Cause:** `DialogBox` only types text and bobs its arrow from `DialogBox.update(time, delta)`. `src/scenes/cutscene.js` calls it from its own `update()`; `src/scenes/card.js` built a DialogBox but had no `update()` at all, so the box stayed blank until a key forced the whole line (advance() skips typing). e2e only asserted `dialogOpen`, so nothing caught it.
**Fix:** `card.js` gets `update(time, delta)` calling `this.dialog.update`; unit test in tests/unit/card.test.js: every scene that builds a DialogBox (except ui.js) must call `this.dialog.update(time, delta)` from `update()` (fails without the fix). Verified in the offline bundle: the body reads "Happy Birthday, Taru!".
**Lesson:** a screenshot sweep finds "empty" states that the logic tests treat as healthy; look at the ones marked "unsure".
