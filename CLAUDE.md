# CLAUDE.md

Start with [HANDOFF.md](HANDOFF.md), then [CONTEXT.md](CONTEXT.md), then the last few entries of [MEMORY.md](MEMORY.md),
[ERRORS.md](ERRORS.md), and [decisions/](decisions/). Follow the project-memory routine: log each
work chunk in MEMORY.md and checkpoint with `scripts/checkpoint.ps1 "<summary>"`.

- **BUILD FIRST, THEN TEST (owner rule, 2026-09-27): follow [docs/QUALITY_LOOP.md](docs/QUALITY_LOOP.md).**
  While features are being built: unit tests only, no game servers, browsers, Playwright runs,
  screenshot scripts or pushes, and nothing left running in the background. Once the whole flow is
  built, one full test round, then the quality loop: each run tests ONE category, rates it against
  the rubric in the scorecard, fixes that category, and repeats. This overrides "done = tried in the
  running game" below during the build phase.
- The owner wants the agent to make design and technical choices on its own. They review the
  playable result and ask for changes, so ship something playable, then ask for feedback.
- Art lives in `tools/make-assets.js` as text sprites. Edit it there and re-run `npm run assets`.
  Never hand-edit the PNGs in `assets/`.
- At the start of every session, and when the owner says "check feedback", run `npm run feedback`
  and follow [docs/FEEDBACK.md](docs/FEEDBACK.md). Ask through the feedback thread when an item is
  unclear; don't build on a guess.
- **Feedback fixes are implemented by Sonnet subagents** (Agent tool, `model: "sonnet"`, self-contained
  briefs). The main agent triages, monitors, reviews diffs, runs tests, checks the game, marks items fixed
  and checkpoints. It doesn't write the fix code ([docs/FEEDBACK.md](docs/FEEDBACK.md)).
- A change is done when `npm test` passes ([docs/TESTING.md](docs/TESTING.md)) and it has been tried
  in the running game (`npm start`, http://localhost:8080). Every feedback fix gets a regression test
  named `FB-XXXX: ...`.
- Follow [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (content is data, the engine is code) and
  [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) for every new asset. Build in the phase order of
  [docs/GAME_PLAN.md](docs/GAME_PLAN.md). Don't invent the story: the owner writes it.

## Knowledge graph (graphify)

A code + docs knowledge graph is built and lives in [graphify-out/](graphify-out/): `graph.json`
(queryable), `GRAPH_REPORT.md` (god nodes, communities, suggested questions), `graph.html`
(interactive; open in a browser). Built 2026-10-03: 2,250 nodes, 4,073 edges, 117 communities.

- **Use it before grepping** for "how does X work / what calls Y / what connects A to B":
  `graphify query "<question>"`, `graphify path "A" "B"`, `graphify explain "X"`. If the `graphify`
  command isn't on PATH, use the interpreter in `graphify-out/.graphify_python` with `-m graphify`.
  Skim `GRAPH_REPORT.md` first for the community map.
- **Scope:** `.graphifyignore` excludes `assets/`, `vendor/` and `node_modules/`. The 95 reference
  screenshots (docs/research, feedback/screenshots) are not in the graph. Large docs (STYLE_GUIDE, STORY,
  MEMORY, ERRORS, research) were only skimmed by headings.
- **Refresh** after big code changes with `/graphify . --update` (AST only for code, cheap). Don't rebuild
  from scratch unless asked. Treat the graph as a map; verify in the source before editing.
- Reviewed findings (hub nodes, low-cohesion generator scripts, `ui.js` size) are in
  [docs/GRAPH_NOTES.md](docs/GRAPH_NOTES.md): none is a bug.
