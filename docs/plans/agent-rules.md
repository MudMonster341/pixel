# Rules for every build agent (read this first)

You are a Sonnet agent building one package of the BITS Dubai pixel game (Phaser 3, plain script tags, no build step; Node is only tooling).
The game is a private birthday gift. The coordinator (the main agent) briefs you, reviews your diff, runs the tests, commits and logs. You write the code.
You cannot see the game: use the screenshots named in your brief (open them with the Read tool: it shows images), the generators' preview PNGs, and the tests.

## Before you start
1. Read `CLAUDE.md`, then the sections of `docs/ARCHITECTURE.md` (content is data, the engine is code) and `docs/TESTING.md` that touch your files.
2. Open every screenshot your brief names, and read the owner's exact words with `node tools/feedback.js show FB-00xx`.
3. A knowledge graph is in `graphify-out/`: `graphify query "<question>"`, `graphify explain "<name>"`, `graphify path "A" "B"` find code faster than grepping. Do not rebuild it.

## Hard rules
- **Work directly in the main checkout.** Do NOT commit, push, branch, stash or reset. Leave the working tree with your changes only.
- **No servers, browsers, Playwright runs, screenshot scripts or background processes.** The only check you run is `npm.cmd run test:unit`
  (PowerShell blocks `npm.ps1`; or `node --test "tests/unit/*.test.js"`). It must be fully green when you finish. You may run one-off `node` scripts that read files.
- **Art:** free packs only (FB-0025). Never hand-draw art and never hand-edit PNGs in `assets/` or the generated maps. Art lives in the generators
  (`tools/make-assets.js` text sprites and pack crops/recolours, `tools/make-minigame-art.js`, `tools/campus/`, `tools/interiors/`, `tools/make-animals.js`);
  edit the generator and re-run it (`npm.cmd run assets`, `npm.cmd run campus`, `npm.cmd run interiors`). Raw packs are in `assets/vendor/` and
  `assets/External Tilesets/` (git-ignored). Any pack you start using must be CC0/CC-BY/explicitly permissive (check the licence file), and gets a line in
  `CREDITS.md` and `docs/research/asset-packs.md`. Protected characters (Hello Kitty, Batman, Pokemon...) are never drawn: use generic stand-ins.
- **Tests:** every owner-feedback fix gets a regression test whose name starts with `FB-00xx:` (the id from the brief) in `tests/unit/*.test.js` (node:test).
  Prefer pure-logic tests and source/data assertions (the repo already does this, see `tests/unit/card.test.js`). Add an e2e spec in `tests/e2e/` only when
  nothing else can pin the behaviour; you cannot run it, so keep it small and say so in your report. Never weaken or delete a test to get green; if an
  intended behaviour change breaks an existing test, update that test and say why.
- **Soft-lock guards stay.** `tests/unit/story-clearance.test.js` and `tests/unit/completeness.test.js` encode "every door/NPC/key station is reachable, no room is empty".
  Keep them green; extend them when you add rooms/doors/NPCs.
- Keep the story as written in `docs/STORY.md` (do not invent story). Texts are short, warm, a little funny. No profanity, nothing mean about real people.
- Match the surrounding code: comment density, naming, idiom. Content is data (maps.js, story.js, ambient.js, campus-facts.js), the engine is code.
- Windows: use forward slashes in node scripts, `path.resolve` for file checks. Leave nothing running.
- Do not touch `feedback/`, `MEMORY.md`, `HANDOFF.md`, `CONTEXT.md` (the coordinator does). Do add an `ERRORS.md` entry only if you hit a non-obvious bug.

## When you finish, report (plain text, short)
1. What changed per feedback id (files). 2. Tests added (names) and the final `test:unit` count. 3. Decisions you made that the owner could disagree with.
4. Anything you could not do or are unsure about, and what the coordinator should check in the running game.
