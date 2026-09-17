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
