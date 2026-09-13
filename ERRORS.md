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
