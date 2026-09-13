# Testing

Every push runs the full test suite: locally before the push leaves your machine (pre-push hook),
and again on GitHub (Actions). If the suite is red, nothing ships.

## Running tests

```bash
npm test                                         # everything: unit, then browser
npm run test:unit                                # ~1 second: data, maps, inventory, dialog, assets, feedback store
npm run test:e2e                                 # ~1.5 minutes: plays the real game in Chromium
npx playwright test tests/e2e/house.spec.js       # one file
npx playwright test --headed                     # watch the tests play
npx playwright show-trace test-results/<test>/trace.zip   # step through a failure frame by frame
```

First time on a new machine: `npm install` then `npx playwright install chromium`.

## The two layers

| Layer | Files | What it checks | Tool |
|---|---|---|---|
| **Unit** | `tests/unit/*.test.js` | Rules and content without a browser. Every map is valid and everything on it is reachable; inventory stacking; NPC dialog outcomes; generated art is up to date; feedback store workflow | `node:test` (built into Node) |
| **Browser (e2e)** | `tests/e2e/*.spec.js` | Real gameplay with real key presses. Boots without errors; movement and collisions; pickups and slots; doors; talking to NPCs; tutorial; minimap; dev feedback overlay | Playwright + Chromium |

- Unit tests load the `src/` scripts into a sandbox (`tests/helpers/game-data.js`), fresh for each test.
- Browser tests start their own server on port 4173 with a throwaway feedback folder, and read game
  state through `window.game` and `GameState` (`tests/e2e/helpers.js`).

## Where tests run

- **Before every push:** `.githooks/pre-push` runs `npm test`. `npm install` switches the hook on
  (the `prepare` script sets `core.hooksPath`).
- **On GitHub:** `.github/workflows/test.yml` runs on every push and pull request. When it fails,
  the Playwright report and traces are uploaded as a downloadable artifact.

## Rules

1. **New feature → tests in the same change.** At least one browser test that plays the feature,
   plus unit tests for its rules and data.
2. **Every fixed feedback item gets a regression test named after it**:
   `test('FB-0007: door works when approached from the side', ...)`. Pass the test name to
   `npm run feedback -- fix FB-0007 --test "<file> › <name>"`.
3. **Every bug in ERRORS.md names the test that now covers it.**
4. **Test behaviour, not pixels.** Use tile coordinates and game state, not screenshot comparisons.
   The art will keep changing.
5. **No fixed sleeps for outcomes.** Wait for state with `expect.poll`. Movement distances get
   wide margins, because frame timing varies between machines.
6. **Maps are checked automatically.** A new map gets the tile, reachability and door checks without
   writing a new test.
7. **Never skip the hook or delete a failing test to get a push through.** Fix it, or ask.
