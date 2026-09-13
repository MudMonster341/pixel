# CLAUDE.md

Start with [CONTEXT.md](CONTEXT.md), then the last few entries of [MEMORY.md](MEMORY.md),
[ERRORS.md](ERRORS.md), and [decisions/](decisions/). Follow the project-memory routine: log each
work chunk in MEMORY.md and checkpoint with `scripts/checkpoint.ps1 "<summary>"`.

- The owner wants the agent to make design and technical choices on its own. They review the
  playable result and ask for changes, so ship something playable, then ask for feedback.
- Art lives in `tools/make-assets.js` as text sprites. Edit it there and re-run `npm run assets`.
  Never hand-edit the PNGs in `assets/`.
- At the start of every session, and when the owner says "check feedback", run `npm run feedback`
  and follow [docs/FEEDBACK.md](docs/FEEDBACK.md). Ask through the feedback thread when an item is
  unclear; don't build on a guess.
- A change is done when `npm test` passes ([docs/TESTING.md](docs/TESTING.md)) and it has been tried
  in the running game (`npm start`, http://localhost:8080). Every feedback fix gets a regression test
  named `FB-XXXX: ...`.
- Follow [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (content is data, the engine is code) and
  [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) for every new asset. Build in the phase order of
  [docs/GAME_PLAN.md](docs/GAME_PLAN.md). Don't invent the story: the owner writes it.
